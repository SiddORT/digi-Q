// These races use separate PostgreSQL transactions held behind real advisory locks.
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { eq } from "drizzle-orm";

mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
process.env.SESSION_SECRET = "isolated-postgres-contention-signing-key-not-for-production";
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

test("separate PostgreSQL guest contenders serialize last token and same-key replay", async () => {
  await h.api.put(h.t.qrs, { id: "guest-qr-row", clinicId: "c", branchId: "b", publicReference: "guest-qr" });
  await h.api.put(h.t.qrs, { id: "guest-qr-row-2", clinicId: "c", branchId: "b", publicReference: "guest-qr-2" });
  const date = h.tomorrow;
  const schedule = await h.api.one(h.t.schedules, "d" + new Date(date).getUTCDay());
  await h.api.change(h.t.schedules, schedule.id, { data: { ...schedule, maxTokens: 1 } });
  const input = (suffix) => ({ qrReference: "guest-qr", fullName: "Guest " + suffix, branchId: "b", doctorId: "d", date,
    requestId: `12345678-1234-4234-8234-1234567890${suffix}`, receiptSecret: suffix[0].repeat(64) });
  const a = input("12"), b = { ...input("34"), qrReference: "guest-qr-2" };
  // Distinct guest keys race for the same schedule lock on distinct backends.
  const outcomes = await h.race([tx => h.api.createGuestRequest(a, tx), tx => h.api.createGuestRequest(b, tx)]);
  const [reserved] = winner(outcomes);
  assert.equal(reserved.value.status, "confirmed");
  assert.equal((await h.api.all(h.t.appointments)).length, 1);
  assert.equal((await h.api.all(h.t.guestRequests)).length, 1);
  assert.equal((await h.api.all(h.t.patients)).length, 5, "failed booking has no orphan patient");
  const retry = await h.api.createGuestRequest(reserved.value.requestId === a.requestId ? a : b);
  assert.equal(retry.appointmentId, reserved.value.appointmentId);
  assert.equal(retry.token, reserved.value.token);
  assert.equal((await h.api.all(h.t.appointments)).length, 1);
});

test("consulting setup creates one user, a self-owned doctor and clinic-only mapping", async () => {
  const input = {clinic:{name:"Owned Clinic",address:"Road",slug:"owned-clinical"},branches:[{name:"Main",address:"Road",slug:"main-clinical"}]};
  const result = await h.db.transaction(async tx => {
    const admin = await h.api.put(h.t.users,{id:"consult-admin",email:"consult@example.invalid",fullName:"Consulting Admin",role:"clinicAdmin"},tx);
    return h.api.createOwnedClinic(admin,admin,{...input,ownDoctor:true},tx);
  });
  assert.ok(result.doctorId);
  assert.equal((await h.api.one(h.t.clinics,result.clinic.id)).adminId,"consult-admin");
  assert.equal((await h.api.all(h.t.assignments)).filter(a=>a.userId==="consult-admin" && a.clinicId===result.clinic.id && !a.branchId).length,1);
  assert.equal((await h.api.all(h.t.doctors)).filter(d=>d.userId==="consult-admin").length,1);
  const reject = async (operation,pattern) => assert.rejects(operation,error=>pattern.test(error.cause?.message || error.message));
  await reject(h.api.put(h.t.assignments,{id:"foreign-clinic-link",userId:"consult-admin",clinicId:"c",branchId:"b"}),/must match the active clinic administrator/);
  await reject(h.api.put(h.t.assignments,{id:"wrong-branch-clinic",userId:"consult-admin",clinicId:result.clinic.id,branchId:"b"}),/active own doctor profile/);
  await reject(h.api.put(h.t.assignments,{id:"admin-without-profile",userId:"admin",clinicId:"c",branchId:"b"}),/active own doctor profile/);
  const mapping=(await h.api.all(h.t.assignments)).find(a=>a.userId==="consult-admin" && !a.branchId);
  await reject(h.db.delete(h.t.assignments).where(eq(h.t.assignments.id,mapping.id)),/administrator assignment cannot be removed/);
  assert.equal((await h.api.all(h.t.assignments)).some(a=>a.id===mapping.id),true);
  assert.equal((await h.api.all(h.t.assignments)).some(a=>["foreign-clinic-link","wrong-branch-clinic","admin-without-profile"].includes(a.id)),false);
  assert.equal((await h.api.one(h.t.clinics,result.clinic.id)).adminId,"consult-admin");
});

