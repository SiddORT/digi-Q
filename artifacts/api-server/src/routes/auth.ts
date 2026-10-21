import { Router } from "express";
import { publicOrigin } from "../lib/public-website";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, users, authChallenges } from "@workspace/db";
import { HttpError, assert } from "../lib/http";
import { uid, put, audit } from "../lib/store";
import { isStaffRole, requireUser } from "../lib/auth";
import { sendAuthEmail, smtpConfig } from "../lib/auth-email";
import { resolvedIntegration } from "../lib/integration-vault";
import { patientLoginPhone, startPatientSmsLogin, verifyPatientSmsLogin } from "../lib/patient-login-sms";
import { securityEmail, securitySms, requireSecurityDelivery, eligibleStaffMobile, type SecurityOutcomes } from "../lib/security-notifications";
import { parse } from "../lib/http";
import { RequestRegistrationMobileCodeBody, VerifyRegistrationMobileCodeBody } from "@workspace/api-zod";
import { optionalRegistrationMobile, requestRegistrationMobile, verifyRegistrationMobile } from "../lib/registration-mobile";
import { createSession, revokeSession, hashPassword, verifyPassword, issueCsrf,
  lockCredentials, invalidateStaffCredentials, insertSession, sessionCookie, challengeUserId,
  resendRegistrationChallenge, getCookie,
  createChallenge, validateChallenge, consumeChallenge, consumeRateLimit, passwordInput } from "../lib/native-auth";
