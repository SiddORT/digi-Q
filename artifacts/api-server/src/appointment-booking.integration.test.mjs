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

test("private detail alone projects profile and actor, without conflating visit contact or publication", async () => {
  await h.api.put(h.t.users, { id: "r", email: "staff@example.invalid", fullName: "Receptionist", role: "receptionist", managingAdminId: "admin" });
  const a = await h.book();
  await h.api.change(h.t.patients, a.patientId, { mobile: "+14155550111", data: { fullName: "Profile Patient", gender: "female", dateOfBirth: "1990-03-14", email: "patient@example.invalid" } });
  const saved = await edit(a, { bookingMobile: "+14155550222" });
  const detail = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.staff, {}, { id: a.id });
  assert.equal(detail.privatePatient.mobile, "+14155550111");
  assert.equal(detail.bookingMobile, "+14155550222");
  assert.equal(detail.privatePatient.gender, "female");
  assert.equal(detail.privatePatient.canEdit, true);
  assert.equal(detail.history.at(-1).actorDisplayName, "Receptionist");
  assert.equal(detail.history.at(-1).actorRecordedRole, "receptionist");
  assert.equal(detail.history.at(-1).actorId, undefined);
  assert.equal(saved.privatePatient, undefined, "write response is not the private detail serializer");
  const listed = await h.route(h.api.appointmentsRouter, "get", "/appointments", h.staff, {});
  assert.equal(listed.items.find(item => item.id === a.id).privatePatient, undefined);
  assert.equal(listed.items.find(item => item.id === a.id).history.at(-1).actorDisplayName, undefined);
});

test("visit visibility does not grant demographic edits, and anonymized or incomplete history remains honest", async () => {
  const a = await h.book();
  const doctor = { id: "du", role: "doctor", doctorId: "d", clinicIds: ["c"], branchIds: ["b"] };
  const doctorView = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", doctor, {}, { id: a.id });
  assert.equal(doctorView.privatePatient.canEdit, false);
  const ownView = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.patient, {}, { id: a.id });
  assert.equal(ownView.privatePatient.canEdit, true, "patient self-edit is independent of appointment editing");
  assert.equal(ownView.canEditBooking, false);
  await assert.rejects(h.route(h.api.appointmentsRouter, "get", "/appointments/:id",
    { ...h.staff, clinicIds: [] }, {}, { id: a.id }), /scope/);
  const row = await h.api.one(h.t.appointments, a.id);
  await h.api.change(h.t.appointments, a.id, { data: { ...row, history: [
    { status: "waiting", occurredAt: "2030-01-07T10:00:00Z" },
    { status: "waiting", action: "reschedule", occurredAt: "2030-01-07T11:00:00Z",
      from: { date: "2030-01-06", startTime: "09:00" }, to: { date: "2030-01-07" },
      actorId: "removed-actor", deletedActor: true, actorKind: "doctor" },
  ] } });
  const detail = await h.route(h.api.appointmentsRouter, "get", "/appointments/:id", h.staff, {}, { id: a.id });
  assert.equal(detail.history.length, 2);
  assert.equal(detail.history[0].actorState, "unknown");
  assert.equal(detail.history[1].actorState, "deleted");
  assert.deepEqual(detail.history[1].from, { date: "2030-01-06", startTime: "09:00" });
  assert.deepEqual(detail.history[1].to, { date: "2030-01-07" });
  assert.equal(JSON.stringify(detail).includes("removed-actor"), false);
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
