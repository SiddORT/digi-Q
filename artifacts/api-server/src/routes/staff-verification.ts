import { Router } from "express";
import { createHmac, randomInt, randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, users, authChallenges } from "@workspace/db";
import { requireUser, roles } from "../lib/auth";
import { assert, HttpError } from "../lib/http";
import { safeEqual } from "../lib/native-auth";
import { securityEmail, securitySms, eligibleStaffMobile } from "../lib/security-notifications";
import { verifiedContact, captureStaffWelcome, staffNoticeState } from "../lib/staff-account-notifications";

export const staffVerificationRouter = Router();
const channelInput = z.object({ channel: z.enum(["email", "sms"]) }).strict();
const confirmInput = channelInput.extend({ challengeId: z.string().max(100), code: z.string().regex(/^\d{6}$/) });
const purpose = (channel: string) => `staff-contact:${channel}`;
function digest(id: string, channel: string, userId: string, contact: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  assert(secret && Buffer.byteLength(secret) >= 32, 503, "Verification is temporarily unavailable.");
  return createHmac("sha256", secret).update(JSON.stringify([id, purpose(channel), userId, contact, code])).digest("hex");
}
async function staff(req: any) {
  const actor = await requireUser(req);
  roles(actor, ["superAdmin", "clinicAdmin", "doctor", "receptionist"]);
  return actor;
}
staffVerificationRouter.use("/staff-verification", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
staffVerificationRouter.get("/staff-verification", async (req, res) => {
  const actor = await staff(req);
  const [account] = await db.select().from(users).where(eq(users.id, actor.id));
  res.json({ email: account.email, mobile: account.mobile,
    emailVerified: !!verifiedContact(account, "email"), mobileVerified: !!verifiedContact(account, "sms"),
    promptRequired: account.data.staffVerificationPrompt === true && (!verifiedContact(account, "email") || !verifiedContact(account, "sms")),
    ...(account.data.staffContactOnboarding ? {
      welcomeEmailStatus: await staffNoticeState(db, "staff_welcome", account.id, "email") || "awaiting_verification",
      welcomeSmsStatus: await staffNoticeState(db, "staff_welcome", account.id, "sms") || "awaiting_verification",
    } : {}) });
});
staffVerificationRouter.post("/staff-verification/defer", async (req, res) => {
  const actor = await staff(req);
  await db.execute(sql`update users set data=jsonb_set(data,'{staffVerificationPrompt}','false'::jsonb) where id=${actor.id}`);
  res.json({ ok: true });
});
staffVerificationRouter.post("/staff-verification/request", async (req, res) => {
  const actor = await staff(req), { channel } = channelInput.parse(req.body);
  const id = randomUUID(), code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 300000);
  const contact = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"staff-verification:" + actor.id + ":" + channel}))`);
    const [account] = await tx.select().from(users).where(eq(users.id, actor.id)).for("update");
    assert(account?.status === "active", 403, "Your account is unavailable.");
    assert(!verifiedContact(account, channel), 409, "This contact is already verified.");
    const contact = channel === "email" ? account.email : eligibleStaffMobile(account.mobile);
    assert(contact && (channel === "email" || contact === account.mobile), 400, "Save a valid mobile number with country code in Profile first.");
    const recent = await tx.select().from(authChallenges).where(and(eq(authChallenges.userId, actor.id),
      eq(authChallenges.purpose, purpose(channel)), gte(authChallenges.createdAt, new Date(Date.now() - 3600000))));
    assert(!recent.some(c => c.createdAt.getTime() > Date.now() - 60000), 429, "Wait 60 seconds before requesting another code.");
    assert(recent.length < 5, 429, "Too many code requests. Try again in an hour.");
    await tx.update(authChallenges).set({ consumedAt: new Date() }).where(and(eq(authChallenges.userId, actor.id), eq(authChallenges.purpose, purpose(channel))));
    await tx.insert(authChallenges).values({ id, userId: actor.id, email: account.email,
      purpose: purpose(channel), tokenHash: digest(id, channel, actor.id, contact, code),
      data: { contact, deliveryReady: false }, expiresAt });
    return contact;
  });
  const values = { otp: code, expiry_minutes: "5" };
  const outcome = channel === "email"
    ? await securityEmail("staff_email_otp", actor.role, contact, values)
    : await securitySms("staff_mobile_otp", actor.role, contact, values);
  if (outcome.status !== "provider_accepted") {
    await db.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, id));
    throw new HttpError(503, "The code could not be sent. Wait a minute and try again.");
  }
  await db.execute(sql`update auth_challenges set data=jsonb_set(data,'{deliveryReady}','true'::jsonb) where id=${id}`);
  res.json({ challengeId: id, expiresAt: expiresAt.toISOString(), resendAfterSeconds: 60 });
});
staffVerificationRouter.post("/staff-verification/confirm", async (req, res) => {
  const actor = await staff(req), input = confirmInput.parse(req.body);
  const error = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"staff-verification:" + actor.id + ":" + input.channel}))`);
    const [account] = await tx.select().from(users).where(eq(users.id, actor.id)).for("update");
    const [challenge] = await tx.select().from(authChallenges).where(and(eq(authChallenges.id, input.challengeId), eq(authChallenges.userId, actor.id))).for("update");
    const contact = input.channel === "email" ? account?.email : account?.mobile;
    if (!account || account.status !== "active" || !challenge || challenge.purpose !== purpose(input.channel) ||
      challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 ||
      !challenge.data.deliveryReady || contact !== challenge.data.contact) return "This code is no longer valid. Request a new code.";
    const matches = safeEqual(challenge.tokenHash, digest(challenge.id, input.channel, actor.id, contact!, input.code));
    await tx.update(authChallenges).set({ attempts: challenge.attempts + 1, ...(matches ? { consumedAt: new Date(), data: {} } : {}) }).where(eq(authChallenges.id, challenge.id));
    if (!matches) return "Incorrect code. Check the code and try again.";
    await tx.update(users).set(input.channel === "email"
      ? { emailVerifiedAt: new Date() }
      : { data: { ...account.data, staffMobileProof: { contact, verifiedAt: new Date().toISOString() } } }).where(eq(users.id, actor.id));
    await captureStaffWelcome(tx, actor.id, input.channel);
    return undefined;
  });
  if (error) throw new HttpError(400, error);
  res.json({ verified: true });
});
