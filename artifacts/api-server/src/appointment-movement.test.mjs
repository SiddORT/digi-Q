import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
process.env.SESSION_SECRET = "isolated-movement-signing-key-not-for-production";
let h;
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { mock.timers.setTime(Date.UTC(2030, 0, 7, 12)); await h.seed(); });
after(async () => { try { if (h) await h.close(); } finally { mock.timers.reset(); } });
const review = (a, actor = h.staff) => h.route(h.api.appointmentsRouter, "get", "/appointments/:id/movement", actor, {}, { id: a.id });
const move = (a, data, actor = h.staff) => h.route(h.api.appointmentsRouter, "post", "/appointments/:id/reschedule", actor, data, { id: a.id });
const dest = (date = h.tomorrow) => ({ doctorId: "d2", branchId: "b2", date, expectedRevision: 0, reason: "Choose another session" });
const shift = (r, position = r.currentPosition + 1) => ({ action: "shift", expectedRevision: r.appointment.revision,
  expectedQueueVersion: r.queueVersion, position, reason: "Arriving later" });
const rejects = (operation, pattern = /changed|started|ended|called|scope|later|position|closed|cutoff/i) =>
  assert.rejects(operation, e => [400, 403, 404, 409].includes(e.status) && pattern.test(e.message));
const doctor = () => ({ id: "du", role: "doctor", doctorId: "d", clinicIds: ["c"], branchIds: ["b"] });
async function guest(secret = "a".repeat(64)) {
  await h.api.put(h.t.qrs, { id: "guest-qr-row", clinicId: "c", branchId: "b", publicReference: "guest-qr" });
  const receipt = await h.api.createGuestRequest({ qrReference: "guest-qr", fullName: "Private Guest",
    branchId: "b", doctorId: "d", date: h.today, requestId: "12345678-1234-4234-8234-123456789012", receiptSecret: secret });
  return { receipt, secret };
}
const manage = data => h.route(h.api.guestRequestsRouter, "post", "/public/guest-receipt/manage", null, data);

test("one place later preserves identifiers, session and status and records exact order without notifying", async () => {
  const a = await h.book(), b = await h.book("p2"), c = await h.book("p3");
  const r = await review(a, h.patient);
  assert.deepEqual(r.positions, [2, 3]);
  const saved = await h.act(a.id, shift(r, 2), h.patient);
  for (const key of ["id", "reference", "token", "tokenNumber", "date", "sessionId", "status", "startTime"]) assert.equal(saved[key], a[key], key);
  assert.deepEqual(h.api.orderedReservations(await h.rows()).map(a => a.id), [b.id, a.id, c.id]);
  const event = (await h.api.one(h.t.appointments, a.id)).history.at(-1);
  assert.deepEqual(event.beforeOrder, [a.id, b.id, c.id]);
  assert.deepEqual(event.afterOrder, [b.id, a.id, c.id]);
  assert.equal(saved.history.at(-1).beforeOrder, undefined, "patient history cannot disclose other booking IDs");
  assert.equal((await h.api.all(h.t.auditLogs)).filter(e => e.action === "reschedule").length, 0);
});

test("last position is explained and moving forward or to the same place is rejected", async () => {
  const a = await h.book(), b = await h.book("p2");
  const last = await review(b);
  assert.deepEqual(last.positions, []);
  assert.match(last.appointment.movementReason, /last/);
  assert.equal(last.appointment.canReschedule, true);
  assert.ok(!last.appointment.allowedActions.includes("shift"));
  await rejects(h.act(b.id, shift(last, 1)));
  await rejects(h.act(a.id, shift(await review(a), 1)));
});

test("future shifts are allowed but future absence/re-entry cannot revive care", async () => {
  const a = await h.book("p1", h.tomorrow); await h.book("p2", h.tomorrow);
  const saved = await h.act(a.id, shift(await review(a), 2), h.patient);
  assert.equal(saved.date, h.tomorrow);
  await rejects(h.act(a.id, {action: "noShow", reason: "Away"}), /date|active/);
});

