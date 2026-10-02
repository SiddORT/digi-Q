import { db, appointments, patients, clinics, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { one, getSettings } from "./store";
import { sendAuthEmail } from "./auth-email";
import { validEmailAddress } from "./integration-config";
import { clinicDisplayPreferences } from "./display-preferences";
import { lockQueue } from "./appointments";
import { resolvedTemplate } from "./notification-template-store";
import { renderNotification } from "./notification-templates";

export type ConfirmationEmail = "provider_accepted" | "unavailable" | "disabled" | "no_recipient" | "not_attempted";
type Sender = (to: string, subject: string, text: string) => Promise<unknown>;

async function confirmationRecipient(patient: any, conn: any) {
  const account = patient.userId ? await one(users,patient.userId,conn) : null;
  return String(account?.email || patient.email || "").trim();
}

/** Persist known no-dispatch decisions with the booking itself, including service callers. */
export async function initialConfirmationEmail(patient: any, enabled: boolean, conn: any): Promise<ConfirmationEmail | undefined> {
  if (!enabled) return "disabled";
  if (!validEmailAddress(await confirmationRecipient(patient,conn))) return "no_recipient";
  return undefined; // Eligible email is claimed only after the booking commits.
}

export function confirmationText(row: any, clinic: any) {
  const preferences = clinicDisplayPreferences(clinic);
  const [year, month, day] = row.date.split("-");
  const date = preferences.dateFormat === "DD/MM/YYYY" ? `${day}/${month}/${year}`
    : preferences.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}`
    : preferences.dateFormat === "YYYY-MM-DD" ? row.date
    : `${day} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(month)-1]} ${year}`;
  const time = (value: string | undefined) => {
    if (!value) return "Not recorded";
    if (preferences.timeFormat === "24h") return value;
    const [hour, minute] = value.split(":");
    return `${Number(hour)%12||12}:${minute} ${Number(hour)<12?"AM":"PM"}`;
  };
  // No medical notes, receipt secret, QR bearer payload or account tokens.
  return `Your appointment is confirmed.\n\n${row.clinicName} · ${row.branchName}\nDoctor: ${row.doctorName}\nDate: ${date}\nSession: ${time(row.startTime)}–${time(row.endTime)} (${row.timezone || "timezone unavailable"})\nReference: ${row.reference}\nToken: ${row.token}\n\nKeep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.`;
}

async function saveOutcome(conn: any, id: string, outcome: ConfirmationEmail) {
  // Atomic JSON merge must not overwrite simultaneous clinical state/history.
  await conn.update(appointments).set({ data: sql`${appointments.data} || ${JSON.stringify({confirmationEmail:outcome})}::jsonb` }).where(eq(appointments.id,id));
}
async function lockConfirmation(conn: any, id: string) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"appointment-confirmation:"+id}))`);
  const original = await one(appointments,id,conn);
  // Clinical writers replace appointment JSON under this same queue lock.
  // Serialize with them so a stale transition cannot erase our dispatch claim.
  await lockQueue(conn,original.doctorId,original.branchId,original.date);
  const row = await one(appointments,id,conn);
  if (row.doctorId!==original.doctorId || row.branchId!==original.branchId || row.date!==original.date || row.startTime!==original.startTime)
    throw new Error("Appointment changed during notification preparation");
  return row;
}

/** Called only after booking commit. At-most-once dispatch, never SMTP inside the booking transaction. */
export async function confirmAppointmentEmail(id: string, conn: any = db, send: Sender = sendAuthEmail): Promise<ConfirmationEmail> {
  let claimed: { outcome: ConfirmationEmail; recipient?: string; text?: string; rendered?: ReturnType<typeof renderNotification> };
  try {
    claimed = await conn.transaction(async (tx: any) => {
      const row = await lockConfirmation(tx,id);
      if (row.confirmationEmail) return { outcome: row.confirmationEmail };
      if (["completed","cancelled","noShow"].includes(row.status)) {
        await saveOutcome(tx,id,"not_attempted"); return {outcome:"not_attempted"};
      }
      const config = await getSettings(tx,row.clinicId);
      if (!config.notificationsEnabled) {
        await saveOutcome(tx,id,"disabled"); return {outcome:"disabled"};
      }
      const patient = await one(patients,row.patientId,tx);
      const recipient = await confirmationRecipient(patient,tx);
      if (!validEmailAddress(recipient)) {
        await saveOutcome(tx,id,"no_recipient"); return {outcome:"no_recipient"};
      }
      const clinic = await one(clinics,row.clinicId,tx);
      const template = await resolvedTemplate("booking", row.clinicId, tx);
      const rendered = template.source === "default" ? undefined : renderNotification(template.content, {
        clinic_name: clinic.name, patient_name: patient.fullName || "Patient",
        doctor_name: row.doctorName || "Your doctor", appointment_details: confirmationText(row, clinic),
        reference: row.reference || "", timezone: row.timezone || "", previous_details: "",
        clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" · "),
      });
      // A crash after this durable claim remains unknown, never automatically resent.
      await saveOutcome(tx,id,"not_attempted");
      return {outcome:"not_attempted",recipient,text:confirmationText(row,clinic),rendered};
    });
  } catch {
    // The committed booking is authoritative even if notification storage is unavailable.
    return "unavailable";
  }
  if (!claimed.recipient || !claimed.text) return claimed.outcome;
  let outcome: ConfirmationEmail = "provider_accepted";
  try {
    if (claimed.rendered && send === sendAuthEmail)
      await sendAuthEmail(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, undefined, claimed.rendered);
    else await send(claimed.recipient,claimed.rendered?.subject || "DigiQ Doctors — Appointment confirmation",claimed.rendered?.text || claimed.text);
  }
  catch { outcome = "unavailable"; }
  try { await conn.transaction(async (tx: any) => { await lockConfirmation(tx,id); await saveOutcome(tx,id,outcome); }); }
  catch { return "not_attempted"; }
  return outcome;
}