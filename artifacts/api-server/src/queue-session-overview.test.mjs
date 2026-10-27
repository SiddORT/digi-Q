// Disposable PostgreSQL only: no development records, queues or delivery.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

let h;
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { await h.seed(); });
after(async () => { await h?.close(); });
const admin = () => ({ id: "admin", role: "clinicAdmin", clinicIds: ["c"], branchIds: [] });
const overview = (actor = admin(), params = {}) =>
  h.route(h.api.queueRouter, "get", "/queue-sessions", actor, {}, {}, { date: h.today, ...params });

test("empty scheduled sessions list without selecting a doctor or location", async () => {
  const result = await overview();
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map(r => r.branchId).sort(), ["b", "b2"]);
  for (const item of result.items) {
    assert.equal(item.total, 0);
    assert.equal(item.snapshotOnly, false);
    assert.equal(item.date, h.today);
    assert.ok(item.clinicName && item.branchName && item.doctorName && item.timezone);
    assert.equal(item.patientId, undefined);
    assert.equal(item.entries, undefined);
  }
});

test("doctor own-doctor and receptionist exact-location scope precede counts and filters", async () => {
  await h.book();
  const doctor = { id: "du", role: "doctor", doctorId: "d", clinicIds: ["c"], branchIds: ["b", "b2"] };
  const own = await overview(doctor);
  assert.equal(own.total, 1);
  assert.equal(own.items[0].doctorId, "d");
  assert.equal(own.items[0].total, 1);
  assert.equal((await overview(doctor, { doctorId: "d2" })).total, 0);
  const receptionist = { id: "r", role: "receptionist", clinicIds: ["c"], branchIds: ["b2"] };
  const assigned = await overview(receptionist);
  assert.equal(assigned.total, 1);
  assert.equal(assigned.items[0].branchId, "b2");
  assert.equal(assigned.items[0].total, 0);
  assert.equal((await overview(receptionist, { branchId: "b" })).total, 0);
});

test("unassigned clinics and patient role cannot inspect session summaries", async () => {
  assert.equal((await overview({ ...admin(), clinicIds: ["foreign"] })).total, 0);
  await assert.rejects(overview(h.patient), e => e.status === 403);
});

test("pagination and literal name search are bounded and totals survive empty pages", async () => {
  const first = await overview(admin(), { pageSize: 1 });
  const second = await overview(admin(), { pageSize: 1, page: 2 });
  assert.equal(first.total, 2);
  assert.equal(first.items.length, 1);
  assert.notEqual(first.items[0].branchId, second.items[0].branchId);
  const empty = await overview(admin(), { pageSize: 1, page: 3 });
  assert.equal(empty.total, 2);
  assert.deepEqual(empty.items, []);
  assert.equal((await overview(admin(), { search: "Doctor Two" })).total, 1);
  assert.equal((await overview(admin(), { search: "%" })).total, 0);
  await assert.rejects(overview(admin(), { pageSize: 101 }), e => e.name === "ZodError");
  await assert.rejects(overview(admin(), { date: "2030-02-31" }), e => e.status === 400);
});

test("snapshot-only sessions remain visible after weekly timing changes without roster disclosure", async () => {
  const appointment = await h.book();
  await h.control.query(`update schedules set data=data || '{"startTime":"02:00","endTime":"23:00"}'::jsonb
    where doctor_id='d' and day_of_week=$1`, [new Date(`${h.today}T12:00:00Z`).getUTCDay()]);
  const result = await overview(admin(), { doctorId: "d" });
  assert.equal(result.total, 2);
  const historical = result.items.find(r => r.snapshotOnly);
  assert.ok(historical);
  assert.equal(historical.startTime, appointment.startTime);
  assert.equal(historical.available, false);
  assert.equal(historical.total, 1);
  assert.equal(historical.waiting, 1);
  assert.equal(result.items.find(r => !r.snapshotOnly).total, 0);
  const text = JSON.stringify(result);
  assert.ok(!text.includes(appointment.id));
  assert.ok(!text.includes(appointment.reference));
});

test("extra and closed sessions are listed, while inactive memberships are excluded", async () => {
  await h.api.put(h.t.availabilityExceptions, { id: "closed", doctorId: "d", branchId: "b", date: h.today,
    data: { isClosed: true } });
  await h.api.put(h.t.availabilityExceptions, { id: "extra", doctorId: "d", branchId: "b", date: h.today,
    data: { isExtra: true, startTime: "23:01", endTime: "23:59", timezone: "UTC" } });
  const result = await overview(admin(), { doctorId: "d" });
  assert.equal(result.total, 2);
  assert.equal(result.items.find(r => r.sessionId === "extra").available, true);
  assert.equal(result.items.find(r => r.sessionId !== "extra").available, false);
  await h.control.query("update users set status='inactive' where id='du'");
  assert.equal((await overview(admin(), { doctorId: "d" })).total, 0);
});

test("super-admin sees existing authorized sessions and reads do not mutate operations", async () => {
  const booked = await h.book();
  const before = await h.control.query("select id,status,data from appointments order by id");
  const result = await overview({ id: "sa", role: "superAdmin", clinicIds: [], branchIds: [] });
  assert.equal(result.total, 2);
  assert.equal(result.items.reduce((n, r) => n + r.total, 0), 1);
  const after = await h.control.query("select id,status,data from appointments order by id");
  assert.deepEqual(after.rows, before.rows);
  assert.equal((await h.api.one(h.t.appointments, booked.id)).status, booked.status);
});
