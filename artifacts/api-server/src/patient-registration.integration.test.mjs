import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
let h;
before(async () => { h = await createFeatureHarness({ administration: true }); await seedFeatureFixtures(h.pg); });
after(async () => h?.close());
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };

test("staff registration commits before booking and is listed/opened by every permitted role", async () => {
  for (const actor of ["sa", "adm", "rec"]) {
    const p = ok(await h.call(actor, "POST", "/patients", { fullName: `Registered ${actor}`, clinicId: "c1", branchId: "b1" }), 201);
    assert.equal(p.clinicId, "c1"); assert.equal(p.branchId, "b1");
    assert.equal((await h.pg.query("select count(*)::int n from appointments where patient_id=$1", [p.id])).rows[0].n, 0);
    for (const reader of ["sa", "adm", "rec", "docu"]) {
      const list = ok(await h.call(reader, "GET", `/patients?search=${encodeURIComponent(p.fullName)}&clinicId=c1&branchId=b1&status=active`));
      assert.deepEqual(list.items.map(row => row.id), [p.id], `${actor} -> ${reader}`);
      assert.equal(ok(await h.call(reader, "GET", `/patients/${p.id}`)).id, p.id);
      assert.equal(ok(await h.call(reader, "GET", `/patients/${p.id}/activity`)).total, 0);
    }
    for (const reader of ["adm2", "rec3", "doc3u", "patu"]) {
      assert.equal(ok(await h.call(reader, "GET", `/patients?search=${encodeURIComponent(p.fullName)}`)).total, 0);
      assert.equal((await h.call(reader, "GET", `/patients/${p.id}`)).status, 403);
    }
  }
});

test("clinic-only registrations, empty/removed assignments and paired locations retain the boundary", async () => {
  const clinicOnly = ok(await h.call("adm", "POST", "/patients", { fullName: "Clinic Only Registration", clinicId: "c1" }), 201);
  const second = ok(await h.call("adm", "POST", "/patients", { fullName: "Second Location Registration", clinicId: "c2", branchId: "b2" }), 201);
  assert.equal(ok(await h.call("docu", "GET", `/patients/${clinicOnly.id}`)).id, clinicOnly.id);
  assert.equal(ok(await h.call("docu", "GET", `/patients?search=Clinic%20Only&clinicId=c1`)).total, 1);
  assert.equal(ok(await h.call("docu", "GET", `/patients?search=Clinic%20Only&branchId=b1`)).total, 0, "a branch filter must not include clinic-only records");
  assert.equal(ok(await h.call("docu", "GET", `/patients/${second.id}`)).branchId, "b2");
  assert.ok((await h.call("adm", "POST", "/patients", { fullName: "Mismatched Location", clinicId: "c1", branchId: "b2" })).status >= 400);
  assert.equal((await h.call("rec", "POST", "/patients", { fullName: "Forbidden Registration", clinicId: "c2", branchId: "b2" })).status, 403);
  assert.equal((await h.call("docu", "POST", "/patients", { fullName: "Forbidden Doctor Create", clinicId: "c1", branchId: "b1" })).status, 403);
  assert.equal((await h.call("docu", "PATCH", `/patients/${clinicOnly.id}`, { fullName: "Forbidden Doctor Edit" })).status, 403);
  const mappings = (await h.pg.query("select * from assignments where user_id='docu'")).rows;
  try {
    await h.pg.exec("delete from assignments where user_id='docu'");
    assert.equal(ok(await h.call("docu", "GET", "/patients?search=Registration")).total, 0);
    assert.equal((await h.call("docu", "GET", `/patients/${clinicOnly.id}`)).status, 403);
  } finally {
    for (const m of mappings) await h.pg.query("insert into assignments(id,user_id,clinic_id,branch_id) values ($1,$2,$3,$4)", [m.id, m.user_id, m.clinic_id, m.branch_id]);
  }
  assert.equal(ok(await h.call("patu", "GET", "/patients/p1")).id, "p1");
  assert.equal(ok(await h.call("patu", "GET", "/patients")).total, 1);
});

test("registration-only visibility does not expose another doctor's visits, activity or documents", async () => {
  const p = ok(await h.call("rec", "POST", "/patients", { fullName: "Independent Profile", clinicId: "c1", branchId: "b1" }), 201);
  const doc = ok(await h.call("adm", "POST", `/patients/${p.id}/documents?clinicId=c1&name=private.txt`, Buffer.from("private")), 201);
  assert.deepEqual(ok(await h.call("docu", "GET", `/patients/${p.id}/documents`)), { items: [], uploadClinicIds: [] });
  assert.equal((await h.call("docu", "GET", `/patient-documents/${doc.id}`)).status, 404);
  assert.equal((await h.call("docu", "POST", `/patients/${p.id}/documents?clinicId=c1&name=private.txt`, Buffer.from("private"))).status, 403);
  await h.pg.exec(`insert into users(id,full_name,email,role) values ('other-doc','Other Doctor','other@test.invalid','doctor');
    insert into doctors(id,user_id,owner_admin_id) values ('other-d','other-doc','adm');
    insert into assignments(id,user_id,clinic_id,branch_id) values ('other-assignment','other-doc','c1','b1');`);
  await h.pg.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data) values ('other-visit',$1,'other-d','c1','b1','2030-01-01',99,'completed','rec','{}')`, [p.id]);
  await h.pg.exec(`insert into appointment_history(id,appointment_id,actor_id,to_status) values ('other-history','other-visit','other-doc','completed')`);
  assert.equal(ok(await h.call("docu", "GET", `/patients/${p.id}/activity`)).total, 0);
  assert.deepEqual(ok(await h.call("docu", "GET", `/patients/${p.id}/documents`)).items, []);
  assert.equal((await h.call("docu", "GET", `/patient-documents/${doc.id}`)).status, 404);
  assert.equal(ok(await h.call("adm", "GET", `/patients/${p.id}/activity`)).total, 1);
  assert.equal(ok(await h.call("adm", "GET", `/patients/${p.id}/documents`)).items.length, 1);
});

test("matching search, status, pagination and location filters work immediately after registration", async () => {
  const active = ok(await h.call("rec", "POST", "/patients", { fullName: "Filter Registration Active", clinicId: "c1", branchId: "b1" }), 201);
  const inactive = ok(await h.call("rec", "POST", "/patients", { fullName: "Filter Registration Inactive", clinicId: "c1", branchId: "b1", status: "inactive" }), 201);
  for (const actor of ["sa", "adm", "rec", "docu"]) {
    const base = "/patients?search=Filter%20Registration&clinicId=c1&branchId=b1";
    assert.deepEqual(ok(await h.call(actor, "GET", `${base}&status=active`)).items.map(p => p.id), [active.id]);
    assert.deepEqual(ok(await h.call(actor, "GET", `${base}&status=inactive`)).items.map(p => p.id), [inactive.id]);
    assert.equal(ok(await h.call(actor, "GET", `${base}&pageSize=1&page=2`)).items.length, 1);
    assert.equal(ok(await h.call(actor, "GET", `${base}&pageSize=1&page=3`)).total, 2);
    assert.equal(ok(await h.call(actor, "GET", `${base}&pageSize=1&page=3`)).items.length, 0);
  }
});
