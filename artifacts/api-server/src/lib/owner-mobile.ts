import { createHash, randomInt } from "node:crypto";
import { db, authChallenges } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { accountMobileProblem } from "@workspace/api-zod/account-mobile";
import { createChallenge, consumeChallenge, consumeRateLimit } from "./native-auth";
import { securitySms } from "./security-notifications";
import { assert, HttpError } from "./http";

const purpose = "owner-mobile";
export const ownerMobileSubject = (flow: string, binding: string) =>
  createHash("sha256").update(JSON.stringify([flow, binding])).digest("hex");
export function requireAccountMobile(value: unknown): string {
  const mobile = typeof value === "string" ? value.trim() : "";
  assert(!accountMobileProblem(mobile), 400, accountMobileProblem(mobile) || "Invalid account mobile");
  return mobile;
}
async function lock(conn: any, subject: string) {
  await conn.execute(sql`select pg_advisory_xact_lock(hashtext(${"owner-mobile:" + subject}))`);
}
/** Uses the existing hashed, expiring challenge store; the empty email is NOT an identity. */
export async function startOwnerMobile(subject: string, value: unknown, deliver = securitySms) {
  const mobile = requireAccountMobile(value);
  await consumeRateLimit(`owner-mobile:subject:${subject}`, 1, 60_000);
  await consumeRateLimit(`owner-mobile:phone:${ownerMobileSubject("phone", mobile)}`, 5, 3600_000);
  return db.transaction(async tx => {
    await lock(tx, subject);
    await tx.execute(sql`update auth_challenges set data='{}'::jsonb,consumed_at=now()
      where purpose=${purpose} and data->>'subject'=${subject}`);
    const code = String(randomInt(100000, 1000000));
    const id = await createChallenge({ email: "", purpose, secret: code, ttlMs: 600_000,
      data: { subject, mobile, deliveryReady: false } },tx);
    const outcome = await deliver("registration_mobile_otp", "clinicAdmin", mobile, { otp: code, expiry_minutes: "10" });
    await tx.update(authChallenges).set(outcome.status === "provider_accepted"
      ? { data: { subject, mobile, deliveryReady: true } }
      : { data: {}, consumedAt: new Date() }).where(eq(authChallenges.id, id));
    return { challengeId: id, sms: outcome };
  });
}
export async function confirmOwnerMobile(subject: string, id: string, code: string) {
  const result = await db.transaction(async tx => {
    await lock(tx, subject);
    const [row] = await tx.select().from(authChallenges).where(eq(authChallenges.id, id)).for("update");
    if (!row || row.data.subject !== subject || row.data.deliveryReady !== true || row.data.verified === true)
      return false;
    // Catch inside the transaction so failed-guess counters commit.
    try {
      const consumed = await consumeChallenge(id, purpose, code, tx);
      await tx.update(authChallenges).set({ data: { ...consumed.data, verified: true, verifiedAt: new Date().toISOString() } }).where(eq(authChallenges.id, id));
      return true;
    } catch (error) { if (error instanceof HttpError && error.status === 400) return false; throw error; }
  });
  assert(result, 400, "This mobile code is incorrect or expired. Request a new code if needed.");
}
export async function invalidateOwnerMobile(subject: string, id: string) {
  await db.transaction(async tx => {
    await lock(tx,subject);
    await tx.execute(sql`update auth_challenges set data='{}'::jsonb,consumed_at=now()
      where id=${id} and purpose=${purpose} and data->>'subject'=${subject}`);
  });
}
/** Must run inside the account/setup transaction, including receipt reconciliation. */
export async function useOwnerMobileProof(conn: any, subject: string, id: string, value: unknown, previousRegistrationId?: string) {
  const mobile = requireAccountMobile(value);
  await lock(conn, subject);
  const [row] = await conn.select().from(authChallenges).where(eq(authChallenges.id, id || "")).for("update");
  assert(row?.purpose === purpose && row.expiresAt > new Date() && row.data.subject === subject &&
    row.data.mobile === mobile && row.data.verified === true,
  400, "Verify this exact mobile number before continuing.");
  if(row.data.used === true) {
    assert(previousRegistrationId && row.data.registrationId === previousRegistrationId,400,"Verify your mobile again before starting another registration.");
    const [previous] = await conn.select().from(authChallenges).where(eq(authChallenges.id,previousRegistrationId)).for("update");
    assert(previous?.purpose === "register" && !previous.consumedAt && previous.expiresAt > new Date(),
      400,"This registration has ended. Verify your mobile again.");
  }
  await conn.update(authChallenges).set({ data: { ...row.data, used: true } }).where(eq(authChallenges.id, row.id));
  return { contact: mobile, verifiedAt: typeof row.data.verifiedAt === "string" ? row.data.verifiedAt : new Date().toISOString() };
}