test("stale queue changes and replay cannot duplicate a position move", async () => {
  const a = await h.book(), b = await h.book("p2"); await h.book("p3");
  const r = await review(a);
  await h.act(b.id, {action: "noShow", reason: "Away"});
  await rejects(h.act(a.id, shift(r)));
  const fresh = await review(a); await h.act(a.id, shift(fresh));
  await rejects(h.act(a.id, shift(fresh)));
  assert.equal((await h.api.one(h.t.appointments, a.id)).history.filter(e=>e.action==="shift").length, 1);
});

test("called patients are denied; staff must explicitly release without false absence", async () => {
  const a = await h.book(); await h.book("p2"); await h.book("p3");
  await h.act(a.id, {action: "call"});
  const r = await review(a);
  await rejects(h.act(a.id, shift(r, 2), h.patient), /called/);
  await rejects(h.act(a.id, shift(r, 2)), /Confirm/);
  const moved = await h.act(a.id, {...shift(r, 2), releaseCallConfirmed: true});
  assert.equal(moved.status, "waiting"); assert.equal(moved.calledAt, null);
  assert.equal(moved.history.some(e => e.action === "noShow"), false);
  assert.equal(moved.history.at(-1).callReleased, true);
});

test("reschedule before and during original session ignores cancellation cutoff, cancellation does not", async () => {
  await h.api.change(h.t.settings, "platform", { data: {notificationsEnabled: false, cancellationCutoffMinutes: 180, bookingHorizonDays:60} });
  for (const date of [h.today, h.tomorrow]) {
    const a = await h.book("p1", date);
    if (date === h.today) await rejects(h.act(a.id, {action: "cancel", reason:"Later"}), /cutoff/);
    const moved = await move(a, dest(date), h.staff);
    assert.equal(moved.reference, a.reference); assert.match(moved.token, /^B-/);
    assert.equal(moved.doctorId, "d2"); assert.equal(moved.status, "waiting");
    assert.equal((await h.rows()).filter(r => r.id === a.id).length, 1);
  }
});

test("exact start and end boundaries use the care session rather than a cancellation deadline", async () => {
  const schedule = await h.api.one(h.t.schedules, "d"+new Date(h.today+"T12:00:00Z").getUTCDay());
  await h.api.change(h.t.schedules,schedule.id,{data:{...schedule,startTime:"13:00",endTime:"15:00"}});
  const a=await h.book(); await h.book("p2"); const c=await h.book("p3");
  assert.equal((await review(a)).appointment.canReschedule,true,"before start");
  mock.timers.setTime(Date.UTC(2030,0,7,13));
  await h.act(a.id,shift(await review(a),2));
  mock.timers.setTime(Date.UTC(2030,0,7,14,59));
  assert.equal((await review(c)).appointment.canReschedule,true,"during session");
  mock.timers.setTime(Date.UTC(2030,0,7,15));
  await rejects(move(c,{...dest(),expectedRevision:(await h.api.one(h.t.appointments,c.id)).revision}),/ended/);
});

test("an already running destination uses ordinary capacity and appends without immediate-next priority", async () => {
  const a=await h.book();
  const first=await h.book("p2",h.today,{doctorId:"d2",branchId:"b2"});
  const next=await h.book("p3",h.today,{doctorId:"d2",branchId:"b2"});
  await h.act(first.id,{action:"call"});
  const moved=await move(a,dest(h.today));
  assert.equal(moved.token,"B-03");
  const destinationRows=(await h.rows()).filter(r=>r.doctorId==="d2");
  assert.equal(h.api.queueSummary(destinationRows,moved).nextToken,next.token);
  assert.equal(h.api.queueSummary(destinationRows,moved).ownEntry.patientsAhead,2);
});

test("same session directs to Shift Time; called reschedule requires staff release", async () => {
  const a = await h.book();
  await rejects(move(a, {doctorId:"d",branchId:"b",date:h.today,expectedRevision:0}), /Shift Time/);
  await h.act(a.id, {action:"call"});
  await rejects(move(a, {...dest(), expectedRevision:1}, h.patient), /called/);
  await rejects(move(a, {...dest(), expectedRevision:1}), /Confirm/);
  const moved = await move(a, {...dest(), expectedRevision:1, releaseCallConfirmed:true});
  assert.equal(moved.calledAt, null); assert.equal(moved.history.at(-1).callReleased, true);
});

