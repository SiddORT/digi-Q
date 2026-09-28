import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import argon2 from "argon2";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, users, authSessions, authChallenges, authRateLimits } from "@workspace/db";
import { HttpError } from "./http";

export const SESSION_COOKIE = "digiq_session";
export const CSRF_COOKIE = "digiq_csrf";
const SESSION_AGE = 12 * 60 * 60 * 1000;
const digest = (raw: string) => createHash("sha256").update(raw).digest("hex");
function challengeDigest(id: string, purpose: string, raw: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new HttpError(503, "Authentication secret is not configured", "AUTH_SECRET_UNCONFIGURED");
  return createHmac("sha256", secret).update(`${purpose}:${id}:${raw}`).digest("hex");
}
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/api" };
export function passwordInput(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 1024)
    throw new HttpError(400, "Password must be at least 12 characters and at most 1024 bytes", "INVALID_PASSWORD");
}
export async function hashPassword(password: string): Promise<string> {
  passwordInput(password);
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(hash: string | null | undefined, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) return false;
  dummyHash ||= hashPassword(randomBytes(32).toString("base64url"));
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
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      const [row] = await db.select({ userId: authSessions.userId, tokenHash: authSessions.tokenHash })
        .from(authSessions).innerJoin(users, eq(users.id, authSessions.userId))
        .where(and(eq(authSessions.tokenHash, digest(token)), gt(authSessions.expiresAt, new Date()),
          isNull(authSessions.revokedAt), eq(users.status, "active"))).limit(1);
      if (row) { (req as any).authUserId = row.userId; (req as any).authSessionHash = row.tokenHash; }
    }
    next();
  } catch (error) { next(error); }
}
export async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(authSessions).where(lt(authSessions.expiresAt, new Date()));
  await db.insert(authSessions).values({ tokenHash: digest(token), userId, expiresAt: new Date(Date.now() + SESSION_AGE) });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_AGE });
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
  await db.insert(authChallenges).values({
    id, userId: input.userId, email: input.email, purpose: input.purpose, tokenHash: challengeDigest(id, input.purpose, input.secret),
    expiresAt: new Date(Date.now() + input.ttlMs), data: input.data || {},
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
export async function consumeChallenge(id: string, purpose: string, secret: string) {
  const row = await db.transaction(async tx => {
    const [challenge] = await tx.select().from(authChallenges).where(eq(authChallenges.id, id)).for("update");
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || challenge.expiresAt <= new Date()
      || challenge.attempts >= 5) return null;
    const matching = safeEqual(challenge.tokenHash, challengeDigest(id, purpose, secret));
    await tx.update(authChallenges).set({ attempts: challenge.attempts + 1,
      ...(matching ? { consumedAt: new Date(), data: {} } : {}) })
      .where(eq(authChallenges.id, id));
    return matching ? challenge : null;
  });
  if (!row) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row;
}