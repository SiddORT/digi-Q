import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { drizzle } from "drizzle-orm/pglite";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h, provision;
const bundle = resolve(import.meta.dirname, ".healthcare-vocabulary-test.mjs");
before(async () => {
  // Fictional readiness values only; the harness intercepts every mail request.
  Object.assign(process.env, { CLINICFLOW_PUBLIC_ORIGIN: "https://fictional.test.invalid",
    SMTP_HOST: "mail.test.invalid", SMTP_PORT: "587", SMTP_USER: "fictional",
    SMTP_PASSWORD: "fictional", SMTP_FROM: "fictional@test.invalid", SMTP_REQUIRE_TLS: "true" });
  await build({ entryPoints: [resolve(import.meta.dirname, "../../../lib/db/src/healthcare-vocabulary.ts")], outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external" });
  provision = (await import(bundle)).provisionHealthcareVocabulary;
  h = await createFeatureHarness({ administration: true, registration: true, simulatedMail: true });
  await seedFeatureFixtures(h.pg);
});
after(async () => { await h?.close(); await rm(bundle, { force: true }); });
const patch = (actor, clinic, metadata) => h.call(actor, "PATCH", `/clinics/${clinic}/settings`, { clinic: metadata });
const read = async (id = "c1", actor = "adm") => (await h.call(actor, "GET", `/clinics/${id}/settings`)).data.clinic;
const setup = (name, clinic = {}) => ({
  requestId: crypto.randomUUID(), admin: { fullName: "Fictional Clinic Owner", email: `${name}@test.invalid` },
  clinic: { name, slug: name, address: "Fictional Road", email: "clinic@test.invalid", phone: "+919876543210", ...clinic },
  branches: [{ name: "Main", slug: "main", address: "Fictional Road", timezone: "UTC", inheritEmail: true, inheritPhone: true, openingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }],
  ownDoctor: false,
});

test("an empty catalog is returned honestly without fabricating or writing master IDs", async () => {
  const options = await h.call(null, "GET", "/public/registration-options");
  assert.equal(options.status, 200);
  assert.deepEqual(options.data, { categories: [], specialities: [], qualifications: [] });
  assert.equal((await patch("adm", "c1", { customCategory: "Empty catalog clinic", customSpecialities: ["Community outreach"] })).status, 200);
});

test("additive provisioning reconciles legacy names/codes, preserves inactive decisions and operator-managed vocabulary", async () => {
  await h.pg.exec(`insert into masters(id,category,code,status,data) values
    ('legacy-general','clinicCategory','general','active','{"name":"General"}'),
    ('legacy-specialist','clinicCategory','specialist','inactive','{"name":"Specialist"}'),
    ('operator-ortho','specialization','operatorCode','inactive','{"name":"Orthopedics"}'),
    ('operator-custom','specialization','operatorSpeciality','active','{"name":"Operator Care"}')`);
  const conn = drizzle(h.pg);
  await conn.transaction(tx => provision(tx));
  const first = (await h.pg.query("select id,category,code,status,data from masters order by id")).rows;
  await conn.transaction(tx => provision(tx));
  assert.deepEqual((await h.pg.query("select id,category,code,status,data from masters order by id")).rows, first);
  assert.equal(first.filter(r => r.category === "clinicCategory").length, 10);
  assert.equal(first.filter(r => r.category === "specialization").length, 24);
  assert.equal(first.find(r => r.id === "legacy-specialist").status, "inactive");
  assert.equal(first.find(r => r.id === "operator-ortho").data.name, "Orthopedics");
  const options = await h.call(null, "GET", "/public/registration-options");
  assert.equal(options.status, 200);
  assert.ok(options.data.categories.some(r => r.id === "legacy-general"));
  assert.ok(!options.data.categories.some(r => r.id === "legacy-specialist"));
  assert.ok(options.data.specialities.some(r => r.name === "General Medicine"));
});

test("lookup completeness is not silently capped at 200 and does not create masters on reads", async () => {
  await h.pg.exec(`insert into masters(id,category,code,data) select 'extra-'||n,'specialization','extra-'||n,jsonb_build_object('name','Extra '||n) from generate_series(1,205) n`);
  const before = (await h.pg.query("select count(*)::int n from masters")).rows[0].n;
  const options = await h.call(null, "GET", "/public/registration-options");
  assert.ok(options.data.specialities.length > 200);
  assert.equal((await h.pg.query("select count(*)::int n from masters")).rows[0].n, before);
});

test("large fictional setup catalog returns every active option with a measured payload", async t => {
  // Only the disposable embedded database is populated; never workspace/prod data.
  await h.pg.exec(`insert into masters(id,category,code,data)
    select 'catalog-bench-'||category||'-'||n,category,'catalog-bench-'||category||'-'||n,
      jsonb_build_object('name','Fictional '||category||' '||lpad(n::text,5,'0'))
    from unnest(array['clinicCategory','specialization','qualification']) category
    cross join generate_series(1,10000) n`);
  try {
    const before = (await h.pg.query("select count(*)::int n from masters")).rows[0].n;
    const start = performance.now();
    const result = await h.call(null, "GET", "/public/registration-options");
    const elapsedMs = performance.now() - start;
    assert.equal(result.status, 200);
    for (const key of ["categories", "specialities", "qualifications"]) {
      const fictional = result.data[key].filter(o => o.id.startsWith("catalog-bench-"));
      assert.equal(fictional.length, 10000);
      assert.equal(new Set(fictional.map(o => o.id)).size, 10000);
      assert.ok(fictional.some(o => o.name.endsWith("10000")));
      assert.ok(fictional.every(o => Object.keys(o).sort().join(",") === "id,name"));
    }
    assert.equal((await h.pg.query("select count(*)::int n from masters")).rows[0].n, before);
    t.diagnostic(`30,000 fictional options + existing test catalog: ${Math.round(elapsedMs)}ms; ${Buffer.byteLength(JSON.stringify(result.data))} JSON bytes (embedded PostgreSQL, not a production latency estimate)`);
  } finally {
    await h.pg.exec("delete from masters where id like 'catalog-bench-%'");
  }
});

test("custom values normalize, persist, reopen, resolve names and remain clinic-owned", async () => {
  const count = (await h.pg.query("select count(*)::int n from masters")).rows[0].n;
  const standard = (await h.call(null, "GET", "/public/registration-options")).data.specialities.find(r => r.name === "General Medicine");
  const result = await patch("adm", "c1", { customCategory: "  Community Care  ", specialityIds: [standard.id, standard.id], customSpecialities: ["  Sleep Health  ", "sleep health", "Pain & Recovery"] });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const saved = await read();
  assert.equal(saved.customCategory, "Community Care");
  assert.equal(saved.categoryId, null);
  assert.deepEqual(saved.specialityIds, [standard.id]);
  assert.deepEqual(saved.customSpecialities, ["sleep health", "Pain & Recovery"]);
  assert.deepEqual(saved.specialityNames, ["General Medicine", "sleep health", "Pain & Recovery"]);
  assert.equal((await read("c2")).customCategory, undefined);
  const list = await h.call("sa", "GET", "/clinics?adminId=adm");
  assert.equal(list.data.items.find(r => r.id === "c1").categoryName, saved.categoryName);
  assert.deepEqual(list.data.items.find(r => r.id === "c1").specialityNames, saved.specialityNames);
  const detail = await h.call("sa", "GET", "/clinics/c1");
  assert.deepEqual(detail.data.specialityNames, saved.specialityNames);
  assert.equal((await h.pg.query("select count(*)::int n from masters")).rows[0].n, count);
  assert.equal((await h.call("adm", "POST", "/masters", { category: "specialization", code: "notGlobal", name: "Not global" })).status, 403);
  assert.equal((await h.pg.query("select specialization_id from doctors where id='d1'")).rows[0].specialization_id, null);
});

test("standard replacement, explicit custom clearing, and unrelated edits have unambiguous semantics", async () => {
  assert.equal((await patch("adm", "c1", { categoryId: "legacy-general" })).status, 200);
  assert.equal((await read()).customCategory, null);
  assert.equal((await patch("adm", "c1", { customCategory: "Independent" })).status, 200);
  assert.equal((await read()).categoryId, null);
  assert.equal((await patch("adm", "c1", { phone: "+919876543210" })).status, 200);
  assert.equal((await read()).customCategory, "Independent");
  assert.equal((await patch("adm", "c1", { customCategory: null, customSpecialities: [] })).status, 200);
  assert.equal((await read()).customCategory, null);
  assert.deepEqual((await read()).customSpecialities, []);
  const generic = await h.call("adm", "PATCH", "/clinics/c1", { name: "Lakeview Clinic", address: "Original Road", customCategory: "Generic path", customSpecialities: ["Generic Care"] });
  assert.equal(generic.status, 200, JSON.stringify(generic.data));
  assert.equal((await read()).categoryName, "Generic path");
});

test("legacy inactive selections are retained, but cannot be newly assigned", async () => {
  await h.pg.exec(`update clinics set data=data||'{"categoryId":"legacy-specialist","customCategory":null,"specialityIds":["operator-ortho"],"customSpecialities":[]}' where id='c2'`);
  assert.equal((await patch("adm", "c2", { categoryId: "legacy-specialist", specialityIds: ["operator-ortho"] })).status, 200);
  assert.equal((await read("c2")).categoryName, "Specialist");
  const generic = await h.call("adm", "PATCH", "/clinics/c2", { name: "Hillside Clinic", address: "", categoryId: "legacy-specialist", specialityIds: ["operator-ortho"] });
  assert.equal(generic.status, 200, JSON.stringify(generic.data));
  assert.equal((await patch("adm", "c1", { categoryId: "legacy-specialist" })).status, 400);
  assert.equal((await patch("adm", "c1", { specialityIds: ["operator-ortho"] })).status, 400);
});

test("invalid metadata fails without changing saved records", async () => {
  const old = await read();
  const standard = (await h.call(null, "GET", "/public/registration-options")).data.specialities.find(r => r.name === "General Medicine");
  for (const metadata of [
    { categoryId: "legacy-general", customCategory: "Conflict" },
    { categoryId: "arbitrary text not an ID" },
    { customCategory: "x".repeat(101) },
    { customSpecialities: [" "] }, { customSpecialities: Array(31).fill("Care") },
    { customSpecialities: ["Bad\nText"] },
    { specialityIds: [standard.id], customSpecialities: ["GENERAL MEDICINE"] },
  ]) {
    assert.equal((await patch("adm", "c1", metadata)).status, 400, JSON.stringify(metadata));
    assert.deepEqual(await read(), old);
  }
});

test("foreign owners, doctors, receptionists and anonymous callers cannot change either metadata path", async () => {
  for (const actor of ["adm2", "docu", "rec", null]) {
    for (const metadata of [{ customCategory: "Unauthorized" }, { customSpecialities: ["Unauthorized"] }]) {
      assert.ok([401,403].includes((await patch(actor, "c1", metadata)).status));
      assert.ok([401,403].includes((await h.call(actor, "PATCH", "/clinics/c1", { name: "Lakeview Clinic", address: "", ...metadata })).status));
    }
  }
  assert.equal((await patch("sa", "c3", { customCategory: "Superadmin care" })).status, 200);
  assert.equal((await read("c3", "sa")).customCategory, "Superadmin care");
  assert.equal((await h.call("docu", "POST", "/clinics", { name: "No metadata delegation", address: "", customCategory: "Unauthorized" })).status, 403);
});

test("Super Admin onboarding is atomic and replay-safe with custom metadata", async () => {
  const invalid = setup("metadata-invalid", { customCategory: "Clinic", customSpecialities: [" "] });
  assert.equal((await h.call("sa", "POST", "/clinic-admin-onboarding", invalid)).status, 400);
  assert.equal((await h.pg.query("select count(*)::int n from users where email=$1", [invalid.admin.email])).rows[0].n, 0);
  const input = setup("metadata-admin", { customCategory: "  Rural Clinic  ", customSpecialities: ["Custom Care"] });
  const result = await h.call("sa", "POST", "/clinic-admin-onboarding", input);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.clinic.customCategory, "Rural Clinic");
  const retry = await h.call("sa", "POST", "/clinic-admin-onboarding", input);
  assert.equal(retry.status, 201, JSON.stringify(retry.data));
  assert.equal(retry.data.clinic.id, result.data.clinic.id);
  await patch("sa", result.data.clinic.id, { customCategory: "Edited after registration" });
  const receipt = await h.call("sa", "GET", `/clinic-admin-onboarding/completion?requestId=${input.requestId}`);
  assert.equal(receipt.data.result.clinic.customCategory, "Edited after registration");
  assert.equal((await h.call("sa", "POST", "/clinic-admin-onboarding", { ...input, clinic: { ...input.clinic, customCategory: "Different" } })).status, 409);
});

test("public owner onboarding saves mixed metadata atomically, with recovery and independent doctor specialization", async () => {
  const argon2 = createRequire(import.meta.url)("argon2");
  const password = "Fixture-Only!DigiQ-2026";
  await h.pg.query("insert into users(id,email,full_name,role,email_verified_at,password_hash) values('metadata-self','metadata-self@test.invalid','Fictional Owner','clinicAdmin',now(),$1)", [await argon2.hash(password)]);
  const standard = (await h.call(null, "GET", "/public/registration-options")).data.specialities.find(r => r.name === "General Medicine");
  const { admin, ...input } = setup("metadata-self-clinic", { categoryId: "legacy-general", specialityIds: [standard.id], customSpecialities: ["  Mobile Care  "] });
  Object.assign(input, { fullName: "Fictional Owner", password, ownDoctor: true });
  const invalid = await h.call("metadata-self", "POST", "/clinic-registration", { ...input, clinic: { ...input.clinic, customCategory: "Conflict" } });
  assert.equal(invalid.status, 400);
  assert.equal((await h.pg.query("select count(*)::int n from clinics where admin_id='metadata-self'")).rows[0].n, 0);
  const result = await h.call("metadata-self", "POST", "/clinic-registration", input);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.deepEqual(result.data.clinic.specialityNames, ["General Medicine", "Mobile Care"]);
  const doctor = await h.pg.query("select specialization_id from doctors where user_id='metadata-self'");
  assert.equal(doctor.rows[0].specialization_id, null);
  const replay = await h.call("metadata-self", "POST", "/clinic-registration", input);
  assert.equal(replay.status, 201, JSON.stringify(replay.data));
  assert.equal(replay.data.clinic.id, result.data.clinic.id);
  assert.equal((await h.call("metadata-self", "GET", `/clinic-registration/completion?requestId=${input.requestId}`)).data.result.clinic.id, result.data.clinic.id);
});
