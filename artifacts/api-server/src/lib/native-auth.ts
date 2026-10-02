import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import argon2 from "argon2";
import { and, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db, users, authSessions, authChallenges, authRateLimits } from "@workspace/db";
import { HttpError } from "./http";
import { SESSION_AGE, sessionMode } from "./auth-config";
import { signSessionJwt, verifySessionJwt } from "./jwt-session";

export const SESSION_COOKIE = "digiq_session";
export const CSRF_COOKIE = "digiq_csrf";
const digest = (raw: string) => createHash("sha256").update(raw).digest("hex");
function challengeDigest(id: string, purpose: string, raw: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new HttpError(503, "Authentication secret is not configured", "AUTH_SECRET_UNCONFIGURED");
  return createHmac("sha256", secret).update(`${purpose}:${id}:${raw}`).digest("hex");
}
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/api" };
export function passwordInput(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password) || Buffer.byteLength(password, "utf8") > 1024)
    throw new HttpError(400, "Password must contain at least 8 characters, including letters and numbers, and at most 1024 bytes", "INVALID_PASSWORD");
}
export async function hashPassword(password: string): Promise<string> {
  passwordInput(password);
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | null | undefined, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) return false;
  dummyHash ||= hashPassword(`a1${randomBytes(32).toString("base64url")}`);
  try {
    const verified = await argon2.verify(hash || await dummyHash, password);
    return Boolean(hash && verified);
  } catch { return false; }
}
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function getCookie(req: Request, name: string): string | undefined {
  const value = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  try { return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined; } catch { return undefined; }
}
export async function nativeSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getCookie(req, SESSION_COOKIE);
    if (!token) return next();
    let subject: string | undefined;
    let mode: "native" | "jwt";
    try {
      mode = sessionMode();
      if (mode === "jwt") {
        subject = await verifySessionJwt(token);
        if (!subject) return next();
      } else if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return next();
    } catch (error) {
      // Fail closed without breaking anonymous public routes, even with stale cookies.
      // Credential issuance still exposes an explicit 503 configuration error.
      if (error instanceof HttpError && error.code === "AUTH_SESSION_UNCONFIGURED") return next();
      throw error;
    }
    {
      const [row] = await db.select({ userId: authSessions.userId, tokenHash: authSessions.tokenHash })
        .from(authSessions).innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(eq(authSessions.tokenHash, digest(token)), gt(authSessions.expiresAt, new Date()),
          isNull(authSessions.revokedAt), eq(users.status, "active"))).limit(1);
      if (row && (mode === "native" || row.userId === subject)) {
        (req as any).authUserId = row.userId; (req as any).authSessionHash = row.tokenHash;
      }
    }
    next();
  } catch (error) { next(error); }
}
type AuthTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Serialize credential changes and credential-derived session issuance per identity. */
export async function lockCredentials(tx: AuthTransaction, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"auth-credentials:" + userId}))`);
}
export async function insertSession(tx: AuthTransaction, userId: string) {
  const mode = sessionMode();
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = mode === "jwt" ? await signSessionJwt(userId, issuedAt) : randomBytes(32).toString("base64url");
  const expiresAt = new Date(mode === "jwt" ? issuedAt * 1000 + SESSION_AGE : Date.now() + SESSION_AGE);
  await tx.insert(authSessions).values({ tokenHash: digest(token), userId, expiresAt });
  return token;
}
export function sessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
}
export async function createSession(res: Response, userId: string, expectedPasswordHash?: string) {
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  const token = await db.transaction(async tx => {
    await lockCredentials(tx, userId);
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.status !== "active" ||
      (expectedPasswordHash !== undefined && (user.passwordHash !== expectedPasswordHash ||
        !["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(user.role))))
      throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    return insertSession(tx, userId);
  });
  sessionCookie(res, token);
}
/** Called only while holding the credential lock, in the password-write transaction.
 * All outstanding staff recovery/setup/device credentials predate this change.
 * Patient and registration identities are intentionally unaffected.
 */
export async function invalidateStaffCredentials(tx: AuthTransaction, userId: string) {
  await tx.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.userId, userId));
  await tx.update(authChallenges).set({ consumedAt: new Date(), data: {} })
    .where(and(eq(authChallenges.userId, userId), isNull(authChallenges.consumedAt),
      inArray(authChallenges.purpose, ["reset", "invitation", "device"])));
}
export async function revokeSession(req: Request, res: Response) {
  if ((req as any).authSessionHash) await db.update(authSessions).set({ revokedAt: new Date() })
    .where(eq(authSessions.tokenHash, (req as any).authSessionHash));
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
export async function revokeUserSessions(userId: string) {
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.userId, userId));
}
export function issueCsrf(req: Request, res: Response) {
  const existing = getCookie(req, CSRF_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{43}$/.test(existing)) return existing;
  const token = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
  return token;
}
export function checkCsrf(req: Request, _res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const cookie = getCookie(req, CSRF_COOKIE), header = req.get("x-csrf-token");
  if (!cookie || !header || !safeEqual(cookie, header)) return next(new HttpError(403, "Invalid CSRF token", "INVALID_CSRF"));
  next();
}
export async function consumeRateLimit(key: string, max: number, windowMs = 600_000) {
  if (randomBytes(1)[0] === 0)
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, new Date()));
  const hash = digest(key);
  await db.transaction(async tx => {
    const result = await tx.execute(sql`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${hash},1,now() + (${windowMs} * interval '1 millisecond'))
      on conflict ("key") do update
      set attempts=case when auth_rate_limits.expires_at<now() then 1 else auth_rate_limits.attempts+1 end,
          expires_at=case when auth_rate_limits.expires_at<now() then now() + (${windowMs} * interval '1 millisecond') else auth_rate_limits.expires_at end
      returning attempts`);
    if (Number(result.rows[0]?.attempts) > max) throw new HttpError(429, "Too many attempts; please try later", "RATE_LIMITED");
  });
}
export async function createChallenge(input: { userId?: string; email: string; purpose: string; secret: string; ttlMs: number; data?: Record<string, unknown> }) {
  const id = randomBytes(18).toString("base64url");
  await db.delete(authChallenges).where(lt(authChallenges.expiresAt, new Date()));
  await db.transaction(async tx => {
    if (input.userId) await lockCredentials(tx, input.userId);
    await tx.insert(authChallenges).values({
    id, userId: input.userId, email: input.email, purpose: input.purpose, tokenHash: challengeDigest(id, input.purpose, input.secret),
    expiresAt: new Date(Date.now() + input.ttlMs), data: input.data || {},
    });
  });
  return id;
}
/** Validate reset/invite token before starting expensive Argon2id work. */
export async function validateChallenge(id: string, purpose: string, secret: string) {
  const [row] = await db.select({ tokenHash: authChallenges.tokenHash }).from(authChallenges)
    .where(and(eq(authChallenges.id, id), eq(authChallenges.purpose, purpose),
      isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, new Date()),
      lt(authChallenges.attempts, 5))).limit(1);
  if (!row || !safeEqual(row.tokenHash, challengeDigest(id, purpose, secret)))
    throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
}
export async function consumeChallenge(id: string, purpose: string, secret: string, transaction?: AuthTransaction) {
  const consume = async (tx: AuthTransaction) => {
    const [challenge] = await tx.select().from(authChallenges).where(eq(authChallenges.id, id)).for("update");
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || challenge.expiresAt <= new Date()
      || challenge.attempts >= 5) return null;
    const matching = safeEqual(challenge.tokenHash, challengeDigest(id, purpose, secret));
    await tx.update(authChallenges).set({ attempts: challenge.attempts + 1,
      ...(matching ? { consumedAt: new Date(), data: {} } : {}) })
      .where(eq(authChallenges.id, id));
    return matching ? challenge : null;
  };
  const row = transaction ? await consume(transaction) : await db.transaction(consume);
  if (!row) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row;
}
/** A non-locking lookup is used only to establish lock order: user, then challenge.
 * Consumption and all authorization checks must still occur under that lock.
 */
export async function challengeUserId(id: string) {
  const [row] = await db.select({ userId: authChallenges.userId }).from(authChallenges)
    .where(eq(authChallenges.id, id)).limit(1);
  if (!row?.userId) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row.userId;
}
/** Rotate a pending registration code without extending its original lifetime.
 * Keep the opaque ID stable so a delivery failure never strands the caller.
 * Delivery is inside the transaction: failed delivery preserves the old code.
 */
export async function resendRegistrationChallenge(id: string,
  deliver: (address: string, secret: string) => Promise<void>) {
  return db.transaction(async tx => {
    const [challenge] = await tx.select().from(authChallenges)
      .where(eq(authChallenges.id, id)).for("update");
    if (!challenge || challenge.purpose !== "register" || challenge.userId ||
      challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5)
      throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
    const remaining = Math.ceil((challenge.createdAt.getTime() + 60_000 - Date.now()) / 1000);
    if (remaining > 0)
      throw new HttpError(429, "Please wait before requesting another code", "REGISTRATION_RESEND_COOLDOWN");
    // Per-ID cooldown is shared across server instances and independent of IP.
    // Keep attempts intact: resend must not replenish the verification budget.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"registration-resend:" + id}))`);
    const key = digest("registration-resend:" + id);
    const result = await tx.execute(sql`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${key},1,now() + interval '60 seconds')
      on conflict ("key") do update set attempts=1, expires_at=now() + interval '60 seconds'
      where auth_rate_limits.expires_at <= now() returning attempts`);
    if (!result.rows.length)
      throw new HttpError(429, "Please wait before requesting another code", "REGISTRATION_RESEND_COOLDOWN");
    let secret: string;
    do { secret = String(randomInt(100000, 1000000)); }
    while (safeEqual(challenge.tokenHash, challengeDigest(id, "register", secret)));
    await tx.update(authChallenges).set({ tokenHash: challengeDigest(id, "register", secret) })
      .where(eq(authChallenges.id, id));
    await deliver(challenge.email, secret);
    return id;
  });
}