// These races use separate PostgreSQL transactions held behind real advisory locks.
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
let h;
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { await h.seed(); });
after(async () => {
  try { if (h) await h.close(); }
  finally { mock.timers.reset(); }
});

function winner(outcomes, count = 1) {
  const successes = outcomes.filter(result => result.status === "fulfilled");
  const failures = outcomes.filter(result => result.status === "rejected");
  assert.equal(successes.length, count, JSON.stringify(outcomes, (_key, value) =>
    value instanceof Error ? { message: value.message, status: value.status } : value));
  for (const { reason } of failures) {
    assert.equal(reason.status, 409, reason.message);
    assert.ok(typeof reason.message === "string" && reason.message.trim().length > 8, "conflict explains the failed operation");
  }
  return successes;
}

async function events(id, action) {
  const [history, audits] = await Promise.all([h.api.all(h.t.appointmentHistory), h.api.all(h.t.auditLogs)]);
  return {
    history: history.filter(entry => entry.appointmentId === id),
    audits: audits.filter(entry => entry.entityId === id && entry.action === action),
  };
}

async function oneEvent(id, action) {
  const { history, audits } = await events(id, action);
  assert.equal(history.filter(entry => entry.actorId?.startsWith("staff-")).length, 1,
    "one persisted history event from the raced workers");
  assert.equal(audits.length, 1, `one ${action} audit event`);
}

const checkIn = (id, expectedRevision = 0) =>
  (tx, actor) => h.api.transition(actor, id, { action: "checkIn", expectedRevision }, tx);
const reschedule = (id, body) =>
  (tx, actor) => h.api.reschedule(actor, id, body, tx);
const destination = date => ({ doctorId: "d2", branchId: "b2", date, expectedRevision: 0 });

test("duplicate check-in cannot create two consultations, history events, or audits", async () => {
  const a = await h.book();
  const outcomes = await h.race([checkIn(a.id), checkIn(a.id)]);
  winner(outcomes);
  const row = await h.api.one(h.t.appointments, a.id);
  assert.equal(row.status, "inConsultation");
  assert.equal(row.revision, 1);
  assert.equal(row.token, a.token);
  assert.equal(row.reference, a.reference);
  await oneEvent(a.id, "checkIn");
});

test("competing check-ins leave just one patient in consultation", async () => {
  const a = await h.book(), b = await h.book("p2");
  const outcomes = await h.race([checkIn(a.id), checkIn(b.id)]);
  winner(outcomes);
  const rows = (await h.rows()).filter(row => [a.id, b.id].includes(row.id));
  assert.deepEqual(rows.map(row => row.status).sort(), ["inConsultation", "waiting"].sort());
  assert.equal(rows.filter(row => ["called", "inConsultation"].includes(row.status)).length, 1);
  const checkedIn = rows.find(row => row.status === "inConsultation");
  assert.equal(checkedIn.id, a.id, "the earlier reservation must win, regardless of lock order");
  for (const booking of [a, b]) {
    const row = rows.find(entry => entry.id === booking.id);
    assert.equal(row.token, booking.token);
    assert.equal(row.reference, booking.reference);
    assert.equal(h.api.rank(row), booking.queueRank);
  }
  await oneEvent(checkedIn.id, "checkIn");
  assert.equal((await events(rows.find(row => row.id !== checkedIn.id).id, "checkIn")).history
    .filter(entry => entry.actorId?.startsWith("staff-")).length, 0);
});

