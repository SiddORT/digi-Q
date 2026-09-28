// Isolated Unix-socket PostgreSQL; never reads DATABASE_URL or contacts SMTP.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = resolve(import.meta.dirname);
const bundle = resolve(root, `.native-auth-test-${process.pid}.mjs`);
process.env.SESSION_SECRET = "disposable-test-signing-key-not-for-production-123";
process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://example.test";
Object.assign(process.env, { SMTP_HOST: "localhost", SMTP_PORT: "587", SMTP_USER: "test",
  SMTP_PASSWORD: "test-not-a-credential", SMTP_FROM: "test@example.test" });
globalThis.nativeAuthMail = [];
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
    stdin: { contents: 'export * from "./lib/native-auth"; export * from "./lib/auth-email"; export * from "./routes/auth";',
      resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-auth", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
      b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.nativeAuthDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "isolated-mail" }));
      b.onLoad({ filter: /.*/, namespace: "isolated-mail" }, () => ({ contents: `
        export default { createTransport() { return { async sendMail(message) {
          globalThis.nativeAuthMail.push(message);
        } }; } };
      ` }));
    } }],
  });
  api = await import(bundle);
});
beforeEach(async () => {
  await h.control.query("truncate auth_sessions, auth_challenges, auth_rate_limits, users cascade");
  globalThis.nativeAuthMail.length = 0;
});
after(async () => {
  try { if (h) await h.close(); }
  finally { await rm(bundle, { force: true }); delete globalThis.nativeAuthDb; delete globalThis.nativeAuthMail; }
});
function request(body = {}, cookie = "") {
  return { body, ip: "198.51.100.20", method: "POST", path: "/api/auth",
    headers: { cookie, origin: "https://example.test" },
    get(name) { return this.headers[name.toLowerCase()]; } };
}
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
test("standalone device challenge is HMAC-bound, single-use, and requires active staff identity", async () => {
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
  const verified = await route("/auth/verify-device", { challengeId, code });
  assert.equal(verified.res.body.authenticated, true);
  assert.equal(verified.res.cookies[api.SESSION_COOKIE].options.secure, true);
  assert.deepEqual((await h.control.query("select data from auth_challenges where id=$1", [challengeId])).rows[0].data, {});
  await assert.rejects(() => api.consumeChallenge(challengeId, "device", code), /Invalid or expired/);
  await assert.rejects(() => route("/auth/verify-device", { challengeId, code }), /Invalid or expired/);
  const inactiveChallenge = await api.createChallenge({ userId: "device-staff", email: "device@example.test",
    purpose: "device", secret: "654321", ttlMs: 600_000 });
  await h.control.query("update users set status='inactive' where id='device-staff'");
  await assert.rejects(() => route("/auth/verify-device", { challengeId: inactiveChallenge, code: "654321" }),
    error => error.code === "INVALID_VERIFICATION" && error.status === 401);
  assert.equal(globalThis.nativeAuthMail.length, 0);
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
test("verified registration and patient email create separate roles without an email provider", async () => {
  const register = await route("/auth/register/start", { email: "clinic@example.test",
    fullName: "Clinic Admin", password: "disposable clinic passphrase 123" });
  const registerCode = /code is (\d{6})/.exec(globalThis.nativeAuthMail.pop().text)[1];
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