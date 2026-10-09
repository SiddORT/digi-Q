// Read-only endpoint exercised against disposable PostgreSQL; never real SMTP or project data.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h;
const path = "/management/booking-mail-outcomes";
before(async () => {
  h = await createFeatureHarness();
  await seedFeatureFixtures(h.pg);
  const states = ["pending", "sending", "delivery_unknown", "provider_accepted", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient", "future_state"];
  for (const [index, state] of states.entries()) {
    await h.pg.query("insert into settings(id,data) values($1,$2)", [`mail-outbox:booking:owner-${index}:recipient:private-hash`, {
      event: "booking", clinicId: "c1", recipientGroup: "clinicAdmin", state,
      appointmentId: "private-appointment-id", recipientUserId: "adm", recipientEmailKey: "private-hash",
      snapshot: { reference: `REF-${index}`, email: "private@test.invalid", fullName: "PRIVATE-NAME", notes: "PRIVATE-NOTES" },
      previousDetails: "PRIVATE-MESSAGE", createdAt: 1700000000000 + index,
      attempts: 1, claimedAt: 1700000000000, dueAt: 0,
    }]);
  }
  for (const [id, clinicId, event, recipientGroup] of [
    ["foreign", "c3", "booking", "clinicAdmin"], ["other-owned-clinic", "c2", "booking", "clinicAdmin"],
    ["patient", "c1", "booking", "patient"], ["doctor", "c1", "booking", "doctor"],
    ["receptionist", "c1", "booking", "receptionist"], ["cancelled", "c1", "cancelled", "clinicAdmin"],
  ]) await h.pg.query("insert into settings(id,data) values($1,$2)", [`mail-outbox:${event}:${id}`, {
    event, clinicId, recipientGroup, state: "delivery_unknown", snapshot: { reference: `EXCLUDED-${id}` }, createdAt: 1700000001000,
  }]);
});
after(async () => { await h?.close(); });

test("owner reads only selected clinic booking/admin outcomes through a minimal allowlist", async () => {
  const result = await h.call("adm", "GET", `${path}?clinicId=c1`);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.data.items.length, 10);
  assert.equal(result.data.hasMore, false);
  assert.equal(result.data.items[0].status, "unknown");
  for (const item of result.data.items) assert.deepEqual(Object.keys(item).sort(), ["createdAt", "reference", "status"]);
  for (const text of ["PRIVATE", "private", "EXCLUDED", "snapshot", '"recipient', "appointmentId", "attempts"]) assert.ok(!JSON.stringify(result.data).includes(text), text);
  assert.equal((await h.call("adm", "GET", `${path}?clinicId=c2`)).data.items[0].reference, "EXCLUDED-other-owned-clinic");
});

test("authentication, actual current ownership and active workspace are enforced without new staff permissions", async () => {
  assert.equal((await h.call(null, "GET", `${path}?clinicId=c1`)).status, 401);
  for (const user of ["sa", "docu", "rec", "patu", "adm2"])
    assert.equal((await h.call(user, "GET", `${path}?clinicId=c1`)).status, 403, user);
  for (const clinic of ["c3", "missing"]) assert.equal((await h.call("adm", "GET", `${path}?clinicId=${clinic}`)).status, 403);
  await h.pg.query("insert into settings(id,data) values('workspace:adm',$1)", [{ clinicId: "c2" }]);
  assert.equal((await h.call("adm", "GET", `${path}?clinicId=c1`)).status, 403);
  await h.pg.exec("delete from settings where id='workspace:adm'");
  // Transfer an unstaffed clinic: moving a staffed clinic would correctly violate management guards.
  await h.pg.exec("insert into clinics(id,admin_id,owner_id,data) values('transfer-clinic','adm','adm','{}')");
  assert.equal((await h.call("adm", "GET", `${path}?clinicId=transfer-clinic`)).status, 200);
  await h.pg.exec("update clinics set admin_id='adm2' where id='transfer-clinic'");
  assert.equal((await h.call("adm", "GET", `${path}?clinicId=transfer-clinic`)).status, 403, "a previous owner's session loses access");
  assert.equal((await h.call("adm2", "GET", `${path}?clinicId=transfer-clinic`)).status, 200, "the new current owner has access");
});

test("bounded pages are deterministic and repeated reads never alter durable claims or terminal outcomes", async () => {
  const before = (await h.pg.query("select id,data from settings where id like 'mail-outbox:%' order by id")).rows;
  const first = await h.call("adm", "GET", `${path}?clinicId=c1&pageSize=3`);
  const second = await h.call("adm", "GET", `${path}?clinicId=c1&pageSize=3&page=2`);
  assert.equal(first.data.hasMore, true);
  assert.deepEqual(first.data.items.map(i => i.reference), ["REF-9", "REF-8", "REF-7"]);
  assert.deepEqual(second.data.items.map(i => i.reference), ["REF-6", "REF-5", "REF-4"]);
  assert.deepEqual((await h.call("adm", "GET", `${path}?clinicId=c1&pageSize=3`)).data, first.data);
  assert.deepEqual((await h.call("adm", "GET", `${path}?clinicId=c1&page=100`)).data, { items: [], hasMore: false });
  for (const query of ["", "?clinicId=c1&page=0", "?clinicId=c1&pageSize=51", "?clinicId=c1&page=bad"])
    assert.equal((await h.call("adm", "GET", `${path}${query}`)).status, 400);
  for (const method of ["POST", "PUT", "DELETE"]) assert.equal((await h.call("adm", method, `${path}?clinicId=c1`, {})).status, 404);
  assert.deepEqual((await h.pg.query("select id,data from settings where id like 'mail-outbox:%' order by id")).rows, before);
});
