// Real HTTPS/Express requests against a private Unix-socket PostgreSQL and fake SMTP.
// No DATABASE_URL, external SMTP service, or production data is used.
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { request as httpsRequest } from "node:https";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = resolve(import.meta.dirname);
const frontend = resolve(root, "../../clinicflow/src/lib/auth-request.ts");
const bundle = resolve(root, `.auth-http-test-${process.pid}.mjs`);
const transportBundle = resolve(root, `.auth-transport-test-${process.pid}.mjs`);
process.env.NODE_ENV = "production";
process.env.LOG_LEVEL = "silent";
process.env.SESSION_SECRET = "disposable-test-signing-key-not-for-production-123";
process.env.AUTH_SESSION_MODE = "native";
process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://example.test";
Object.assign(process.env, { SMTP_HOST: "localhost", SMTP_PORT: "587", SMTP_USER: "test",
  SMTP_PASSWORD: "test-not-a-credential", SMTP_FROM: "test@example.test" });
globalThis.nativeAuthMail = [];
let harness, temp, server, origin, backend, authRequest;
const jar = new Map();
const sent = [];

function cookieHeader() {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
function rememberCookies(headers) {
  for (const header of headers) {
    const [pair] = header.split(";");
    const at = pair.indexOf("=");
    const name = pair.slice(0, at), value = pair.slice(at + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}
// Browser-like same-origin fetch adapter: only URL/cookie handling is emulated.
// All response bytes and Set-Cookie headers come from the real TLS server.
async function browserFetch(path, options = {}) {
  const url = new URL(path, origin);
  assert.equal(url.origin, origin, "transport must remain same-origin");
  const headers = { origin, "sec-fetch-site": "same-origin",
    ...Object.fromEntries(new Headers(options.headers).entries()) };
  if (options.credentials !== "omit" && cookieHeader()) headers.cookie = cookieHeader();
  const record = { path: url.pathname, method: options.method || "GET", headers: { ...headers }, setCookie: [] };
  sent.push(record);
  return new Promise((resolvePromise, reject) => {
    const req = httpsRequest(url, { method: options.method || "GET", headers, rejectUnauthorized: false }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        record.setCookie = res.headers["set-cookie"] || [];
        if (options.credentials !== "omit") rememberCookies(res.headers["set-cookie"] || []);
        resolvePromise(new Response(Buffer.concat(chunks), {
          status: res.statusCode, headers: { "content-type": res.headers["content-type"] || "application/json" },
        }));
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(options.body);
  });
}
globalThis.fetch = browserFetch;

before(async () => {
  harness = await createQueueHarness({ empty: true });
  await harness.control.query(queueFixtureSql);
  // The queue fixture has a legacy auth_sessions stub with an obsolete id.
  // Replace it with the actual additive auth migration's session table.
  await harness.control.query("drop table auth_sessions");
  await harness.control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0012_native_auth_additive.sql"), "utf8"));
  globalThis.nativeAuthDb = harness.db;
  await build({
    entryPoints: [resolve(root, "app.ts")], outfile: bundle, bundle: true,
    platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-http-auth", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated-db" }));
      b.onLoad({ filter: /.*/, namespace: "isolated-db" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.nativeAuthDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "isolated-mail" }));
      b.onLoad({ filter: /.*/, namespace: "isolated-mail" }, () => ({ contents: `
        export default { createTransport() { return { async sendMail(message) {
          globalThis.nativeAuthMail.push(message);
        } }; } };
      ` }));
    } }],
  });
  backend = await import(bundle);
  temp = await mkdtemp(join(tmpdir(), "clinicflow-auth-https-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(temp, "key.pem"), "-out", join(temp, "cert.pem"), "-days", "1",
    "-subj", "/CN=localhost"], { stdio: "pipe" });
  server = createServer({ key: await readFile(join(temp, "key.pem")),
    cert: await readFile(join(temp, "cert.pem")) }, backend.default);
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  origin = `https://127.0.0.1:${server.address().port}`;
  await build({ entryPoints: [frontend], outfile: transportBundle, bundle: true,
    platform: "node", format: "esm" });
  ({ authRequest } = await import(transportBundle));
  assert.equal(typeof authRequest, "function", "frontend auth transport must be exported");
});
beforeEach(async () => {
  await harness.control.query("truncate auth_sessions, auth_challenges, auth_rate_limits, users cascade");
  globalThis.nativeAuthMail.length = 0;
  jar.clear();
  sent.length = 0;
});
after(async () => {
  try {
    if (server) await new Promise(resolvePromise => server.close(resolvePromise));
    if (harness) await harness.close();
  } finally {
    await Promise.all([rm(bundle, { force: true }), rm(transportBundle, { force: true }),
      ...(temp ? [rm(temp, { recursive: true, force: true })] : [])]);
    delete globalThis.nativeAuthDb;
    delete globalThis.nativeAuthMail;
    delete globalThis.fetch;
  }
});
const post = (path, body, options = {}) => browserFetch(`/api/auth/${path}`, {
  method: "POST", headers: { "content-type": "application/json", ...options.headers },
  body: JSON.stringify(body), credentials: options.credentials,
});
async function expectBlocked(response, code = "INVALID_CSRF") {
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, code);
}
function mailCode() {
  assert.equal(globalThis.nativeAuthMail.length, 1, "exactly one fake email");
  const code = /code is (\d{6})/.exec(globalThis.nativeAuthMail[0].text)?.[1];
  assert.ok(code, "verification code captured from fake SMTP");
  return code;
}