test("consultation state, terminal states and ended sessions lock movement", async () => {
  const a = await h.book();
  await h.act(a.id,{action:"checkIn"});
  await rejects(move(a, {...dest(),expectedRevision:1}), /started/);
  await rejects(h.act(a.id, shift(await review(a), 2)));
  const b = await h.book("p2");
  mock.timers.setTime(Date.UTC(2030,0,7,23,59));
  await rejects(move(b,dest()), /ended/);
  await rejects(h.act(b.id, {action:"noShow",reason:"Away"}), /ended/);
  const r = await review(b); assert.equal(r.appointment.canReschedule, false);
  assert.match(r.appointment.movementReason, /ended/);
});

test("explicitly closed source session does not silently revive care", async () => {
  const a = await h.book();
  await h.api.put(h.t.availabilityExceptions,{id:"closed",doctorId:"d",branchId:"b",date:h.today,data:{isClosed:true,reason:"Closed for emergency"}});
  await rejects(move(a,dest()), /Closed/);
  await rejects(h.act(a.id, {...shift(await review(a)), position:2}), /Closed/);
});

test("assigned doctors mark absent and re-enter with reviewed position, same token and no old priority", async () => {
  const a=await h.book(); const b=await h.book("p2");
  const absent=await h.act(a.id,{action:"noShow",reason:"Patient unavailable"},doctor());
  assert.ok(absent.allowedActions.includes("requeue"));
  const r=await review(a,doctor());
  const restored=await h.act(a.id,{action:"requeue",reason:"Returned",expectedRevision:r.appointment.revision,expectedQueueVersion:r.queueVersion,position:2},doctor());
  assert.equal(restored.token,a.token); assert.equal(restored.reference,a.reference);
  assert.deepEqual(h.api.orderedReservations((await h.rows()).filter(a=>h.api.pendingStatuses.includes(a.status))).map(a=>a.id),[b.id,a.id]);
  await rejects(h.act(a.id,{action:"noShow",reason:"Away"},h.patient), /own pending/);
});

test("cancelled patients cannot re-enter and old absent sessions cannot re-enter", async () => {
  const a=await h.book("p1",h.tomorrow);
  await h.act(a.id,{action:"cancel",reason:"Cannot attend"});
  await rejects(h.act(a.id,{action:"requeue",reason:"Back",position:1}), /Cancelled/);
  const b=await h.book("p2"); await h.act(b.id,{action:"noShow",reason:"Away"});
  mock.timers.setTime(Date.UTC(2030,0,8,12));
  await rejects(h.act(b.id,{action:"requeue",reason:"Back",position:1}), /date|ended/);
});

test("doctor and receptionist source and destination scopes stay restricted", async () => {
  const a=await h.book();
  await rejects(move(a,dest(),doctor()), /scope/);
  const outside={...h.staff,branchIds:["b2"]};
  await rejects(review(a,outside), /scope/);
  await rejects(h.act(a.id,{action:"noShow",reason:"Away"},outside), /scope/);
  const otherPatient={...h.patient,patientId:"p2"};
  await rejects(review(a,otherPatient), /scope/);
});

test("full, walk-in-only, horizon and duplicate destinations preserve original booking", async () => {
  const a=await h.book();
  const day=new Date(h.tomorrow+"T12:00:00Z").getUTCDay(), schedule=await h.api.one(h.t.schedules,"d2"+day);
  await h.api.change(h.t.schedules,schedule.id,{data:{...schedule,maxTokens:1}});
  await h.book("p2",h.tomorrow,{doctorId:"d2",branchId:"b2"});
  await rejects(move(a,dest()), /capacity/);
  await h.api.change(h.t.schedules,schedule.id,{data:{...schedule,queueMode:"walkInsOnly"}});
  await rejects(move(a,dest()), /walk-ins/);
  await h.api.change(h.t.schedules,schedule.id,{data:schedule});
  await h.book("p1",h.tomorrow,{doctorId:"d2",branchId:"b2"});
  await rejects(move(a,dest()), /already/);
  await rejects(move(a,dest("2031-01-01")), /horizon/);
  const original=await h.api.one(h.t.appointments,a.id);
  assert.equal(original.revision,0); assert.equal(original.token,a.token); assert.equal(original.date,a.date);
});

