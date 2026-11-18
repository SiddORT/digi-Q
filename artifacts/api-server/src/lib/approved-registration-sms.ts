import { createHash } from "node:crypto";
import { settings, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { notificationTemplateKey, resolvedTemplate, saveTemplate } from "./notification-template-store";
import { deliveryControlCatalog } from "./notification-controls";
import { smsTemplateContent } from "./notification-templates";

/** Explicit installation data, NEVER runtime defaults or startup seeding. */
export const approvedRegistrationSms = [
  { recipient: "clinicAdmin" as const, dltTemplateId: "1777179491541503439",
    body: "Dear Clinic, Your Digi-Q clinic registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team" },
  { recipient: "patient" as const, dltTemplateId: "1777179491551752035",
    body: "Dear Clinic, Your Digi-Q patient registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team" },
] as const;
const event = "registration_mobile_otp";
const receiptId = "configuration-install:approved-registration-sms";
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) :
  v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
export const configurationDigest = (v: unknown) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
export type RegistrationSmsPlan = { version: 1; environment: string; targetFingerprint: string; baseline: string };

/** Non-secret plans contain only hashes; drafts, provider credentials and contacts never leave the process. */
export async function inspectRegistrationSms(conn: any, environment: string, targetFingerprint: string) {
  const [receipt] = await conn.select().from(settings).where(eq(settings.id, receiptId));
  const rows = [];
  const records = [];
  const controls = await deliveryControlCatalog(conn);
  for (const pair of approvedRegistrationSms) {
    const current = await resolvedTemplate(event, undefined, conn, pair.recipient, "sms");
    const exact = current.wordingPublished && current.content.body === pair.body &&
      smsTemplateContent.parse(current.content).dltTemplateId === pair.dltTemplateId;
    const untouched = !receipt && !current.local.published && current.local.activationEnabled === undefined &&
      (current.local.revision === 0 || !!current.local.draft);
    records.push([pair.recipient, current.local]);
    const control = controls.items.find(r => r.event === event && r.channel === "sms" && r.recipient === pair.recipient)!;
    rows.push({ recipient: pair.recipient, revision: current.local.revision, source: current.source,
      exact, enabled: current.content.enabled, ready: control.ready, blockedReasons: control.blockedReasons,
      draftPreserved: !!current.local.draft, action: exact ? "keep" : untouched ? "install" : "conflict" });
  }
  const plan: RegistrationSmsPlan = { version: 1, environment, targetFingerprint,
    baseline: configurationDigest({ records, receipt: receipt?.data ?? null }) };
  return { plan, rows };
}

/** All target locks are taken before inspecting; nested saveTemplate calls retain normal validation/audits.
 * Failure of either publication/readiness check rolls back BOTH pairs, drafts, receipt and audit writes. */
export async function installRegistrationSms(conn: any, actorId: string, plan: RegistrationSmsPlan,
  environment: string, targetFingerprint: string) {
  assert(plan?.version === 1 && plan.environment === environment && plan.targetFingerprint === targetFingerprint,
    409, "The configuration plan belongs to another environment or database.");
  return conn.transaction(async (tx: any) => {
    for (const id of [receiptId, ...approvedRegistrationSms.map(p => notificationTemplateKey(event, undefined, p.recipient, "sms"))].sort())
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const [actor] = await tx.select().from(users).where(eq(users.id, actorId));
    assert(actor?.role === "superAdmin" && actor.status === "active" && !actor.data?.demo && !actor.data?.demoFixture,
      403, "An active non-demo Superadmin audit actor is required.");
    const user = { ...actor, ...actor.data, id: actor.id, role: actor.role };
    const before = await inspectRegistrationSms(tx, environment, targetFingerprint);
    assert(before.plan.baseline === plan.baseline, 409, "Configuration changed since inspection. Generate a fresh check plan.");
    assert(!before.rows.some(r => r.action === "conflict"), 409,
      "An administrator changed a registration pair. Review it in Notifications; the installer will not overwrite it.");
    let installed = 0;
    for (const pair of approvedRegistrationSms) {
      if (before.rows.find(r => r.recipient === pair.recipient)!.action !== "install") continue;
      const current = await resolvedTemplate(event, undefined, tx, pair.recipient, "sms");
      await saveTemplate(user, { event, channel: "sms", recipient: pair.recipient, mode: "publish",
        revision: current.local.revision, content: { ...current.content, enabled: true,
          body: pair.body, dltTemplateId: pair.dltTemplateId } }, tx, { preserveDraft: true });
      installed++;
    }
    const after = await inspectRegistrationSms(tx, environment, targetFingerprint);
    for (const row of after.rows) {
      assert(row.exact, 409, "The saved registration pair did not match the approval.");
      if (before.rows.find(r => r.recipient === row.recipient)!.action === "install")
        assert(row.enabled && row.ready, 400, "Registration SMS prerequisites are missing; both publications were rolled back.");
    }
    if (installed) await tx.insert(settings).values({ id: receiptId, data: { version: 1, installed: true } })
      .onConflictDoNothing();
    return { installed, ...(await inspectRegistrationSms(tx, environment, targetFingerprint)) };
  });
}
