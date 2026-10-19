// Isolated Unix-socket PostgreSQL; never reads DATABASE_URL or contacts SMTP.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { decodeJwt } from "jose";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = resolve(import.meta.dirname);
const bundle = resolve(root, `.native-auth-test-${process.pid}.mjs`);
process.env.SESSION_SECRET = "disposable-test-signing-key-not-for-production-123";
process.env.AUTH_SESSION_MODE = "native";
process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://example.test";
for (const name of ["SECURE", "REQUIRE_TLS", "FROM_NAME", "NOTIFICATIONS_ENABLED"]) delete process.env[`SMTP_${name}`];
Object.assign(process.env, { SMTP_HOST: "localhost", SMTP_PORT: "587", SMTP_USER: "test",
  SMTP_PASSWORD: "test-not-a-credential", SMTP_FROM: "test@example.test",
  DIGI_SMTP_HOST: "ignored.example.invalid", DIGI_SMTP_PORT: "465", DIGI_SMTP_USER: "ignored",
  DIGI_SMTP_PASSWORD: "ignored-fixture", DIGI_SMTP_FROM: "ignored@example.invalid" });
globalThis.nativeAuthMail = [];
Object.assign(process.env, { NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
  NOTIFICATION_SMS_KEY:"fictional-key",NOTIFICATION_SMS_BEARER_TOKEN:"fictional-token",
  NOTIFICATION_SMS_CLIENT_ID:"fictional-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_ENABLED:"false" });
globalThis.nativeAuthSms=[];
const smsCalls=globalThis.nativeAuthSms;
let h, api;
before(async () => {
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  // Queue fixtures contain an obsolete session stub; let the auth migration
  // install the real token-hash primary-key table instead.
  await h.control.query("drop table auth_sessions");
  await h.control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0012_native_auth_additive.sql"), "utf8"));
  globalThis.nativeAuthDb = h.db;
  await build({
    stdin: { contents: 'export * from "./lib/native-auth"; export * from "./lib/jwt-session"; export * from "./lib/auth-email"; export * from "./routes/auth"; export * from "./lib/notification-template-store"; export * from "./lib/notification-templates"; export * from "./lib/patient-login-sms"; export * from "./lib/security-notifications";',
      resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-auth", setup(b) {
      b.onResolve({filter:/^@workspace\/api-zod$/},()=>({path:resolve(root,"../../../lib/api-zod/src/generated/api.ts")}));
      b.onResolve({filter:/notification-sms-transport$/},()=>({path:"sms-transport",namespace:"isolated-sms"}));
      b.onLoad({filter:/.*/,namespace:"isolated-sms"},()=>({contents:`
        export * from "${resolve(root,"lib/notification-sms-transport.ts")}";
        export async function sendNotificationSms(_env,_mobile,message) {
          globalThis.nativeAuthSms.push(message);return globalThis.nativeAuthSmsOutcome || "provider_accepted";
        }
      `,loader:"ts",resolveDir:root}));
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
      b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.nativeAuthDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "isolated-mail" }));
      b.onLoad({ filter: /.*/, namespace: "isolated-mail" }, () => ({ contents: `
        export default { createTransport() { return { async sendMail(message) {
          globalThis.nativeAuthMail.push(message);
          if(globalThis.nativeAuthMailFailure) throw Object.assign(new Error("fictional transport failure"),{code:globalThis.nativeAuthMailFailure});
        } }; } };
      ` }));
    } }],
  });
  api = await import(bundle);
});
beforeEach(async () => {
  await h.control.query("truncate auth_sessions, auth_challenges, auth_rate_limits, users cascade");
  globalThis.nativeAuthMail.length = 0;
  smsCalls.length=0;
  delete globalThis.nativeAuthSmsOutcome;
  delete globalThis.nativeAuthMailFailure;
  await h.control.query("delete from settings where id ~ '(clinic_registration_otp|patient_email_otp|registration_mobile_otp|doctor_setup|staff_setup|password_setup_complete)'");
});
after(async () => {
  delete globalThis.nativeAuthSms;
  delete globalThis.nativeAuthSmsOutcome;
  try { if (h) await h.close(); }
  finally { await rm(bundle, { force: true }); delete globalThis.nativeAuthDb; delete globalThis.nativeAuthMail; }
});
function request(body = {}, cookie = "") {
  return { body, ip: "198.51.100.20", method: "POST", path: "/api/auth",
    headers: { cookie, origin: "https://example.test" },
    get(name) { return this.headers[name.toLowerCase()]; } };
}
test("rate-limit rejection reports remaining time without extending the window", async () => {
  await api.consumeRateLimit("retry-duration-fixture", 1, 60000);
  await assert.rejects(api.consumeRateLimit("retry-duration-fixture", 1, 60000),
    error => error.code === "RATE_LIMITED" && /^Too many attempts\. Try again in (?:[1-9]|[1-5][0-9]|60) seconds\.$/.test(error.message));
});
function response() {
  return { cookies: {}, headers: {}, set(name, value) { this.headers[name] = value; return this; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this; },
    clearCookie(name) { this.cookies[name] = null; return this; },
    json(body) { this.body = body; return this; } };
}
async function route(path, body = {}, cookie = "") {
  const r = request(body, cookie), s = response();
  const layer = api.authRouter.stack.find(l => l.route?.path === path && l.route.methods.post);
  assert.ok(layer, path);
  await layer.route.stack[0].handle(r, s);
  return { req: r, res: s };
}
async function resolveSession(req) {
  await new Promise((resolve, reject) => api.nativeSession(req, response(), error => error ? reject(error) : resolve()));
}
test("Argon2id staff login immediately issues a secure session without device email, CSRF and revocation", async () => {
  const password = "disposable staff passphrase with 24 chars";
  const hash = await api.hashPassword(password);
  assert.match(hash, /^\$argon2id\$v=19\$m=65536,p=1,t=3\$/);
  await h.control.query("insert into users(id,email,full_name,role,password_hash) values ($1,$2,$3,$4,$5)",
    ["staff", "staff@example.test", "Staff", "doctor", hash]);
  const login = await route("/auth/login", { email: "staff@example.test", password });
  assert.deepEqual(login.res.body, { authenticated: true,
    user: { id: "staff", email: "staff@example.test", fullName: "Staff", role: "doctor", status: "active" } });
  assert.equal(globalThis.nativeAuthMail.length, 0);
  assert.equal((await h.control.query("select count(*)::int as n from auth_challenges")).rows[0].n, 0);
  const cookie = login.res.cookies[api.SESSION_COOKIE];
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal(cookie.options.sameSite, "lax");
  const raw = cookie.value;
  assert.equal((await h.control.query("select token_hash from auth_sessions")).rows[0].token_hash === raw, false);
  const req = request({}, `${api.SESSION_COOKIE}=${raw}`);
  await resolveSession(req);
  assert.equal(req.authUserId, "staff");
  const csrfRes = response(), csrf = api.issueCsrf(req, csrfRes);
  const reused = request({}, `${api.CSRF_COOKIE}=${csrf}`);
  assert.equal(api.issueCsrf(reused, response()), csrf);
  const invalid = request({}, `${api.CSRF_COOKIE}=${csrf}`);
  invalid.headers["x-csrf-token"] = "wrong";
  await new Promise(resolve => api.checkCsrf(invalid, response(), error => { assert.equal(error.status, 403); resolve(); }));
  await api.revokeSession(req, response());
  const revoked = request({}, `${api.SESSION_COOKIE}=${raw}`);
  await resolveSession(revoked);
  assert.equal(revoked.authUserId, undefined);
});
test("retired device endpoint rejects even valid historical challenges without consuming or issuing credentials", async () => {
  const hash = await api.hashPassword("standalone device fixture password 123");
  await h.control.query("insert into users(id,email,full_name,role,password_hash) values ($1,$2,$3,$4,$5)",
    ["device-staff", "device@example.test", "Device Staff", "doctor", hash]);
  const code = "123456";
  const challengeId = await api.createChallenge({ userId: "device-staff", email: "device@example.test",
    purpose: "device", secret: code, ttlMs: 600_000 });
  const [challenge] = (await h.control.query("select token_hash from auth_challenges where id=$1", [challengeId])).rows;
  assert.notEqual(challenge.token_hash, code);
  assert.match(challenge.token_hash, /^[0-9a-f]{64}$/);
  await assert.rejects(() => api.consumeChallenge(challengeId, "device", "000000"), /Invalid or expired/);
  for (const body of [{ challengeId, code }, {}, { challengeId, code: "000000" }]) {
    const res = response();
    const layer = api.authRouter.stack.find(l => l.route?.path === "/auth/verify-device");
    await assert.rejects(async () => layer.route.stack[0].handle(request(body), res),
      error => error.code === "AUTH_METHOD_REMOVED" && error.status === 410);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.deepEqual(res.cookies, {});
  }
  assert.equal((await h.control.query("select consumed_at from auth_challenges where id=$1", [challengeId])).rows[0].consumed_at, null);
  assert.equal((await h.control.query("select count(*)::int n from auth_sessions")).rows[0].n, 0);
  assert.equal(globalThis.nativeAuthMail.length, 0);
});
test("disposable single-key cutover forces reauth; compromise revocation prevents old-key rollback resurrection", async () => {
  const keys = ["AUTH_SESSION_MODE", "JWT_SIGNING_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const oldKey = "disposable-cutover-old-key-never-used-outside-tests";
  const newKey = "disposable-cutover-new-key-never-used-outside-tests";
  const password = "disposable key cutover password 123";
  const hash = await api.hashPassword(password);
  const digest = value => createHash("sha256").update(value).digest("hex");
  const identity = async () => (await h.control.query("select id,email,full_name,role,status,password_hash,clerk_id from users order by id")).rows;
  const session = async token => {
    const req = request({}, `${api.SESSION_COOKIE}=${token}`);
    await resolveSession(req);
    return req;
  };
  try {
    for (const key of keys.filter(key => key.startsWith("SMTP_"))) delete process.env[key];
    await h.control.query("insert into users(id,email,full_name,role,password_hash,clerk_id) values ('cutover','cutover@example.test','Cutover','doctor',$1,'preserved-provider-mapping')", [hash]);
    const baseline = await identity();
    process.env.AUTH_SESSION_MODE = "jwt";
    process.env.JWT_SIGNING_KEY = oldKey;
    const old = (await route("/auth/login", { email: "cutover@example.test", password })).res.cookies[api.SESSION_COOKIE].value;
    assert.equal((await session(old)).authUserId, "cutover");
    // Coordinated one-key replacement: no overlap/refresh support is asserted.
    process.env.JWT_SIGNING_KEY = newKey;
    assert.equal((await session(old)).authUserId, undefined);
    assert.equal((await h.control.query("select revoked_at from auth_sessions where token_hash=$1", [digest(old)])).rows[0].revoked_at, null);
    const fresh = (await route("/auth/login", { email: "cutover@example.test", password })).res.cookies[api.SESSION_COOKIE].value;
    assert.equal((await session(fresh)).authUserId, "cutover");
    assert.equal(decodeJwt(fresh).exp - decodeJwt(fresh).iat, 43200);
    const parts = fresh.split(".");
    parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(fresh), sub: "attacker" })).toString("base64url");
    assert.equal((await session(parts.join("."))).authUserId, undefined);
    // Knowing a signing key alone cannot create the required DB proof.
    const forged = await api.signSessionJwt("cutover");
    assert.equal((await session(forged)).authUserId, undefined);
    await api.revokeSession(await session(fresh), response());
    assert.equal((await session(fresh)).authUserId, undefined);
    // Demonstrate the rollback hazard, then the durable compromise response.
    process.env.JWT_SIGNING_KEY = oldKey;
    assert.equal((await session(old)).authUserId, "cutover", "restoring an unrevoked old key resurrects its session");
    await h.control.query("update auth_sessions set revoked_at=now() where revoked_at is null");
    assert.equal((await session(old)).authUserId, undefined);
    process.env.JWT_SIGNING_KEY = newKey;
    assert.equal((await session(fresh)).authUserId, undefined);
    const after = (await route("/auth/login", { email: "cutover@example.test", password })).res.cookies[api.SESSION_COOKIE].value;
    assert.equal((await session(after)).authUserId, "cutover");
    await api.revokeUserSessions("cutover");
    assert.equal((await session(after)).authUserId, undefined);
    assert.deepEqual(await identity(), baseline, "IDs, mapping, role, status and password hash unchanged");
    assert.equal(globalThis.nativeAuthMail.length, 0);
    assert.equal((await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n, 0);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
test("native default sessions survive optional JWT key replacement without mode activation", async () => {
  const savedMode = process.env.AUTH_SESSION_MODE, savedKey = process.env.JWT_SIGNING_KEY;
  try {
    delete process.env.AUTH_SESSION_MODE;
    await h.control.query("insert into users(id,email,full_name,role) values ('native','native@example.test','Native','doctor')");
    const res = response();
    await api.createSession(res, "native");
    process.env.JWT_SIGNING_KEY = "disposable-native-mode-unused-replacement-key";
    const req = request({}, `${api.SESSION_COOKIE}=${res.cookies[api.SESSION_COOKIE].value}`);
    await resolveSession(req);
    assert.equal(req.authUserId, "native");
  } finally {
    if (savedMode === undefined) delete process.env.AUTH_SESSION_MODE; else process.env.AUTH_SESSION_MODE = savedMode;
    if (savedKey === undefined) delete process.env.JWT_SIGNING_KEY; else process.env.JWT_SIGNING_KEY = savedKey;
  }
});
test("unknown email has no session, bad tokens avoid hash work, and absent SMTP fails explicitly", async () => {
  await assert.rejects(() => route("/auth/login", { email: "unknown@example.test", password: "disposable password 123" }),
    /Invalid email or password/);
  assert.equal(globalThis.nativeAuthMail.length, 0);
  await assert.rejects(() => route("/auth/reset-password", {
    token: "a".repeat(24) + "." + "b".repeat(43), password: "disposable password 123",
  }), /Invalid or expired/);
  assert.throws(() => api.smtpConfig({}), error => error.code === "EMAIL_UNCONFIGURED");
  assert.throws(() => api.passwordInput("x".repeat(1025)), error => error.code === "INVALID_PASSWORD");
});
test("all SMTP settings absent: staff login works, denials remain credential errors, mail endpoints fail explicitly", async () => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    const password = "disposable absent smtp staff password 123";
    const hash = await api.hashPassword(password);
    await h.control.query("insert into users(id,email,full_name,role,status,password_hash) values ($1,$2,$3,$4,$5,$6)",
      ["staff", "staff@example.test", "Staff", "doctor", "active", hash]);
    await h.control.query("insert into users(id,email,full_name,role,status,password_hash) values ($1,$2,$3,$4,$5,$6)",
      ["inactive", "inactive@example.test", "Inactive", "doctor", "inactive", hash]);
    await h.control.query("insert into users(id,email,full_name,role,status,password_hash) values ($1,$2,$3,$4,$5,$6)",
      ["passwordless", "passwordless@example.test", "Passwordless", "doctor", "active", null]);
    await h.control.query("insert into users(id,email,full_name,role,status,password_hash) values ($1,$2,$3,$4,$5,$6)",
      ["patient", "patient@example.test", "Patient", "patient", "active", hash]);
    for (const [email, attempt] of [
      ["staff@example.test", "incorrect disposable password"],
      ["inactive@example.test", password],
      ["passwordless@example.test", password],
      ["patient@example.test", password],
    ]) {
      await assert.rejects(() => route("/auth/login", { email, password: attempt }),
        error => error.code === "INVALID_CREDENTIALS" && error.status === 401);
    }
    assert.equal((await h.control.query("select count(*)::int as n from auth_sessions")).rows[0].n, 0);
    const login = await route("/auth/login", { email: "staff@example.test", password });
    assert.deepEqual(login.res.body, { authenticated: true,
      user: { id: "staff", email: "staff@example.test", fullName: "Staff", role: "doctor", status: "active" } });
    const cookie = login.res.cookies[api.SESSION_COOKIE];
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(globalThis.nativeAuthMail.length, 0);
    assert.equal((await h.control.query("select count(*)::int as n from auth_challenges")).rows[0].n, 0);
    const req = request({}, `${api.SESSION_COOKIE}=${cookie.value}`);
    await resolveSession(req);
    assert.equal(req.authUserId, "staff");
    await api.revokeSession(req, response());
    const revoked = request({}, `${api.SESSION_COOKIE}=${cookie.value}`);
    await resolveSession(revoked);
    assert.equal(revoked.authUserId, undefined);
    for (const [path, body] of [
      ["/auth/forgot-password", { email: "staff@example.test" }],
      ["/auth/register/start", { email: "new@example.test", fullName: "New Admin", password }],
      ["/auth/patient/start", { email: "newpatient@example.test" }],
    ]) {
      await assert.rejects(() => route(path, body), error => error.code === "EMAIL_UNCONFIGURED");
    }
    await assert.rejects(() => api.inviteStaff(null, { id: "staff", email: "staff@example.test" }),
      error => error.code === "EMAIL_UNCONFIGURED");
    await assert.rejects(() => api.requestStaffReset(null, { id: "staff", email: "staff@example.test" }),
      error => error.code === "EMAIL_UNCONFIGURED");
    assert.equal((await h.control.query("select count(*)::int as n from auth_challenges")).rows[0].n, 0);
    assert.equal(globalThis.nativeAuthMail.length, 0);
    // Redeeming an already-issued reset token has no email-delivery dependency.
    const id = await api.createChallenge({ userId: "staff", email: "staff@example.test",
      purpose: "reset", secret: "b".repeat(43), ttlMs: 600_000 });
    assert.equal((await route("/auth/reset-password", { token: `${id}.${"b".repeat(43)}`,
      password: "new disposable staff password 123" })).res.body.reset, true);
    assert.equal(globalThis.nativeAuthMail.length, 0);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
test("account limiter and single-use challenge persist across requests", async () => {
  for (let i = 0; i < 5; i++) await api.consumeRateLimit("test-account", 5);
  await assert.rejects(() => api.consumeRateLimit("test-account", 5), error => error.status === 429);
  const id = await api.createChallenge({ email: "person@example.test", purpose: "patient",
    secret: "123456", ttlMs: 600_000, data: { fullName: "Test" } });
  assert.notEqual((await h.control.query("select token_hash from auth_challenges where id=$1", [id])).rows[0].token_hash,
    "123456");
  const result = await api.consumeChallenge(id, "patient", "123456");
  assert.deepEqual(result.data, { fullName: "Test" });
  assert.deepEqual((await h.control.query("select data from auth_challenges where id=$1", [id])).rows[0].data, {});
  await assert.rejects(() => api.consumeChallenge(id, "patient", "123456"), /Invalid or expired/);
});
test("registration preflight rejects every missing original field despite complete DIGI settings", async () => {
  for (const field of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) {
    const original = process.env[field];
    try {
      delete process.env[field];
      await assert.rejects(() => route("/auth/register/start", {
        email: `${field.toLowerCase()}@example.test`, fullName: "Fictional Admin", password: "fictional preflight password 123",
      }), error => error.code === "EMAIL_UNCONFIGURED");
      assert.equal((await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n, 0);
      assert.equal((await h.control.query("select count(*)::int n from users")).rows[0].n, 0);
      assert.equal(globalThis.nativeAuthMail.length, 0);
    } finally {
      if (original === undefined) delete process.env[field]; else process.env[field] = original;
    }
  }
});
test("verified registration and patient email create separate roles with original SMTP settings and fictional transport", async () => {
  const register = await route("/auth/register/start", { email: "clinic@example.test",
    fullName: "Clinic Admin", password: "disposable clinic passphrase 123" });
  const registrationMail = globalThis.nativeAuthMail.pop();
  assert.equal(registrationMail.subject, "Verify your DigiQ clinic registration");
  assert.match(registrationMail.text, /clinic administrator registration/);
  const registerCode = /code is (\d{6})/.exec(registrationMail.text)[1];
  const confirmed = await route("/auth/register/verify",
    { challengeId: register.res.body.challengeId, code: registerCode });
  assert.equal(confirmed.res.body.authenticated, true);
  const admin = (await h.control.query("select role, password_hash from users where email='clinic@example.test'")).rows[0];
  assert.equal(admin.role, "clinicAdmin");
  assert.match(admin.password_hash, /^\$argon2id\$/);
  const patient = await route("/auth/patient/start", { email: "patient@example.test" });
  const patientCode = /code is (\d{6})/.exec(globalThis.nativeAuthMail.pop().text)[1];
  await route("/auth/patient/verify", { challengeId: patient.res.body.challengeId, code: patientCode });
  const row = (await h.control.query("select role, full_name, password_hash from users where email='patient@example.test'")).rows[0];
  assert.equal(row.role, "patient");
  assert.equal(row.full_name, "", "name remains unset until real patient onboarding");
  assert.equal(row.password_hash, null);
  const forbidden = await route("/auth/patient/start", { email: "clinic@example.test" });
  assert.ok(forbidden.res.body.challengeId);
  assert.equal(globalThis.nativeAuthMail.length, 0, "staff identity never gets a patient OTP");
});
async function setupSmsPatient() {
  await h.control.query("insert into users(id,email,full_name,role,mobile) values('sms-patient','sms-patient@example.test','SMS Patient','patient','+919876543210')");
  const current=await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms");
  await api.saveTemplate({id:"fixture-admin",role:"superAdmin"},{channel:"sms",event:"patient_login_otp",recipient:"patient",
    revision:current.local.revision,mode:"publish",content:{...api.defaultTemplate("patient_login_otp"),senderId:"",dltEntityId:"",dltTemplateId:"FIXTURE_OTP"}});
}
const smsCode=()=>/login code is (\d{6})/.exec(smsCalls.at(-1))?.[1];

test("SMS patient login preserves identity and issues a single-use secure session even with optional SMS disabled",async()=>{
  await setupSmsPatient();
  const started=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  assert.equal(smsCalls.length,1);
  const otp=smsCode();assert(otp);
  assert(!JSON.stringify(started.res.body).includes(otp));
  const challengeId=started.res.body.challengeId;
  const challenge=(await h.control.query("select * from auth_challenges where id=$1",[challengeId])).rows[0];
  assert.equal(challenge.purpose,"patient-sms");
  assert.notEqual(challenge.token_hash,otp);
  assert(!JSON.stringify(challenge.data).includes(otp));
  const verified=await route("/auth/patient/verify",{channel:"sms",challengeId,code:otp});
  assert.equal(verified.res.body.authenticated,true);
  assert.equal(verified.res.cookies[api.SESSION_COOKIE].options.httpOnly,true);
  const req=request({},`${api.SESSION_COOKIE}=${verified.res.cookies[api.SESSION_COOKIE].value}`);await resolveSession(req);
  assert.equal(req.authUserId,"sms-patient");
  await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId,code:otp}));
  const row=(await h.control.query("select * from users where id='sms-patient'")).rows[0];
  assert.equal(row.role,"patient");
  assert.equal(row.email_verified_at,null,"SMS must not verify email ownership");
  assert.equal(row.data.mobileVerified,true);
  assert.equal((await h.control.query("select count(*)::int as n from users")).rows[0].n,1);
  assert.equal(globalThis.nativeAuthMail.length,0);
  const saved=(await h.control.query("select data from settings")).rows;
  assert(!JSON.stringify(saved).includes(otp),"No login code in notification history/outbox/settings");
});
test("wrong SMS codes consume the bounded attempt budget durably and cannot cross email verification",async()=>{
  await setupSmsPatient();
  const started=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  const challengeId=started.res.body.challengeId,otp=smsCode();
  const wrong=otp==="000000"?"111111":"000000";
  for(let i=0;i<5;i++)await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId,code:wrong}));
  assert.equal((await h.control.query("select attempts from auth_challenges where id=$1",[challengeId])).rows[0].attempts,5);
  await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId,code:otp}));
  const second=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  await assert.rejects(route("/auth/patient/verify",{challengeId:second.res.body.challengeId,code:smsCode()}));
});
test("SMS login rejects expiry, changed phone/status and shared numbers without creating accounts",async()=>{
  await setupSmsPatient();
  const started=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  await h.control.query("update auth_challenges set expires_at=now()-interval '1 minute' where id=$1",[started.res.body.challengeId]);
  await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId:started.res.body.challengeId,code:smsCode()}));
  const second=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  const otp=smsCode();
  await h.control.query("update users set mobile='+919876543211' where id='sms-patient'");
  await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId:second.res.body.challengeId,code:otp}));
  await h.control.query("update users set mobile='+919876543210',status='inactive' where id='sms-patient'");
  smsCalls.length=0;
  await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  assert.equal(smsCalls.length,0);
  await h.control.query("update users set status='active' where id='sms-patient'; insert into users(id,email,full_name,role,mobile) values('shared','shared@example.test','Shared','patient','+919876543210')");
  await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  await route("/auth/patient/start",{channel:"sms",mobile:"+919876543212"});
  assert.equal(smsCalls.length,0);
  assert.equal((await h.control.query("select count(*)::int as n from auth_sessions")).rows[0].n,0);
});
test("resending SMS invalidates the previous challenge and uncertain or rejected dispatch is never retried",async()=>{
  await setupSmsPatient();
  const first=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"}),old=smsCode();
  const second=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"}),latest=smsCode();
  await assert.rejects(route("/auth/patient/verify",{channel:"sms",challengeId:first.res.body.challengeId,code:old}));
  assert.equal((await route("/auth/patient/verify",{channel:"sms",challengeId:second.res.body.challengeId,code:latest})).res.body.authenticated,true);
  for(const outcome of ["provider_rejected","pre_dispatch_failed","delivery_unknown"]){
    globalThis.nativeAuthSmsOutcome=outcome;
    const count=smsCalls.length;
    await assert.rejects(api.startPatientSmsLogin("+919876543210",h.db),error=>error.code==="PATIENT_SMS_DELIVERY_FAILED");
    assert.equal(smsCalls.length,count+1,"Exactly one dispatch attempt");
    const challenge=(await h.control.query("select consumed_at,data from auth_challenges order by created_at desc limit 1")).rows[0];
    assert(challenge.consumed_at);assert.deepEqual(challenge.data,{});
  }
});
test("patient OTP is platform-scoped, SMS-only, switchable and requires its code placeholder",async()=>{
  await setupSmsPatient();
  const sa={id:"fixture-admin",role:"superAdmin"};
  const current=await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms");
  for(const patch of [{clinicId:"foreign"},{channel:"email"},{recipient:"doctor"},
    {content:{...current.content,body:"No OTP placeholder"}},
    {content:{...current.content,subject:"Code {{otp}}",body:"No body code"}}])
    await assert.rejects(api.saveTemplate(sa,{channel:"sms",event:"patient_login_otp",recipient:"patient",revision:current.local.revision,mode:"publish",content:current.content,...patch}));
  await api.changeActivation(sa,{channel:"sms",event:"patient_login_otp",recipient:"patient",revision:current.local.revision,enabled:false});
  await assert.rejects(api.startPatientSmsLogin("+919876543210",h.db),{code:"SECURITY_DELIVERY_DISABLED"});
  const off=await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms");
  await api.changeActivation(sa,{channel:"sms",event:"patient_login_otp",recipient:"patient",revision:off.local.revision,enabled:true});
  await assert.rejects(api.saveTemplate(sa,{channel:"email",event:"booking",recipient:"patient",revision:0,mode:"publish",content:{...api.defaultTemplate("booking"),body:"Code {{otp}}"}}));
});
test("previously published OTP-only patient SMS wording stays usable and obeys activation",async()=>{
  await setupSmsPatient();
  const id="sms-template:platform:patient_login_otp";
  // Model an existing saved template, not a fresh publish through new validation.
  await h.control.query("update settings set data=jsonb_set(data,'{published,body}',to_jsonb($2::text)) where id=$1",
    [id,"Your login code is {{otp}}. Do not share it."]);
  const persisted=await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms");
  assert.equal(persisted.content.enabled,true);
  assert(!persisted.content.body.includes("expiry_minutes"));
  const first=await api.startPatientSmsLogin("+919876543210",h.db);
  const otp=/code is (\d{6})/.exec(smsCalls.at(-1))?.[1];
  assert(otp);
  assert(first);
  const challenge=(await h.control.query("select expires_at,consumed_at from auth_challenges where id=$1",[first])).rows[0];
  assert(challenge.expires_at>new Date());assert.equal(challenge.consumed_at,null);
  const target={event:"patient_login_otp",recipient:"patient",channel:"sms"};
  const actor={id:"fixture-admin",role:"superAdmin"};
  await api.changeActivation(actor,{...target,revision:persisted.local.revision,enabled:false});
  await assert.rejects(api.startPatientSmsLogin("+919876543210",h.db),{code:"SECURITY_DELIVERY_DISABLED"});
  assert.equal(smsCalls.length,1);
  const off=await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms");
  await api.changeActivation(actor,{...target,revision:off.local.revision,enabled:true});
  assert.equal(smsCalls.length,1);
  await api.startPatientSmsLogin("+919876543210",h.db);
  assert.equal(smsCalls.length,2);
});

