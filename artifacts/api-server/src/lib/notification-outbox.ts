import { db, settings, appointments, clinics, patients, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { one, getSettings } from "./store";
import { templateEvents, renderNotification, type TemplateEvent } from "./notification-templates";
import { resolvedTemplate } from "./notification-template-store";
import { sendAuthEmail } from "./auth-email";
import { confirmationText } from "./appointment-confirmation";
import { validEmailAddress } from "./integration-config";

// Existing PostgreSQL JSON settings store provides durable rows without a production migration.
export async function enqueueEvent(conn: any, event: TemplateEvent, row: any, previousDetails: any = "") {
  if (!(await getSettings(conn, row.clinicId)).notificationsEnabled) return;
  if (typeof previousDetails === "object") previousDetails = confirmationText(previousDetails, await one(clinics, row.clinicId, conn)).replace("Your appointment is confirmed.", "Previous visit details:");
  const id = `mail-outbox:${event}:${row.id}:${row.revision || 0}`;
  await conn.insert(settings).values({ id, data: {
    event, appointmentId: event === "onboarding" ? undefined : row.id, clinicId: row.clinicId,
    previousDetails, snapshot: row, state: "pending", attempts: 0, dueAt: Date.now(), createdAt: Date.now(),
  } }).onConflictDoNothing();
}
export function reminderDue(row: any, now = Date.now()) {
  if (!row.date || !row.startTime || !row.timezone || !["waiting", "booked"].includes(row.status) || row.checkedInAt) return false;
  const local = (instant: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  // Compare actual instants in the session timezone: no machine-timezone assumptions or guessed DST offset.
  const target = `${row.date}T${row.startTime}`;
  for (let minute = 59; minute <= 60; minute++) if (local(now + minute * 60000) === target) return true;
  return false;
}
export async function processNotifications(conn: any = db, send: typeof sendAuthEmail = sendAuthEmail, now = Date.now()) {
  // One PostgreSQL scheduler per deployment, including when several web replicas run.
  const acquired = await conn.transaction(async (tx: any) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('notification-scheduler')) as acquired`);
    if (!lock.rows[0]?.acquired) return false;
    const from = new Date(now - 86400000).toISOString().slice(0, 10), to = new Date(now + 172800000).toISOString().slice(0, 10);
    const rows = await tx.select().from(appointments).where(sql`${appointments.status} in ('waiting','booked') and ${appointments.date} between ${from} and ${to}`);
    for (const raw of rows) {
      const row = { ...raw.data, ...raw };
      let due = false;
      try { due = reminderDue(row, now); } catch { console.error("Reminder skipped: invalid session timing"); }
      if (due) await enqueueEvent(tx, "reminder", row);
    }
    return true;
  });
  if (!acquired) return;
  const candidates = await conn.select().from(settings).where(sql`${settings.id} like 'mail-outbox:%' and ${settings.data}->>'state' = 'pending' and (${settings.data}->>'dueAt')::bigint <= ${now}`).limit(100);
  for (const record of candidates) {
    try {
    const claimed = await conn.transaction(async (tx: any) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${record.id}))`);
      const [fresh] = await tx.select().from(settings).where(eq(settings.id, record.id));
      const data = fresh.data;
      if (data.state !== "pending" || data.dueAt > now) return null;
      const update = async (patch: any) => tx.update(settings).set({ data: { ...data, ...patch } }).where(eq(settings.id, record.id));
      if (!(await getSettings(tx, data.clinicId)).notificationsEnabled) { await update({ state: "disabled" }); return null; }
      const clinic = await one(clinics, data.clinicId, tx);
      const current = data.appointmentId ? await one(appointments, data.appointmentId, tx) : null;
      if (data.event === "reminder" && (!current || !reminderDue(current, now) || current.revision !== data.snapshot.revision)) {
        await update({ state: "obsolete" }); return null;
      }
      let recipient: string, patient: any = null;
      if (current) {
        patient = await one(patients, current.patientId, tx);
        const account = patient.userId ? await one(users, patient.userId, tx) : null;
        recipient = account?.email || patient.email || "";
      } else recipient = (await one(users, clinic.adminId, tx)).email || "";
      if (!validEmailAddress(recipient)) { await update({ state: "no_recipient" }); return null; }
      const template = await resolvedTemplate(data.event, data.clinicId, tx);
      const row = data.snapshot;
      const rendered = renderNotification(template.content, { clinic_name: clinic.name, patient_name: patient?.fullName || "", doctor_name: row.doctorName || "",
        appointment_details: current ? confirmationText(row, clinic).replace("Your appointment is confirmed.", "Visit details:") : "",
        previous_details: data.previousDetails || "", reference: row.reference || "", timezone: row.timezone || clinic.timezone || "", clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" · ") });
      // Durable dispatch claim. A crash/timeout after this point is unknown, never blindly retried.
      await update({ state: "sending", claimedAt: now, attempts: data.attempts + 1 });
      return { recipient, rendered, data };
    });
    if (!claimed) continue;
    let state = "provider_accepted";
    try { await send(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, undefined, claimed.rendered); }
    catch (error: any) {
      state = error?.code === "EMAIL_UNCONFIGURED"
        ? claimed.data.attempts < 4 ? "pending" : "configuration_failed"
        : "delivery_unknown";
    }
    await conn.update(settings).set({ data: { ...claimed.data, state, attempts: claimed.data.attempts + 1, dueAt: now + 60000 * 2 ** claimed.data.attempts, finishedAt: Date.now() } }).where(eq(settings.id, record.id));
    } catch {
      // Preparation failures remain pending and retry next tick; one bad item must not block other clinics.
      // If dispatch was already claimed, its state remains sending and is never automatically resent.
      console.error("Notification item failed; durable dispatch state retained");
      await conn.transaction(async (tx: any) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${record.id}))`);
        const [latest] = await tx.select().from(settings).where(eq(settings.id, record.id));
        if (latest?.data.state !== "pending") return;
        const attempts = (latest.data.attempts || 0) + 1;
        await tx.update(settings).set({ data: { ...latest.data, attempts, state: attempts >= 5 ? "preparation_failed" : "pending", dueAt: now + 60000 * 2 ** attempts } }).where(eq(settings.id, record.id));
      });
    }
  }
}
export function startNotificationWorker() {
  // Development never sends automatically. Production follows each clinic's explicit notifications setting.
  if (process.env.NODE_ENV !== "production") return;
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await processNotifications(); } catch { console.error("Notification worker failed; pending work retained"); } finally { busy = false; } };
  const timer = setInterval(() => void tick(), 30000); timer.unref();
}