test("actual HTTPS frontend transport completes Argon2 staff login, session and logout with all SMTP settings absent", async () => {
  const smtpKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"];
  const savedSmtp = Object.fromEntries(smtpKeys.map(key => [key, process.env[key]]));
  try {
    for (const key of smtpKeys) delete process.env[key];
  const password = "disposable staff passphrase with 24 chars";
  // Seed a real Argon2id credential, not a synthetic route or a password fixture.
  const { default: argon2 } = await import("argon2");
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  assert.match(passwordHash, /^\$argon2id\$/);
  await harness.control.query("insert into users(id,email,full_name,role,password_hash) values ($1,$2,$3,$4,$5)",
    ["staff", "staff@example.test", "Staff", "doctor", passwordHash]);
  const status = await browserFetch("/api/auth/status", { credentials: "same-origin" });
  assert.equal((await status.json()).role, null);
  assert.deepEqual(sent.at(-1).setCookie, [], "status must not set cookies");
  assert.equal(jar.has("digiq_csrf"), false, "status must not silently create a CSRF cookie");
  const [lateStatus, bootstrap] = await Promise.all([
    browserFetch("/api/auth/status"), browserFetch("/api/auth/csrf"),
  ]);
  assert.equal((await lateStatus.json()).role, null);
  assert.ok((await bootstrap.json()).csrfToken);
  assert.deepEqual(sent.findLast(r => r.path === "/api/auth/status").setCookie, [],
    "a status response racing CSRF bootstrap cannot overwrite cookies");
  assert.ok(jar.has("digiq_csrf"), "bootstrap cookie survives overlapping status");
  const validToken = jar.get("digiq_csrf");
  await browserFetch("/api/auth/status");
  assert.deepEqual(sent.at(-1).setCookie, [], "late status does not set another cookie");
  assert.equal(jar.get("digiq_csrf"), validToken);
  for (const options of [
    { credentials: "omit", headers: { "x-csrf-token": validToken } },
    { headers: {} },
    { headers: { "x-csrf-token": "mismatched-token" } },
  ]) {
    await expectBlocked(await post("login", { email: "staff@example.test", password }, options));
    assert.equal(globalThis.nativeAuthMail.length, 0);
    assert.equal((await harness.control.query("select count(*)::int as n from auth_challenges")).rows[0].n, 0);
  }
  const transportStart = sent.length;
  const login = await authRequest("login", { email: "staff@example.test", password });
  assert.deepEqual(login, { authenticated: true,
    user: { id: "staff", email: "staff@example.test", fullName: "Staff", role: "doctor", status: "active" } },
    "public user must not leak passwordHash");
  assert.ok(jar.has("digiq_session"));
  const sessionCookie = sent.findLast(r => r.path === "/api/auth/login").setCookie
    .find(value => value.startsWith("digiq_session="));
  assert.match(sessionCookie, /; HttpOnly;/i);
  assert.match(sessionCookie, /; Secure;/i);
  assert.match(sessionCookie, /; SameSite=Lax/i);
  assert.match(sessionCookie, /; Path=\/api/i);
  assert.equal((await (await browserFetch("/api/auth/status")).json()).role, "doctor");
  assert.deepEqual(sent.at(-1).setCookie, [], "authenticated status does not overwrite CSRF cookie");
  assert.equal((await authRequest("logout", {})).authenticated, false);
  assert.equal(jar.has("digiq_session"), false);
  assert.equal((await (await browserFetch("/api/auth/status")).json()).role, null);
  assert.equal(globalThis.nativeAuthMail.length, 0, "password login does not send device mail");
  assert.equal((await harness.control.query("select count(*)::int as n from auth_challenges")).rows[0].n, 0,
    "password login never creates device challenges");
  assert.ok(sent.slice(transportStart).filter(r => r.method === "POST").every(r =>
    r.headers["x-csrf-token"]), "frontend transport includes CSRF on every mutation");
  } finally {
    for (const key of smtpKeys) {
      if (savedSmtp[key] === undefined) delete process.env[key];
      else process.env[key] = savedSmtp[key];
    }
  }
});

test("origin gate rejects cross-site mutations even with valid CSRF; patient OTP shares transport", async () => {
  const token = (await (await browserFetch("/api/auth/csrf")).json()).csrfToken;
  await expectBlocked(await post("patient/start", { email: "patient@example.test" },
    { headers: { "x-csrf-token": token, origin: "https://attacker.test" } }), "REQUEST_FAILED");
  assert.equal(globalThis.nativeAuthMail.length, 0);
  const started = await authRequest("patient/start", { email: "patient@example.test" });
  assert.ok(started.challengeId);
  assert.equal((await authRequest("patient/verify", { challengeId: started.challengeId, code: mailCode() })).authenticated, true);
  assert.equal((await (await browserFetch("/api/auth/status")).json()).role, "patient");
});