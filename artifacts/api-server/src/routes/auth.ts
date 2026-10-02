import { Router } from "express";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@workspace/db";
import { HttpError, assert } from "../lib/http";
import { uid, put, audit } from "../lib/store";
import { isStaffRole, requireUser } from "../lib/auth";
import { sendAuthEmail, smtpConfig } from "../lib/auth-email";
import { createSession, revokeSession, hashPassword, verifyPassword, issueCsrf,
  lockCredentials, invalidateStaffCredentials, insertSession, sessionCookie, challengeUserId,
  resendRegistrationChallenge,
  createChallenge, validateChallenge, consumeChallenge, consumeRateLimit, passwordInput } from "../lib/native-auth";

export const authRouter = Router();
const CODE_AGE = 10 * 60_000;
const LINK_AGE = 30 * 60_000;
const code = () => randomBytes(4).readUInt32BE() % 900000 + 100000;
function email(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(normalized))
    throw new HttpError(400, "Valid email required", "INVALID_EMAIL");
  return normalized;
}
function publicOrigin(req: any): string {
  const origin = process.env.CLINICFLOW_PUBLIC_ORIGIN;
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw new HttpError(503, "Public email links are not configured", "PUBLIC_ORIGIN_UNCONFIGURED");
  return origin;
}
async function localUser(address: string) {
  const [row] = await db.select().from(users).where(sql`lower(${users.email})=${address}`).limit(1);
  return row;
}
async function limit(req: any, address: string, action: string, maximum = 5) {
  await consumeRateLimit(`${action}:account:${address}`, maximum);
  await consumeRateLimit(`${action}:ip:${req.ip || "unknown"}`, maximum * 10);
}
async function mailCode(address: string, purpose: string, userId?: string, data?: Record<string, unknown>) {
  smtpConfig();
  const secret = String(code());
  const challengeId = await createChallenge({ userId, email: address, purpose, secret, ttlMs: CODE_AGE, data });
  await sendAuthEmail(address, "DigiQ Doctors verification", `Your verification code is ${secret}. It expires in 10 minutes.`);
  return challengeId;
}
async function mailLink(req: any, address: string, userId: string, purpose: string, route: string) {
  smtpConfig();
  const secret = randomBytes(32).toString("base64url");
  const id = await createChallenge({ userId, email: address, purpose, secret, ttlMs: LINK_AGE });
  const url = new URL(route, publicOrigin(req));
  url.searchParams.set("token", `${id}.${secret}`);
  await sendAuthEmail(address, "DigiQ Doctors account access", `Use this link within 30 minutes: ${url}`);
}
function splitToken(token: unknown) {
  const parts = typeof token === "string" ? /^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(token) : null;
  if (!parts) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return { id: parts[1], secret: parts[2] };
}
export async function inviteStaff(req: any, row: { id: string; email: string }) {
  await mailLink(req, row.email.toLowerCase(), row.id, "invitation", "/set-password");
  await db.update(users).set({ invitationStatus: "sent" }).where(eq(users.id, row.id));
}
export async function requestStaffReset(req: any, row: { id: string; email: string }) {
  // Assisted recovery follows the same no-account-cap policy as self-service.
  await consumeRateLimit(`forgot-password:ip:${req?.ip || "unknown"}`, 30);
  await mailLink(req, row.email.toLowerCase(), row.id, "reset", "/reset-password");
}
authRouter.get("/auth/csrf", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ csrfToken: issueCsrf(_req, res) });
});
authRouter.get("/auth/status", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const userId = (req as any).authUserId as string | undefined;
  const [user] = userId ? await db.select({ role: users.role }).from(users).where(eq(users.id, userId)) : [];
  const role = user?.role ?? null;
  // Session checks can overlap the login form's CSRF bootstrap on first load.
  // They must not issue a second cookie that invalidates the bootstrap header.
  // Only /auth/csrf owns CSRF cookie issuance.
  res.json({ role, staffPasswordVerified: Boolean(role && isStaffRole(role)), requiresStaffPassword: false });
});
authRouter.post("/auth/login", async (req, res) => {
  const address = email(req.body?.email), password = req.body?.password;
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  await limit(req, address, "staff-login");
  const user = await localUser(address);
  const validPassword = await verifyPassword(user?.passwordHash, password);
  if (!user || !isStaffRole(user.role) || user.status !== "active" || !validPassword)
    throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
  // Password authentication is independent of email delivery. SMTP is required
  // only by endpoints that explicitly send verification or recovery messages.
  await revokeSession(req, res);
  await createSession(res, user.id, user.passwordHash!);
  res.set("Cache-Control", "no-store").json({
    authenticated: true,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status },
  });
});
// No runtime issuer remains. Retain a fail-closed compatibility tombstone for
// stale clients, including any still-valid historical device challenge.
authRouter.post("/auth/verify-device", (_req, res) => {
  res.set("Cache-Control", "no-store");
  throw new HttpError(410, "Device verification is retired. Use staff email and password.", "AUTH_METHOD_REMOVED");
});
authRouter.post("/auth/logout", async (req, res) => {
  await revokeSession(req, res);
  res.set("Cache-Control", "no-store").json({ authenticated: false });
});
authRouter.post("/auth/forgot-password", async (req, res) => {
  const address = email(req.body?.email);
  // Recovery has no per-account request cap; retain the existing IP abuse limit.
  await consumeRateLimit(`forgot-password:ip:${req.ip || "unknown"}`, 30);
  smtpConfig();
  const user = await localUser(address);
  if (user?.status === "active" && isStaffRole(user.role)) await mailLink(req, address, user.id, "reset", "/reset-password");
  res.set("Cache-Control", "no-store").json({ sent: true });
});
async function updatePassword(req: any, res: any, purpose: "reset" | "invitation") {
  const { id, secret } = splitToken(req.body?.token);
  passwordInput(req.body?.password);
  await consumeRateLimit(`${purpose}:token:${id}`, 5);
  await consumeRateLimit(`${purpose}:ip:${req.ip || "unknown"}`, 20);
  await validateChallenge(id, purpose, secret);
  const hashed = await hashPassword(req.body.password);
  const userId = await challengeUserId(id);
  const token = await db.transaction(async tx => {
    await lockCredentials(tx, userId);
    const challenge = await consumeChallenge(id, purpose, secret, tx);
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || challenge.userId !== user.id || user.status !== "active" || !isStaffRole(user.role) ||
        user.email.toLowerCase() !== challenge.email)
      throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
    await tx.update(users).set({ passwordHash: hashed, passwordChangedAt: new Date(), emailVerifiedAt: new Date(), invitationStatus: "notRequired" }).where(eq(users.id, user.id));
    await invalidateStaffCredentials(tx, user.id);
    return purpose === "invitation" ? insertSession(tx, user.id) : undefined;
  });
  if (token) sessionCookie(res, token);
  res.set("Cache-Control", "no-store").json(purpose === "invitation" ? { authenticated: true } : { reset: true });
}
authRouter.post("/auth/reset-password", async (req, res) => updatePassword(req, res, "reset"));
authRouter.post("/auth/invitation/accept", async (req, res) => updatePassword(req, res, "invitation"));
authRouter.post("/auth/change-password", async (req, res) => {
  const actor = await requireUser(req);
  assert(isStaffRole(actor.role), 403, "Staff account required");
  await limit(req, actor.id, "change-password");
  passwordInput(req.body?.password);
  const [user] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!user || !await verifyPassword(user.passwordHash, req.body?.currentPassword))
    throw new HttpError(401, "Invalid password", "INVALID_CREDENTIALS");
  const hashed = await hashPassword(req.body.password);
  await db.transaction(async tx => {
    await lockCredentials(tx, actor.id);
    const [current] = await tx.select().from(users).where(eq(users.id, actor.id)).for("update");
    if (!current || current.status !== "active" || !isStaffRole(current.role) || current.passwordHash !== user.passwordHash)
      throw new HttpError(401, "Invalid password", "INVALID_CREDENTIALS");
    await tx.update(users).set({ passwordHash: hashed, passwordChangedAt: new Date() }).where(eq(users.id, actor.id));
    await invalidateStaffCredentials(tx, actor.id);
    await audit(actor, "changePassword", "users", actor, tx);
  });
  res.set("Cache-Control", "no-store").json({ changed: true });
});
authRouter.post("/auth/patient/start", async (req, res) => {
  const address = email(req.body?.email);
  await limit(req, address, "patient-login");
  smtpConfig();
  const user = await localUser(address);
  const challengeId = user && (user.status !== "active" || user.role !== "patient")
    ? randomBytes(18).toString("base64url")
    : await mailCode(address, "patient", user?.id);
  res.set("Cache-Control", "no-store").json({ challengeId });
});
authRouter.post("/auth/patient/verify", async (req, res) => {
  await consumeRateLimit(`patient-verify:${req.ip || "unknown"}`, 25);
  const { challengeId, code: submitted } = req.body || {};
  if (typeof challengeId !== "string" || typeof submitted !== "string") throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
  const challenge = await consumeChallenge(challengeId, "patient", submitted);
  const existing = await localUser(challenge.email);
  if (existing && (existing.role !== "patient" || existing.status !== "active"))
    throw new HttpError(401, "Invalid verification", "INVALID_VERIFICATION");
  const user = existing || await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + challenge.email}))`);
    const [nowExisting] = await tx.select().from(users).where(sql`lower(${users.email})=${challenge.email}`).limit(1);
    if (nowExisting) { assert(nowExisting.role === "patient" && nowExisting.status === "active", 401, "Invalid verification"); return nowExisting; }
    return put(users, { id: uid(), email: challenge.email, fullName: "", role: "patient", invitationStatus: "notRequired", emailVerifiedAt: new Date() }, tx);
  });
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  await createSession(res, user.id);
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
authRouter.post("/auth/register/start", async (req, res) => {
  const address = email(req.body?.email);
  const name = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  if (!name || name.length > 200) throw new HttpError(400, "Full name required", "INVALID_NAME");
  passwordInput(req.body?.password);
  await limit(req, address, "clinic-register", 3);
  smtpConfig();
  if (await localUser(address)) throw new HttpError(409, "Account already registered", "ACCOUNT_EXISTS");
  const hash = await hashPassword(req.body.password);
  const challengeId = await mailCode(address, "register", undefined, { fullName: name, passwordHash: hash });
  res.set("Cache-Control", "no-store").json({ challengeId });
});
authRouter.post("/auth/registration/resend", async (req, res) => {
  res.set("Cache-Control", "no-store");
  await consumeRateLimit(`registration-resend:ip:${req.ip || "unknown"}`, 25);
  const id = req.body?.challengeId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(id))
    throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  smtpConfig();
  try {
    const challengeId = await resendRegistrationChallenge(id, (address, secret) =>
      sendAuthEmail(address, "DigiQ Doctors verification", `Your verification code is ${secret}. Use it before your original registration code expires.`));
    res.json({ challengeId });
  } catch (error) {
    if (error instanceof HttpError && error.code === "REGISTRATION_RESEND_COOLDOWN")
      res.set("Retry-After", "60");
    throw error;
  }
});
authRouter.post("/auth/register/verify", async (req, res) => {
  await consumeRateLimit(`register-verify:${req.ip || "unknown"}`, 25);
  const { challengeId, code: submitted } = req.body || {};
  if (typeof challengeId !== "string" || typeof submitted !== "string") throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
  const challenge = await consumeChallenge(challengeId, "register", submitted);
  const user = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + challenge.email}))`);
    const [existing] = await tx.select().from(users).where(sql`lower(${users.email})=${challenge.email}`).limit(1);
    assert(!existing, 409, "Account already registered");
    const record = await put(users, { id: uid(), email: challenge.email, fullName: String(challenge.data.fullName),
      role: "clinicAdmin", status: "active", passwordHash: String(challenge.data.passwordHash),
      emailVerifiedAt: new Date(), invitationStatus: "notRequired" }, tx);
    await audit(record, "registerClinicAdmin", "users", record, tx);
    return record;
  });
  await createSession(res, user.id);
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
// Old provider-only endpoints fail closed rather than silently granting access.
authRouter.post("/auth/staff-verify", (_req, _res) => { throw new HttpError(410, "Use local staff login", "AUTH_METHOD_REMOVED"); });