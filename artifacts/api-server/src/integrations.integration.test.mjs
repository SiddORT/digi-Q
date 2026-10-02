// Private disposable PostgreSQL, injected identities at the router boundary, fake SMTP.
// No live app, real environment credentials, or provider connections.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = import.meta.dirname;
const bundle = resolve(root, `.integrations-test-${process.pid}.mjs`);
const env = { SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "fixture-user",
  SMTP_PASSWORD: "fixture-password", SMTP_FROM: "DigiQ Doctors <sender@example.invalid>" };
let harness, server, origin, api;
globalThis.integrationMail = [];
globalThis.integrationFailure = false;
Object.assign(process.env, env, { NODE_ENV: "test", SMTP_SECURE: "", SMTP_REQUIRE_TLS: "" });
process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32); // Synthetic fixture key only.

before(async () => {
  harness = await createQueueHarness({ empty: true });
  await harness.control.query(queueFixtureSql);
  await harness.control.query("drop table auth_sessions");
  await harness.control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0012_native_auth_additive.sql"), "utf8"));
  for (const role of ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"])
    await harness.control.query("insert into users(id,role,email,full_name) values($1,$1,$2,$1)", [role, `${role}@example.invalid`]);
  for (let i = 0; i < 12; i++)
    await harness.control.query("insert into users(id,role) values($1,'superAdmin')", [`admin${i}`]);
  globalThis.integrationDb = harness.db;
  await build({
    stdin: { contents: `
      import express from "express";
      import { integrationsRouter } from "./routes/integrations";
      export * from "./lib/integration-config";
      export { sendAuthEmail } from "./lib/auth-email";
      export { hashPassword } from "./lib/native-auth";
      export { encryptIntegration, decryptIntegration, resolvedIntegration } from "./lib/integration-vault";
      export { deliverOtp } from "./lib/otp-delivery";
      export const app = express();
      app.use(express.json());
      app.use((req,res,next)=>{req.authUserId=req.headers["x-test-user"];req.authSessionHash="test-session";next();});
      app.use(integrationsRouter);
      app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.status>=500?"Service unavailable":err.message,code:err.code}));
    `, resolveDir: root, loader: "ts" },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-integrations", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
      b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db=globalThis.integrationDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "fake-mail" }));
      b.onLoad({ filter: /.*/, namespace: "fake-mail" }, () => ({ contents: `
        export default {createTransport(options){globalThis.integrationTransport=options;return {async sendMail(message){
          if(globalThis.integrationFailure) throw new Error("private fixture-password smtp diagnostics");
          globalThis.integrationMail.push(message);
          return {accepted:[message.to],rejected:[]};
        }}}};
      ` }));
    } }],
  });
  api = await import(bundle);
  server = api.app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await harness?.close();
  await rm(bundle, { force: true });
  delete globalThis.integrationDb;
});
async function request(user, method = "GET", body = { recipient: "recipient@example.invalid" }) {
  const response = await fetch(origin + "/settings/integrations" + (method === "POST" ? "/smtp/test-email" : ""), {
    method, headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json" },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  return { status: response.status, body: await response.json() };
}
test("unauthenticated and every non-Super Admin role denied on both endpoints", async () => {
  for (const user of [null, "clinicAdmin", "doctor", "receptionist", "patient"])
    for (const method of ["GET", "POST"])
      assert.equal((await request(user, method)).status, user ? 403 : 401);
  assert.equal(globalThis.integrationMail.length, 0);
});
test("readiness contains key names/statuses only; invalid and missing configuration", async () => {
  const result = await request("superAdmin");
  assert.equal(result.status, 200);
  assert.equal(result.body.smtp.ready, true);
  for (const value of Object.values(env)) assert.ok(!JSON.stringify(result.body).includes(value));
  assert.equal(api.integrationReadiness({}).smtp.ready, false);
  for (const patch of [{ SMTP_PORT: "0" }, { SMTP_PORT: "1.5" }, { SMTP_FROM: "a@example.invalid\r\nBcc: x@y.invalid" }, { SMTP_REQUIRE_TLS: "false" }, { SMTP_SECURE: "yes" }])
    assert.throws(() => api.smtpConfig({ ...env, ...patch }), { code: "EMAIL_UNCONFIGURED" });
  assert.equal(api.smtpConfig({ ...env, SMTP_PORT: "465" }).secure, true);
  assert.equal(api.smtpConfig(env).secure, false);
});
test("strict recipient and fixed branded content; user abuse limit", async () => {
  assert.equal((await request("superAdmin", "POST", { recipient: "a@example.invalid", subject: "custom" })).status, 400);
  assert.equal((await request("superAdmin", "POST", { recipient: "a@example.invalid\r\nBcc: b@example.invalid" })).status, 400);
  const result = await request("superAdmin", "POST");
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "provider_accepted");
  assert.match(result.body.message, /Inbox delivery is not confirmed/);
  assert.match(globalThis.integrationMail[0].subject, /DigiQ Doctors/);
  assert.equal(globalThis.integrationTransport.requireTLS, true);
  assert.equal((await request("superAdmin", "POST")).status, 429);
});
test("SMTP errors are generic; no config fails safely; injected auth email remains supported", async () => {
  globalThis.integrationFailure = true;
  const result = await request("admin0", "POST");
  assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(result).includes("fixture-password"));
  globalThis.integrationFailure = false;
  process.env.SMTP_PASSWORD = "";
  assert.equal((await request("admin1", "POST")).status, 503);
  process.env.SMTP_PASSWORD = env.SMTP_PASSWORD;
  let delivered = false;
  await api.sendAuthEmail("recipient@example.invalid", "subject", "text", { async sendMail() { delivered = true; } });
  assert.equal(delivered, true);
});
test("IP limit applies across Super Admin identities", async () => {
  let limited = false;
  for (let i = 2; i < 12; i++) {
    const result = await request(`admin${i}`, "POST");
    if (result.status === 429) limited = true;
  }
  assert.equal(limited, true);
});