test("concurrent own-doctor attachment is idempotent with no duplicate account or branch assignment", async () => {
  const owner=await h.api.one(h.t.users,"admin");
  const before = (await h.api.all(h.t.users)).length;
  const outcomes=await h.race([
    tx=>h.api.attachOwnDoctor(owner,{branchIds:["b"]},tx),
    tx=>h.api.attachOwnDoctor(owner,{branchIds:["b"]},tx),
  ], {doctorIds:[],lockKeys:["own-doctor:admin"]});
  assert.equal(outcomes.length,2);
  assert.ok(outcomes.every(o => o.status === "fulfilled"));
  assert.equal(outcomes[0].value.id, outcomes[1].value.id);
  assert.equal((await h.api.all(h.t.doctors)).filter(d=>d.userId==="admin").length,1);
  assert.equal((await h.api.all(h.t.assignments)).filter(a=>a.userId==="admin" && a.branchId).length,0);
  assert.equal((await h.api.all(h.t.users)).length,before);
});

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

async function capacity(maxTokens) {
  const schedule = await h.api.one(h.t.schedules, "d" + new Date(h.tomorrow).getUTCDay());
  await h.api.change(h.t.schedules, schedule.id, { data: { ...schedule, maxTokens } });
}

const booking = (patientId, requestId, actor) => (tx, worker) =>
  h.book(patientId, h.tomorrow, { requestId }, { tx, actor: actor || worker });

async function assertBookingEffects(count) {
  assert.equal((await h.rows()).length, count);
  const history = await h.api.all(h.t.appointmentHistory);
  const audits = (await h.api.all(h.t.auditLogs)).filter(event => event.action === "book");
  assert.equal(history.filter(event => event.toStatus === "waiting").length, count);
  assert.equal(audits.length, count);
  const rows = await h.rows();
  assert.equal(new Set(rows.map(row => row.token)).size, count, "tickets are unique, including cancelled bookings");
  assert.equal(new Set(rows.map(row => row.reference)).size, count);
  for (const row of rows) {
    assert.equal(history.filter(event => event.appointmentId === row.id && event.toStatus === "waiting").length, 1);
    assert.equal(audits.filter(event => event.entityId === row.id).length, 1);
  }
}

test("same-request booking retries return one ticket even at capacity", async () => {
  await capacity(1);
  const op = booking("p1", "same-request", h.staff);
  const results = winner(await h.race([op, op]), 2).map(result => result.value);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].token, "A-01");
  assert.equal(results[0].reference, results[1].reference);
  const retry = await h.book("p1", h.tomorrow, { requestId: "same-request" });
  assert.equal(retry.id, results[0].id);
  assert.equal(retry.token, results[0].token);
  assert.equal(retry.reference, results[0].reference);
  await assert.rejects(h.book("p2", h.tomorrow, { requestId: "same-request" }),
    { status: 409, message: "Idempotency key already used for another booking" });
  await assertBookingEffects(1);
  await capacity(2);
  assert.equal((await h.book("p2", h.tomorrow)).token, "A-02", "retries consume no extra token");
});

test("independent PostgreSQL contenders preserve separate same-day session capacity and tokens", async () => {
  const weekday = new Date(h.tomorrow).getUTCDay(), id = "d" + weekday;
  const original = await h.api.one(h.t.schedules,id);
  await h.api.change(h.t.schedules,id,{data:{...original,startTime:"09:00",endTime:"10:00",maxTokens:1}});
  await h.api.put(h.t.schedules,{id:"second",doctorId:"d",clinicId:"c",branchId:"b",dayOfWeek:weekday,data:{...original,startTime:"14:00",endTime:"15:00",maxTokens:1}});
  const op = (patientId,sessionId) => (tx,actor) => h.book(patientId,h.tomorrow,{sessionId},{tx,actor});
  const outcomes = await h.race([op("p1",id),op("p2","second"),op("p3",id),op("p4","second")]);
  const accepted = winner(outcomes,2).map(r=>r.value);
  assert.deepEqual(accepted.map(a=>a.startTime).sort(),["09:00","14:00"]);
  assert.deepEqual(accepted.map(a=>a.tokenNumber),[1,1]);
  assert.equal((await h.rows()).length,2);
});