test("private receipt capability reads and shifts only its linked booking without leaking other identities", async () => {
  const {receipt,secret}=await guest(); await h.book("p2");
  const r=await manage({receiptSecret:secret});
  assert.equal(r.appointment.date,h.today,"management preserves the date-only appointment wire contract");
  assert.equal(r.appointment.id,receipt.appointmentId); assert.deepEqual(r.positions,[2]);
  const saved=await manage({receiptSecret:secret,action:shift(r,2),appointmentId:"not-authorized"});
  assert.equal(saved.appointment.token,r.appointment.token);
  const serialized=JSON.stringify(saved);
  for(const privateValue of ["Patient 2",secret,"receiptHash","actorId","beforeOrder","afterOrder"]) assert.ok(!serialized.includes(privateValue),privateValue);
  assert.equal((await h.api.one(h.t.appointments,receipt.appointmentId)).history.at(-1).actorKind,"privateReceipt");
  assert.ok((await h.api.all(h.t.auditLogs)).some(row=>row.entityId===receipt.appointmentId&&row.action==="shift"&&row.summary.startsWith("Patient via protected booking receipt:")));
  await rejects(manage({receiptSecret:secret,action:shift(r,2)}));
  await rejects(manage({receiptSecret:"b".repeat(64)}), /receipt/);
  await rejects(manage({receiptSecret:secret,action:{action:"noShow",expectedRevision:1}}), /only/);
});

test("private receipt reschedules and refreshes ticket; cancelled/revoked capabilities cannot move", async () => {
  const {receipt,secret}=await guest();
  const r=await manage({receiptSecret:secret});
  await rejects(manage({receiptSecret:secret,destination:dest("2030-02-31")}),/Invalid date/);
  const saved=await manage({receiptSecret:secret,destination:dest()});
  assert.equal(saved.appointment.reference,r.appointment.reference); assert.match(saved.appointment.token,/^B-/);
  const receiptAfter=await h.route(h.api.guestRequestsRouter,"post","/public/guest-receipt",null,{receiptSecret:secret});
  assert.equal(receiptAfter.token,saved.appointment.token);
  await manage({receiptSecret:secret,action:{action:"cancel",expectedRevision:1,reason:"Cannot attend"}});
  await rejects(manage({receiptSecret:secret,destination:{...dest(h.today),expectedRevision:2}}), /Cancelled/);
  await h.api.change(h.t.guestRequests,receipt.id,{status:"rejected"});
  await rejects(manage({receiptSecret:secret}),/receipt/);
});

test("simultaneous shifts wait on actual independent PostgreSQL connections and commit exactly once", async () => {
  const a=await h.book(); await h.book("p2"); await h.book("p3");
  const r=await review(a), body=shift(r,2);
  const outcomes=await h.race([tx=>h.api.transition(h.patient,a.id,body,tx),tx=>h.api.transition(h.patient,a.id,body,tx)]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(outcomes.find(r=>r.status==="rejected").reason.status,409);
  assert.equal((await h.api.one(h.t.appointments,a.id)).history.filter(e=>e.action==="shift").length,1);
});

test("shift versus consultation start cannot overwrite active care", async () => {
  const a=await h.book(); await h.book("p2");
  const body=shift(await review(a),2);
  const outcomes=await h.race([tx=>h.api.transition(h.patient,a.id,body,tx),tx=>h.api.transition(h.staff,a.id,{action:"checkIn",expectedRevision:0},tx)]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
  const saved=await h.api.one(h.t.appointments,a.id);
  assert.ok(saved.status==="inConsultation" || saved.queueRank===2);
  assert.equal(saved.history.filter(e=>["checkIn","shift"].includes(e.action)).length,1);
});
