// Private disposable PostgreSQL, injected identities at the router boundary, fake SMTP.
// No live app, real environment credentials, or provider connections.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const root = import.meta.dirname;
const bundle = resolve(root, `.integrations-test-${process.pid}.mjs`);
const env = { SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "fixture-user",
  SMTP_PASSWORD: "fixture-password", SMTP_FROM: "DigiQ Doctors <sender@example.invalid>" };
let harness, server, origin, api;
globalThis.integrationMail = [];
globalThis.integrationFailure = false;
globalThis.integrationSms = [];
globalThis.integrationSmsOutcome = "provider_accepted";
for (const name of ["HOST", "PORT", "USER", "PASSWORD", "FROM", "SECURE", "REQUIRE_TLS", "FROM_NAME", "NOTIFICATIONS_ENABLED"]) delete process.env[`DIGI_SMTP_${name}`];
Object.assign(process.env, Object.fromEntries(Object.entries(env).map(([key,value]) => [`DIGI_${key}`,value])),
  { NODE_ENV: "test", SMTP_HOST: "legacy.example.invalid", SMTP_PASSWORD: "legacy-ignored",
    SMTP_SECURE: "true", SMTP_REQUIRE_TLS: "false", SMTP_NOTIFICATIONS_ENABLED: "false" });
process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32); // Synthetic fixture key only.

