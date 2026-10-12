import { db, settings, clinics, appointments, patients, users, doctors, assignments } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { one, getSettings, flatten } from "./store";
import { isClinicalMember } from "./clinical-membership";
import { templateRecipients, substitute, type TemplateEvent, type TemplateRecipient, type SmsTemplateContent } from "./notification-templates";
import { resolvedTemplate } from "./notification-template-store";
import { resolvedIntegration } from "./integration-vault";
import { notificationSmsReadiness, notificationSmsEnabled, sendNotificationSms } from "./notification-sms-transport";
import { confirmationText } from "./appointment-confirmation";
import { reminderDispatchEligible } from "./notification-outbox";

const phoneKey=(phone:string)=>createHash("sha256").update(phone).digest("hex");
export function notificationPhone(value:unknown) {
  const raw=String(value||"").trim();
  if(!raw)return "";
  try {const phone=parsePhoneNumberFromString(raw,"IN");return phone?.isValid()?phone.number:"";}catch{return "";}
}
async function targetAccounts(conn:any,group:TemplateRecipient,row:any,clinic:any) {
  if(group==="clinicAdmin") return [await one(users,clinic.adminId,conn)];
  if(group==="doctor") {
    if(!row.doctorId)return [];
    const doctor=await one(doctors,row.doctorId,conn);
    if(doctor.ownerAdminId!==clinic.adminId||!row.branchId||!await isClinicalMember(doctor.id,row.branchId,conn))return [];
    return [await one(users,doctor.userId,conn)];
  }
  if(group==="patient") {
    if(!row.patientId)return [];
    const patient=await one(patients,row.patientId,conn);
    const account=patient.userId?await one(users,patient.userId,conn):null;
    return [{...patient, mobile:account?.mobile||patient.mobile, targetPatientId:patient.id,
      status:patient.status==="active"&&(!account||account.status==="active")?"active":"inactive"}];
  }
  const links=await conn.select().from(assignments).where(eq(assignments.clinicId,row.clinicId));
  const targets=[];
  for(const link of links) if(!link.branchId||link.branchId===row.branchId) {
    const account=await one(users,link.userId,conn);
    if(account.role==="receptionist")targets.push(account);
  }
  return targets;
}
export async function enqueueSmsEvent(conn:any,event:TemplateEvent,row:any,previousDetails:string="") {
  const env=(await resolvedIntegration("notificationSms",conn)).env;
  if(!notificationSmsEnabled(env)||!notificationSmsReadiness(env).ready)return; // Enabling later must never drain a historical backlog.
  const clinic=await one(clinics,row.clinicId,conn);
  const used=new Set<string>();
  for(const group of templateRecipients) {
    if(event==="onboarding"&&group!=="clinicAdmin")continue;
    const template=await resolvedTemplate(event,row.clinicId,conn,group,"sms");
    if(!template.content.enabled)continue;
    for(const account of await targetAccounts(conn,group,row,clinic)) {
      const phone=notificationPhone(account.mobile);
      if(account.status!=="active"||!phone||used.has(phone))continue;
      used.add(phone);
      const id=`sms-outbox:${event}:${row.id}:${row.revision||0}:${phoneKey(phone)}`;
      await conn.insert(settings).values({id,data:{
        event,clinicId:row.clinicId,appointmentId:event==="onboarding"?undefined:row.id,
        recipientGroup:group,recipientUserId:account.targetPatientId?undefined:account.id,
        recipientPatientId:account.targetPatientId,recipientPhoneKey:phoneKey(phone),
        snapshot:row,previousDetails,state:"pending",createdAt:Date.now(),dueAt:Date.now(),attempts:0,
      }}).onConflictDoNothing();
    }
  }
}
/** Claims and outcomes share the durable settings outbox with email but never the email dedup key.
 * No automatic resend after dispatch, including a worker crash or a timed-out provider response. */
