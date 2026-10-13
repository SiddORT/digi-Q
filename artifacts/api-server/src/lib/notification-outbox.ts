import { db, settings, appointments, clinics, patients, users, doctors, assignments } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { one, getSettings } from "./store";
import { templateRecipients, defaultRecipient, renderNotification, type TemplateEvent } from "./notification-templates";
import { isClinicalMember } from "./clinical-membership";
import { resolvedTemplate } from "./notification-template-store";
import { sendAuthEmail } from "./auth-email";
import { confirmationText } from "./appointment-confirmation";
import { validEmailAddress, emailNotificationsEnabled, smtpConfig } from "./integration-config";
import { recordNotification, recordDecision, claimNotificationOccurrence, notificationEntry, templateSnapshot, cleanupNotificationHistory } from "./notification-history";
import { logger } from "./logger";
import { resolvedIntegration } from "./integration-vault";
import { createHash } from "node:crypto";
import { assert } from "./http";
import { previousSessionSnapshot, visitTemplateValues, missingVisitVariables } from "./notification-template-values";
import { validTemplateTarget } from "./notification-templates";
const emailKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/** Explicit safe projection only: never return an outbox payload or recipient identifiers. */
export async function listOwnerBookingMailOutcomes(user: any, clinicId: string, page = 1, pageSize = 20, conn: any = db) {
  assert(user.role === "clinicAdmin", 403, "Only the owning Clinic Admin can view booking email outcomes");
  const [clinic] = await conn.select({ id: clinics.id }).from(clinics)
    .where(sql`${clinics.id} = ${clinicId} and ${clinics.adminId} = ${user.id}`);
  assert(clinic && user.clinicIds.includes(clinicId) && (!user.activeClinicId || user.activeClinicId === clinicId),
    403, "You are not the current owner of this clinic workspace");
  // Ownership is also checked in the read, so a concurrent transfer cannot disclose stale scope.
  const result = await conn.execute(sql`
    select s.data->'snapshot'->>'reference' as reference, s.data->>'state' as status,
      s.data->>'createdAt' as "createdAt"
    from settings s join clinics c on c.id = s.data->>'clinicId' and c.admin_id = ${user.id}
    where c.id = ${clinicId} and s.id like 'mail-outbox:booking:%'
      and s.data->>'event' = 'booking' and s.data->>'recipientGroup' = 'clinicAdmin'
    order by (s.data->>'createdAt')::bigint desc nulls last, s.id desc
    limit ${pageSize + 1} offset ${(page - 1) * pageSize}`);
  const statuses = new Set(["pending", "sending", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown",
    "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient"]);
  return {
    items: result.rows.slice(0, pageSize).map((row: any) => ({
      reference: row.reference || null,
      status: statuses.has(row.status) ? row.status : "unknown",
      createdAt: row.createdAt && Number.isSafeInteger(Number(row.createdAt)) ? Number(row.createdAt) : null,
    })),
    hasMore: result.rows.length > pageSize,
  };
}