test("duplicate checkout and call-next call the legacy pending patient only once", async () => {
  const a = await h.book(), b = await h.book("p2"), c = await h.book("p3");
  await h.api.change(h.t.appointments, b.id, { status: "booked" });
  await h.act(a.id, { action: "checkIn" });
  const outcomes = await h.race([
    (tx, actor) => h.api.transition(actor, a.id, { action: "complete", expectedRevision: 1 }, tx),
    (tx, actor) => h.api.transition(actor, a.id, { action: "complete", expectedRevision: 1 }, tx),
    (tx, actor) => h.route(h.api.queueRouter, "post", "/queue/call-next", actor,
      { doctorId: "d", branchId: "b", date: h.today }, {}, {}, tx),
  ]);
  winner(outcomes);
  const rows = await h.rows();
  assert.equal(rows.find(row => row.id === a.id).status, "completed");
  assert.equal(rows.find(row => row.id === b.id).status, "called");
  assert.equal(rows.find(row => row.id === c.id).status, "waiting");
  assert.equal(rows.filter(row => ["called", "inConsultation"].includes(row.status)).length, 1);
  assert.equal(rows.find(row => row.id === b.id).token, b.token);
  await oneEvent(b.id, "call");
  const completeEvents = await events(a.id, "complete");
  assert.equal(completeEvents.history.filter(event => event.toStatus === "completed").length, 1);
  assert.equal(completeEvents.audits.length, 1);
});

test("skip versus check-in serializes with either contender launched first", async () => {
  for (const reverse of [false, true]) {
    await h.seed();
    const a = await h.book(), b = await h.book("p2");
    const ops = [
      (tx, actor) => h.api.transition(actor, a.id, { action: "noShow", reason: "Absent at reception", expectedRevision: 0 }, tx),
      checkIn(a.id),
    ];
    const outcomes = await h.race(reverse ? ops.reverse() : ops);
    winner(outcomes);
    const row = await h.api.one(h.t.appointments, a.id);
    assert.ok(["noShow", "inConsultation"].includes(row.status));
    assert.equal(row.revision, 1);
    assert.equal((await h.api.one(h.t.appointments, b.id)).status, "waiting");
    await oneEvent(a.id, row.status === "noShow" ? "noShow" : "checkIn");
  }
});

test("competing re-entry uses the queue version, preserving ranks and both tickets", async () => {
  const a = await h.book(), b = await h.book("p2"), c = await h.book("p3");
  const absentA = await h.act(a.id, { action: "noShow", reason: "Away" });
  const absentB = await h.act(b.id, { action: "noShow", reason: "Away" });
  const version = h.api.queueVersion(await h.rows());
  const returnOp = (id, revision) => (tx, actor) => h.api.transition(actor, id, {
    action: "requeue", reason: "Returned to reception", position: 1,
    expectedRevision: revision, expectedQueueVersion: version,
  }, tx);
  winner(await h.race([returnOp(a.id, absentA.revision), returnOp(b.id, absentB.revision)]));
  const rows = await h.rows();
  const pending = rows.filter(row => h.api.pendingStatuses.includes(row.status));
  assert.equal(pending.length, 2);
  assert.equal(new Set(pending.map(h.api.rank)).size, pending.length);
  assert.equal(h.api.orderedReservations(pending)[0].queueRank, 1);
  assert.equal(rows.find(row => row.id === c.id).status, "waiting");
  for (const booking of [a, b, c]) {
    const row = rows.find(entry => entry.id === booking.id);
    assert.equal(row.token, booking.token);
    assert.equal(row.reference, booking.reference);
  }
  const winnerRow = rows.find(row => [a.id, b.id].includes(row.id) && row.status === "waiting");
  assert.ok(winnerRow);
  assert.equal(rows.find(row => row.id !== winnerRow.id && [a.id, b.id].includes(row.id)).status, "noShow");
  assert.equal((await events(winnerRow.id, "requeue")).audits.length, 1);
  assert.equal((await events(winnerRow.id, "requeue")).history
    .filter(event => event.actorId?.startsWith("staff-")).length, 1);
  assert.equal((await events(winnerRow.id === a.id ? b.id : a.id, "requeue")).audits.length, 0);
});

