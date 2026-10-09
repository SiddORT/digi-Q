import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";
import { drizzle } from "drizzle-orm/node-postgres";
import express from "express";

const bundle = resolve(import.meta.dirname, `.notification-templates-${process.pid}.mjs`);
let h, api;
const sa = { id: "sa", role: "superAdmin" }, ca = { id: "ca", role: "clinicAdmin" };
before(async () => {
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  await h.control.query("insert into clinics(id,admin_id,data) values('c','ca','{\"name\":\"Actual Clinic\",\"email\":\"clinic@example.invalid\"}'),('foreign','other','{}')");
  globalThis.notificationTestDb = h.db;
  await build({
    stdin: { contents: `export * from "./lib/notification-templates"; export * from "./lib/notification-template-store"; export * from "./lib/notification-outbox"; export * from "./lib/permission-policy"; export * from "./lib/custom-roles"; export {systemUsersRouter} from "./routes/system-users"; export {errors} from "./lib/http";`, resolveDir: import.meta.dirname },
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `export * from "${resolve(import.meta.dirname, "../../../lib/db/src/schema/core.ts")}";export const db=globalThis.notificationTestDb;`, loader: "ts", resolveDir: import.meta.dirname }));
    }}],
  });
  api = await import(`${bundle}?t=${Date.now()}`);
});
after(async () => { if (h) await h.close(); await rm(bundle, { force: true }); delete globalThis.notificationTestDb; });
test("only Super Admin has platform access; clinic ownership is enforced", async () => {
  for (const role of ["doctor", "receptionist", "patient"])
    await assert.rejects(api.templateCatalog({ id: "ca", role }, "c"), { status: 403 });
  await assert.rejects(api.templateCatalog(ca), { status: 403 });
  await assert.rejects(api.templateCatalog(ca, "foreign"), { status: 403 });
  const result = await api.templateCatalog(ca, "c");
  assert.equal(result.scopeName, "Actual Clinic");
  assert.equal(result.items.length, 6);
  assert.match(result.items[0].previewSubject, /Actual Clinic/);
});
test("strict content validation rejects unknown variables, header injection and unsafe logo URLs", () => {
  const base = api.defaultTemplate("booking");
  for (const patch of [{ body: "{{password}}" }, { subject: "bad\nBcc: other" }, { logoUrl: "javascript:alert(1)" }, { logoUrl: "https://user:pass@example.invalid/a.png" }, { body: "{{ clinic name }}" }])
    assert.equal(api.templateContent.safeParse({ ...base, ...patch }).success, false);
  assert.equal(api.templateSave.safeParse({ event: "booking", revision: 0, mode: "publish", extra: "bad", content: base }).success, false);
});
test("drafts never affect effective sending, clinic overrides stay scoped, stale writes fail and reset revision prevents ABA", async () => {
  const global = { ...api.defaultTemplate("booking"), subject: "Platform {{clinic_name}}" };
  await api.saveTemplate(sa, { event: "booking", revision: 0, mode: "publish", content: global });
  const local = { ...global, subject: "Local {{clinic_name}}" };
  await api.saveTemplate(ca, { clinicId: "c", event: "booking", revision: 0, mode: "draft", content: local });
  assert.equal((await api.resolvedTemplate("booking", "c")).content.subject, global.subject);
  await api.saveTemplate(ca, { clinicId: "c", event: "booking", revision: 1, mode: "publish", content: local });
  assert.equal((await api.resolvedTemplate("booking", "c")).content.subject, local.subject);
  assert.equal((await api.resolvedTemplate("booking", "foreign")).content.subject, global.subject);
  await assert.rejects(api.saveTemplate(ca, { clinicId: "c", event: "booking", revision: 1, mode: "publish", content: global }), { status: 409 });
  await api.saveTemplate(ca, { clinicId: "c", event: "booking", revision: 2, mode: "reset" });
  assert.equal((await api.resolvedTemplate("booking", "c")).content.subject, global.subject);
  await assert.rejects(api.saveTemplate(ca, { clinicId: "c", event: "booking", revision: 0, mode: "publish", content: local }), { status: 409 });
  const logs = await h.control.query("select * from audit_logs where entity_type='notification_templates'");
  assert.equal(logs.rows.length, 4);
  assert.ok(logs.rows.every(row => !JSON.stringify(row).includes("Platform {{")));
});
test("HTML escapes data and template text; substituted values are not recursively interpreted", () => {
  const content = { ...api.defaultTemplate("booking"), body: "{{patient_name}} <script>x</script> {{clinic_name}}" };
  const rendered = api.renderNotification(content, { patient_name: "{{clinic_name}}", clinic_name: "<img onerror=bad>" });
  assert.match(rendered.text, /\{\{clinic_name\}\}/);
  assert.ok(!rendered.html.includes("<script>"));
  assert.ok(!rendered.html.includes("<img onerror="));
  assert.match(rendered.html, /&lt;script&gt;/);
});
test("configured restrictions deny targeted requests and never restrict Super Admin", async () => {
  await h.control.query("insert into settings(id,data) values('permission-policy',$1)", [JSON.stringify({ revision: 1, denied: ["doctor:appointments:cancel", "doctor:patients:read"] })]);
  await assert.rejects(api.enforcePermissionPolicy({ role: "doctor" }, { method: "POST", path: "/appointments/a/actions", body: { action: "cancel" } }), { status: 403 });
  await assert.rejects(api.enforcePermissionPolicy({ role: "doctor" }, { method: "GET", path: "/patients" }), { status: 403 });
  await api.enforcePermissionPolicy(sa, { method: "GET", path: "/patients" });
  await api.enforcePermissionPolicy({ role: "doctor" }, { method: "GET", path: "/appointments" });
});
test("reminder timing follows session timezone and rejects terminal or checked-in visits", () => {
  const row = { date: "2030-06-14", startTime: "10:00", timezone: "Asia/Kolkata", status: "waiting" };
  const now = Date.parse("2030-06-14T03:30:00Z");
  assert.equal(api.reminderDue(row, now), true);
  assert.equal(api.reminderDue(row, now + 3 * 60000), false);
  assert.equal(api.reminderDue({ ...row, status: "cancelled" }, now), false);
  assert.equal(api.reminderDue({ ...row, checkedInAt: "yes" }, now), false);
});
test("outbox is durable, idempotent, renders variables and never re-sends accepted or unknown deliveries", async () => {
  await h.control.query("insert into users(id,role,email,full_name) values('ca','clinicAdmin','owner@example.invalid','Owner')");
  await h.control.query("insert into settings(id,data) values('platform','{\"notificationsEnabled\":true}')");
  await api.enqueueEvent(h.db, "onboarding", { id: "c", clinicId: "c" });
  await api.enqueueEvent(h.db, "onboarding", { id: "c", clinicId: "c" });
  let sent = 0;
  const fake = async (to, subject, text) => { sent++; assert.equal(to, "owner@example.invalid"); assert.match(text, /Actual Clinic/); };
  await api.processNotifications(h.db, fake);
  await api.processNotifications(h.db, fake);
  assert.equal(sent, 1);
  await api.enqueueEvent(h.db, "onboarding", { id: "c", clinicId: "c", revision: 1 });
  const fail = async () => { sent++; throw Error("unknown SMTP outcome"); };
  await api.processNotifications(h.db, fail);
  await api.processNotifications(h.db, fail);
  assert.equal(sent, 2);
  const result = await h.control.query("select data->>'state' as state from settings where id like 'mail-outbox:%' order by id");
  assert.deepEqual(result.rows.map(r => r.state).sort(), ["delivery_unknown", "provider_accepted"]);
});
test("concurrent workers claim a durable event once; known pre-dispatch failures back off", async () => {
  await api.enqueueEvent(h.db, "onboarding", { id: "c", clinicId: "c", revision: 2 });
  let calls = 0;
  const fake = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); };
  const first = await h.connect(), second = await h.connect();
  const firstPid = await first.query("select pg_backend_pid() as pid"), secondPid = await second.query("select pg_backend_pid() as pid");
  assert.notEqual(firstPid.rows[0].pid, secondPid.rows[0].pid);
  await Promise.all([api.processNotifications(drizzle(first), fake), api.processNotifications(drizzle(second), fake)]);
  assert.equal(calls, 1);
  await api.enqueueEvent(h.db, "onboarding", { id: "c", clinicId: "c", revision: 3 });
  const before = Date.now();
  await api.processNotifications(h.db, async () => { const error = new Error("Not configured"); error.code = "EMAIL_UNCONFIGURED"; throw error; });
  const result = await h.control.query("select data from settings where id='mail-outbox:onboarding:c:3'");
  assert.equal(result.rows[0].data.state, "pending");
  assert.ok(result.rows[0].data.dueAt > before + 59000);
});
test("custom roles enforce clinic restrictions, revisions, base-role and assignment safeguards", async () => {
  const input = { revision: 0, roles: [{ id: "limited-admin", name: "Clinic observer", baseRole: "clinicAdmin", denied: ["appointments:create"] }], bindings: [{ userId: "ca", roleId: "limited-admin", clinicId: "c" }] };
  await assert.rejects(api.saveCustomRoles(ca, input), { status: 403 });
  const saved = await api.saveCustomRoles(sa, input);
  assert.equal(saved.revision, 1);
  await assert.rejects(api.saveCustomRoles(sa, input), { status: 409 });
  await assert.rejects(api.enforcePermissionPolicy(ca, { method: "POST", path: "/appointments", body: { clinicId: "c" } }), { status: 403 });
  await assert.rejects(api.enforcePermissionPolicy(ca, { method: "POST", path: "/appointments" }), { status: 403 });
  await api.enforcePermissionPolicy(ca, { method: "POST", path: "/appointments", body: { clinicId: "foreign" } });
  await api.enforcePermissionPolicy(sa, { method: "POST", path: "/appointments", body: { clinicId: "c" } });
  await assert.rejects(api.saveCustomRoles(sa, { ...saved, roles: [] }), { status: 400 });
  await assert.rejects(api.saveCustomRoles(sa, { ...saved, roles: [{ ...saved.roles[0], baseRole: "doctor" }] }), { status: 400 });
  await assert.rejects(api.saveCustomRoles(sa, { ...saved, bindings: [{ ...saved.bindings[0], clinicId: "foreign" }] }), { status: 400 });
  await api.saveCustomRoles(sa, { ...saved, roles: [], bindings: [] });
});
test("recipient templates are isolated, secondary channels opt in and onboarding stays admin-only", async () => {
  assert.equal(api.defaultTemplate("booking", "doctor").enabled, false);
  assert.equal(api.defaultTemplate("booking", "clinicAdmin").enabled, true, "approved owning-admin booking policy");
  assert.equal(api.defaultTemplate("cancelled", "clinicAdmin").enabled, false, "unrelated secondary events remain opt-in");
  const before = await api.resolvedTemplate("booking", "c");
  const doctor = { ...api.defaultTemplate("booking", "doctor"), enabled: true, subject: "Doctor visit notice" };
  await api.saveTemplate(ca, { clinicId: "c", recipient: "doctor", event: "booking", revision: 0, mode: "publish", content: doctor });
  assert.equal((await api.resolvedTemplate("booking", "c", h.db, "doctor")).content.subject, doctor.subject);
  assert.deepEqual((await api.resolvedTemplate("booking", "c")).content, before.content);
  assert.equal((await api.templateCatalog(ca, "c", "doctor")).items.every(i => i.recipient === "doctor" && i.event !== "onboarding"), true);
  await assert.rejects(api.saveTemplate(ca, { clinicId: "c", recipient: "patient", event: "onboarding", revision: 0, mode: "publish", content: doctor }), { status: 400 });
});
test("system staff directory excludes patients and credential fields, scopes filters and denies non-admins", async () => {
  await h.control.query("insert into users(id,role,email,full_name,status) values('sa','superAdmin','system@example.invalid','System Admin','active'),('patient-account','patient','patient@example.invalid','Patient Account','active')");
  const app = express();
  app.use((req, _res, next) => { req.authUserId = req.get("x-test-user"); req.authSessionHash = "isolated-proof"; next(); });
  app.use(api.systemUsersRouter); app.use(api.errors);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/management/system-users`;
    const response = await fetch(url, { headers: { "x-test-user": "sa" } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.data.some(u => u.role === "superAdmin"));
    assert.ok(body.data.every(u => u.role !== "patient" && !("passwordHash" in u) && !("data" in u)));
    const scoped = await (await fetch(url + "?clinicId=c", { headers: { "x-test-user": "sa" } })).json();
    assert.deepEqual(scoped.data.map(u => u.id), ["ca"]);
    assert.equal((await fetch(url, { headers: { "x-test-user": "ca" } })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test("recipient delivery deduplicates multi-role staff and retries and respects opt-outs", async () => {
  await h.control.query(`insert into users(id,role,email,status) values('staff-doctor','doctor','owner@example.invalid','active'),('reception','receptionist','reception@example.invalid','active');
    insert into patients(id,clinic_id,data) values('recipient-patient','c','{"email":"patient-notices@example.invalid","fullName":"Example patient"}');
    insert into doctors(id,user_id,owner_admin_id) values('recipient-doctor','staff-doctor','ca');
    insert into assignments(id,user_id,clinic_id) values('recipient-link','reception','c');
    insert into appointments(id,patient_id,doctor_id,clinic_id,date,token_number,data) values('recipient-visit','recipient-patient','recipient-doctor','c','2026-11-01',1,'{"startTime":"10:00","endTime":"11:00","timezone":"UTC"}')`);
  const row = { id: "recipient-visit", patientId: "recipient-patient", doctorId: "recipient-doctor", clinicId: "c", date: "2026-11-01", startTime: "10:00", endTime: "11:00", timezone: "UTC", revision: 0 };
  for (const recipient of ["clinicAdmin", "doctor", "receptionist"]) {
    await api.saveTemplate(ca, { clinicId: "c", event: "completed", recipient, revision: 0, mode: "publish", content: { ...api.defaultTemplate("completed", recipient), enabled: true } });
  }
  await api.enqueueEvent(h.db, "completed", row); await api.enqueueEvent(h.db, "completed", row);
  const jobs = await h.control.query("select id from settings where id like 'mail-outbox:completed:recipient-visit:%'");
  assert.equal(jobs.rows.length, 3); // Patient, shared admin/doctor address, receptionist.
  const delivered = [];
  await api.processNotifications(h.db, async email => { delivered.push(email); }, Date.now() + 100);
  assert.deepEqual(delivered.sort(), ["owner@example.invalid", "patient-notices@example.invalid", "reception@example.invalid"]);
  await api.processNotifications(h.db, async () => { throw Error("Duplicate delivery"); }, Date.now() + 200);
  const content = { ...api.defaultTemplate("completed", "receptionist"), enabled: false };
  await api.saveTemplate(ca, { clinicId: "c", event: "completed", recipient: "receptionist", revision: 1, mode: "publish", content });
  await api.enqueueEvent(h.db, "completed", { ...row, revision: 1 });
  const newer = await h.control.query("select data from settings where id like 'mail-outbox:completed:recipient-visit:1%'");
  assert.equal(newer.rows.length, 2);
});