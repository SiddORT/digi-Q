import { db, settings, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authorizedTemplateScope, changeActivation, resolvedTemplate } from "./notification-template-store";
import { deliveryControlCatalog } from "./notification-controls";
import { lockNotificationPreferences } from "./notification-preferences";
import { getSettings, audit } from "./store";
import { assert } from "./http";
import type { TemplateEvent, TemplateRecipient } from "./notification-templates";
import { recordNotification, notificationEntry, historyId } from "./notification-history";

const revisionId = (clinicId?: string) => `notification-policy-revision:${clinicId || "platform"}`;
async function policyRevision(conn: any, clinicId?: string) {
  const [row] = await conn.select().from(settings).where(eq(settings.id, revisionId(clinicId)));
  const stored = row?.data?.revision || 0;
  // Include the live gate, so a legacy Clinic/Platform edit invalidates a stale
  // checkbox baseline even if it did not use this new batch endpoint.
  return stored * 2 + ((await getSettings(conn, clinicId)).notificationsEnabled ? 1 : 0);
}
export async function managedNotificationSettings(user: any, clinicId?: string, conn: any = db) {
  const clinic = await authorizedTemplateScope(user, clinicId, conn);
  const catalog = await deliveryControlCatalog(conn, clinicId, clinic);
  const canActivate = user.role === "superAdmin";
  const [platform] = await conn.select().from(settings).where(eq(settings.id, "platform"));
  const inherited = clinicId ? typeof clinic?.policies?.notificationsEnabled !== "boolean" : typeof platform?.data?.notificationsEnabled !== "boolean";
  return { revision: await policyRevision(conn, clinicId), scopeName: catalog.scopeName, notificationsEnabled: !!catalog.notificationsEnabled,
    inherited, canActivate,
    // Clinic Admins have no existing activation permission. Provider details and
    // administrator-only recipient policies are not disclosed through this endpoint.
    items: canActivate ? catalog.items : catalog.items.filter(r => r.channel === "email" && r.recipient !== "superAdmin").map(r => ({
      ...r, blockedReasons: r.blockedReasons.map(reason => /SMTP|SMS|Communication/.test(reason) ? "Delivery provider is not ready; contact the platform administrator" : reason),
    })) };
}
type PolicyInput = { clinicId?: string; revision: number; notificationsEnabled?: boolean; confirmed?: boolean;
  changes: { channel: "email" | "sms"; event: string; recipient: string; revision: number; enabled: boolean }[] };
export async function saveManagedNotificationSettings(user: any, input: PolicyInput, conn: any = db) {
  await conn.transaction(async (tx: any) => {
    await lockNotificationPreferences(tx);
    const clinic = await authorizedTemplateScope(user, input.clinicId, tx);
    assert(user.role === "superAdmin" || input.changes.length === 0, 403, "Only Superadmins can change event activation");
    assert(await policyRevision(tx, input.clinicId) === input.revision, 409, "Notification policy changed. Reload before saving.");
    assert(new Set(input.changes.map(c => `${c.channel}:${c.event}:${c.recipient}`)).size === input.changes.length, 400, "Duplicate event activation");
    // Scope row locks serialize narrow gate merges with legacy full policy writers.
    if (clinic) await tx.execute(sql`select id from clinics where id = ${clinic.id} for update`);
    else {
      await tx.insert(settings).values({ id: "platform", data: {} }).onConflictDoNothing();
      await tx.execute(sql`select id from settings where id = 'platform' for update`);
    }
    await authorizedTemplateScope(user, input.clinicId, tx);
    assert(await policyRevision(tx, input.clinicId) === input.revision, 409, "Notification policy changed. Reload before saving.");
    const gate = (await getSettings(tx, input.clinicId)).notificationsEnabled;
    const activating = input.notificationsEnabled === true && !gate || input.changes.some(c => c.enabled);
    assert(!activating || input.confirmed === true, 400, "Confirm activation for this scope");
    for (const change of [...input.changes].sort((a, b) => `${a.channel}:${a.event}:${a.recipient}`.localeCompare(`${b.channel}:${b.event}:${b.recipient}`))) {
      await changeActivation(user, { ...change, event: change.event as TemplateEvent, recipient: change.recipient as TemplateRecipient, clinicId: input.clinicId }, tx);
    }
    if (input.notificationsEnabled !== undefined) {
      if (clinic) {
        await tx.execute(sql`update clinics set data = jsonb_set(data, '{policies}', coalesce(data->'policies','{}'::jsonb) || ${JSON.stringify({ notificationsEnabled: input.notificationsEnabled })}::jsonb)
          where id = ${clinic.id}`);
      } else {
        await tx.insert(settings).values({ id: "platform", data: {} }).onConflictDoNothing();
        await tx.execute(sql`update settings set data = data || ${JSON.stringify({ notificationsEnabled: input.notificationsEnabled })}::jsonb where id = 'platform'`);
      }
      await audit(user, "notification_gate", "notification_policy", { id: input.clinicId || "platform", clinicId: input.clinicId }, tx);
    }
    const revision = Math.floor(input.revision / 2) + 1, id = revisionId(input.clinicId);
    await tx.insert(settings).values({ id, data: { revision } }).onConflictDoUpdate({ target: settings.id, set: { data: { revision } } });
    // Turning a gate/event off terminally cancels matching unclaimed work; enabling
    // never turns these records pending again.
    const pending = await tx.select().from(settings).where(sql`(${settings.id} like 'mail-outbox:%' or ${settings.id} like 'sms-outbox:%')
      and ${settings.data}->>'state' = 'pending' and (${input.clinicId || null}::text is null or ${settings.data}->>'clinicId' = ${input.clinicId || null})`);
    for (const job of pending) {
      const channel = job.id.startsWith("sms-") ? "sms" : "email";
      const gateOn = (await getSettings(tx, job.data.clinicId)).notificationsEnabled;
      const template = await resolvedTemplate(job.data.event, job.data.clinicId, tx, job.data.recipientGroup, channel);
      if (!gateOn || !template.content.enabled) {
        await tx.update(settings).set({ data: { ...job.data, state: "disabled", finishedAt: Date.now() } }).where(eq(settings.id, job.id));
        await recordNotification(tx, job.data.historyKey || job.id, notificationEntry(job.data, channel), "disabled");
      }
    }
    const receipts = await tx.execute(sql`select s.id, s.data, a.clinic_id as "clinicId" from settings s
      join appointments a on s.id = 'patient-confirmation-preference:' || a.id
      where (${input.clinicId || null}::text is null or a.clinic_id = ${input.clinicId || null})`);
    for (const receipt of receipts.rows) {
      const bookingId = receipt.id.slice("patient-confirmation-preference:".length);
      const [history] = await tx.select().from(settings).where(eq(settings.id, historyId(`patient-booking:${bookingId}`)));
      if (history?.data.status !== "pending" || history.data.dispatchAt) continue;
      if (!(await getSettings(tx, receipt.clinicId)).notificationsEnabled ||
          !(await resolvedTemplate("booking", receipt.clinicId, tx, "patient", "email")).content.enabled) {
        await tx.update(settings).set({ data: { ...receipt.data, enabled: false } }).where(eq(settings.id, receipt.id));
        await recordNotification(tx, `patient-booking:${bookingId}`, { channel: "email", event: "booking", recipientGroup: "patient" }, "disabled");
      }
    }
  });
  return managedNotificationSettings(user, input.clinicId, conn);
}
