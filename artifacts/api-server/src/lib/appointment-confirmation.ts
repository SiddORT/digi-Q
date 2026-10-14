import { db, appointments, patients, clinics, users, settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { one, getSettings } from "./store";
import { sendAuthEmail } from "./auth-email";
import { validEmailAddress, emailNotificationsEnabled, smtpConfig } from "./integration-config";
import { resolvedIntegration } from "./integration-vault";
import { recordNotification, recordDecision, notificationEntry, historyId, templateSnapshot } from "./notification-history";
import { formatTemplateSession, visitTemplateValues, missingVisitVariables } from "./notification-template-values";
import { lockQueue } from "./appointments";
import { resolvedTemplate } from "./notification-template-store";
import { renderNotification } from "./notification-templates";

export type ConfirmationEmail = "provider_accepted" | "unavailable" | "disabled" | "no_recipient" | "not_attempted";
type Sender = (to: string, subject: string, text: string) => Promise<unknown>;

/** Called at actual booking creation only; idempotent booking retries do not recapture. */
export async function capturePatientConfirmation(conn: any, row: any) {
  const entry=notificationEntry({event:"booking",clinicId:row.clinicId,snapshot:row,recipientGroup:"patient"},"email");
  try {
    const patient=await one(patients,row.patientId,conn);
    const template=await resolvedTemplate("booking",row.clinicId,conn);
    const env=(await resolvedIntegration("smtp",conn)).env;
    const recipient=await confirmationRecipient(patient,conn);
    let ready=true;try{smtpConfig(env);}catch{ready=false;}
    const status=!(await getSettings(conn,row.clinicId)).notificationsEnabled||!template.content.enabled||!emailNotificationsEnabled(env)?"disabled":
      !validEmailAddress(recipient)?"no_recipient":!ready?"configuration_failed":
      process.env.NODE_ENV==="development"?"not_attempted":"pending";
    await recordDecision(conn,`patient-booking:${row.id}`,entry,status,{...templateSnapshot(template,"booking","patient","email"),recipient:recipient||undefined,provider:"smtp"});
  }catch{await recordDecision(conn,`patient-booking:${row.id}`,entry,"preparation_failed");}
}

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
  const { date, start, end } = formatTemplateSession(row, clinic);
  // No medical notes, receipt secret, QR bearer payload or account tokens.
  return `Your appointment is confirmed.\n\n${row.clinicName} · ${row.branchName}\nDoctor: ${row.doctorName}\nDate: ${date}\nSession: ${start || "Not recorded"}–${end || "Not recorded"} (${row.timezone || "timezone unavailable"})\nReference: ${row.reference}\nToken: ${row.token}\nClinic contact: ${[clinic.email, clinic.phone].filter(Boolean).join(" · ") || "Contact reception at the clinic"}\n\nKeep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.`;
}

