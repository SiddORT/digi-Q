import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const bundle = resolve(import.meta.dirname, `.notification-templates-${process.pid}.mjs`);
let h, api;
const sa = { id: "sa", role: "superAdmin" }, ca = { id: "ca", role: "clinicAdmin" };
before(async () => {
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  await h.control.query("insert into clinics(id,admin_id,data) values('c','ca','{\"name\":\"Actual Clinic\",\"email\":\"clinic@example.invalid\"}'),('foreign','other','{}')");
  globalThis.notificationTestDb = h.db;
  await build({
    stdin: { contents: `export * from "./lib/notification-templates"; export * from "./lib/notification-template-store";`, resolveDir: import.meta.dirname },
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