test("reschedule versus check-in commits only one state and keeps the original reference", async () => {
  const schedule = await h.api.one(h.t.schedules, "d" + new Date(h.today).getUTCDay());
  await h.api.change(h.t.schedules, schedule.id, { data: { ...schedule, startTime: "13:00" } });
  const a = await h.book();
  const outcomes = await h.race([
    reschedule(a.id, destination(h.tomorrow)),
    checkIn(a.id),
  ], { doctorIds: ["d", "d2"] });
  winner(outcomes);
  const row = await h.api.one(h.t.appointments, a.id);
  assert.equal(row.reference, a.reference);
  assert.equal(row.revision, 1);
  if (row.status === "waiting") {
    assert.equal(row.date, h.tomorrow);
    assert.equal(row.doctorId, "d2");
    assert.equal(row.token, "B-01");
    assert.equal(row.history.at(-1).from.token, a.token);
    await oneEvent(a.id, "reschedule");
  } else {
    assert.equal(row.status, "inConsultation");
    assert.equal(row.date, h.today);
    assert.equal(row.token, a.token);
    await oneEvent(a.id, "checkIn");
  }
});

test("competing destination transfers honor capacity without consuming a losing token", async () => {
  const a = await h.book("p1", h.tomorrow), b = await h.book("p2", h.tomorrow);
  const schedule = await h.api.one(h.t.schedules, "d2" + new Date(h.tomorrow).getUTCDay());
  await h.api.change(h.t.schedules, schedule.id, { data: { ...schedule, maxTokens: 1 } });
  winner(await h.race([
    reschedule(a.id, destination(h.tomorrow)),
    reschedule(b.id, destination(h.tomorrow)),
  ], { doctorIds: ["d", "d2"] }));
  const rows = await h.rows();
  const moved = rows.find(row => row.doctorId === "d2");
  const retained = rows.find(row => row.doctorId === "d");
  assert.ok(moved && retained);
  assert.equal(moved.token, "B-01");
  assert.equal(moved.reference, (moved.id === a.id ? a : b).reference);
  assert.equal(moved.history.at(-1).from.token, (moved.id === a.id ? a : b).token);
  assert.equal(retained.token, (retained.id === a.id ? a : b).token);
  assert.equal(retained.reference, (retained.id === a.id ? a : b).reference);
  assert.equal(retained.revision, 0);
  await oneEvent(moved.id, "reschedule");
  const retainedEvents = await events(retained.id, "reschedule");
  assert.equal(retainedEvents.history.filter(event => event.actorId?.startsWith("staff-")).length, 0);
  assert.equal(retainedEvents.audits.length, 0);
  await h.api.change(h.t.schedules, schedule.id, { data: { ...schedule, maxTokens: 2 } });
  const next = await h.book("p3", h.tomorrow, { doctorId: "d2", branchId: "b2" });
  assert.equal(next.token, "B-02", "failed transfer must not consume a destination token");
  const sourceNext = await h.book("p4", h.tomorrow);
  assert.equal(sourceNext.token, "A-03", "neither moved nor retained source token may be reused");
});

test("opposing doctor transfers acquire locks in a deadlock-free order", { timeout: 15000 }, async () => {
  const a = await h.book("p1", h.tomorrow);
  const b = await h.book("p2", h.tomorrow, { doctorId: "d2", branchId: "b2" });
  const outcomes = await h.race([
    reschedule(a.id, destination(h.tomorrow)),
    reschedule(b.id, { doctorId: "d", branchId: "b", date: h.tomorrow, expectedRevision: 0 }),
  ], { doctorIds: ["d", "d2"] });
  winner(outcomes, 2);
  const [movedA, movedB] = await Promise.all([h.api.one(h.t.appointments, a.id), h.api.one(h.t.appointments, b.id)]);
  assert.equal(movedA.doctorId, "d2");
  assert.equal(movedB.doctorId, "d");
  assert.equal(movedA.reference, a.reference);
  assert.equal(movedB.reference, b.reference);
  assert.notEqual(movedA.token, a.token);
  assert.notEqual(movedB.token, b.token);
  await oneEvent(a.id, "reschedule");
  await oneEvent(b.id, "reschedule");
});