const fixturePassword = "FixturePassword947";
async function prepareEditor(actor) {
  await harness.control.query("update users set password_hash=$1 where id=$2", [await api.hashPassword(fixturePassword), actor]);
}
const edit = (actor, patch = {}) => request(actor, "PUT", {
  provider: "smtp", mode: "database", revision: null, currentPassword: fixturePassword, values: {}, ...patch,
});
test("credential editing rejects other roles, wrong password and unsupported fields", async () => {
  for (const actor of [null, "clinicAdmin", "doctor", "receptionist", "patient"])
    assert.equal((await edit(actor)).status, actor ? 403 : 401);
  await prepareEditor("admin10");
  assert.equal((await edit("admin10", { currentPassword: "wrong" })).status, 403);
  assert.equal((await edit("admin10", { values: { SESSION_SECRET: "forbidden" } })).status, 400);
  assert.equal((await edit("admin10", { values: { SMTP_PORT: "0" } })).status, 400);
  assert.equal((await harness.control.query("select count(*)::int n from integration_credentials")).rows[0].n, 0);
});
test("encryption authenticates ciphertext/provider; key failure never falls back", async () => {
  const sealed = api.encryptIntegration("smtp", { SMTP_PASSWORD: "private-fixture" });
  assert.ok(!sealed.includes("private-fixture"));
  assert.equal(api.decryptIntegration("smtp", sealed).SMTP_PASSWORD, "private-fixture");
  assert.throws(() => api.decryptIntegration("sms", sealed), { code: "INTEGRATION_DECRYPT_FAILED" });
  const parts = sealed.split(".");
  parts[2] = Buffer.alloc(16).toString("base64");
  assert.throws(() => api.decryptIntegration("smtp", parts.join(".")), { code: "INTEGRATION_DECRYPT_FAILED" });
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "";
  assert.throws(() => api.encryptIntegration("smtp", {}), { code: "INTEGRATION_KEY_REQUIRED" });
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
});
test("encrypted save, preserved blank fields, conflict, delivery resolution and audited environment restore", async () => {
  await prepareEditor("admin9");
  const saved = await edit("admin9", { values: { SMTP_PASSWORD: "new-fixture-secret" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.smtp.source, "database");
  assert.ok(saved.body.smtp.revision);
  assert.ok(!JSON.stringify(saved.body).includes("new-fixture-secret"));
  const row = (await harness.control.query("select * from integration_credentials where provider='smtp'")).rows[0];
  assert.ok(!row.encrypted.includes("new-fixture-secret"));
  assert.equal((await edit("admin9")).status, 409);
  const changed = await edit("admin9", { revision: saved.body.smtp.revision, values: { SMTP_HOST: "changed.example.invalid" } });
  assert.equal(changed.status, 200);
  await api.sendAuthEmail("fixture@example.invalid", "test", "test");
  assert.equal(globalThis.integrationTransport.auth.pass, "new-fixture-secret");
  assert.equal(globalThis.integrationTransport.host, "changed.example.invalid");
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "cd".repeat(32);
  await assert.rejects(api.resolvedIntegration("smtp"), { code: "INTEGRATION_DECRYPT_FAILED" });
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
  const restored = await edit("admin9", { mode: "environment", revision: changed.body.smtp.revision });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.smtp.source, "environment");
  assert.equal(restored.body.smtp.revision, null);
  const audits = (await harness.control.query("select summary from audit_logs where entity_type='integration'")).rows;
  assert.equal(audits.length, 3);
  assert.ok(!JSON.stringify(audits).includes("new-fixture-secret"));
});
test("direct Twilio uses encrypted credentials with no connector and never sends during save", async () => {
  await prepareEditor("admin8");
  const originalFetch = globalThis.fetch;
  const values = { TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`, TWILIO_MESSAGING_SERVICE_SID: `MG${"b".repeat(32)}`, TWILIO_AUTH_TOKEN: "c".repeat(32) };
  const saved = await edit("admin8", { provider: "sms", values });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.sms.ready, true);
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, `https://api.twilio.com/2010-04-01/Accounts/${values.TWILIO_ACCOUNT_SID}/Messages.json`);
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from(`${values.TWILIO_ACCOUNT_SID}:${values.TWILIO_AUTH_TOKEN}`).toString("base64")}`);
      return { ok: true };
    };
    assert.equal(await api.deliverOtp("+15555550123", "123456", 300), "sms");
    assert.equal(calls, 1);
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(api.deliverOtp("+15555550123", "123456", 300), { code: "OTP_DELIVERY_FAILED" });
  } finally { globalThis.fetch = originalFetch; }
  assert.equal((await edit("admin8", { provider: "sms", mode: "environment", revision: saved.body.sms.revision })).status, 200);
});