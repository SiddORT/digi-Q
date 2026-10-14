import { db, authChallenges } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { createChallenge, consumeChallenge, consumeRateLimit } from "./native-auth";
import { patientLoginPhone } from "./patient-login-sms";
import { assert } from "./http";
import { securitySms, type ChannelOutcome } from "./security-notifications";

export const optionalRegistrationMobile = (value: unknown) =>
  value === undefined || value === "" ? undefined : patientLoginPhone(value);

/** Parent ID is an opaque registration intent, never a login credential. */
export async function requestRegistrationMobile(parentId: string) {
  await consumeRateLimit(`registration-mobile:${parentId}`,1,60_000);
  const [parent] = await db.select().from(authChallenges).where(eq(authChallenges.id,parentId));
  assert(parent && ["register","patient"].includes(parent.purpose) && !parent.consumedAt &&
    parent.expiresAt > new Date() && parent.attempts < 5 && typeof parent.data.mobile === "string",400,"Invalid or expired registration");
  if (parent.data.mobileVerified === true) return {status:"not_requested"} as ChannelOutcome;
  const mobile = patientLoginPhone(parent.data.mobile);
  const otp = String(randomInt(100000,1000000));
  const id = await createChallenge({email:parent.email,purpose:"registration-mobile",secret:otp,
    ttlMs:Math.max(1,parent.expiresAt.getTime()-Date.now()),data:{parentId,mobile}});
  await db.transaction(async tx => {
    const [current] = await tx.select().from(authChallenges).where(eq(authChallenges.id,parentId)).for("update");
    assert(current && !current.consumedAt && current.expiresAt > new Date(),400,"Registration has expired");
    await tx.update(authChallenges).set({data:{...current.data,mobileChallengeId:id}}).where(eq(authChallenges.id,parentId));
  });
  return securitySms("registration_mobile_otp",parent.purpose==="register"?"clinicAdmin":"patient",mobile,
    {otp,expiry_minutes:String(Math.max(1,Math.ceil((parent.expiresAt.getTime()-Date.now())/60_000)))});
}
export async function verifyRegistrationMobile(parentId: string, submitted: string) {
  const [parent] = await db.select().from(authChallenges).where(eq(authChallenges.id,parentId));
  assert(parent && ["register","patient"].includes(parent.purpose) && !parent.consumedAt &&
    parent.expiresAt > new Date() && parent.attempts < 5 && typeof parent.data.mobileChallengeId === "string",400,"Invalid or expired registration");
  // Consume outside the parent transaction so wrong attempts remain durable.
  const child = await consumeChallenge(parent.data.mobileChallengeId as string,"registration-mobile",submitted);
  await db.transaction(async tx => {
    const [current] = await tx.select().from(authChallenges).where(eq(authChallenges.id,parentId)).for("update");
    assert(current && !current.consumedAt && current.expiresAt > new Date() &&
      current.data.mobileChallengeId === child.id && child.data.parentId === current.id &&
      child.email === current.email && child.data.mobile === current.data.mobile,400,"Invalid or expired registration");
    await tx.update(authChallenges).set({data:{...current.data,mobileVerified:true}}).where(eq(authChallenges.id,parentId));
  });
}
