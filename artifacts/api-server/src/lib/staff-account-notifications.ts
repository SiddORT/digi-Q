import { createHash } from "node:crypto";
import { db, settings, users, clinics, branches, assignments } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getSettings } from "./store";
import { publicUrl } from "./public-website";
import { resolvedTemplate } from "./notification-template-store";
import { renderNotification, smsTemplateContent, validEventContent, type TemplateRecipient } from "./notification-templates";
import { recipientPreference, lockNotificationPreferences } from "./notification-preferences";
import { resolvedIntegration } from "./integration-vault";
import { emailNotificationsEnabled } from "./integration-config";
import { sendAuthEmail } from "./auth-email";
import { notificationSmsConfig, notificationSmsEnabled, smsPayload, sendNotificationSms } from "./notification-sms-transport";
import { emailFailure } from "./security-notifications";
import { accountRoleLabel } from "@workspace/api-zod/notification-variable-contract";
import { withStaffDispatch } from "./staff-dispatch-barrier";

type Channel = "email" | "sms";
export function verifiedContact(account: any, channel: Channel) {
  if (channel === "email") return account.emailVerifiedAt ? account.email : undefined;
  return account.mobile && account.data?.staffMobileProof?.contact === account.mobile ? account.mobile : undefined;
}
export async function staffNoticeState(conn: any, event: string, staffId: string, channel: Channel) {
  const [notice] = await conn.select().from(settings).where(eq(settings.id, `staff-account-notice:${event}:${staffId}:${channel}`));
  return notice?.data?.state || null;
}
export async function staffCreationNotice(conn: any, actorId: string, staffId: string) {
  const [occurrence] = await conn.select().from(settings).where(eq(settings.id, `staff-created:${staffId}`));
  if (occurrence?.data.actorId !== actorId) return undefined;
  return { email: await staffNoticeState(conn, "staff_created_admin", staffId, "email"),
    sms: await staffNoticeState(conn, "staff_created_admin", staffId, "sms") };
}
const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
async function account(conn: any, id: string) {
  return (await conn.select().from(users).where(eq(users.id, id)))[0];
}
async function permitted(conn: any, data: any) {
  const recipient = await account(conn, data.recipientId), subject = await account(conn, data.staffId);
  if (!recipient || !subject || recipient.status !== "active" || subject.status !== "active") return undefined;
  const contact = verifiedContact(recipient, data.channel);
  if (!contact || fingerprint(contact) !== data.contactFingerprint) return undefined;
  if (!(await getSettings(conn, data.clinicId)).notificationsEnabled) return undefined;
  const preference = await recipientPreference(conn, recipient.id, data.channel, data.event, data.preferenceEpoch);
  if (!preference.enabled) return undefined;
  const template = await resolvedTemplate(data.event, data.clinicId, conn, recipient.role as TemplateRecipient, data.channel);
  if (!template.content.enabled || template.activatedAt > data.createdAt) return undefined;
  const integration = await resolvedIntegration(data.channel === "email" ? "smtp" : "notificationSms", conn);
  if (data.channel === "email" ? !emailNotificationsEnabled(integration.env) : !notificationSmsEnabled(integration.env)) return undefined;
  return { recipient, subject, contact, template, env: integration.env };
}
async function capture(conn: any, event: "staff_created_admin" | "staff_welcome", staffId: string, recipientId: string, clinicId: string | undefined, channel: Channel) {
  const id = `staff-account-notice:${event}:${staffId}:${channel}`;
  const recipient = await account(conn, recipientId);
  const contact = recipient && verifiedContact(recipient, channel);
  const preference = await recipientPreference(conn, recipientId, channel, event);
  const data = { event, staffId, recipientId, clinicId, channel, createdAt: Date.now(),
    contactFingerprint: contact ? fingerprint(contact) : "", preferenceEpoch: preference.epoch, state: "skipped" };
  // Preserve the occurrence even when the channel is ineligible. Never replay a historical skip.
  try {
    if (await conn.transaction((tx: any) => permitted(tx, data))) data.state = "pending";
  } catch { /* A configuration failure is a durable non-send decision, not failed provisioning. */ }
  await conn.insert(settings).values({ id, data }).onConflictDoNothing();
}
export async function captureStaffCreated(conn: any, actorId: string, staffId: string, clinicIds: string[]) {
  await lockNotificationPreferences(conn);
  // One account-level occurrence; only the actual creating actor is a recipient.
  await conn.insert(settings).values({ id: `staff-created:${staffId}`, data: { actorId, staffId, clinicId: clinicIds[0] || null, createdAt: Date.now() } }).onConflictDoNothing();
  for (const channel of ["email", "sms"] as const)
    await capture(conn, "staff_created_admin", staffId, actorId, clinicIds[0], channel);
}
export async function captureStaffWelcome(conn: any, staffId: string, channel: Channel) {
  const [created] = await conn.select().from(settings).where(eq(settings.id, `staff-created:${staffId}`));
  if (!created) return; // No legacy campaign.
  await lockNotificationPreferences(conn);
  await capture(conn, "staff_welcome", staffId, staffId, created.data.clinicId || undefined, channel);
}
/** Claim before I/O. A crash or uncertain send is never retried automatically. */
export async function processStaffAccountNotifications(conn: any = db, email = sendAuthEmail, sms = sendNotificationSms) {
  const rows = await conn.select().from(settings).where(sql`${settings.id} like 'staff-account-notice:%' and ${settings.data}->>'state'='pending'`).limit(100);
  for (const row of rows) {
    const claim = await conn.transaction(async (tx: any) => {
      await lockNotificationPreferences(tx);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${row.id}))`);
      const [current] = await tx.select().from(settings).where(eq(settings.id, row.id));
      if (current?.data.state !== "pending") return undefined;
      let ready;
      try { ready = await permitted(tx, current.data); } catch { /* fail closed */ }
      const data = { ...current.data, state: ready ? "sending" : "skipped" };
      await tx.update(settings).set({ data }).where(eq(settings.id, row.id));
      return ready ? { data, ready } : undefined;
    });
    if (!claim) continue;
    let state = "pre_dispatch_failed";
    try {
      state = await withStaffDispatch([claim.data.staffId, claim.data.recipientId], "notification", async () => {
        const ready = await permitted(conn, claim.data);
        if (!ready) return "skipped";
        const owned = claim.data.clinicId ? (await conn.select().from(clinics).where(eq(clinics.id, claim.data.clinicId)))[0] : undefined;
        const mappings = await conn.select({ name: branches.data }).from(assignments).innerJoin(branches, eq(assignments.branchId, branches.id)).where(eq(assignments.userId, ready.subject.id));
        // Doctor branch membership is also projected through account assignments.
        const values = { recipient_name: ready.recipient.fullName, staff_name: ready.subject.fullName,
          role_name: accountRoleLabel(ready.subject.role), clinic_name: owned?.data.name || "",
          location_names: mappings.map((m: any) => m.name?.name || "").filter(Boolean).join(", "),
          sign_in_link: publicUrl("/sign-in") };
        if (!validEventContent(claim.data.event, ready.template.content)) return "pre_dispatch_failed";
        const rendered = renderNotification(ready.template.content, values, {event: claim.data.event});
        if (claim.data.channel === "email") {
          try {
            await email(ready.contact, rendered.subject, rendered.text, undefined, rendered, [], undefined,
              async () => { if (!await permitted(conn, claim.data)) throw Object.assign(new Error("No longer eligible"), { code: "EMAIL_PRE_DISPATCH_FAILED" }); });
            return "provider_accepted";
          } catch (error) { return emailFailure(error); }
        }
        if (!ready.template.wordingPublished) return "pre_dispatch_failed";
        const content = smsTemplateContent.parse(ready.template.content);
        try { smsPayload(notificationSmsConfig(ready.env), ready.contact, rendered.text, content); }
        catch { return "pre_dispatch_failed"; }
        return sms(ready.env, ready.contact, rendered.text, content);
      }, conn);
    } catch { /* Remain non-retryable; never risk duplicate dispatch. */ state = "delivery_unknown"; }
    await conn.update(settings).set({ data: { ...claim.data, state, completedAt: Date.now() } }).where(eq(settings.id, row.id));
  }
}
