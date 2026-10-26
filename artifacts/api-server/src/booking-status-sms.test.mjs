import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

// Real disposable PostgreSQL claim/rate persistence and locks; only provider,
// template/config readiness and historical envelope dependencies are fictional.
let h, sms, a, f;
const bundle = resolve(`artifacts/api-server/.local/booking-status-sms-${process.pid}.cjs`);
const mocks = {
  "./appointment-booking-edit": `export const bookingEditPermission=async()=>()=>globalThis.manualSmsFixture.permitted;`,
  "@workspace/db": `export * from "${resolve("lib/db/src/schema/core.ts")}";export const db=globalThis.manualSmsFixture.h.db;`,
  "./auth": `export const roles=(u,rs)=>{if(!rs.includes(u.role))throw Error("Permission denied")};export const canRead=async u=>globalThis.manualSmsFixture.allowed&&u.clinicIds.includes("c");`,
  "./store": `export const one=(...a)=>globalThis.manualSmsFixture.h.api.one(...a);export const getSettings=async()=>({notificationsEnabled:globalThis.manualSmsFixture.enabled});export const audit=async()=>{};`,
  "./public-website": `export const publicUrl=p=>{if(!globalThis.manualSmsFixture.origin)throw Error("missing");return "https://example.invalid"+p;};`,
  "./appointments": `export const lockQueue=(...a)=>globalThis.manualSmsFixture.h.api.lockQueue(...a);`,
  "./notification-sms-outbox": `export const notificationPhone=v=>/^\\+[1-9]\\d{7,14}$/.test(v||"")?v:"";`,
  "./notification-template-store": `export const resolvedTemplate=async()=>globalThis.manualSmsFixture.template;`,
  "./integration-vault": `export const resolvedIntegration=async()=>({env:{fixture:"no-credentials"}});`,
  "./notification-preferences": `export const lockNotificationPreferences=async()=>{};export const recipientPreference=async()=>({enabled:globalThis.manualSmsFixture.preference});`,
  "./notification-sms-transport": `export const notificationSmsEnabled=()=>globalThis.manualSmsFixture.providerEnabled;export const notificationSmsReadiness=()=>({ready:globalThis.manualSmsFixture.ready});export const notificationSmsConfig=()=>({provider:"fictional"});export const smsMetadataReady=()=>globalThis.manualSmsFixture.metadata;export const sendNotificationSms=async()=>{throw Error("Real transport forbidden")};`,
  "./notification-history": `export const templateSnapshot=()=>({});export const recordNotification=async(...args)=>{globalThis.manualSmsFixture.history.push(args);};`,
};
before(async () => {
  h = await createQueueHarness();
  globalThis.manualSmsFixture = { h };
  await build({ entryPoints: [resolve("artifacts/api-server/src/lib/booking-status-sms.ts")],
    outfile: bundle, bundle: true, platform: "node", format: "cjs", packages: "external",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "fictional-manual-sms", setup(b) {
      b.onResolve({ filter: /.*/ }, x => mocks[x.path] ? { path: x.path, namespace: "fake" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fake" }, x => ({ contents: mocks[x.path], resolveDir: resolve(".") }));
    } }] });
  sms = createRequire(import.meta.url)(bundle);
});
beforeEach(async () => {
  await h.seed();
  await h.api.put(h.t.users, { id: h.staff.id, role: "receptionist", managingAdminId: "admin", status: "active" });
  await h.api.put(h.t.users, { id: "u1", role: "patient", mobile: "+14155552671", status: "active" });
  a = await h.book();
  f = globalThis.manualSmsFixture;
  Object.assign(f, { h, allowed: true, permitted: true, enabled: true, origin: true, preference: true, providerEnabled: true,
    ready: true, metadata: true, calls: 0, history: [], template: { wordingPublished: true, effectiveRevision: 1,
      content: { enabled: true, subject: "Fictional manual test", body: "Fictional approved link: {{booking_status_link}}",
        prefix: "", footer: "", logoUrl: "", dltTemplateId: "FICTIONAL-ONLY" } } });
});
after(async () => { if (h) await h.close(); delete globalThis.manualSmsFixture; await rm(bundle, { force: true }); });
const preview = () => sms.bookingStatusSmsPreview(h.staff, a.id, h.db);
const send = async (p, requestId = randomUUID(), result = "provider_accepted", conn = h.db) =>
  sms.sendBookingStatusSms(h.staff, a.id, { requestId, previewToken: p.previewToken }, conn,
    async (_env, to, message) => { f.calls++; assert.equal(to, "+14155552671"); assert.match(message, /\/patient\/queue\?appointment=/); assert.doesNotMatch(message, /check-in|staff|payload=/); if (result === "throw") throw Error("uncertain"); return result; });