async function saveOutcome(conn: any, id: string, outcome: ConfirmationEmail, dispatchOutcome?: "provider_accepted" | "provider_rejected" | "pre_dispatch_failed" | "delivery_unknown") {
  // Atomic JSON merge must not overwrite simultaneous clinical state/history.
  await conn.update(appointments).set({ data: sql`${appointments.data} || ${JSON.stringify({confirmationEmail:outcome,...(dispatchOutcome?{confirmationDispatchOutcome:dispatchOutcome}:{})})}::jsonb` }).where(eq(appointments.id,id));
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
export async function confirmAppointmentEmail(id: string, conn: any = db, send?: Sender): Promise<ConfirmationEmail> {
  const sender=send||sendAuthEmail;
  let claimed: { outcome: ConfirmationEmail; recipient?: string; text?: string; rendered?: ReturnType<typeof renderNotification>; env?: NodeJS.ProcessEnv; historyEntry?: any };
  try {
    claimed = await conn.transaction(async (tx: any) => {
      const row = await lockConfirmation(tx,id);
      const [history]=await tx.select().from(settings).where(eq(settings.id,historyId(`patient-booking:${id}`)));
      const entry=history?notificationEntry({event:"booking",clinicId:row.clinicId,snapshot:row,recipientGroup:"patient"},"email"):undefined;
      const log=async(state:any)=>{if(entry)await recordNotification(tx,`patient-booking:${id}`,entry,state);};
      // A previous claim is authoritative; never regress its outcome during a retry.
      if(row.confirmationEmail){
        if(entry&&!history.data.dispatchAt)await log(row.confirmationEmail==="unavailable"?"configuration_failed":row.confirmationEmail);
        return {outcome:row.confirmationEmail};
      }
      if (["completed","cancelled","noShow"].includes(row.status)) {
        await log("obsolete");
        await saveOutcome(tx,id,"not_attempted"); return {outcome:"not_attempted"};
      }
      const config = await getSettings(tx,row.clinicId);
      if (!config.notificationsEnabled) {
        await log("disabled");
        await saveOutcome(tx,id,"disabled"); return {outcome:"disabled"};
      }
      const patient = await one(patients,row.patientId,tx);
      const patientAccount=patient.userId?await one(users,patient.userId,tx):null;
      if(patient.status!=="active"||(patientAccount&&patientAccount.status!=="active")){
        await log("obsolete");await saveOutcome(tx,id,"not_attempted");return {outcome:"not_attempted"};
      }
      const recipient = await confirmationRecipient(patient,tx);
      if (!validEmailAddress(recipient)) {
        await log("no_recipient");
        await saveOutcome(tx,id,"no_recipient"); return {outcome:"no_recipient"};
      }
      const clinic = await one(clinics,row.clinicId,tx);
      const template = await resolvedTemplate("booking", row.clinicId, tx);
      const env=(await resolvedIntegration("smtp",tx)).env;
      if (!template.content.enabled || !emailNotificationsEnabled(env) || (history && template.activatedAt > history.data.createdAt)) {
        await log("disabled");
        await saveOutcome(tx,id,"disabled"); return {outcome:"disabled"};
      }
      // Ordinary automatic sends are production-only. Isolated tests inject a fake
      // sender; explicitly confirmed administrator tests use their separate endpoint.
      if(!send&&process.env.NODE_ENV!=="production"){
        await log("not_attempted");
        await saveOutcome(tx,id,"not_attempted","pre_dispatch_failed");return {outcome:"not_attempted"};
      }
      const values = {
        ...visitTemplateValues(row, clinic, patient.fullName || patientAccount?.fullName || ""),
        clinic_name: clinic.name, patient_name: patient.fullName || "Patient",
        doctor_name: row.doctorName || "Your doctor", appointment_details: confirmationText(row, clinic),
        reference: row.reference || "", timezone: row.timezone || "", previous_details: "",
        clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" · "),
      };
      if (template.source !== "default" && missingVisitVariables([template.content.subject, template.content.body, template.content.prefix, template.content.footer], values).length) {
        await log("preparation_failed");
        await saveOutcome(tx,id,"unavailable","pre_dispatch_failed");
        return {outcome:"unavailable"};
      }
      // Published wording cannot remove the committed ticket. Keep custom wording
      // intact and append a non-editable factual ticket block when not using details.
      const rendered = template.source === "default" ? undefined : renderNotification({
        ...template.content,body:template.content.body + (/\{\{\s*appointment_details\s*\}\}/.test(template.content.body) ? "" : "\n\n{{appointment_details}}")
      }, values);
      let cfg;
      try{cfg=smtpConfig(env);}catch{
        await log("configuration_failed");
        await saveOutcome(tx,id,"unavailable","pre_dispatch_failed");
        return {outcome:"unavailable"};
      }
      if(entry)await recordNotification(tx,`patient-booking:${id}`,entry,"sending",{
        sender:cfg.from,recipient,subject:rendered?.subject||"DigiQ Doctors — Appointment confirmation",
        message:rendered?.text||confirmationText(row,clinic),provider:"smtp",
        ...templateSnapshot(template,"booking","patient","email"),
      },[cfg.password]);
      // A crash after this durable claim remains unknown, never automatically resent.
      await saveOutcome(tx,id,"not_attempted","delivery_unknown");
      return {outcome:"not_attempted",recipient,text:confirmationText(row,clinic),rendered,env,historyEntry:entry};
    });
  } catch {
    // The committed booking is authoritative even if notification storage is unavailable.
    return "unavailable";
  }
  if (!claimed.recipient || !claimed.text) return claimed.outcome;
  let outcome: ConfirmationEmail = "provider_accepted";
  let dispatchOutcome: "provider_accepted" | "provider_rejected" | "pre_dispatch_failed" | "delivery_unknown" = "provider_accepted";
  try {
    if (sender === sendAuthEmail)
      await sendAuthEmail(claimed.recipient, claimed.rendered?.subject||"DigiQ Doctors — Appointment confirmation", claimed.rendered?.text||claimed.text, undefined, claimed.rendered, [], claimed.env);
    else await sender(claimed.recipient,claimed.rendered?.subject || "DigiQ Doctors — Appointment confirmation",claimed.rendered?.text || claimed.text);
  }
  catch(error:any) {
    outcome = "unavailable";
    dispatchOutcome=error?.code==="EMAIL_UNCONFIGURED"||error?.code==="EMAIL_PRE_DISPATCH_FAILED"?"pre_dispatch_failed":
      error?.code==="EMAIL_REJECTED"?"provider_rejected":"delivery_unknown";
  }
  try { await conn.transaction(async (tx: any) => { await lockConfirmation(tx,id); await saveOutcome(tx,id,outcome,dispatchOutcome); }); }
  catch { return "not_attempted"; }
  if(claimed.historyEntry)await recordNotification(conn,`patient-booking:${id}`,claimed.historyEntry,dispatchOutcome);
  return outcome;
}