before(async () => {
  harness = await createQueueHarness({ empty: true });
  await harness.control.query(queueFixtureSql);
  await harness.control.query("drop table auth_sessions");
  await harness.control.query(await readFile(resolve(root, "../../../lib/db/drizzle/0012_native_auth_additive.sql"), "utf8"));
  for (const role of ["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"])
    await harness.control.query("insert into users(id,role,email,full_name) values($1,$1,$2,$1)", [role, `${role}@example.invalid`]);
  for (let i = 0; i < 12; i++)
    await harness.control.query("insert into users(id,role,email) values($1,'superAdmin',$2)", [`admin${i}`, `admin${i}@example.invalid`]);
  globalThis.integrationDb = harness.db;
  await build({
    stdin: { contents: `
      import express from "express";
      import { integrationsRouter } from "./routes/integrations";
      export * from "./lib/integration-config";
      export { sendAuthEmail } from "./lib/auth-email";
      export { hashPassword } from "./lib/native-auth";
       export { encryptIntegration, decryptIntegration, resolvedIntegration, saveIntegration } from "./lib/integration-vault";
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
      b.onResolve({ filter: /\/notification-sms-transport$/ }, () => ({ path: "sms", namespace: "fake-sms" }));
      b.onLoad({ filter: /.*/, namespace: "fake-sms" }, () => ({ contents: `
        export * from ${JSON.stringify(resolve(root, "lib/notification-sms-transport.ts"))};
         import {notificationSmsConfig,smsPayload} from ${JSON.stringify(resolve(root, "lib/notification-sms-transport.ts"))};
        export async function sendNotificationSms(env,to,message,meta) {
           const cfg=notificationSmsConfig(env),payload=smsPayload(cfg,to,message,meta);
           globalThis.integrationSms.push({to,message,meta,url:cfg.url.href,headers:payload.headers,body:JSON.parse(cfg.mapping.encoding==="json"?payload.body:"{}")});
          return globalThis.integrationSmsOutcome;
        }
      `, resolveDir: root }));
      b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "fake-mail" }));
      b.onLoad({ filter: /.*/, namespace: "fake-mail" }, () => ({ contents: `
        export default {createTransport(options){globalThis.integrationTransport=options;return {async verify(){if(globalThis.integrationFailure)throw new Error("private fixture-password smtp diagnostics");return true;},close(){},async sendMail(message){
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
test("Keep in Touch password-confirmed route save is encrypted and write-only; explicit SMS uses exact contract without activating events",async()=>{
 const beforeSms=globalThis.integrationSms.length;
 await prepareEditor("admin7");
 const values={NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"route-fictional-body-key",
  NOTIFICATION_SMS_BEARER_TOKEN:"route-fictional-distinct-token",NOTIFICATION_SMS_CLIENT_ID:"route-fictional-client",
  NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus"};
 const saved=await edit("admin7",{provider:"notificationSms",values});
 assert.equal(saved.status,200);
 assert.equal(saved.body.notificationSms.smsProvider,"keepInTouch");
 assert.equal(saved.body.notificationSms.ready,true);
 for(const value of [values.NOTIFICATION_SMS_KEY,values.NOTIFICATION_SMS_BEARER_TOKEN,values.NOTIFICATION_SMS_CLIENT_ID])assert(!JSON.stringify(saved.body).includes(value));
 const row=(await harness.control.query("select encrypted from integration_credentials where provider='notificationSms'")).rows[0];
 assert(!row.encrypted.includes(values.NOTIFICATION_SMS_BEARER_TOKEN));
 const current=await api.resolvedIntegration("notificationSms");
 assert.equal(current.env.NOTIFICATION_SMS_BEARER_TOKEN,values.NOTIFICATION_SMS_BEARER_TOKEN);
 const result=await fetch(`${origin}/settings/integrations/notification-sms/test-message`,{
  method:"POST",headers:{"x-test-user":"admin7","content-type":"application/json"},
   body:JSON.stringify({recipient:"+919876543210",message:"Fictional test",dltTemplateId:"BOOKING",confirmed:true,requestId:randomUUID()}),
 });
 assert.equal(result.status,200);assert.equal((await result.json()).status,"provider_accepted");
 const wire=globalThis.integrationSms.at(-1);
 assert.equal(wire.url,"https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS");
 assert.equal(wire.headers.Authorization,"Bearer route-fictional-distinct-token");
 assert.deepEqual(wire.body,{countryCode:"+91",mobile:"9876543210",senderId:"DIGIQ",message:"Fictional test",apiKey:"route-fictional-body-key",clientId:"route-fictional-client",templateId:"BOOKING"});
  assert.equal((await harness.control.query("select count(*)::int n from settings where id like 'sms-template:%' or id like 'sms-outbox:%'")).rows[0].n,0);
 const preserved=await edit("admin7",{provider:"notificationSms",revision:saved.body.notificationSms.revision,values:{NOTIFICATION_SMS_KEY:"",NOTIFICATION_SMS_BEARER_TOKEN:""}});
 assert.equal(preserved.status,200);
 assert.equal((await api.resolvedIntegration("notificationSms")).env.NOTIFICATION_SMS_BEARER_TOKEN,values.NOTIFICATION_SMS_BEARER_TOKEN);
 assert.equal((await edit("admin7",{provider:"notificationSms",revision:preserved.body.notificationSms.revision,mode:"environment"})).status,200);
 globalThis.integrationSms.splice(beforeSms);
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await harness?.close();
  await rm(bundle, { force: true });
  delete globalThis.integrationDb;
});
async function request(user, method = "GET", body = { recipient: "recipient@example.invalid", confirmed: true, requestId: randomUUID() }) {
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
test("connection checks and storage configuration remain admin-only and checks never send mail", async () => {
  const root = `${origin}/settings/integrations`;
  for (const user of ["clinicAdmin", "doctor", "receptionist", "patient"]) {
    assert.equal((await fetch(`${root}/storage`, { headers: { "x-test-user": user } })).status, 403);
    assert.equal((await fetch(`${root}/smtp/check`, { method: "POST", headers: { "x-test-user": user } })).status, 403);
  }
  const before = globalThis.integrationMail.length;
  const response = await fetch(`${root}/smtp/check`, { method: "POST", headers: { "x-test-user": "admin11" } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.checks[0].status, "passed");
  assert.equal(result.checks[1].status, "not_verified");
  assert.equal(globalThis.integrationMail.length, before);
  assert.equal((await fetch(`${root}/unknown/check`, { method: "POST", headers: { "x-test-user": "admin11" } })).status, 400);
  globalThis.integrationFailure = true;
  const failed = await (await fetch(`${root}/smtp/check`, { method: "POST", headers: { "x-test-user": "admin11" } })).json();
  assert.equal(failed.checks[0].status, "failed");
  assert.ok(!JSON.stringify(failed).includes("fixture-password"));
  globalThis.integrationFailure = false;
});
test("SMTP public form values are authorized; credentials stay write-only and invalid configurations fail", async () => {
  const result = await request("superAdmin");
  assert.equal(result.status, 200);
  assert.equal(result.body.smtp.ready, true);
  for (const value of [env.SMTP_USER,env.SMTP_PASSWORD]) assert.ok(!JSON.stringify(result.body).includes(value));
  assert.equal(result.body.smtp.smtpHost,env.SMTP_HOST);
  assert.equal(result.body.smtp.smtpPort,587);
  assert.equal(result.body.smtp.fromEmail,"sender@example.invalid");
  assert.equal(result.body.smtp.fromName,"DigiQ Doctors");
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
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "delivery_unknown");
  assert.ok(!JSON.stringify(result).includes("fixture-password"));
  globalThis.integrationFailure = false;
   process.env.DIGI_SMTP_PASSWORD = "";
   const missing = await request("admin1", "POST");
   assert.equal(missing.status, 200);
   assert.equal(missing.body.status, "pre_dispatch_failed");
   process.env.DIGI_SMTP_PASSWORD = env.SMTP_PASSWORD;
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
  const canonical = api.decryptIntegration("smtp", row.encrypted);
  assert.equal(canonical.SMTP_HOST, env.SMTP_HOST);
  assert.equal(canonical.SMTP_USER, env.SMTP_USER);
  assert.equal(canonical.SMTP_SECURE, undefined);
  assert.equal(canonical.SMTP_NOTIFICATIONS_ENABLED, undefined);
  assert(!Object.keys(canonical).some(key => key.startsWith("DIGI_")));
  assert.equal(saved.body.smtp.useTls, true);
  assert.equal(saved.body.smtp.notificationsEnabled, true);
  assert.equal((await edit("admin9")).status, 409);
  const changed = await edit("admin9", { revision: saved.body.smtp.revision, values: { SMTP_HOST: "changed.example.invalid" } });
  assert.equal(changed.status, 200);
  await api.sendAuthEmail("fixture@example.invalid", "test", "test");
  assert.equal(globalThis.integrationTransport.auth.pass, "new-fixture-secret");
  assert.equal(globalThis.integrationTransport.host, "changed.example.invalid");
  const priorDigiHost = process.env.DIGI_SMTP_HOST;
  process.env.DIGI_SMTP_HOST = "";
  assert.equal((await api.resolvedIntegration("smtp")).source, "database");
  await api.sendAuthEmail("fixture@example.invalid", "test", "test");
  assert.equal(globalThis.integrationTransport.host, "changed.example.invalid");
  process.env.DIGI_SMTP_HOST = priorDigiHost;
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "cd".repeat(32);
  await assert.rejects(api.resolvedIntegration("smtp"), { code: "INTEGRATION_DECRYPT_FAILED" });
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
  const restored = await edit("admin9", { mode: "environment", revision: changed.body.smtp.revision });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.smtp.source, "environment");
  assert.equal(restored.body.smtp.revision, null);
   const audits = (await harness.control.query("select summary from audit_logs where entity_type='integration' and entity_id='smtp'")).rows;
  assert.equal(audits.length, 3);
  assert.ok(!JSON.stringify(audits).includes("new-fixture-secret"));
});
test("notification SMS tests are authorized, validated, explicit and report sanitized outcomes without activating clinics", async () => {
  const post = async (user, body) => {
    const response = await fetch(`${origin}/settings/integrations/notification-sms/test-message`, {
      method: "POST", headers: { ...(user ? { "x-test-user": user } : {}), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const input = { recipient: "+15555550123", message: "Fictional SMS test", senderId: "FIXTURE", confirmed: true, requestId: randomUUID() };
  assert.equal((await post(null, input)).status, 401);
  for (const role of ["clinicAdmin", "doctor", "receptionist", "patient"])
    assert.equal((await post(role, input)).status, 403);
  for (const invalid of [{ ...input, recipient: "123" }, { ...input, message: " " }, { ...input, senderId: "bad\nid" }, { ...input, extra: true }])
    assert.equal((await post("admin9", invalid)).status, 400);
  assert.equal(globalThis.integrationSms.length, 0);
  const original = {
    NOTIFICATION_SMS_URL: process.env.NOTIFICATION_SMS_URL,
    NOTIFICATION_SMS_KEY: process.env.NOTIFICATION_SMS_KEY,
    NOTIFICATION_SMS_MAPPING: process.env.NOTIFICATION_SMS_MAPPING,
    NOTIFICATION_SMS_BEARER_TOKEN: process.env.NOTIFICATION_SMS_BEARER_TOKEN,
    NOTIFICATION_SMS_PROVIDER: process.env.NOTIFICATION_SMS_PROVIDER,
  };
  try {
    delete process.env.NOTIFICATION_SMS_URL;
    delete process.env.NOTIFICATION_SMS_KEY;
    delete process.env.NOTIFICATION_SMS_MAPPING;
    const missing = await post("admin10", input);
    assert.equal(missing.status, 200);
    assert.equal(missing.body.status, "not_dispatched");
    Object.assign(process.env, {
      NOTIFICATION_SMS_URL: "https://provider.example.invalid/send",
      NOTIFICATION_SMS_KEY: "fixture-sms-key",
      NOTIFICATION_SMS_BEARER_TOKEN: "fixture-sms-bearer",
      NOTIFICATION_SMS_PROVIDER: "generic",
      NOTIFICATION_SMS_MAPPING: JSON.stringify({
        encoding: "json", authMode: "header", authField: "x-api-key",
        fields: { recipient: "to", message: "text", senderId: "sender", dltEntityId: "entity", dltTemplateId: "template" },
        staticFields: {}, acceptedStatuses: [200], dltRequired: false,
      }),
    });
    for (const [actor, outcome, expected] of [["admin9", "provider_accepted", "provider_accepted"], ["admin10", "delivery_unknown", "delivery_unknown"], ["admin11", "pre_dispatch_failed", "not_dispatched"]]) {
      globalThis.integrationSmsOutcome = outcome;
      const result = await post(actor, { ...input, requestId: randomUUID() });
      assert.equal(result.status, 200);
      assert.equal(result.body.status, expected);
      assert.equal(JSON.stringify(result.body).includes("fixture-sms-key"), false);
    }
    assert.equal(globalThis.integrationSms.length, 3);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    globalThis.integrationSmsOutcome = "provider_accepted";
  }
});
test("first encrypted save inherits prefixed optional flags and canonical credentials; partial saved records never fall back", async () => {
  const names = ["DIGI_SMTP_SECURE", "DIGI_SMTP_REQUIRE_TLS", "DIGI_SMTP_FROM_NAME", "DIGI_SMTP_NOTIFICATIONS_ENABLED"];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    Object.assign(process.env, { DIGI_SMTP_SECURE: "true", DIGI_SMTP_REQUIRE_TLS: "false",
      DIGI_SMTP_FROM_NAME: "Prefixed name", DIGI_SMTP_NOTIFICATIONS_ENABLED: "false" });
    await api.saveIntegration("smtp", {}, null, "database", "admin6");
    const resolved = await api.resolvedIntegration("smtp");
    assert.equal(resolved.source, "database");
    assert.equal(resolved.env.SMTP_PASSWORD, env.SMTP_PASSWORD);
    assert.equal(resolved.env.SMTP_FROM_NAME, "Prefixed name");
    assert.equal(resolved.env.SMTP_NOTIFICATIONS_ENABLED, "false");
    assert.equal(api.integrationReadiness(resolved.env).smtp.notificationsEnabled, false);
    const cfg = api.smtpConfig(resolved.env);
    assert.equal(cfg.secure, true); assert.equal(cfg.requireTLS, false);
    const sealed = api.encryptIntegration("smtp", { SMTP_HOST: "partial.example.invalid" });
    await harness.control.query("update integration_credentials set encrypted=$1 where provider='smtp'", [sealed]);
    const partial = await api.resolvedIntegration("smtp");
    assert.equal(partial.source, "database");
    assert.throws(() => api.smtpConfig(partial.env), { code: "EMAIL_UNCONFIGURED" });
    await api.saveIntegration("smtp", {}, resolved.revision, "environment", "admin6");
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
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