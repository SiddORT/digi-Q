import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

let h;
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { await h.seed(); });
after(async () => { if (h) await h.close(); });
const edit = (a, body, actor = h.staff, tx) => h.route(h.api.appointmentsRouter, "patch",
  "/appointments/:id/booking", actor, { expectedRevision: a.revision || 0, expectedBookingDetailsRevision: a.bookingDetailsRevision || 0, bookingMobile: "+14155552672",
    notes: "Visit-only fictional note", ...body }, { id: a.id }, {}, tx);

test("limited edit increments its own revision without obsoleting automatic messages, changing patients or scheduling", async () => {
  const a = await h.book();
  const patient = await h.api.one(h.t.patients, a.patientId);
  const settings = await h.api.all(h.t.settings);
  const saved = await edit(a);
  assert.equal(saved.bookingMobile, "+14155552672");
  assert.equal(saved.notes, "Visit-only fictional note");
  assert.equal(saved.bookingDetailsRevision, 1);
  assert.equal(saved.revision, a.revision);
  for (const key of ["id", "status", "date", "doctorId", "branchId", "clinicId", "sessionId", "token", "reference", "bookingContactSource", "confirmationEmail"])
    assert.deepEqual(saved[key], a[key], key);
  assert.deepEqual(await h.api.one(h.t.patients, a.patientId), patient);
  assert.deepEqual(await h.api.all(h.t.settings), settings);
  assert.equal(saved.history.at(-1).action, "booking_details_updated");
  assert.equal(saved.canEditBooking, true);
  const reloaded = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.staff, {}, { id: a.id });
  assert.equal(reloaded.notes, saved.notes);
});

test("strict input denies scheduling, identity and recipient overrides and rejects invalid mobile or long notes", async () => {
  const a = await h.book();
  for (const body of [{ patientId: "p2" }, { date: h.tomorrow }, { recipient: "+14155552673" },
    { bookingMobile: "" }, { bookingMobile: "12345" }, { notes: "x".repeat(1001) }, { expectedRevision: -1 }])
    await assert.rejects(edit(a, body));
  assert.equal((await h.api.one(h.t.appointments, a.id)).revision, 0);
});

test("patient, outside-scope staff, completed and cancelled visits cannot edit", async () => {
  const a = await h.book();
  await assert.rejects(edit(a, {}, h.patient), /Permission/);
  await assert.rejects(edit(a, {}, { ...h.staff, clinicIds: [] }), /scope/);
  for (const status of ["completed", "cancelled"]) {
    await h.api.change(h.t.appointments, a.id, { status });
    await assert.rejects(edit(a), /no longer/);
    const view = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.staff, {}, { id: a.id });
    assert.equal(view.canEditBooking, false);
  }
});

test("stale revision cannot overwrite a saved visit; concurrent writers have exactly one winner", async () => {
  const a = await h.book();
  const results = await h.race([
    (tx) => edit(a, { notes: "First writer" }, h.staff, tx),
    (tx) => edit(a, { notes: "Second writer" }, h.staff, tx),
  ], { doctorIds: [], lockKeys: [`d:b:${a.date}`] });
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected" && r.reason.status === 409).length, 1);
  await assert.rejects(edit(a), /changed/);
  const saved = await h.api.one(h.t.appointments, a.id);
  assert.equal(saved.bookingDetailsRevision, 1);
  assert.equal(saved.revision, a.revision);
  assert.equal(saved.history.filter(e => e.action === "booking_details_updated").length, 1);
});

test("administrative and clinic-specific custom-role restrictions hide and reject Edit", async () => {
  const a = await h.book();
  const get = () => h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.staff, {}, { id: a.id });
  await h.api.put(h.t.settings, { id: "permission-policy", data: { revision: 1, denied: ["receptionist:appointments:update"] } });
  assert.equal((await get()).canEditBooking, false);
  await assert.rejects(edit(a), /disabled/);
  await h.api.change(h.t.settings, "permission-policy", { data: { revision: 2, denied: [] } });
  await h.api.put(h.t.settings, { id: "custom-roles", data: { revision: 1,
    roles: [{ id: "limited", name: "Limited", baseRole: "receptionist", denied: ["appointments:update"] }],
    bindings: [{ userId: h.staff.id, roleId: "limited", clinicId: "c" }] } });
  assert.equal((await get()).canEditBooking, false);
  await assert.rejects(edit(a), /disabled/);
});

test("an operational change conflicts even when the contact/notes revision has not changed", async () => {
  const a = await h.book();
  await h.api.change(h.t.appointments, a.id, { data: { ...a, revision: (a.revision || 0) + 1 } });
  await assert.rejects(edit(a), /changed/);
  const current = await h.api.one(h.t.appointments, a.id);
  assert.equal(current.bookingDetailsRevision, undefined);
  assert.equal(current.bookingMobile, a.bookingMobile);
});