// Existing PostgreSQL JSON settings store provides durable rows without a production migration.
export async function enqueueEvent(conn: any, event: TemplateEvent, row: any, previousDetails: any = "") {
  if(event==="patient_login_otp")return;
  if(event==="booking"){
    const {capturePatientConfirmation}=await import("./appointment-confirmation");
    await capturePatientConfirmation(conn,row);
  }
  if(process.env.NODE_ENV==="development"){
    for(const channel of ["email","sms"] as const){
      if(!await claimNotificationOccurrence(conn,channel,event,row))continue;
      for(const group of templateRecipients){
      if(!validTemplateTarget(event,group,channel)||(channel==="email"&&event==="booking"&&group==="patient"))continue;
      await recordDecision(conn,`${channel}-decision:${event}:${row.id}:${row.revision||0}:${group}:development`,notificationEntry({event,clinicId:row.clinicId,snapshot:row,recipientGroup:group},channel),"not_attempted");
      }
    }
    return;
  }
  const previousSession = previousSessionSnapshot(previousDetails);
  if (previousSession) previousDetails = confirmationText(previousDetails, await one(clinics, row.clinicId, conn)).replace("Your appointment is confirmed.", "Previous visit details:");
  // Each channel has its own savepoint. Both successful preparations survive
  // failures in the other channel and still commit atomically with the visit.
  try {
    const {enqueueSmsEvent}=await import("./notification-sms-outbox");
    await conn.transaction((tx:any)=>enqueueSmsEvent(tx,event,row,previousDetails,previousSession));
  } catch {
    logger.warn("SMS event preparation unavailable; visit and email retained");
    await conn.transaction((tx:any)=>claimNotificationOccurrence(tx,"sms",event,row)).catch(()=>false);
    for(const group of templateRecipients) if(validTemplateTarget(event,group,"sms"))
      await recordDecision(conn,`sms-decision:${event}:${row.id}:${row.revision||0}:${group}:preparation`,notificationEntry({event,clinicId:row.clinicId,snapshot:row,recipientGroup:group},"sms"),"preparation_failed");
  }
  try {
    await conn.transaction((tx:any)=>enqueueEmailEvent(tx,event,row,previousDetails,previousSession));
  } catch {
    logger.warn("Email event preparation unavailable; visit and SMS retained");
    await conn.transaction((tx:any)=>claimNotificationOccurrence(tx,"email",event,row)).catch(()=>false);
    for(const group of templateRecipients) if(validTemplateTarget(event,group,"email")&&(event!=="booking"||group!=="patient"))
      await recordDecision(conn,`email-decision:${event}:${row.id}:${row.revision||0}:${group}:preparation`,notificationEntry({event,clinicId:row.clinicId,snapshot:row,recipientGroup:group},"email"),"preparation_failed");
  }
}
async function enqueueEmailEvent(conn:any,event:TemplateEvent,row:any,previousDetails:string,previousSession?:any) {
  if(event==="patient_login_otp")return;
  if(!await claimNotificationOccurrence(conn,"email",event,row))return;
  const env=(await resolvedIntegration("smtp",conn)).env;
  const gate=(await getSettings(conn,row.clinicId)).notificationsEnabled;
  let configured=true;
  try{smtpConfig(env);}catch{configured=false;}
  const usedEmails = new Set<string>();
  if (row.patientId && (await resolvedTemplate(event, row.clinicId, conn, "patient")).content.enabled) {
    const patient = await one(patients, row.patientId, conn);
    const account = patient.userId ? await one(users, patient.userId, conn) : null;
    usedEmails.add(String(account?.email || patient.email || "").trim().toLowerCase());
  }
  for (const group of templateRecipients) {
  if (!validTemplateTarget(event,group,"email")) continue;
  if (event === "booking" && group === "patient") continue; // Existing confirmation claim owns this recipient.
  const template = await resolvedTemplate(event, row.clinicId, conn, group);
  const primary = group === defaultRecipient(event);
  let targets: any[] = [null];
  if (!primary) {
    if (group === "superAdmin") targets = await conn.select().from(users).where(eq(users.role,"superAdmin"));
    if (group === "clinicAdmin") targets = [await one(users, (await one(clinics, row.clinicId, conn)).adminId, conn)];
    if (group === "doctor") targets = row.doctorId ? [await one(users, (await one(doctors, row.doctorId, conn)).userId, conn)] : [];
    if (group === "receptionist") {
      const links = await conn.select().from(assignments).where(eq(assignments.clinicId, row.clinicId));
      targets = [];
      for (const link of links) if (!link.branchId || link.branchId === row.branchId) {
        const account = await one(users, link.userId, conn);
        if (account.role === "receptionist") targets.push(account);
      }
    }
  }
  for (const target of targets.length?targets:[null]) {
  let email="";
  let active=true;
  if (target) {
    email = String(target.email || "").trim().toLowerCase();
  }else if(primary){
    if(row.patientId){
      const patient=await one(patients,row.patientId,conn);
      const account=patient.userId?await one(users,patient.userId,conn):null;
      email=String(account?.email||patient.email||"").trim().toLowerCase();
      active=patient.status==="active"&&(!account||account.status==="active");
    }else email=String((await one(users,(await one(clinics,row.clinicId,conn)).adminId,conn)).email||"").trim().toLowerCase();
  }
  const decision=`email-decision:${event}:${row.id}:${row.revision||0}:${group}:${target?.id||"primary"}`;
  const entry=notificationEntry({event,clinicId:row.clinicId,snapshot:row,recipientGroup:group},"email");
  const status=!gate||!emailNotificationsEnabled(env)||!template.content.enabled?"disabled":!configured?"configuration_failed":
    !active||(target&&target.status!=="active")||!validEmailAddress(email)?"no_recipient":
    target&&usedEmails.has(email)?"not_attempted":null;
  if(status){await recordDecision(conn,decision,entry,status,{...templateSnapshot(template,event,group,"email"),recipient:email||undefined,provider:"smtp"});continue;}
  usedEmails.add(email);
  const id = `mail-outbox:${event}:${row.id}:${row.revision || 0}`;
  const createdAt=Date.now();
  await conn.insert(settings).values({ id: primary ? id : `${id}:recipient:${emailKey(target.email)}`, data: {
    historyKey:decision,
    recipientGroup: group, recipientUserId: target?.id,
    recipientEmailKey: target ? emailKey(target.email) : undefined,
    event, appointmentId: event === "onboarding" ? undefined : row.id, clinicId: row.clinicId,
    previousDetails, previousSession, snapshot: row, state: "pending", attempts: 0, dueAt: createdAt, createdAt,
  } }).onConflictDoNothing();
  await recordDecision(conn,decision,{...entry,createdAt,dueAt:createdAt},"pending");
  }
  }
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
/** Scheduling is narrow; an already-queued reminder may tolerate a short
 * worker/commit delay. The current row still supplies status, check-in state,
 * session date/time and timezone. No new jobs are captured in this allowance.
 */
export function reminderDispatchEligible(row:any,now=Date.now()){
  for(let delay=0;delay<=5;delay++)if(reminderDue(row,now-delay*60000))return true;
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
      try { due = reminderDue(row, now); } catch { logger.warn("Reminder skipped: invalid session timing"); }
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
      const update = async (patch: any) => {
        await tx.update(settings).set({ data: { ...data, ...patch } }).where(eq(settings.id, record.id));
        if(patch.state) await recordNotification(tx,data.historyKey||record.id,notificationEntry(data,"email"),patch.state,undefined,[],now);
      };
      if (!(await getSettings(tx, data.clinicId)).notificationsEnabled ||
          !emailNotificationsEnabled((await resolvedIntegration("smtp", tx)).env)) { await update({ state: "disabled" }); return null; }
      const clinic = await one(clinics, data.clinicId, tx);
      const current = data.appointmentId ? await one(appointments, data.appointmentId, tx) : null;
      if (data.appointmentId && !current) { await update({ state: "obsolete" }); return null; }
      if(current && ((current.revision||0)!==(data.snapshot.revision||0) ||
        (data.event==="cancelled" ? current.status!=="cancelled" : data.event==="completed" ? current.status!=="completed" : !["waiting","booked"].includes(current.status)))) {
        await update({state:"obsolete"});return null;
      }
      if (data.event === "reminder" && (!current || !reminderDispatchEligible(current, now) || current.revision !== data.snapshot.revision)) {
        await update({ state: "obsolete" }); return null;
      }
      let recipient: string, recipientName = "", patient: any = null;
      if (current) {
        patient = await one(patients, current.patientId, tx);
        const account = patient.userId ? await one(users, patient.userId, tx) : null;
        if(patient.status!=="active"||(account&&account.status!=="active")){await update({state:"obsolete"});return null;}
        recipient = account?.email || patient.email || "";
        recipientName = patient.fullName || account?.fullName || "";
      } else {
        const account = await one(users, clinic.adminId, tx);
        recipient = account.email || "";
        recipientName = account.fullName || "";
      }
      if (data.recipientUserId) {
        const account = await one(users, data.recipientUserId, tx);
        let member = data.recipientGroup === "clinicAdmin" && clinic.adminId === account.id;
        if(data.recipientGroup==="superAdmin") member=data.event==="onboarding"&&account.role==="superAdmin";
        if (data.recipientGroup === "doctor" && current?.doctorId) {
          const doctor=await one(doctors,current.doctorId,tx);
          member=doctor.userId===account.id&&doctor.ownerAdminId===clinic.adminId&&!!current.branchId&&
            await isClinicalMember(doctor.id,current.branchId,tx);
        }
        if (data.recipientGroup === "receptionist") {
          const links = await tx.select().from(assignments).where(eq(assignments.userId, account.id));
          member = account.role === "receptionist" && links.some((l: any) => l.clinicId === data.clinicId && (!l.branchId || l.branchId === current?.branchId));
        }
        if (!member || account.status !== "active") { await update({ state: "obsolete" }); return null; }
        recipient = account.email || "";
        recipientName = account.fullName || "";
        if (data.recipientEmailKey && emailKey(recipient) !== data.recipientEmailKey) { await update({ state: "obsolete" }); return null; }
      }
      if (!validEmailAddress(recipient)) { await update({ state: "no_recipient" }); return null; }
      const template = await resolvedTemplate(data.event, data.clinicId, tx, data.recipientGroup || defaultRecipient(data.event));
      if (!template.content.enabled || template.activatedAt > data.createdAt) { await update({ state: "disabled" }); return null; }
      const row = data.snapshot;
      const values = { ...visitTemplateValues(current?row:null,clinic,recipientName,data.previousSession),
        clinic_name: clinic.name, patient_name: patient?.fullName || "", doctor_name: row.doctorName || "",
        appointment_details: current ? confirmationText(row, clinic).replace("Your appointment is confirmed.", "Visit details:") : "",
        previous_details: data.previousDetails || "", reference: row.reference || "", timezone: row.timezone || clinic.timezone || "", clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" · ") };
      if(missingVisitVariables([template.content.subject,template.content.body,template.content.prefix,template.content.footer],values).length){
        await update({state:"preparation_failed"});return null;
      }
      const rendered = renderNotification(template.content, values);
      const env=(await resolvedIntegration("smtp",tx)).env;
      let cfg;
      try{cfg=smtpConfig(env);}catch{await update({state:"configuration_failed"});return null;}
      await recordNotification(tx,data.historyKey||record.id,notificationEntry(data,"email"),"sending",{
        sender:cfg.from,recipient,subject:rendered.subject,message:rendered.text,provider:"smtp",
        ...templateSnapshot(template,data.event,data.recipientGroup||defaultRecipient(data.event),"email"),
      },[cfg.password],now);
      // Durable dispatch claim. A crash/timeout after this point is unknown, never blindly retried.
      await update({ state: "sending", claimedAt: now, attempts: data.attempts + 1 });
      return { recipient, rendered, data, env };
    });
    if (!claimed) continue;
    let state = "provider_accepted";
    try { await send(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, undefined, claimed.rendered, [], claimed.env); }
    catch (error: any) {
      state = error?.code === "EMAIL_REJECTED" ? "provider_rejected" : error?.code === "EMAIL_PRE_DISPATCH_FAILED" ? "pre_dispatch_failed" : error?.code === "EMAIL_UNCONFIGURED"
        ? claimed.data.attempts < 4 ? "pending" : "configuration_failed"
        : "delivery_unknown";
    }
    const completed={...claimed.data,state,claimedAt:now,attempts:claimed.data.attempts+1,dueAt:now+60000*2**claimed.data.attempts,finishedAt:Date.now()};
    await conn.update(settings).set({ data: completed }).where(eq(settings.id, record.id));
    await recordNotification(conn,claimed.data.historyKey||record.id,notificationEntry(completed,"email"),state as any);
    } catch {
      // Preparation failures remain pending and retry next tick; one bad item must not block other clinics.
      // If dispatch was already claimed, its state remains sending and is never automatically resent.
      logger.warn("Notification item failed; durable dispatch state retained");
      await conn.transaction(async (tx: any) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${record.id}))`);
        const [latest] = await tx.select().from(settings).where(eq(settings.id, record.id));
        if (latest?.data.state !== "pending") return;
        const attempts = (latest.data.attempts || 0) + 1;
        const next={...latest.data,attempts,state:attempts>=5?"preparation_failed":"pending",dueAt:now+60000*2**attempts};
        await tx.update(settings).set({ data: next }).where(eq(settings.id, record.id));
        await recordNotification(tx,latest.data.historyKey||record.id,notificationEntry(latest.data,"email"),"preparation_failed");
        if(attempts<5)await recordNotification(tx,latest.data.historyKey||record.id,notificationEntry(next,"email"),"pending");
      });
    }
  }
}
export function startNotificationWorker() {
  // Development never sends automatically. Production follows each clinic's explicit notifications setting.
  if (process.env.NODE_ENV !== "production") return;
  let busy = false, smsBusy = false;
  const tick = () => {
    // Separate busy gates: a slow/failed provider must not delay the other channel's
    // next poll. Per-record durable claims still protect multiple server instances.
    if(!busy){busy=true;void processNotifications().then(()=>cleanupNotificationHistory()).catch(()=>logger.warn("Email worker failed; pending work retained")).finally(()=>{busy=false;});}
    if(!smsBusy){
      smsBusy=true;
      void import("./notification-sms-outbox").then(m=>m.processSmsNotifications())
        .catch(()=>logger.warn("SMS worker failed; pending work retained")).finally(()=>{smsBusy=false;});
    }
  };
  const timer = setInterval(() => void tick(), 30000); timer.unref();
}