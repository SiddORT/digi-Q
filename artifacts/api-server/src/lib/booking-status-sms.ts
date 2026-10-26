import { createHash } from "node:crypto";
import { db, appointments, patients, users, settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { canRead, roles } from "./auth";
import { one, getSettings, audit } from "./store";
import { assert } from "./http";
import { lockQueue } from "./appointments";
import { publicUrl } from "./public-website";
import { notificationPhone } from "./notification-sms-outbox";
import { resolvedTemplate } from "./notification-template-store";
import { resolvedIntegration } from "./integration-vault";
import { validEventContent, substitute, type SmsTemplateContent } from "./notification-templates";
import { lockNotificationPreferences, recipientPreference } from "./notification-preferences";
import { notificationSmsEnabled, notificationSmsReadiness, notificationSmsConfig, smsMetadataReady,
  sendNotificationSms, type SmsOutcome } from "./notification-sms-transport";
import { recordNotification, templateSnapshot } from "./notification-history";
import { withStaffDispatch } from "./staff-dispatch-barrier";
import { notificationStaffSubjects } from "./notification-staff-subjects";
import { bookingEditPermission } from "./appointment-booking-edit";

const event = "booking_status_link" as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sendInput = z.object({ requestId: z.string().uuid(), previewToken: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const active = (row: any) => ["waiting", "booked", "checkedIn", "called", "inConsultation", "noShow", "skipped"].includes(row.status);
const blocked = (reason: string, recipient = "") => ({ eligible: false, reason, recipient, message: "", previewToken: "" });

async function authorizedRow(user: any, id: string, conn: any) {
  roles(user, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  const row = await one(appointments, id, conn);
  assert(await canRead(user, "appointments", row, conn), 403, "Appointment outside your scope");
  return row;
}

/** Resolve permanent patient/account notification authority, never bookingMobile.
 * This link grants no access: the existing patient route still requires its owner to sign in. */
async function prepare(user: any, id: string, conn: any) {
  const row = await authorizedRow(user, id, conn);
  if (!(await bookingEditPermission(user, conn))(row))
    return { preview: blocked("Your administrator has disabled appointment updates and manual SMS sharing.") };
  if (!active(row)) return { preview: blocked("This visit is completed or cancelled; a booking-status SMS is not available.") };
  const patient = await one(patients, row.patientId, conn);
  const account = patient.userId ? await one(users, patient.userId, conn) : null;
  const recipient = notificationPhone(account?.mobile);
  if (!account || account.role !== "patient" || account.patientId && account.patientId !== patient.id ||
    patient.status !== "active" || account.status !== "active")
    return { preview: blocked("An active patient account owning this booking is required.") };
  if (!recipient)
    return { preview: blocked("The patient's saved account notification mobile is missing or invalid. A separate patient-record or visit number cannot be used.") };
  if (!(await recipientPreference(conn, account.id, "sms", event)).enabled ||
      !(await recipientPreference(conn, account.id, "sms", "booking")).enabled)
    return { preview: blocked("The patient has opted out of booking SMS.", recipient) };
  if (!(await getSettings(conn, row.clinicId)).notificationsEnabled)
    return { preview: blocked("Operational notifications are disabled for this clinic.", recipient) };
  let destination: string;
  try { destination = publicUrl(`/patient/queue?appointment=${encodeURIComponent(id)}`); }
  catch { return { preview: blocked("The patient booking-status website address is not configured.", recipient) }; }
  let template: Awaited<ReturnType<typeof resolvedTemplate>>;
  try { template = await resolvedTemplate(event, row.clinicId, conn, "patient", "sms"); }
  catch { return { preview: blocked("The manual booking-status SMS template is invalid. Ask Superadmin to review its approved wording and registration.", recipient) }; }
  const content = template.content as SmsTemplateContent;
  if (!template.wordingPublished || !content.enabled)
    return { preview: blocked("No enabled, published approved SMS template exists for manual booking-status links. Ask Superadmin to supply its approved wording and registration.", recipient) };
  if (!content.dltTemplateId || !validEventContent(event, content))
    return { preview: blocked("The manual booking-status SMS needs its own approved registration and booking_status_link variable. Automatic booking templates cannot be reused.", recipient) };
  const env = (await resolvedIntegration("notificationSms", conn)).env;
  if (!notificationSmsEnabled(env)) return { preview: blocked("Operational SMS is disabled by provider policy.", recipient) };
  if (!notificationSmsReadiness(env).ready)
    return { preview: blocked("The operational SMS provider is not ready. Ask Superadmin to review its configuration.", recipient) };
  const config = notificationSmsConfig(env);
  if (!smsMetadataReady(config, content))
    return { preview: blocked("Approved SMS sender or DLT registration is missing for this provider.", recipient) };
  // Manual development sends remain disabled, irrespective of automatic Preview cutovers.
  if (process.env.NODE_ENV !== "production")
    return { preview: blocked("Manual SMS delivery is disabled in development.", recipient) };
  const message = substitute(content.body, { booking_status_link: destination });
  if (!message.includes(destination) || message.length > 1600 || /[{}]/.test(message))
    return { preview: blocked("The approved message cannot be prepared within the SMS provider limits.", recipient) };
  const previewToken = hash(JSON.stringify([user.id, id, row.revision || 0, row.status, account.id, recipient,
    message, content, template.effectiveRevision, hash(JSON.stringify(env))]));
  return { preview: { eligible: true, reason: "", recipient, message, previewToken },
    row, account, env, content, template };
}

export async function bookingStatusSmsPreview(user: any, id: string, conn: any = db) {
  return (await prepare(user, id, conn)).preview;
}

/** Durable actor/appointment/request claim. A lost response or crash returns unknown
 * without replaying automatic events or retrying a possibly dispatched message. */
export async function sendBookingStatusSms(user: any, id: string, input: unknown, conn: any = db, send = sendNotificationSms) {
  const body = sendInput.parse(input);
  await authorizedRow(user, id, conn);
  const key = `manual-status-sms:${hash(`${user.id}:${id}:${body.requestId}`)}`;
  const claim = await conn.transaction(async (tx: any) => {
    const initial = await authorizedRow(user, id, tx);
    await lockQueue(tx, initial.doctorId, initial.branchId, initial.date);
    await lockNotificationPreferences(tx);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [previous] = await tx.select().from(settings).where(eq(settings.id, key));
    if (previous) {
      assert(previous.data.previewToken === body.previewToken, 409, "This request was already used for another preview.");
      return { result: { state: previous.data.state === "sending" ? "delivery_unknown" : previous.data.state,
        reason: previous.data.reason || "" } };
    }
    const current = await prepare(user, id, tx);
    if (!current.preview.eligible) return { result: { state: "blocked", reason: current.preview.reason } };
    assert(current.preview.previewToken === body.previewToken, 409, "The booking, recipient, message or delivery settings changed. Preview and confirm again.");
    // Limits are separate from automatic events and apply before a dispatch claim.
    const rateKey = `manual-status-sms-limit:${id}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${rateKey}))`);
    const [rate] = await tx.select().from(settings).where(eq(settings.id, rateKey));
    const recent = (rate?.data?.at || []).filter((at: number) => at > Date.now() - 3600000);
    if (recent.length >= 3) return { result: { state: "blocked", reason: "This booking has reached its manual SMS limit. Try again after one hour." } };
    await tx.insert(settings).values({ id: rateKey, data: { at: [...recent, Date.now()] } })
      .onConflictDoUpdate({ target: settings.id, set: { data: { at: [...recent, Date.now()] } } });
    await tx.insert(settings).values({ id: key, data: { state: "sending", previewToken: body.previewToken,
      appointmentId: id, actorId: user.id, createdAt: Date.now() } });
    await recordNotification(tx, key, { channel: "sms", event, source: "manual", clinicId: current.row!.clinicId,
      reference: current.row!.reference, recipientGroup: "patient", _sourceInput: { event, actorId: user.id,
        appointmentId: id, recipientPatientId: current.row!.patientId, snapshot: current.row } }, "sending", {
      recipient: current.preview.recipient, message: current.preview.message,
      ...templateSnapshot(current.template!, event, "patient", "sms"), dltTemplateId: current.content!.dltTemplateId,
      provider: notificationSmsConfig(current.env!).provider,
    });
    return { prepared: current };
  });
  if (claim.result) return claim.result;
  const current = claim.prepared!;
  const finish = async (state: SmsOutcome | "blocked", reason = "") => {
    await conn.update(settings).set({ data: { state, reason, previewToken: body.previewToken,
      appointmentId: id, actorId: user.id, finishedAt: Date.now() } }).where(eq(settings.id, key));
    await recordNotification(conn, key, { channel: "sms", event, source: "manual", recipientGroup: "patient" },
      state === "blocked" ? "not_attempted" : state);
    await audit(user, "sms_booking_status_link", "appointments", { id, clinicId: current.row!.clinicId }, conn);
    return { state, reason };
  };
  let enteredBarrier = false;
  try {
  // Match automatic patient notifications: guard the actor and staff represented
  // in history, not the patient account (the staff-removal barrier excludes it).
  const staffSubjects = await notificationStaffSubjects(conn, { snapshot: current.row, recipientGroup: "patient" });
  return await withStaffDispatch([...staffSubjects, user.id], "notification", async () => {
    enteredBarrier = true;
    let state: SmsOutcome | "blocked" = "delivery_unknown", reason = "";
    let providerAttempted = false;
    try {
      const final = await prepare(user, id, conn);
      if (!final.preview.eligible || final.preview.previewToken !== body.previewToken) {
        state = "blocked"; reason = final.preview.reason || "The booking or recipient changed before sending. Review again.";
      } else {
        providerAttempted = true;
        state = await send(final.env!, final.preview.recipient, final.preview.message, final.content!);
      }
    } catch {
      if (!providerAttempted) { state = "pre_dispatch_failed"; reason = "The booking or recipient could not be rechecked. No SMS was dispatched."; }
      // A provider exception is uncertain, never an automatic retry.
    }
    return finish(state, reason);
  }, conn, result => result.state === "delivery_unknown");
  } catch (error) {
    if (enteredBarrier) throw error; // Persistence after dispatch is potentially uncertain.
    return finish("pre_dispatch_failed", "The dispatch safety check could not be established. No SMS was dispatched.");
  }
}