test("recovery exceeds three requests without an account cap and keeps token safeguards", async () => {
  await h.control.query("insert into users(id,email,full_name,role) values ('recovery','recovery@example.test','Recovery','doctor')");
  // Even an already exhausted legacy account bucket must not block recovery.
  for (let i = 0; i < 3; i++) await api.consumeRateLimit("forgot-password:account:recovery@example.test", 3);
  const tokens = [];
  for (let i = 0; i < 5; i++) {
    const result = await route("/auth/forgot-password", { email: "recovery@example.test" });
    assert.equal(result.res.body.sent, true);
    tokens.push(new URL(/https:\/\/\S+/.exec(globalThis.nativeAuthMail.pop().text)[0]).searchParams.get("token"));
  }
  assert.equal(new Set(tokens).size, 5);
  for (const token of tokens) assert.match(token, /^[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/);
  const password = "recovered secure passphrase 123";
  await assert.rejects(() => route("/auth/reset-password", { token: tokens[0], password: "short" }));
  const reset = await route("/auth/reset-password", { token: tokens[0], password });
  assert.equal(reset.res.body.reset, true);
  await assert.rejects(() => route("/auth/reset-password", { token: tokens[0], password }), /Invalid or expired/);
  const row = (await h.control.query("select password_hash from users where id='recovery'")).rows[0];
  assert.match(row.password_hash, /^\$argon2id\$/);
  assert.equal(await api.verifyPassword(row.password_hash, password), true);
  await h.control.query("update auth_challenges set expires_at=now()-interval '1 second' where purpose='reset'");
  await assert.rejects(() => route("/auth/reset-password", { token: tokens[1], password }), /Invalid or expired/);
  // Other authentication account limits remain active.
  for (let i = 0; i < 5; i++) await assert.rejects(() => route("/auth/login", { email: "recovery@example.test", password: "wrong" }), error => error.status === 401);
  await assert.rejects(() => route("/auth/login", { email: "recovery@example.test", password: "wrong" }), error => error.status === 429);
});
test("invitation sets credential once; reset revokes previously issued sessions", async () => {
  await h.control.query("insert into users(id,email,full_name,role) values ('invited','invited@example.test','Invited','doctor')");
  await api.inviteStaff(null, { id: "invited", email: "invited@example.test" });
  const link = globalThis.nativeAuthMail.pop().text;
  const token = new URL(/https:\/\/\S+/.exec(link)[0]).searchParams.get("token");
  assert.ok(token);
  const accept = await route("/auth/invitation/accept", { token, password: "invited staff passphrase 123" });
  assert.equal(accept.res.body.authenticated, true);
  const sessionToken = accept.res.cookies[api.SESSION_COOKIE].value;
  const reset = await route("/auth/forgot-password", { email: "invited@example.test" });
  assert.equal(reset.res.body.sent, true);
  const resetToken = new URL(/https:\/\/\S+/.exec(globalThis.nativeAuthMail.pop().text)[0]).searchParams.get("token");
  await route("/auth/reset-password", { token: resetToken, password: "a different new passphrase 123" });
  const old = request({}, `${api.SESSION_COOKIE}=${sessionToken}`);
  await resolveSession(old);
  assert.equal(old.authUserId, undefined);
  assert.equal((await h.control.query("select invitation_status from users where id='invited'")).rows[0].invitation_status, "notRequired");
});

async function publishSecuritySms(event, recipient) {
  const current = await api.resolvedTemplate(event,undefined,h.db,recipient,"sms");
  await api.saveTemplate({id:"fictional-security-admin",role:"superAdmin"},{
    channel:"sms",event,recipient,revision:current.local.revision,mode:"publish",
    content:{...current.content,dltTemplateId:"FICTIONAL_APPROVED_CONTENT"},
  });
}
const lastEmailCode = () => /code is (\d{6})/.exec(globalThis.nativeAuthMail.at(-1).text)[1];
const lastMobileCode = () => /code is (\d{6})/.exec(smsCalls.at(-1))[1];
const newAdmin = (suffix, mobile) => ({email:`${suffix}@example.invalid`,fullName:"Example Clinic Admin",password:"Fictional-only-password-42",...(mobile?{mobile}:{})});

test("registration channels are independent: phone proof cannot verify email or create a session",async()=>{
  await publishSecuritySms("registration_mobile_otp","clinicAdmin");
  const started = await route("/auth/register/start",newAdmin("dual","+919876543210"));
  const {challengeId,channels} = started.res.body;
  assert.equal(channels.email.status,"provider_accepted");
  assert.equal(channels.sms.status,"provider_accepted");
  assert(!channels.sms.destination.includes("+919876543210"));
  assert.equal(started.res.cookies[api.SESSION_COOKIE],undefined);
  const emailCode = lastEmailCode(), phoneCode = lastMobileCode();
  const mobile = await route("/auth/registration/mobile/verify",{challengeId,code:phoneCode});
  assert.deepEqual(mobile.res.body,{mobileVerified:true});
  assert.equal(mobile.res.cookies[api.SESSION_COOKIE],undefined);
  assert.equal((await h.control.query("select count(*)::int n from users")).rows[0].n,0);
  const parent = (await h.control.query("select * from auth_challenges where id=$1",[challengeId])).rows[0];
  assert.equal(parent.consumed_at,null);
  assert.equal(parent.data.mobileVerified,true);
  await assert.rejects(route("/auth/registration/mobile/verify",{challengeId,code:phoneCode}));
  const done = await route("/auth/register/verify",{challengeId,code:emailCode});
  assert(done.res.body.authenticated);
  const user = (await h.control.query("select * from users where email='dual@example.invalid'")).rows[0];
  assert(user.email_verified_at);
  assert.equal(user.mobile,"+919876543210");
  assert.equal(user.data.mobileVerified,true);
  assert(!JSON.stringify(done.res.body).includes(emailCode));
  assert.equal((await h.control.query("select count(*)::int n from settings where id like 'notification-history:%' or id like '%outbox:%'")).rows[0].n,0);
});

test("registration email failure preserves successful SMS and resend uses the published template and actual remaining expiry",async()=>{
  await publishSecuritySms("registration_mobile_otp","clinicAdmin");
  const base = api.defaultTemplate("clinic_registration_otp");
  await api.saveTemplate({id:"fictional-security-admin",role:"superAdmin"},{event:"clinic_registration_otp",recipient:"clinicAdmin",
    revision:0,mode:"publish",content:{...base,subject:"Example verification",body:"Example code is {{otp}}; expires in {{expiry_minutes}} minutes."}});
  globalThis.nativeAuthMailFailure = "EAUTH";
  const started = await route("/auth/register/start",newAdmin("partial","+919876543210"));
  assert.equal(started.res.body.channels.email.status,"provider_rejected");
  assert.equal(started.res.body.channels.sms.status,"provider_accepted");
  const challengeId = started.res.body.challengeId, previousCode = lastEmailCode();
  await route("/auth/registration/mobile/verify",{challengeId,code:lastMobileCode()});
  await assert.rejects(route("/auth/registration/resend",{challengeId}),{code:"REGISTRATION_RESEND_COOLDOWN"});
  await h.control.query("update auth_challenges set created_at=now()-interval '2 minutes',expires_at=now()+interval '4 minutes' where id=$1",[challengeId]);
  const expiry = (await h.control.query("select expires_at from auth_challenges where id=$1",[challengeId])).rows[0].expires_at;
  delete globalThis.nativeAuthMailFailure;
  const resent = await route("/auth/registration/resend",{challengeId});
  assert.equal(resent.res.body.channels.email.status,"provider_accepted");
  assert.equal(globalThis.nativeAuthMail.at(-1).subject,"Example verification");
  assert.match(globalThis.nativeAuthMail.at(-1).text,/expires in 4 minutes/);
  const emailCode = lastEmailCode();
  assert.notEqual(emailCode,previousCode);
  const parent = (await h.control.query("select * from auth_challenges where id=$1",[challengeId])).rows[0];
  assert.equal(parent.expires_at.getTime(),expiry.getTime());
  assert(parent.data.mobileVerified);
  await assert.rejects(route("/auth/register/verify",{challengeId,code:previousCode}));
  await route("/auth/register/verify",{challengeId,code:emailCode});
});

test("optional SMS rejection/uncertainty/unavailable never blocks required email proof or marks a number verified",async()=>{
  for(const status of ["provider_rejected","delivery_unknown","unavailable"]) {
    await h.control.query("truncate auth_rate_limits");
    if(status !== "unavailable") await publishSecuritySms("registration_mobile_otp","clinicAdmin");
    else await h.control.query("delete from settings where id like '%registration_mobile_otp%'");
    globalThis.nativeAuthSmsOutcome = status;
    const started = await route("/auth/register/start",newAdmin(status,"+919876543210"));
    assert.equal(started.res.body.channels.email.status,"provider_accepted");
    assert.equal(started.res.body.channels.sms.status,status);
    await route("/auth/register/verify",{challengeId:started.res.body.challengeId,code:lastEmailCode()});
    const user = (await h.control.query("select * from users where email=$1",[`${status}@example.invalid`])).rows[0];
    assert(user.email_verified_at);
    assert.equal(user.data.mobileVerified,false);
  }
});

test("patient optional phone proves only its new email intent; shared phones never merge or take over identities",async()=>{
  await publishSecuritySms("registration_mobile_otp","patient");
  await h.control.query("insert into users(id,email,full_name,role,mobile) values('original','original@example.invalid','Original','patient','+919876543210')");
  const started = await route("/auth/patient/start",{email:"new-patient@example.invalid",mobile:"+919876543210"});
  assert.deepEqual(Object.keys(started.res.body),["challengeId"],"enumeration-resistant response");
  const challengeId = started.res.body.challengeId, emailCode = lastEmailCode();
  await route("/auth/registration/mobile/verify",{challengeId,code:lastMobileCode()});
  await route("/auth/patient/verify",{challengeId,code:emailCode});
  const accounts = (await h.control.query("select * from users order by email")).rows;
  assert.equal(accounts.length,2);
  assert.equal(accounts.find(u=>u.id==="original").email_verified_at,null);
  assert.equal(accounts.find(u=>u.email==="new-patient@example.invalid").data.mobileVerified,true);
  assert.equal((await api.patientAccountsForPhone("+919876543210",h.db)).length,2);
  const existing = await route("/auth/patient/start",{email:"original@example.invalid",mobile:"+919876543211"});
  await route("/auth/registration/mobile/verify",{challengeId:existing.res.body.challengeId,code:lastMobileCode()});
  await route("/auth/patient/verify",{challengeId:existing.res.body.challengeId,code:lastEmailCode()});
  assert.equal((await h.control.query("select mobile from users where id='original'")).rows[0].mobile,"+919876543210","existing phone is immutable through email login");
});
test("patient email resend retains verified phone, original expiry and attempts with generic delivery responses",async()=>{
  await publishSecuritySms("registration_mobile_otp","patient");
  const started=await route("/auth/patient/start",{email:"resend-patient@example.invalid",mobile:"+919876543210"});
  const challengeId=started.res.body.challengeId,originalCode=lastEmailCode();
  await route("/auth/registration/mobile/verify",{challengeId,code:lastMobileCode()});
  await h.control.query("update auth_challenges set created_at=now()-interval '2 minutes',attempts=1 where id=$1",[challengeId]);
  const original=(await h.control.query("select * from auth_challenges where id=$1",[challengeId])).rows[0];
  const resent=await route("/auth/patient/resend",{challengeId});
  assert.deepEqual(resent.res.body,{challengeId});
  const latest=lastEmailCode();
  assert.notEqual(latest,originalCode);
  const parent=(await h.control.query("select * from auth_challenges where id=$1",[challengeId])).rows[0];
  assert(parent.data.mobileVerified);
  assert.equal(parent.expires_at.getTime(),original.expires_at.getTime());
  assert.equal(parent.attempts,1);
  await route("/auth/patient/verify",{challengeId,code:latest});
  assert.equal((await h.control.query("select data from users where email='resend-patient@example.invalid'")).rows[0].data.mobileVerified,true);
  const unmatched="a".repeat(24);
  assert.deepEqual((await route("/auth/patient/resend",{challengeId:unmatched})).res.body,{challengeId:unmatched});
});
test("unverified duplicate registration phone cannot deny an existing patient's SMS login",async()=>{
  await setupSmsPatient();
  await publishSecuritySms("registration_mobile_otp","patient");
  for(const [index,outcome] of ["provider_accepted","provider_rejected"].entries()) {
    globalThis.nativeAuthSmsOutcome=outcome;
    const email=`unverified-duplicate-${index}@example.invalid`;
    const started=await route("/auth/patient/start",{email,mobile:"+919876543210"});
    // Email is proved, but neither provider acceptance nor receipt proves the phone.
    await route("/auth/patient/verify",{challengeId:started.res.body.challengeId,code:lastEmailCode()});
    const saved=(await h.control.query("select mobile,data from users where email=$1",[email])).rows[0];
    assert.equal(saved.mobile,null);
    assert.equal(saved.data.mobileVerified,false);
    assert.equal((await h.control.query("select count(*)::int n from users where mobile='+919876543210'")).rows[0].n,1);
    globalThis.nativeAuthSmsOutcome="provider_accepted";
    const count=smsCalls.length;
    const sms=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
    assert.equal(smsCalls.length,count+1,"original uniquely matched account still gets its login challenge");
    const verified=await route("/auth/patient/verify",{channel:"sms",challengeId:sms.res.body.challengeId,code:smsCode()});
    assert.equal(verified.res.body.authenticated,true);
    const req=request({},`${api.SESSION_COOKIE}=${verified.res.cookies[api.SESSION_COOKIE].value}`);
    await resolveSession(req);
    assert.equal(req.authUserId,"sms-patient");
  }
});

test("mobile expiry, five wrong attempts, cross-purpose codes and superseded mobile challenges fail closed",async()=>{
  await publishSecuritySms("registration_mobile_otp","clinicAdmin");
  const started = await route("/auth/register/start",newAdmin("attempts","+919876543210"));
  const challengeId = started.res.body.challengeId, emailCode=lastEmailCode(), otp=lastMobileCode();
  const [child] = (await h.control.query("select * from auth_challenges where purpose='registration-mobile'")).rows;
  await assert.rejects(route("/auth/register/verify",{challengeId:child.id,code:otp}));
  const wrong = otp === "000000" ? "111111" : "000000";
  for(let i=0;i<5;i++) await assert.rejects(route("/auth/registration/mobile/verify",{challengeId,code:wrong}));
  assert.equal((await h.control.query("select attempts from auth_challenges where id=$1",[child.id])).rows[0].attempts,5);
  await assert.rejects(route("/auth/registration/mobile/verify",{challengeId,code:otp}));
  await h.control.query("truncate auth_rate_limits");
  await route("/auth/registration/mobile/request",{challengeId});
  const next = lastMobileCode();
  await h.control.query("update auth_challenges set expires_at=now()-interval '1 second' where purpose='registration-mobile'");
  await assert.rejects(route("/auth/registration/mobile/verify",{challengeId,code:next}));
  await route("/auth/register/verify",{challengeId,code:emailCode});
  assert.equal((await h.control.query("select data from users where email='attempts@example.invalid'")).rows[0].data.mobileVerified,false);
});

test("platform security templates allow off states but reject missing essentials, clinic overrides, URLs and SMS bearer links",async()=>{
  const admin = {id:"fictional-security-admin",role:"superAdmin"};
  for(const event of ["clinic_registration_otp","patient_email_otp","doctor_setup","staff_setup","password_setup_complete"]) {
    const content=api.defaultTemplate(event);
    const recipient=api.defaultRecipient(event);
    for(const invalid of [{...content,body:content.body+"\nGo to https://attacker.invalid"}]) {
      await assert.rejects(api.saveTemplate(admin,{event,recipient,revision:0,mode:"draft",content:invalid}),{status:400});
    }
    if(event!=="password_setup_complete") await assert.rejects(api.saveTemplate(admin,{event,recipient,revision:0,mode:"publish",
      content:{...content,body:"No authentication credential"}}),{status:400});
    await assert.rejects(api.saveTemplate(admin,{event,recipient,clinicId:"fictional",revision:0,mode:"publish",content}),{status:400});
    await api.saveTemplate(admin,{event,recipient,revision:0,mode:"draft",content:{...content,enabled:false}});
    await api.changeActivation(admin,{event,recipient,channel:"email",revision:1,enabled:false});
    const disabled=await api.resolvedTemplate(event,undefined,h.db,recipient,"email");
    assert.equal(disabled.content.enabled,false);
    assert.equal(disabled.local.draft.enabled,false);
  }
  await assert.rejects(api.saveTemplate(admin,{channel:"sms",event:"doctor_setup",recipient:"doctor",revision:0,mode:"draft",
    content:{...(await api.resolvedTemplate("doctor_setup",undefined,h.db,"doctor","sms")).content,body:"Use {{setup_link}} in {{expiry_minutes}} minutes."}}),{status:400});
});

test("doctor and staff setup notices bypass optional gates, contain no SMS bearer token, and completion is claimed once despite failures",async()=>{
  for(const role of ["doctor","receptionist"]) {
    const setup=role==="doctor"?"doctor_setup":"staff_setup";
    await publishSecuritySms(setup,role);
    await publishSecuritySms("password_setup_complete",role);
    await h.control.query("insert into users(id,email,full_name,role,mobile) values($1,$2,'Example Staff',$3,'+919876543210')",[role,`${role}@example.invalid`,role]);
    await api.inviteStaff(null,{id:role,email:`${role}@example.invalid`});
    const invitation = globalThis.nativeAuthMail.at(-1);
    const token = new URL(/https:\/\/\S+/.exec(invitation.text)[0]).searchParams.get("token");
    assert.match(invitation.text,role==="doctor"?/doctor/:/staff member/);
    assert(!smsCalls.at(-1).includes(token));
    assert(!smsCalls.at(-1).includes("https:"));
    globalThis.nativeAuthMailFailure="ETIMEDOUT";
    globalThis.nativeAuthSmsOutcome="provider_rejected";
    const before=globalThis.nativeAuthMail.length;
    const done = await route("/auth/invitation/accept",{token,password:"Fictional-new-password-42"});
    assert(done.res.body.authenticated);
    assert(done.res.cookies[api.SESSION_COOKIE]);
    assert.equal(done.res.body.channels.email.status,"delivery_unknown");
    assert.equal(done.res.body.channels.sms.status,"provider_rejected");
    assert.equal(globalThis.nativeAuthMail.length,before+1);
    const user=(await h.control.query("select * from users where id=$1",[role])).rows[0];
    assert(await api.verifyPassword(user.password_hash,"Fictional-new-password-42"));
    assert(user.data.passwordSetupNoticeClaimed);
    assert(!globalThis.nativeAuthMail.at(-1).text.includes("Fictional-new-password-42"));
    await assert.rejects(route("/auth/invitation/accept",{token,password:"Fictional-new-password-42"}));
    assert.equal(globalThis.nativeAuthMail.length,before+1);
    delete globalThis.nativeAuthMailFailure;delete globalThis.nativeAuthSmsOutcome;
  }
});
test("disabled verification and setup fail closed before challenges while independent security delivery stays usable",async()=>{
  const admin={id:"fixture-admin",role:"superAdmin"};
  const toggle=async(event,recipient,channel,enabled)=>{
    const current=await api.resolvedTemplate(event,undefined,h.db,recipient,channel);
    await api.changeActivation(admin,{event,recipient,channel,revision:current.local.revision,enabled});
  };
  await toggle("patient_email_otp","patient","email",false);
  for(const email of ["new@example.invalid","inactive@example.invalid"]) {
    if(email.startsWith("inactive"))await h.control.query("insert into users(id,email,full_name,role,status) values('inactive',$1,'Inactive','patient','inactive')",[email]);
    await assert.rejects(route("/auth/patient/start",{email}),{code:"SECURITY_DELIVERY_DISABLED"});
  }
  await assert.rejects(route("/auth/patient/resend",{challengeId:"fictional"}),{code:"SECURITY_DELIVERY_DISABLED"});
  assert.equal((await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n,0);
  assert.equal(globalThis.nativeAuthMail.length,0);
  await setupSmsPatient();
  // Disabling email must not accidentally disable the independent SMS login.
  const sms=await route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"});
  assert(sms.res.body.challengeId);assert.equal(smsCalls.length,1);
  await toggle("patient_login_otp","patient","sms",false);
  const count=(await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n;
  await assert.rejects(route("/auth/patient/start",{channel:"sms",mobile:"+919876543210"}),{code:"SECURITY_DELIVERY_DISABLED"});
  assert.equal((await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n,count);
  assert.equal(smsCalls.length,1);
  await toggle("patient_login_otp","patient","sms",true);
  assert.equal(smsCalls.length,1,"enabling does not replay");
  await toggle("clinic_registration_otp","clinicAdmin","email",false);
  await assert.rejects(route("/auth/register/start",newAdmin("disabled")),{code:"SECURITY_DELIVERY_DISABLED"});
  await assert.rejects(route("/auth/registration/resend",{challengeId:"fictional"}),{code:"SECURITY_DELIVERY_DISABLED"});
  await toggle("doctor_setup","doctor","email",false);
  await h.control.query("insert into users(id,email,full_name,role) values('disabled-doctor','disabled-doctor@example.invalid','Fixture','doctor')");
  await assert.rejects(api.inviteStaff(null,{id:"disabled-doctor",email:"disabled-doctor@example.invalid"}),{code:"SECURITY_DELIVERY_DISABLED"});
  assert.equal((await h.control.query("select count(*)::int n from auth_challenges")).rows[0].n,count);
  assert.equal(globalThis.nativeAuthMail.length,0);
  await toggle("registration_mobile_otp","patient","sms",false);
  await toggle("patient_email_otp","patient","email",true);
  const started=await route("/auth/patient/start",{email:"mobile-disabled@example.invalid",mobile:"+919876543219"});
  assert(started.res.body.challengeId);
  const parent=(await h.control.query("select data from auth_challenges where id=$1",[started.res.body.challengeId])).rows[0];
  assert.equal(parent.data.mobileVerified,false);
  assert.equal(parent.data.mobileChallengeId,undefined);
  await assert.rejects(route("/auth/registration/mobile/verify",{challengeId:started.res.body.challengeId,code:"123456"}));
  assert.equal((await h.control.query("select count(*)::int n from auth_sessions")).rows[0].n,0);
});
test("security email rechecks activation at SMTP dispatch after asynchronous preparation",async()=>{
  let calls=0;
  const send=async(to,subject,text,_transport,rendered,files,env,beforeDispatch)=>{
    const current=await api.resolvedTemplate("patient_email_otp",undefined,h.db,"patient","email");
    await api.changeActivation({id:"fixture-admin",role:"superAdmin"},{event:"patient_email_otp",recipient:"patient",channel:"email",revision:current.local.revision,enabled:false});
    return api.sendAuthEmail(to,subject,text,{sendMail:async()=>{calls++;}},rendered,files,env,beforeDispatch);
  };
  const result=await api.securityEmail("patient_email_otp","patient","race@example.invalid",{otp:"123456",expiry_minutes:"10"},send,h.db);
  assert.equal(result.status,"disabled");
  assert.equal(calls,0);
  assert.equal(globalThis.nativeAuthMail.length,0);
});