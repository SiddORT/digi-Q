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
          status: res.statusCode,
          headers: Object.fromEntries(Object.entries(res.headers)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => [name, Array.isArray(value) ? value.join(", ") : value])),
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
    stdin:{contents:'export {default} from "./app"; export * from "./lib/notification-template-store"; export * from "./lib/notification-templates";',resolveDir:root,loader:"ts"}, outfile: bundle, bundle: true,
    platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-http-auth", setup(b) {
      b.onResolve({filter:/notification-sms-transport$/},()=>({path:"sms-transport",namespace:"isolated-sms"}));
      b.onLoad({filter:/.*/,namespace:"isolated-sms"},()=>({contents:`
        export * from "${resolve(root,"lib/notification-sms-transport.ts")}";
        export async function sendNotificationSms(_env,_mobile,message) {
          globalThis.nativeAuthSms.push(message);return "provider_accepted";
        }`,resolveDir:root,loader:"ts"}));
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated-db" }));
      b.onLoad({ filter: /.*/, namespace: "isolated-db" }, () => ({ contents: `
        export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
        export const db = globalThis.nativeAuthDb;
      `, resolveDir: root }));
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
      b.onResolve({ filter: /^@workspace\/api-zod\/(public-page|public-website)$/ }, args => ({ path: resolve(root, `../../../lib/api-zod/src/${args.path.split("/").pop()}.ts`) }));
      b.onResolve({ filter: /^@workspace\/public-pages$/ }, () => ({ path: resolve(root, "../../../lib/public-pages/src/index.ts") }));
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
  globalThis.nativeAuthSms=[];
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
    delete globalThis.nativeAuthSms;
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
test("correcting owner email retires the prior registration challenge and its mobile proof", async () => {
  const first=await authRequest("register/start",{email:"original-owner@example.test",fullName:"Fictional Owner",password:"FictionalPass123"});
  const second=await authRequest("register/start",{email:"corrected-owner@example.test",fullName:"Fictional Owner",password:"FictionalPass456"});
  assert.notEqual(first.challengeId,second.challengeId);
  const {rows}=await harness.control.query("select consumed_at,data from auth_challenges where id=$1",[first.challengeId]);
  assert.ok(rows[0].consumed_at);
  assert.deepEqual(rows[0].data,{});
  const resumed=await authRequest("registration/resume",{email:"corrected-owner@example.test",fullName:"Fictional Owner"});
  assert.equal(resumed.challengeId,second.challengeId);
  const old=await authRequest("registration/resume",{email:"original-owner@example.test",fullName:"Fictional Owner"});
  assert.equal(old.challengeId,null);
});

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