import { withStaffDispatch } from "../lib/staff-dispatch-barrier";
import { accountRoleLabel } from "@workspace/api-zod/notification-variable-contract";

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
async function localUser(address: string) {
  const [row] = await db.select().from(users).where(sql`lower(${users.email})=${address}`).limit(1);
  return row;
}
async function limit(req: any, address: string, action: string, maximum = 5) {
  await consumeRateLimit(`${action}:account:${address}`, maximum);
  await consumeRateLimit(`${action}:ip:${req.ip || "unknown"}`, maximum * 10);
}
async function challengeMinutes(id: string) {
  const [challenge] = await db.select({expiresAt:authChallenges.expiresAt}).from(authChallenges).where(eq(authChallenges.id,id));
  assert(challenge,503,"Verification preparation unavailable");
  return String(Math.max(1,Math.ceil((challenge.expiresAt.getTime()-Date.now())/60_000)));
}
async function mailCode(address: string, purpose: string, userId?: string, data?: Record<string, unknown>) {
  await requireSecurityDelivery(purpose === "register" ? "clinic_registration_otp" : "patient_email_otp",
    purpose === "register" ? "clinicAdmin" : "patient","email");
  smtpConfig((await resolvedIntegration("smtp")).env);
  const secret = String(code());
  const challengeId = await createChallenge({ userId, email: address, purpose, secret, ttlMs: CODE_AGE, data });
  const emailOutcome = await securityEmail(purpose === "register" ? "clinic_registration_otp" : "patient_email_otp",
    purpose === "register" ? "clinicAdmin" : "patient",address,{otp:secret,expiry_minutes:await challengeMinutes(challengeId)});
  if (emailOutcome.status === "disabled") {
    await db.update(authChallenges).set({consumedAt:new Date(),data:{}}).where(eq(authChallenges.id,challengeId));
    throw new HttpError(503,"Verification email delivery is unavailable. Verification is still required.",
      "SECURITY_DELIVERY_DISABLED");
  }
  const smsOutcome = data?.mobile ? await requestRegistrationMobile(challengeId) : {status:"not_requested" as const};
  return {challengeId,channels:{email:emailOutcome,sms:smsOutcome}};
}
async function mailLink(req: any, address: string, userId: string, purpose: string, route: string) {
  const target = purpose === "invitation" ? await localUser(address) : undefined;
  await ensureStaffInvitationConfigured(target?.role);
  const url = new URL(route, publicOrigin());
  const secret = randomBytes(32).toString("base64url");
  const id = await createChallenge({ userId, email: address, purpose, secret, ttlMs: LINK_AGE });
  url.searchParams.set("token", `${id}.${secret}`);
  return withStaffDispatch([userId], purpose === "invitation" ? "invitation" : "recovery", async () => {
  if (purpose === "invitation") {
    const user = await localUser(address);
     const recipient = user.role as "doctor" | "clinicAdmin" | "receptionist" | "superAdmin";
     assert(user.id === userId, 400, "Invitation account changed");
     const values = {recipient_name:user.fullName,role_name:accountRoleLabel(user.role),
      setup_link:url.toString(),expiry_minutes:await challengeMinutes(id)};
    const email = await securityEmail(recipient === "doctor" ? "doctor_setup" : "staff_setup",recipient,address,values);
    // Advisory contains no bearer link. Independent transport failure cannot erase a saved profile.
    const sms = await securitySms(recipient === "doctor" ? "doctor_setup" : "staff_setup",recipient,eligibleStaffMobile(user.mobile),values);
    if (email.status !== "provider_accepted") await db.update(authChallenges).set({consumedAt:new Date(),data:{}}).where(eq(authChallenges.id,id));
    return {email,sms};
  }
  await sendAuthEmail(address, "DigiQ Doctors account access", `Use this link within 30 minutes: ${url}`);
  return undefined;
  }, db, outcomes => outcomes?.email.status === "delivery_unknown" || outcomes?.sms.status === "delivery_unknown");
}
/** Configuration errors must be detected before committing a new staff profile. */
export async function ensureStaffInvitationConfigured(role?: string) {
  if (role) await requireSecurityDelivery(role === "doctor" ? "doctor_setup" : "staff_setup",
    role as "doctor" | "clinicAdmin" | "receptionist" | "superAdmin","email");
  smtpConfig((await resolvedIntegration("smtp")).env);
  publicOrigin();
}
function splitToken(token: unknown) {
  const parts = typeof token === "string" ? /^([A-Za-z0-9_-]{24})\.([A-Za-z0-9_-]{43})$/.exec(token) : null;
  if (!parts) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return { id: parts[1], secret: parts[2] };
}
export async function inviteStaff(req: any, row: { id: string; email: string }) {
  const channels = await mailLink(req, row.email.toLowerCase(), row.id, "invitation", "/set-password");
  await db.update(users).set({ invitationStatus: channels?.email.status === "provider_accepted" ? "sent" : "failed",
    data:sql`${users.data} || ${JSON.stringify({setupNotificationOutcomes:channels})}::jsonb` }).where(eq(users.id, row.id));
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
  let staffDirectoryRevision: string | undefined;
  if (role) {
    const installed = (await db.execute(sql`select to_regclass('public.staff_deletion_receipts') as present`)).rows[0] as any;
    if (installed?.present)
      staffDirectoryRevision = String((await db.execute(sql`select count(*)::text as revision from staff_deletion_receipts`)).rows[0]?.revision);
  }
  // Only /auth/csrf owns CSRF cookie issuance.
  res.json({ role, staffPasswordVerified: Boolean(role && isStaffRole(role)), requiresStaffPassword: false, staffDirectoryRevision });
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
  smtpConfig((await resolvedIntegration("smtp")).env);
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
  const completed = await db.transaction(async tx => {
    await lockCredentials(tx, userId);
    const challenge = await consumeChallenge(id, purpose, secret, tx);
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || challenge.userId !== user.id || user.status !== "active" || !isStaffRole(user.role) ||
        user.email.toLowerCase() !== challenge.email)
      throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
    await tx.update(users).set({ passwordHash: hashed, passwordChangedAt: new Date(), emailVerifiedAt: new Date(), invitationStatus: "notRequired" }).where(eq(users.id, user.id));
    await invalidateStaffCredentials(tx, user.id);
    // Challenge consumption, credential invalidation and this durable claim commit together.
    // A crash after commit is uncertain, never a reason to replay completion sends.
    if (purpose === "invitation") await tx.update(users).set({
      data:sql`${users.data} || '{"passwordSetupNoticeClaimed":true}'::jsonb`
    }).where(eq(users.id,user.id));
    return {token:purpose === "invitation" ? await insertSession(tx, user.id) : undefined,
      notify:purpose === "invitation" && !user.passwordHash && !user.data?.passwordSetupNoticeClaimed,user};
  });
  if (completed.token) sessionCookie(res, completed.token);
  let channels: SecurityOutcomes | undefined;
  if (completed.notify) {
    const user = completed.user, recipient = user.role as "doctor"|"clinicAdmin"|"receptionist"|"superAdmin";
     const values = {recipient_name:user.fullName,role_name:accountRoleLabel(user.role)};
    channels = {email:await securityEmail("password_setup_complete",recipient,user.email,values),
      sms:await securitySms("password_setup_complete",recipient,eligibleStaffMobile(user.mobile),values)};
  }
  res.set("Cache-Control", "no-store").json(purpose === "invitation" ? { authenticated: true,channels } : { reset: true });
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
  assert(req.body?.channel===undefined||["email","sms"].includes(req.body.channel),400,"Invalid login channel");
  if(req.body?.channel==="sms") {
    const mobile=patientLoginPhone(req.body.mobile);
    await limit(req,mobile,"patient-sms-login");
    const challengeId=await startPatientSmsLogin(mobile);
    res.set("Cache-Control","no-store").json({challengeId});
    return;
  }
  const address = email(req.body?.email);
  await limit(req, address, "patient-login");
  await requireSecurityDelivery("patient_email_otp","patient","email");
  smtpConfig((await resolvedIntegration("smtp")).env);
  const user = await localUser(address);
   const mobile = optionalRegistrationMobile(req.body?.mobile);
   const result = user && (user.status !== "active" || user.role !== "patient")
     ? {challengeId:randomBytes(18).toString("base64url")}
     : await mailCode(address, "patient", user?.id, mobile ? {mobile,mobileVerified:false} : undefined);
   // All email-login starts use the same generic response; no account existence or delivery claim.
   res.set("Cache-Control", "no-store").json({challengeId:result.challengeId});
});
authRouter.post("/auth/patient/verify", async (req, res) => {
  await consumeRateLimit(`patient-verify:${req.ip || "unknown"}`, 25);
  const { challengeId, code: submitted } = req.body || {};
  if (typeof challengeId !== "string" || typeof submitted !== "string") throw new HttpError(400, "Invalid verification", "INVALID_VERIFICATION");
  assert(req.body?.channel===undefined||["email","sms"].includes(req.body.channel),400,"Invalid login channel");
  if(req.body?.channel==="sms") {
    const session=await verifyPatientSmsLogin(challengeId,submitted);
    sessionCookie(res,session);
    res.set("Cache-Control","no-store").json({authenticated:true});
    return;
  }
  const challenge = await consumeChallenge(challengeId, "patient", submitted);
  const existing = await localUser(challenge.email);
  if (existing && (existing.role !== "patient" || existing.status !== "active"))
    throw new HttpError(401, "Invalid verification", "INVALID_VERIFICATION");
  const user = existing || await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"user-email:" + challenge.email}))`);
    const [nowExisting] = await tx.select().from(users).where(sql`lower(${users.email})=${challenge.email}`).limit(1);
    if (nowExisting) { assert(nowExisting.role === "patient" && nowExisting.status === "active", 401, "Invalid verification"); return nowExisting; }
     return put(users, { id: uid(), email: challenge.email, fullName: "", role: "patient", invitationStatus: "notRequired", emailVerifiedAt: new Date(),
       // An unproved optional number must not enter phone-based identity matching.
       mobile:challenge.data.mobileVerified === true && typeof challenge.data.mobile === "string" ? challenge.data.mobile : undefined,
       data:{mobileVerified:challenge.data.mobileVerified === true} }, tx);
  });
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
  await createSession(res, user.id);
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
authRouter.post("/auth/patient/resend",async(req,res)=>{
  await requireSecurityDelivery("patient_email_otp","patient","email");
  const body = parse(RequestRegistrationMobileCodeBody,req.body);
  await consumeRateLimit(`patient-email-resend:ip:${req.ip || "unknown"}`,25);
  // Preserve the same parent intent, phone proof, expiry and attempt budget.
  // Unmatched/expired accounts and transport outcomes have the same public response.
  try {
    await resendRegistrationChallenge(body.challengeId,async(address,secret,expiresAt)=>{
      const outcome = await securityEmail("patient_email_otp","patient",address,
        {otp:secret,expiry_minutes:String(Math.max(1,Math.ceil((expiresAt.getTime()-Date.now())/60_000)))});
      if(outcome.status!=="provider_accepted")throw new HttpError(503,"Email outcome unavailable",
        outcome.status === "disabled" ? "SECURITY_DELIVERY_DISABLED" : "EMAIL_DELIVERY_FAILED");
    },"patient");
  } catch(error) {
    if(!(error instanceof HttpError) || !["INVALID_VERIFICATION","REGISTRATION_RESEND_COOLDOWN","EMAIL_DELIVERY_FAILED"].includes(error.code!))throw error;
  }
  res.set("Cache-Control","no-store").json({challengeId:body.challengeId});
});
authRouter.post("/auth/register/start", async (req, res) => {
  await requireSecurityDelivery("clinic_registration_otp","clinicAdmin","email");
  const address = email(req.body?.email);
  const name = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
  if (!name || name.length > 200) throw new HttpError(400, "Full name required", "INVALID_NAME");
  passwordInput(req.body?.password);
  await limit(req, address, "clinic-register", 3);
  smtpConfig((await resolvedIntegration("smtp")).env);
  if (await localUser(address)) throw new HttpError(409, "Account already registered", "ACCOUNT_EXISTS");
  const hash = await hashPassword(req.body.password);
   const mobile = optionalRegistrationMobile(req.body?.mobile);
   const result = await mailCode(address, "register", undefined, { fullName: name, passwordHash: hash,...(mobile ? {mobile,mobileVerified:false} : {}) });
   const {challengeId} = result;
  res.cookie("digiq_registration", challengeId, { httpOnly: true, secure: true, sameSite: "strict", path: "/api/auth", maxAge: CODE_AGE });
   res.set("Cache-Control", "no-store").json(result);
});
// Credential remains in an HttpOnly cookie, never in a temporary form draft.
authRouter.post("/auth/registration/resume", async (req, res) => {
  const id = getCookie(req, "digiq_registration");
  const [challenge] = typeof id === "string" ? await db.select().from(authChallenges).where(eq(authChallenges.id, id)) : [];
  const valid = challenge && challenge.purpose === "register" && !challenge.consumedAt && challenge.attempts < 5 && challenge.expiresAt > new Date() && challenge.email === email(req.body?.email) && challenge.data?.fullName === req.body?.fullName;
  res.set("Cache-Control", "no-store").json({ challengeId: valid ? id : null, mobilePending:Boolean(valid && challenge.data.mobile) });
});
authRouter.post("/auth/registration/resend", async (req, res) => {
  await requireSecurityDelivery("clinic_registration_otp","clinicAdmin","email");
  res.set("Cache-Control", "no-store");
  await consumeRateLimit(`registration-resend:ip:${req.ip || "unknown"}`, 25);
  const id = req.body?.challengeId;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(id))
    throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  smtpConfig((await resolvedIntegration("smtp")).env);
  try {
     const challengeId = await resendRegistrationChallenge(id, async (address, secret, expiresAt) => {
       const outcome = await securityEmail("clinic_registration_otp","clinicAdmin",address,
         {otp:secret,expiry_minutes:String(Math.max(1,Math.ceil((expiresAt.getTime()-Date.now())/60_000)))});
       if (outcome.status !== "provider_accepted") throw new HttpError(503, outcome.status === "delivery_unknown" ?
         "Email outcome uncertain. The previous code remains valid; wait before retrying." : "Email was not accepted. The previous code remains valid.",
         outcome.status === "disabled" ? "SECURITY_DELIVERY_DISABLED" : "EMAIL_DELIVERY_FAILED");
     });
     res.json({ challengeId,channels:{email:{status:"provider_accepted"}} });
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
       mobile:challenge.data.mobileVerified === true && typeof challenge.data.mobile === "string" ? challenge.data.mobile : undefined,
       data:{mobileVerified:challenge.data.mobileVerified === true},
      emailVerifiedAt: new Date(), invitationStatus: "notRequired" }, tx);
    await audit(record, "registerClinicAdmin", "users", record, tx);
    return record;
  });
  await createSession(res, user.id);
  res.clearCookie("digiq_registration", { httpOnly: true, secure: true, sameSite: "strict", path: "/api/auth" });
  res.set("Cache-Control", "no-store").json({ authenticated: true });
});
authRouter.post("/auth/registration/mobile/request",async(req,res)=>{
  const body = parse(RequestRegistrationMobileCodeBody,req.body);
  await consumeRateLimit(`registration-mobile:ip:${req.ip || "unknown"}`,25);
  const sms = await requestRegistrationMobile(body.challengeId);
  // Generic for patient intents; never certify delivery for an unmatched login identity.
  res.set("Cache-Control","no-store").json({sms});
});
authRouter.post("/auth/registration/mobile/verify",async(req,res)=>{
  const body = parse(VerifyRegistrationMobileCodeBody,req.body);
  await consumeRateLimit(`registration-mobile-verify:ip:${req.ip || "unknown"}`,25);
  await verifyRegistrationMobile(body.challengeId,body.code);
  res.set("Cache-Control","no-store").json({mobileVerified:true});
});
// Old provider-only endpoints fail closed rather than silently granting access.
authRouter.post("/auth/staff-verify", (_req, _res) => { throw new HttpError(410, "Use local staff login", "AUTH_METHOD_REMOVED"); });