test("competing clinic slug provisioning rolls back the losing admin and all its setup", async () => {
  const op = async (tx, actor) => {
    const admin = await h.api.put(h.t.users,{id:"new-"+actor.id,email:actor.id+"@example.com",fullName:"New Admin",role:"clinicAdmin"},tx);
    return h.api.createOwnedClinic(admin,admin,{clinic:{name:actor.id,address:"Road",slug:"shared-clinic"},branches:[{name:"Main",address:"Road",slug:"main-branch"}]},tx);
  };
  const results = winner(await h.race([op,op],{doctorIds:[],lockKeys:["slug:clinics::shared-clinic"]}));
  assert.equal(results.length,1);
  assert.equal((await h.api.all(h.t.clinics)).filter(c=>c.slug==="shared-clinic").length,1);
  assert.equal((await h.api.all(h.t.users)).filter(u=>u.id.startsWith("new-")).length,1);
  assert.equal((await h.api.all(h.t.branches)).filter(b=>b.slug==="main-branch").length,1);
  assert.equal((await h.api.all(h.t.qrs)).length,1);
});

test("different requests for the same patient create one active booking and a clear conflict", async () => {
  const outcomes = await h.race([booking("p1", "duplicate-a"), booking("p1", "duplicate-b")]);
  const [success] = winner(outcomes);
  assert.equal(outcomes.find(result => result.status === "rejected").reason.message,
    "Patient already has an active booking for this session");
  assert.equal(success.value.token, "A-01");
  await assertBookingEffects(1);
  assert.equal((await h.book("p2", h.tomorrow)).token, "A-02", "duplicate rejection consumes no token");
  await assertBookingEffects(2);
});

test("competing patients for the last slot cannot exceed capacity or consume losing tokens", async () => {
  await capacity(2);
  const first = await h.book("p1", h.tomorrow);
  const outcomes = await h.race([booking("p2", "last-a"), booking("p3", "last-b")]);
  const [success] = winner(outcomes);
  assert.equal(outcomes.find(result => result.status === "rejected").reason.message, "Session capacity reached");
  assert.equal(first.token, "A-01");
  assert.equal(success.value.token, "A-02");
  assert.equal((await h.rows()).filter(row => row.status !== "cancelled").length, 2);
  await assertBookingEffects(2);
  await capacity(3);
  assert.equal((await h.book("p4", h.tomorrow)).token, "A-03", "capacity rejection consumes no token");
  await assertBookingEffects(3);
});

test("cancellation racing a full session booking frees capacity without reusing its ticket", async () => {
  // Either serialization order is valid; launch order is not proof of lock order.
  for (const reverse of [false, true]) {
    await h.seed();
    await capacity(1);
    const original = await h.book("p1", h.tomorrow, { requestId: "original" });
    const cancel = (tx, actor) => h.route(h.api.appointmentsRouter, "post", "/appointments/:id/actions",
      actor, { action: "cancel", expectedRevision: 0 }, { id: original.id }, {}, tx);
    const ops = [cancel, booking("p2", "replacement", h.staff)];
    const outcomes = await h.race(reverse ? ops.reverse() : ops);
    const cancelled = outcomes[reverse ? 1 : 0], booked = outcomes[reverse ? 0 : 1];
    assert.equal(cancelled.status, "fulfilled");
    winner(outcomes, booked.status === "fulfilled" ? 2 : 1);
    if (booked.status === "rejected") assert.equal(booked.reason.message, "Session capacity reached");
    await assertBookingEffects(booked.status === "fulfilled" ? 2 : 1);
    const retained = await h.api.one(h.t.appointments, original.id);
    assert.equal(retained.status, "cancelled");
    assert.equal(retained.token, original.token);
    assert.equal(retained.reference, original.reference);
    assert.equal(retained.revision, 1);
    await oneEvent(original.id, "cancel");
    const replacement = await h.book("p2", h.tomorrow, { requestId: "replacement" });
    assert.equal(replacement.token, "A-02");
    if (booked.status === "fulfilled") assert.equal(replacement.id, booked.value.id);
    const retry = await h.book("p2", h.tomorrow, { requestId: "replacement" });
    assert.equal(retry.id, replacement.id);
    assert.equal(retry.reference, replacement.reference);
    const originalRetry = await h.book("p1", h.tomorrow, { requestId: "original" });
    assert.equal(originalRetry.id, original.id);
    assert.equal(originalRetry.status, "cancelled", "retry cannot resurrect a cancelled reservation");
    assert.equal((await h.rows()).filter(row => row.status !== "cancelled").length, 1);
    await assert.rejects(h.book("p3", h.tomorrow), { status: 409, message: "Session capacity reached" });
    await assertBookingEffects(2);
  }
});

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