export async function processSmsNotifications(conn:any=db,send=sendNotificationSms,now=Date.now()) {
  const candidates=await conn.select().from(settings).where(sql`${settings.id} like 'sms-outbox:%' and ${settings.data}->>'state' = 'pending' and (${settings.data}->>'dueAt')::bigint <= ${now}`).limit(100);
  for(const record of candidates) {
    try {
      const claim=await conn.transaction(async(tx:any)=>{
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${record.id}))`);
        const [fresh]=await tx.select().from(settings).where(eq(settings.id,record.id));
        const data=fresh.data;
        if(data.state!=="pending"||data.dueAt>now)return null;
        const update=async(state:string)=>tx.update(settings).set({data:{...data,state,finishedAt:now}}).where(eq(settings.id,record.id));
        if(!(await getSettings(tx,data.clinicId)).notificationsEnabled){await update("disabled");return null;}
        const clinic=await one(clinics,data.clinicId,tx);
        const current=data.appointmentId?flatten((await tx.select().from(appointments).where(eq(appointments.id,data.appointmentId)))[0]):null;
        const snapshot=data.snapshot;
        // Booking revision is the initial visit; all other events require their exact current revision.
        const mismatch=current && ((current.revision||0)!==(snapshot.revision||0));
        const invalidStatus=current && (data.event==="cancelled"?current.status!=="cancelled":
          data.event==="completed"?current.status!=="completed":
          data.event==="reminder"?!reminderDispatchEligible(current,now):!["waiting","booked"].includes(current.status));
        if(data.appointmentId&&(!current||mismatch||invalidStatus)){await update("obsolete");return null;}
        const template=await resolvedTemplate(data.event,data.clinicId,tx,data.recipientGroup,"sms");
        if(!template.content.enabled||template.activatedAt>data.createdAt){await update("disabled");return null;}
        const env=(await resolvedIntegration("notificationSms",tx)).env;
        if(!notificationSmsEnabled(env)){await update("disabled");return null;}
        if(!notificationSmsReadiness(env).ready){await update("pre_dispatch_failed");return null;}
        const targets=await targetAccounts(tx,data.recipientGroup,current||snapshot,clinic);
        const target=targets.find(a=>data.recipientPatientId?a.targetPatientId===data.recipientPatientId:a.id===data.recipientUserId);
        const phone=notificationPhone(target?.mobile);
        if(!target||target.status!=="active"||!phone||phoneKey(phone)!==data.recipientPhoneKey){await update("no_recipient");return null;}
        const patient=current?.patientId?await one(patients,current.patientId,tx):null;
        const values={clinic_name:clinic.name,patient_name:patient?.fullName||"",doctor_name:snapshot.doctorName||"",
          appointment_details:current?confirmationText(snapshot,clinic).replace("Your appointment is confirmed.","Visit details:"):"",
          previous_details:data.previousDetails||"",reference:snapshot.reference||"",timezone:snapshot.timezone||clinic.timezone||"",
          clinic_contact:[clinic.email,clinic.phone].filter(Boolean).join(" · ")};
        const content=template.content as SmsTemplateContent;
        const message=substitute(content.body,values);
        if(message.length>1600){await update("pre_dispatch_failed");return null;}
        await tx.update(settings).set({data:{...data,state:"sending",claimedAt:now,attempts:data.attempts+1}}).where(eq(settings.id,record.id));
        return {data,env,phone,message,content};
      });
      if(!claim)continue;
      let state="delivery_unknown";
      try{state=await send(claim.env,claim.phone,claim.message,claim.content);}catch{/* claim persists; never retry uncertain dispatch */}
      await conn.update(settings).set({data:{...claim.data,state,attempts:claim.data.attempts+1,finishedAt:Date.now()}}).where(eq(settings.id,record.id));
    }catch{
      console.error("SMS notification preparation failed; durable dispatch state retained");
      // Preparation errors can be retried only while the durable row is still pending.
      await conn.transaction(async(tx:any)=>{
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${record.id}))`);
        const [fresh]=await tx.select().from(settings).where(eq(settings.id,record.id));
        if(fresh?.data.state!=="pending")return;
        const attempts=(fresh.data.attempts||0)+1;
        await tx.update(settings).set({data:{...fresh.data,attempts,state:attempts>=5?"pre_dispatch_failed":"pending",dueAt:now+60000*2**attempts}}).where(eq(settings.id,record.id));
      });
    }
  }
}
