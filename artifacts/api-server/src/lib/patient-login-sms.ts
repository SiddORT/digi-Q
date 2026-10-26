import { db, users, authChallenges } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { assert, HttpError } from "./http";
import { createChallenge, consumeChallenge, lockCredentials, insertSession } from "./native-auth";
import { resolvedIntegration } from "./integration-vault";
import { resolvedTemplate } from "./notification-template-store";
import { smsTemplateContent, validEventContent, substitute } from "./notification-templates";
import { notificationSmsConfig, smsPayload, sendNotificationSms } from "./notification-sms-transport";
import { requireSecurityDelivery } from "./security-notifications";

export function patientLoginPhone(value: unknown) {
  assert(typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value.trim()),400,"Enter a mobile number with country code");
  return (value as string).trim();
}
/** Fail closed for shared/ambiguous phone numbers. SMS never creates a synthetic email identity. */
export async function patientAccountsForPhone(mobile: string, conn: any = db) {
  return conn.select().from(users).where(sql`
    ${users.role} = 'patient' and ${users.status} = 'active' and
    regexp_replace(coalesce(${users.mobile}, ''), '[^0-9]', '', 'g') = ${mobile.slice(1)}`).limit(2);
}

export async function sendPatientLoginSms(mobile: string, otp: string, expirySeconds: number,
  conn: any = db, send = sendNotificationSms) {
  assert(/^\d{6}$/.test(otp) && Number.isFinite(expirySeconds) && expirySeconds > 0,503,"Login code or expiry is unavailable");
  await requireSecurityDelivery("patient_login_otp","patient","sms",conn);
  const { env } = await resolvedIntegration("notificationSms",conn);
  const cfg = notificationSmsConfig(env);
  const template = await resolvedTemplate("patient_login_otp",undefined,conn,"patient","sms");
  const content = smsTemplateContent.parse(template.content);
  assert(validEventContent("patient_login_otp",content),503,"Patient login SMS template is not configured");
  const message = substitute(content.body,{otp,expiry_minutes:String(Math.ceil(expirySeconds/60))});
  smsPayload(cfg,mobile,message,content); // Enforce sender/DLT before dispatch, independently of opt-out gates.
  await requireSecurityDelivery("patient_login_otp","patient","sms",conn);
  const outcome = await send(env,mobile,message,content);
  if(outcome!=="provider_accepted") throw new HttpError(503,
    "The login SMS could not be confirmed. Wait before requesting a new code, or use email login.","PATIENT_SMS_DELIVERY_FAILED");
  // Never persist or log the OTP/message/provider response in notification history.
}

export async function startPatientSmsLogin(mobile: string, conn: any = db, deliver = sendPatientLoginSms) {
  // The route throttles before this lookup. Explicit eligibility feedback is
  // intentional; ambiguous numbers get the same response without identity hints.
  const matches = await patientAccountsForPhone(mobile,conn);
  if(matches.length!==1) throw new HttpError(400,
    "No patient account eligible for SMS login was found for this mobile. Choose Email OTP to sign in or register, or check the mobile saved on your patient account.",
    "PATIENT_SMS_NOT_REGISTERED");
  await requireSecurityDelivery("patient_login_otp","patient","sms",conn);
  const cfg=notificationSmsConfig((await resolvedIntegration("notificationSms",conn)).env);
  const template=await resolvedTemplate("patient_login_otp",undefined,conn,"patient","sms");
  assert(validEventContent("patient_login_otp",template.content),503,"Patient login SMS template is not configured");
  smsPayload(cfg,mobile,substitute(template.content.body,{otp:"000000",expiry_minutes:"10"}),smsTemplateContent.parse(template.content));
  const account=matches[0], otp=String(randomInt(100000,1000000));
  const challengeId=await createChallenge({userId:account.id,email:account.email,purpose:"patient-sms",
    secret:otp,ttlMs:10*60_000,data:{mobile}});
  try { await deliver(mobile,otp,600,conn); }
  catch(error) {
    await conn.update(authChallenges).set({consumedAt:new Date(),data:{}}).where(eq(authChallenges.id,challengeId));
    throw error;
  }
  return challengeId;
}

/** Identity and phone must still match under the credential lock when creating the session. */
export async function verifyPatientSmsLogin(challengeId: string, otp: string, conn: any = db) {
  // Consume outside the session transaction so failed-code attempts remain
  // durable even when verification throws; a valid code stays single-use.
  const challenge=await consumeChallenge(challengeId,"patient-sms",otp);
  assert(challenge.userId,400,"Invalid or expired verification");
  const userId=challenge.userId!;
  return conn.transaction(async(tx:any)=>{
    await lockCredentials(tx,userId);
    const mobile=patientLoginPhone(challenge.data?.mobile);
    const matches=await patientAccountsForPhone(mobile,tx);
    assert(matches.length===1&&matches[0].id===challenge.userId,401,"Invalid or expired verification");
    const account=matches[0];
    assert(account.email===challenge.email,401,"Invalid or expired verification");
    await tx.update(users).set({data:{...account.data,mobileVerified:true}}).where(eq(users.id,account.id));
    return insertSession(tx,account.id);
  });
}
