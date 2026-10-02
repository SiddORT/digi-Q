// Real disposable PostgreSQL contention, no app server/SMTP/deployment data.
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/node-postgres";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = import.meta.dirname, bundle = resolve(root, `.auth-contention-${process.pid}.mjs`);
const context = new AsyncLocalStorage();
let h, api, oldHash;
process.env.SESSION_SECRET = "disposable-contention-signing-key-123456789";
process.env.AUTH_SESSION_MODE = "native";
Object.assign(process.env, { SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "fixture",
  SMTP_PASSWORD: "disposable-fixture-not-a-secret", SMTP_FROM: "fixture@example.invalid" });
globalThis.authRaceMail = [];
globalThis.authRaceMailFailure = false;
before(async () => {
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  await h.control.query("drop table auth_sessions");
  await h.control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0012_native_auth_additive.sql"), "utf8"));
  globalThis.authRaceDb = new Proxy(h.db, { get(target, prop) {
    const db = context.getStore() || target;
    return typeof db[prop] === "function" ? db[prop].bind(db) : db[prop];
  } });
  await build({
    stdin: { contents: 'export * from "./lib/native-auth"; export * from "./routes/auth";', resolveDir: root },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-race", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "race" }));
      b.onLoad({ filter: /.*/, namespace: "race" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.authRaceDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "no-mail" }));
      b.onLoad({ filter: /.*/, namespace: "no-mail" }, () => ({ contents:
        `export default { createTransport(){return { async sendMail(message) {
          if (globalThis.authRaceMailFailure) throw new Error("fixture delivery failure");
          globalThis.authRaceMail.push(message);
          return { accepted: [message.to], rejected: [] };
        } };} };` }));
    } }],
  });
  api = await import(bundle);
  oldHash = await api.hashPassword("original password 123");
});
beforeEach(async () => {
  await h.control.query("truncate auth_sessions, auth_challenges, auth_rate_limits, users cascade");
  globalThis.authRaceMail.length = 0;
  globalThis.authRaceMailFailure = false;
  await h.control.query("insert into users(id,email,full_name,role,password_hash) values('staff','staff@example.test','Staff','doctor',$1)", [oldHash]);
});
after(async () => {
  await h?.close(); await rm(bundle, { force: true });
  delete globalThis.authRaceDb; delete globalThis.authRaceMail; delete globalThis.authRaceMailFailure;
});
function response() {
  return { cookies: {}, headers: {}, cookie(k,v) { this.cookies[k] = v; }, clearCookie() {}, set(k,v) { this.headers[k] = v; return this; }, json(v) { this.body = v; } };
}
async function route(path, body, identity = {}, res = response()) {
  await api.authRouter.stack.find(l => l.route?.path === path).route.stack[0].handle(
    { body, ip: "192.0.2.1", headers: {}, ...identity }, res);
  return res;
}
async function challenge(purpose = "reset") {
  const secret = "s".repeat(43);
  const id = await api.createChallenge({ userId: "staff", email: "staff@example.test", purpose, secret, ttlMs: 600000 });
  return `${id}.${secret}`;
}
async function race(operations) {
  const gate = await h.connect(), clients = await Promise.all(operations.map(() => h.connect()));
  const pending = [];
  let settled;
  try {
    await gate.query("begin");
    await gate.query("select pg_advisory_xact_lock(hashtext('auth-credentials:staff'))");
    // Queue each worker behind the real lock in a deterministic order.
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i], pid = (await client.query("select pg_backend_pid() pid")).rows[0].pid;
      pending.push(context.run(drizzle(client), operations[i]));
      settled = Promise.allSettled(pending);
      let waiting = false;
      for (let n = 0; n < 500; n++) {
        if ((await h.control.query("select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted", [pid])).rowCount) {
          waiting = true; break;
        }
        await delay(10);
      }
      assert.ok(waiting, `worker ${i} must actually contend in PostgreSQL`);
    }
    await gate.query("commit");
    return await settled;
  } finally {
    await gate.query("rollback");
    await settled;
    await Promise.all([gate, ...clients].map(client => client.end()));
  }
}
const reset = token => route("/auth/reset-password", { token, password: "replacement password 456" });
test("different outstanding reset tokens contend: one wins and all old credentials/sessions are revoked", async () => {
  const a = await challenge(), b = await challenge(), invite = await challenge("invitation"), device = await challenge("device");
  await api.createSession(response(), "staff", oldHash);
  const result = await race([() => reset(a), () => reset(b)]);
  assert.deepEqual(result.map(r => r.status), ["fulfilled", "rejected"]);
  assert.equal(result[1].reason.code, "INVALID_VERIFICATION");
  assert.equal((await h.control.query("select count(*)::int n from auth_sessions where revoked_at is null")).rows[0].n, 0);
  for (const token of [a,b,invite,device]) {
    const id = token.split(".")[0];
    assert.ok((await h.control.query("select consumed_at from auth_challenges where id=$1", [id])).rows[0].consumed_at);
  }
});
test("same reset token replay under contention has exactly one winner", async () => {
  const token = await challenge();
  const result = await race([() => reset(token), () => reset(token)]);
  assert.deepEqual(result.map(r => r.status), ["fulfilled", "rejected"]);
});
test("login with pre-reset verification cannot issue a session after reset commits", async () => {
  const token = await challenge(), res = response();
  const result = await race([() => reset(token), () => api.createSession(res, "staff", oldHash)]);
  assert.deepEqual(result.map(r => r.status), ["fulfilled", "rejected"]);
  assert.equal(result[1].reason.code, "INVALID_CREDENTIALS");
  assert.deepEqual(res.cookies, {});
});
test("login ordered before reset is revoked by the same password transaction", async () => {
  const token = await challenge();
  const result = await race([() => route("/auth/login", { email: "staff@example.test", password: "original password 123" }), () => reset(token)]);
  assert.deepEqual(result.map(r => r.status), ["fulfilled", "fulfilled"]);
  assert.equal((await h.control.query("select count(*)::int n from auth_sessions where revoked_at is null")).rows[0].n, 0);
});
test("session-insert failure rolls back invitation consumption, password and revocations; cookie is not emitted", async () => {
  const token = await challenge("invitation");
  await api.createSession(response(), "staff", oldHash);
  await h.control.query(`create function reject_test_session() returns trigger language plpgsql as $$begin raise exception 'fixture insert failure'; end$$;
    create trigger reject_test_session before insert on auth_sessions for each row execute function reject_test_session()`);
  try {
    const res = response();
    await assert.rejects(() => route("/auth/invitation/accept", { token, password: "replacement password 456" }, {}, res),
      error => error.cause?.message === "fixture insert failure");
    assert.deepEqual(res.cookies, {});
    assert.equal((await h.control.query("select password_hash from users where id='staff'")).rows[0].password_hash, oldHash);
    assert.equal((await h.control.query("select consumed_at from auth_challenges where id=$1", [token.split(".")[0]])).rows[0].consumed_at, null);
    assert.equal((await h.control.query("select revoked_at from auth_sessions")).rows[0].revoked_at, null);
  } finally {
    await h.control.query("drop trigger reject_test_session on auth_sessions; drop function reject_test_session()");
  }
});
test("password change racing reset cannot overwrite the winner using an old password", async () => {
  const token = await challenge();
  const result = await race([() => reset(token), () => route("/auth/change-password",
    { currentPassword: "original password 123", password: "changed password 789" },
    { authUserId: "staff", authSessionHash: "isolated-session-proof", method: "POST", path: "/api/auth/change-password" })]);
  assert.deepEqual(result.map(r => r.status), ["fulfilled", "rejected"]);
  assert.equal(result[1].reason.code, "INVALID_CREDENTIALS");
});
test("password change invalidates outstanding setup/recovery links and sessions without changing identity", async () => {
  await challenge(); await challenge("invitation");
  await api.createSession(response(), "staff", oldHash);
  await route("/auth/change-password", { currentPassword: "original password 123", password: "changed password 789" },
    { authUserId: "staff", authSessionHash: "isolated-session-proof", method: "POST", path: "/api/auth/change-password" });
  assert.equal((await h.control.query("select count(*)::int n from auth_challenges where consumed_at is null")).rows[0].n, 0);
  assert.equal((await h.control.query("select count(*)::int n from auth_sessions where revoked_at is null")).rows[0].n, 0);
  assert.deepEqual((await h.control.query("select id,email,role from users")).rows, [{ id: "staff", email: "staff@example.test", role: "doctor" }]);
});
test("shared rate limit admits only its maximum across independent database clients", async () => {
  const clients = await Promise.all(Array.from({ length: 6 }, () => h.connect()));
  try {
    const results = await Promise.allSettled(clients.map(client => context.run(drizzle(client),
      () => api.consumeRateLimit("smtp-test:actor:isolated", 3, 900000))));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 3);
    assert.ok(results.filter(r => r.status === "rejected").every(r => r.reason.status === 429));
  } finally { await Promise.all(clients.map(client => client.end())); }
});
async function pendingRegistration({ aged = true, purpose = "register" } = {}) {
  const id = await api.createChallenge({ email: "pending@example.test", purpose, secret: "123456", ttlMs: 600000,
    data: { fullName: "Pending Admin", passwordHash: oldHash } });
  if (aged) await h.control.query("update auth_challenges set created_at=now()-interval '61 seconds' where id=$1", [id]);
  return id;
}
test("registration resend preserves pending data/expiry, rotates code and creates exactly one verified account", async () => {
  const id = await pendingRegistration();
  await h.control.query("update auth_challenges set attempts=2 where id=$1", [id]);
  const before = (await h.control.query("select * from auth_challenges where id=$1", [id])).rows[0];
  const res = await route("/auth/registration/resend", { challengeId: id });
  assert.deepEqual(res.body, { challengeId: id });
  assert.equal((await h.control.query("select count(*)::int n from users where email='pending@example.test'")).rows[0].n, 0);
  const after = (await h.control.query("select * from auth_challenges where id=$1", [id])).rows[0];
  assert.deepEqual(after.data, before.data);
  assert.deepEqual(after.expires_at, before.expires_at);
  assert.notEqual(after.token_hash, before.token_hash);
  assert.equal(after.attempts, before.attempts);
  await assert.rejects(() => api.validateChallenge(id, "register", "123456"), { code: "INVALID_VERIFICATION" });
  const secret = /code is (\d{6})/.exec(globalThis.authRaceMail[0].text)[1];
  await route("/auth/register/verify", { challengeId: id, code: secret });
  await assert.rejects(() => route("/auth/register/verify", { challengeId: id, code: secret }), { code: "INVALID_VERIFICATION" });
  assert.deepEqual((await h.control.query("select role,password_hash from users where email='pending@example.test'")).rows,
    [{ role: "clinicAdmin", password_hash: oldHash }]);
});
test("resend cooldown is shared and delivery failure preserves the old usable code", async () => {
  const fresh = await pendingRegistration({ aged: false }), res = response();
  await assert.rejects(() => route("/auth/registration/resend", { challengeId: fresh }, {}, res),
    { status: 429, code: "REGISTRATION_RESEND_COOLDOWN" });
  assert.equal(res.headers["Retry-After"], "60");
  const id = await pendingRegistration();
  globalThis.authRaceMailFailure = true;
  await assert.rejects(() => route("/auth/registration/resend", { challengeId: id }), { code: "EMAIL_DELIVERY_FAILED" });
  await api.validateChallenge(id, "register", "123456");
  globalThis.authRaceMailFailure = false;
  await route("/auth/registration/resend", { challengeId: id });
  await assert.rejects(() => route("/auth/registration/resend", { challengeId: id }, { ip: "192.0.2.2" }),
    { status: 429, code: "REGISTRATION_RESEND_COOLDOWN" });
  assert.equal(globalThis.authRaceMail.length, 1);
});
test("unknown, expired, consumed, wrong-purpose and exhausted challenges reject generically without mail", async () => {
  for (const state of ["unknown", "expired", "consumed", "purpose", "attempts"]) {
    const id = state === "unknown" ? "z".repeat(24) : await pendingRegistration({ purpose: state === "purpose" ? "patient" : "register" });
    if (state === "expired") await h.control.query("update auth_challenges set expires_at=now()-interval '1 second' where id=$1", [id]);
    if (state === "consumed") await h.control.query("update auth_challenges set consumed_at=now() where id=$1", [id]);
    if (state === "attempts") await h.control.query("update auth_challenges set attempts=5 where id=$1", [id]);
    await assert.rejects(() => route("/auth/registration/resend", { challengeId: id }),
      { status: 400, code: "INVALID_VERIFICATION", message: "Invalid or expired verification" });
  }
  assert.equal(globalThis.authRaceMail.length, 0);
});
test("concurrent registration resends serialize across clients; only one new code is delivered", async () => {
  const id = await pendingRegistration(), gate = await h.connect();
  const clients = await Promise.all([h.connect(), h.connect()]);
  let settled;
  try {
    await gate.query("begin");
    await gate.query("select id from auth_challenges where id=$1 for update", [id]);
    const pids = await Promise.all(clients.map(async c => (await c.query("select pg_backend_pid() pid")).rows[0].pid));
    settled = Promise.allSettled(clients.map(c => context.run(drizzle(c),
      () => api.resendRegistrationChallenge(id, async (address, secret) => { globalThis.authRaceMail.push({ address, secret }); }))));
    let waiting = 0;
    for (let n = 0; n < 500; n++) {
      waiting = (await h.control.query("select count(*)::int n from pg_stat_activity where pid=any($1::int[]) and wait_event_type='Lock'", [pids])).rows[0].n;
      if (waiting === 2) break;
      await delay(10);
    }
    assert.equal(waiting, 2, "both workers block on actual PostgreSQL locks");
    await gate.query("commit");
    const results = await settled;
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.find(r => r.status === "rejected").reason.code, "REGISTRATION_RESEND_COOLDOWN");
    assert.equal(globalThis.authRaceMail.length, 1);
    await api.validateChallenge(id, "register", globalThis.authRaceMail[0].secret);
  } finally {
    await gate.query("rollback"); await settled;
    await Promise.all([gate, ...clients].map(c => c.end()));
  }
});
test("resend retains shared IP abuse protection across challenge IDs", async () => {
  for (let i = 0; i < 25; i++)
    await api.consumeRateLimit("registration-resend:ip:192.0.2.1", 25);
  const id = await pendingRegistration();
  await assert.rejects(() => route("/auth/registration/resend", { challengeId: id }),
    { status: 429, code: "RATE_LIMITED" });
  assert.equal(globalThis.authRaceMail.length, 0);
  await api.validateChallenge(id, "register", "123456");
});