test("server recipient never follows edited visit mobile; destination retains patient sign-in boundary", async () => {
  await h.api.change(h.t.appointments, a.id, { data: { ...a, bookingMobile: "+14155552672" } });
  const p = await preview();
  assert.equal(p.eligible, true); assert.equal(p.recipient, "+14155552671");
  assert.match(p.message, /https:\/\/example.invalid\/patient\/queue\?appointment=/);
  assert.equal((await send(p)).state, "provider_accepted");
  const claims = await h.control.query("select data from settings where id like 'staff-dispatch:%'");
  assert.equal(claims.rows.length, 1);
  assert.equal(claims.rows[0].data.state, "completed");
  assert(claims.rows[0].data.userIds.includes(h.staff.id));
  assert(claims.rows[0].data.userIds.includes("du"), "Guard the doctor represented in the historical snapshot");
  assert(!claims.rows[0].data.userIds.includes("u1"), "Patient recipients are not staff-removal subjects");
  assert.equal(f.history[0][2].source, "manual");
  assert.equal(f.history[0][2].event, "booking_status_link");
});

test("all prerequisites fail closed with explicit safe reasons and no dispatch", async () => {
  for (const [key, reason] of [["permitted", /administrator/], ["enabled", /disabled/], ["origin", /website/], ["preference", /opted out/],
    ["providerEnabled", /provider policy/], ["ready", /provider is not ready/], ["metadata", /registration/]]) {
    f[key] = false; const p = await preview(); assert.equal(p.eligible, false); assert.match(p.reason, reason); f[key] = true;
  }
  f.template.wordingPublished = false;
  assert.match((await preview()).reason, /approved SMS template/);
  f.template.wordingPublished = true; f.template.content.dltTemplateId = "";
  assert.match((await preview()).reason, /own approved registration/);
  f.template.content.dltTemplateId = "FICTIONAL-ONLY"; f.template.content.body = "Automatic booking confirmation";
  assert.equal((await preview()).eligible, false);
  assert.equal(f.calls, 0);
});

test("a patient-record mobile never substitutes for the account's missing or invalid notification mobile", async () => {
  const approved = await preview();
  assert.equal(approved.eligible, true);
  const patient = await h.api.one(h.t.patients, a.patientId);
  assert(patient.mobile, "The separate patient record retains a different saved number");
  for (const mobile of [null, "", "12345"]) {
    await h.control.query("update users set mobile=$1 where id='u1'", [mobile]);
    const p = await preview();
    assert.equal(p.eligible, false);
    assert.match(p.reason, /account notification mobile/);
    assert.equal(p.recipient, "");
    assert.equal(p.message, "");
    assert.equal((await send(approved)).state, "blocked");
    assert.equal(f.calls, 0);
  }
});

test("ownership, inactive accounts, completed/cancelled and revoked scope do not leak a preview", async () => {
  f.allowed = false; await assert.rejects(preview(), /scope/); f.allowed = true;
  await assert.rejects(sms.bookingStatusSmsPreview(h.patient, a.id, h.db), /Permission/);
  await h.api.change(h.t.users, "u1", { status: "inactive" }); assert.equal((await preview()).message, "");
  await h.api.change(h.t.users, "u1", { status: "active" });
  for (const status of ["completed", "cancelled"]) {
    await h.api.change(h.t.appointments, a.id, { status });
    assert.equal((await preview()).eligible, false);
  }
});

test("preview is bound to recipient, wording, revision, clinic gate and send-time state", async () => {
  const p = await preview();
  f.template.content.body += " Changed"; await assert.rejects(send(p), /changed/);
  f.template.content.body = "Fictional approved link: {{booking_status_link}}";
  await h.api.change(h.t.users, "u1", { mobile: "+14155552672" }); await assert.rejects(send(p), /changed/);
  await h.api.change(h.t.users, "u1", { mobile: "+14155552671" });
  await h.api.change(h.t.appointments, a.id, { data: { ...a, revision: 1 } }); await assert.rejects(send(p), /changed/);
  f.enabled = false; assert.equal((await send(p)).state, "blocked"); assert.equal(f.calls, 0);
});

test("durable duplicate requests never redispatch accepted, rejected, failed or unknown outcomes", async () => {
  for (const result of ["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "throw"]) {
    const p = await preview(), requestId = randomUUID();
    const expected = result === "throw" ? "delivery_unknown" : result;
    // Each loop is a new hour for the isolated per-visit rate record.
    await h.control.query("delete from settings where id like 'manual-status-sms-limit:%'");
    const first = await send(p, requestId, result), count = f.calls;
    assert.equal(first.state, expected);
    assert.equal((await send(p, requestId, result)).state, expected);
    assert.equal(f.calls, count);
  }
});

test("simultaneous double-clicks overlap on real PostgreSQL locks and send exactly once", async () => {
  const p = await preview(), requestId = randomUUID();
  const results = await h.race([
    tx => send(p, requestId, "provider_accepted", tx),
    tx => send(p, requestId, "provider_accepted", tx),
  ], { doctorIds: ["d"] });
  assert.equal(results.filter(r => r.status === "fulfilled").length, 2);
  assert.equal(f.calls, 1);
});

test("a real safety-barrier rejection is a known pre-dispatch failure, not uncertain delivery", async () => {
  const p = await preview(), requestId = randomUUID();
  await h.control.query("delete from users where id=$1", [h.staff.id]);
  assert.equal((await send(p, requestId)).state, "pre_dispatch_failed");
  assert.equal(f.calls, 0);
  assert.equal((await send(p, requestId)).state, "pre_dispatch_failed");
  assert.equal(f.calls, 0);
});