test("retired device compatibility URL fails closed over HTTPS without cookies or email", async () => {
  const missingCsrf = await browserFetch("/api/auth/verify-device", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challengeId: "stale", code: "123456" }),
  });
  assert.equal(missingCsrf.status, 403, "tombstone does not bypass normal CSRF");
  const csrf = await (await browserFetch("/api/auth/csrf")).json();
  const retired = await browserFetch("/api/auth/verify-device", {
    method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
    body: JSON.stringify({ challengeId: "stale", code: "123456" }),
  });
  assert.equal(retired.status, 410);
  assert.equal((await retired.json()).code, "AUTH_METHOD_REMOVED");
  assert.equal(retired.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(sent.at(-1).setCookie, []);
  assert.equal(jar.has("digiq_session"), false);
  assert.equal(globalThis.nativeAuthMail.length, 0);
  assert.equal((await harness.control.query("select count(*)::int n from auth_sessions")).rows[0].n, 0);
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

test("SMS patient login uses the actual HTTPS/CSRF transport and establishes the existing patient session",async()=>{
  Object.assign(process.env,{NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
    NOTIFICATION_SMS_KEY:"fixture-key",NOTIFICATION_SMS_BEARER_TOKEN:"fixture-token",
    NOTIFICATION_SMS_CLIENT_ID:"fixture-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_ENABLED:"false"});
  await harness.control.query("insert into users(id,email,full_name,role,mobile) values('sms-http','sms-http@example.test','SMS HTTP Patient','patient','+919876543210')");
  const current=await backend.resolvedTemplate("patient_login_otp",undefined,harness.db,"patient","sms");
  await backend.saveTemplate({id:"fixture-admin",role:"superAdmin"},{channel:"sms",event:"patient_login_otp",recipient:"patient",
    revision:current.local.revision,mode:"publish",content:{...backend.defaultTemplate("patient_login_otp"),senderId:"",dltEntityId:"",dltTemplateId:"FIXTURE_OTP"}});
  const started=await authRequest("patient/start",{channel:"sms",mobile:"+919876543210"});
  const otp=/login code is (\d{6})/.exec(globalThis.nativeAuthSms.at(-1))?.[1];assert(otp);
  assert.equal((await authRequest("patient/verify",{channel:"sms",challengeId:started.challengeId,code:otp})).authenticated,true);
  const status=await (await browserFetch("/api/auth/status")).json();
  assert.equal(status.role,"patient");
  assert.equal((await harness.control.query("select count(*)::int as n from auth_sessions where user_id='sms-http'")).rows[0].n,1);
  await assert.rejects(authRequest("patient/verify",{channel:"sms",challengeId:started.challengeId,code:otp}));
});
test("disabled verification is a distinct safe frontend error with no false sent state or challenge",async()=>{
  const actor={id:"fixture-admin",role:"superAdmin"};
  const current=await backend.resolvedTemplate("patient_email_otp",undefined,harness.db,"patient","email");
  await backend.changeActivation(actor,{event:"patient_email_otp",recipient:"patient",channel:"email",revision:current.local.revision,enabled:false});
  await assert.rejects(authRequest("patient/start",{email:"disabled@example.test"}),error=>{
    assert.equal(error.status,503);assert.equal(error.code,"SECURITY_DELIVERY_DISABLED");
    assert.match(error.message,/Sending is turned off\. No message was sent/);
    assert.match(error.message,/Verification is still required/);
    return true;
  });
  assert.equal(globalThis.nativeAuthMail.length,0);
  assert.equal((await harness.control.query("select count(*)::int n from auth_challenges")).rows[0].n,0);
  const off=await backend.resolvedTemplate("patient_email_otp",undefined,harness.db,"patient","email");
  await backend.changeActivation(actor,{event:"patient_email_otp",recipient:"patient",channel:"email",revision:off.local.revision,enabled:true});
  assert.equal(globalThis.nativeAuthMail.length,0);
  assert((await authRequest("patient/start",{email:"enabled@example.test"})).challengeId);
  assert.equal(globalThis.nativeAuthMail.length,1);
});

test("email signup plus separate SMS proof survives complete profile onboarding over HTTPS",async()=>{
  Object.assign(process.env,{NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
    NOTIFICATION_SMS_KEY:"fixture-key",NOTIFICATION_SMS_BEARER_TOKEN:"fixture-token",
    NOTIFICATION_SMS_CLIENT_ID:"fixture-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_ENABLED:"false"});
  const current=await backend.resolvedTemplate("registration_mobile_otp",undefined,harness.db,"patient","sms");
  await backend.saveTemplate({id:"fixture-admin",role:"superAdmin"},{channel:"sms",event:"registration_mobile_otp",recipient:"patient",
    revision:current.local.revision,mode:"publish",content:{...backend.defaultTemplate("registration_mobile_otp"),senderId:"",dltEntityId:"",dltTemplateId:"FIXTURE_REGISTER"}});
  const started=await authRequest("patient/start",{email:"onboard-phone@example.test",mobile:"+919876543210"});
  assert.equal(started.channels.email.status,"not_reported");
  assert.equal(started.channels.sms.status,"provider_accepted");
  const emailCode=mailCode(), smsCode=/\b(\d{6})\b/.exec(globalThis.nativeAuthSms.at(-1))?.[1];
  assert(smsCode);
  await authRequest("registration/mobile/verify",{challengeId:started.challengeId,code:smsCode});
  assert.equal((await harness.control.query("select count(*)::int n from users")).rows[0].n,0,"SMS proof alone creates nothing");
  await authRequest("patient/verify",{challengeId:started.challengeId,code:emailCode});
  const me=await (await browserFetch("/api/me")).json();
  assert.equal(me.needsOnboarding,true);
  assert.equal(me.user.mobile,"+919876543210");
  const csrf=(await (await browserFetch("/api/auth/csrf")).json()).csrfToken;
  for (const consent of [false,undefined]) {
    const denied=await browserFetch("/api/onboarding",{method:"POST",credentials:"include",
      headers:{"content-type":"application/json","x-csrf-token":csrf},
      body:JSON.stringify({fullName:"Fictional Patient",intent:"patient",termsAccepted:consent})});
    assert.equal(denied.status,400,"consent is required before any patient profile is saved");
    assert.equal((await harness.control.query("select count(*)::int n from patients")).rows[0].n,0);
  }
  const response=await browserFetch("/api/onboarding",{method:"POST",credentials:"include",
    headers:{"content-type":"application/json","x-csrf-token":csrf},
    body:JSON.stringify({fullName:"Fictional Patient",mobile:"",intent:"patient",termsAccepted:true})});
  assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
  const profile=await response.json();
  assert.equal(profile.needsOnboarding,false);
  assert.equal(profile.user.mobile,"+919876543210","empty onboarding default cannot erase verified phone");
  const patient=(await harness.control.query("select * from patients where user_id=$1",[me.user.id])).rows[0];
  assert.equal(patient.mobile,"+919876543210");
  assert.equal(patient.mobile_verified,true);
});

test("email-only signup cannot introduce an unproved SMS-login phone through onboarding",async()=>{
  const mobile="+919876543210";
  const started=await authRequest("patient/start",{email:"email-only-onboarding@example.test"});
  await authRequest("patient/verify",{challengeId:started.challengeId,code:mailCode()});
  const me=await (await browserFetch("/api/me")).json();
  assert.equal(me.needsOnboarding,true);
  assert(!me.user.mobile);
  const csrf=(await (await browserFetch("/api/auth/csrf")).json()).csrfToken;
  const onboard=body=>browserFetch("/api/onboarding",{method:"POST",credentials:"include",
    headers:{"content-type":"application/json","x-csrf-token":csrf},
    body:JSON.stringify({fullName:"Fictional Email Only",intent:"patient",termsAccepted:true,...body})});
  const denied=await onboard({mobile});
  assert.equal(denied.status,400,"unproved phone is rejected, not bound to the new account");
  assert.match(JSON.stringify(await denied.json()),/Verify your phone during signup/);
  assert.equal((await harness.control.query("select count(*)::int n from patients where user_id=$1",[me.user.id])).rows[0].n,0);
  assert(!(await harness.control.query("select mobile from users where id=$1",[me.user.id])).rows[0].mobile);
  const completed=await onboard({});
  assert.equal(completed.status,201,JSON.stringify(await completed.clone().json()));
  const profile=await completed.json();
  assert.equal(profile.needsOnboarding,false);
  assert(!profile.user.mobile);
  assert.equal((await harness.control.query("select mobile from patients where user_id=$1",[me.user.id])).rows[0].mobile,"");
  await authRequest("logout");
  await assert.rejects(authRequest("patient/start",{channel:"sms",mobile}),
    error=>error.code==="PATIENT_SMS_NOT_REGISTERED");
  assert.equal((await (await browserFetch("/api/auth/status")).json()).role,null);
  assert.equal(globalThis.nativeAuthSms.length,0,"no SMS sent for an unproved onboarding number");
});