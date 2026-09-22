import { Router, type IRouter } from "express";
import { randomInt, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { db, otpChallenges, patients, users, settings } from "@workspace/db";
import { RequestOtpBody, VerifyOtpBody } from "@workspace/api-zod";
import { requireUser } from "../lib/auth";
import { HttpError } from "../lib/http";
import { deliverOtp, developmentOtpEnabled } from "../lib/otp-delivery";

const router: IRouter = Router();
const resendSeconds = 60;

function digest(id: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(503, "Verification service is unavailable.", "OTP_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(`${id}:${code}`).digest("hex");
}

router.use("/otp", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
}));

router.post("/otp/request", async (req, res) => {
  const user = await requireUser(req);
  const input = RequestOtpBody.parse(req.body);
  const [platform] = await db.select().from(settings).where(eq(settings.id, "platform"));
  const expiry = Math.min(900, Math.max(60, Number(platform?.data.otpExpirySeconds ?? 300)));
  const id = randomUUID();
  const code = randomInt(100000, 1000000).toString();
  const codeHash = digest(id, code);
  const expiresAt = new Date(Date.now() + expiry * 1000);
  const provider = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${user.id}`}))`);
    const recent = await tx.select().from(otpChallenges).where(and(
      eq(otpChallenges.userId, user.id),
      gte(otpChallenges.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
    ));
    if (recent.some(challenge => challenge.createdAt.getTime() > Date.now() - resendSeconds * 1000)) {
      throw new HttpError(429, "Please wait 60 seconds before requesting another code.");
    }
    if (recent.length >= 5) throw new HttpError(429, "Hourly verification limit reached. Please try again later.");
    const delivery = await deliverOtp(input.mobile, code, expiry);
    await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.userId, user.id));
    await tx.insert(otpChallenges).values({
      id, userId: user.id, mobile: input.mobile, codeHash, expiresAt,
    });
    return delivery;
  });
  res.setHeader("Cache-Control", "no-store");
  res.json({
    challengeId: id, expiresAt: expiresAt.toISOString(), resendAfterSeconds: resendSeconds,
    provider,
    ...(developmentOtpEnabled() && provider === "development" ? { developmentCode: code } : {}),
  });
});

router.post("/otp/verify", async (req, res) => {
  const user = await requireUser(req);
  const input = VerifyOtpBody.parse(req.body);
  const [platform] = await db.select().from(settings).where(eq(settings.id, "platform"));
  const maxAttempts = Math.min(10, Math.max(1, Number(platform?.data.otpMaxAttempts ?? 5)));
  // Return failures out of the transaction so failed-attempt counters are committed.
  const outcome = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${user.id}`}))`);
    const [challenge] = await tx.select().from(otpChallenges).where(and(
      eq(otpChallenges.id, input.challengeId), eq(otpChallenges.userId, user.id),
    )).for("update");
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
      return { error: "This code has expired or has already been used. Request a new code.", status: 400 } as const;
    }
    if (challenge.attempts >= maxAttempts) return { error: "Too many attempts. Request a new code.", status: 429 } as const;
    await tx.update(otpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(otpChallenges.id, challenge.id));
    const matches = timingSafeEqual(Buffer.from(digest(challenge.id, input.code), "hex"), Buffer.from(challenge.codeHash, "hex"));
    if (!matches) return { error: "Incorrect verification code.", status: 400 } as const;
    const now = new Date();
    await tx.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));
    await tx.update(patients).set({ mobile: challenge.mobile, mobileVerified: true }).where(eq(patients.userId, user.id));
    await tx.update(users).set({ mobile: challenge.mobile }).where(eq(users.id, user.id));
    return { mobile: challenge.mobile, verifiedAt: now.toISOString() } as const;
  });
  if ("error" in outcome) throw new HttpError(outcome.status ?? 400, outcome.error ?? "Verification failed");
  res.setHeader("Cache-Control", "no-store");
  res.json({ verified: true, ...outcome });
});

export default router;