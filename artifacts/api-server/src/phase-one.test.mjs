// Real isolated PostgreSQL domain tests. No app listener, Clerk session, or production DB.
import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { build } from "esbuild";
import { resolve, join } from "node:path";
import { rm } from "node:fs/promises";
import { queueFixtureSql, seedQueueFixtures } from "./test-support/queue-fixtures.mjs";

const root = import.meta.dirname, bundle = join(root, ".phase-one-test.mjs");
process.env.SESSION_SECRET = "isolated-phase-one-test-signing-key-not-for-production";
await build({
  stdin: { contents: `
    export * from "./lib/appointments";
    export * from "./lib/reschedule";
    export * from "./lib/queue-order";
    export * from "./lib/session-duration";
    export * from "./lib/store";
    export * from "./lib/clinic-expansion";
    export * from "./lib/presence";
    export { queryMetrics } from "./lib/list-query";
    export { sessionQueueWaitMinutes, availability, availabilitySessions } from "./lib/availability";
    export * from "./routes/appointments";
    export * from "./routes/queue";
    export * from "./routes/duration";
    export * from "./routes/public";
    export * from "./routes/guest-requests";
    export { readAppointmentQrPayload } from "./lib/appointment-qr";
    export * from "./routes/clinic-expansion";
    export * from "./routes/resources";
    export * as tables from "@workspace/db";
    export { GetQueueResponse } from "@workspace/api-zod";
  `, resolveDir: root },
  outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
  plugins: [{ name: "isolated-db", setup(b) {
    b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
    b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({ path: resolve(root, "../../../lib/api-zod/src/index.ts") }));
    b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({ contents: `
      export * from "${resolve(root, "../../../lib/db/src/schema/core.ts")}";
      export const db = new Proxy({}, {get:(_,key)=>{const v=globalThis.phaseDb[key]; return typeof v==="function"?v.bind(globalThis.phaseDb):v;}});
    `, resolveDir: root }));
    b.onLoad({ filter: /lib\/auth\.ts$/ }, async a => ({
      contents: (await (await import("node:fs/promises")).readFile(a.path, "utf8")).replace(/export async function requireUser\(req: Request\) \{[\s\S]*?\n\}/, "export async function requireUser(req: Request) { return globalThis.phaseActor; }"),
      loader: "ts",
    }));
  } }],
});
const database = new PGlite();
globalThis.phaseDb = drizzle(database);
const api = await import(bundle), t = api.tables;
after(async () => { await database.close(); await rm(bundle, { force: true }); });
await database.exec(queueFixtureSql);
mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const staff = { id: "r", role: "receptionist", clinicIds: ["c"], branchIds: ["b", "b2"] };
const patient = { id: "u1", role: "patient", patientId: "p1", clinicIds: [], branchIds: [] };
async function seed() { await seedQueueFixtures(api, t, database); }
async function route(router, method, path, actor, body = {}, params = {}, query = {}) {
  globalThis.phaseActor = actor;
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
  assert.ok(layer, path);
  let result;
  const response = { status: () => response, set: () => response, json: value => { result = value; } };
  await layer.route.stack.at(-1).handle({ body, params, query }, response);
  return result;
}
async function book(patientId = "p1", date = today, extra = {}) {
  return route(api.appointmentsRouter, "post", "/appointments", staff, { patientId, doctorId: "d", branchId: "b", clinicId: "c", date, source: "phone", ...extra });
}
async function act(id, body, actor = staff) {
  return globalThis.phaseDb.transaction(tx => api.transition(actor, id, body, tx));
}
async function guest(extra = {}) {
  await globalThis.phaseDb.insert(t.qrs).values({ id: "guestqr", clinicId: "c", branchId: "b", publicReference: "guest-qr" }).onConflictDoNothing();
  return api.createGuestRequest({ qrReference: "guest-qr", fullName: "Name Only", branchId: "b", doctorId: "d", date: today,
    requestId: "12345678-1234-4234-8234-123456789012", receiptSecret: "a".repeat(64), ...extra });
}
test("anonymous guest immediately reserves a waiting token without contact; replay preserves private ticket", async () => {
  await seed();
  const row = await guest();
  assert.equal(row.status, "confirmed");
  assert.equal((await api.all(t.appointments)).length, 1);
  assert.equal(row.mobile, null);
  assert.equal(row.receiptHash, api.guestHash("a".repeat(64)));
  assert.equal(JSON.stringify(row).includes("a".repeat(64)), false);
  const ticket = await route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "a".repeat(64) });
  assert.equal(ticket.appointmentId, row.appointmentId);
  assert.equal(ticket.appointmentStatus, "waiting");
  assert.equal(ticket.revision, 0);
  assert.equal(ticket.token, row.token);
  assert.ok(ticket.reference && ticket.checkInUrl.startsWith("/check-in?payload=v1."));
  assert.equal(api.readAppointmentQrPayload(new URL(ticket.checkInUrl, "http://localhost").searchParams.get("payload")), ticket.reference);
  assert.deepEqual(await route(api.guestRequestsRouter, "post", "/public/guest-requests", null, {
    qrReference: "guest-qr", fullName: "Name Only", branchId: "b", doctorId: "d", date: today,
    requestId: "12345678-1234-4234-8234-123456789012", receiptSecret: "a".repeat(64),
  }), ticket);
  await assert.rejects(() => route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "b".repeat(64) }), /Receipt not found/);
  await assert.rejects(() => guest({ fullName: "Changed" }), /Idempotency/);
  await assert.rejects(() => guest({ receiptSecret: "c".repeat(64) }), /Idempotency/);
  await assert.rejects(() => guest({ requestId: "12345678-1234-4234-8234-123456789099" }), /Receipt secret already belongs/);
  await assert.rejects(() => api.decideGuestRequest(staff, row.id, { action: "reject", reason: "Changed" }), /already decided/);
  const appointments = await api.all(t.appointments);
  assert.equal(appointments.length, 1);
  assert.equal(appointments[0].status, "waiting");
  assert.equal(appointments[0].bookingOrigin, "anonymousGuest");
  const p = await api.one(t.patients, appointments[0].patientId);
  assert.equal(p.userId, null); assert.equal(p.mobile, null); assert.equal(p.fullName, "Name Only");
  const receipt = api.guestReceipt(row);
  assert.ok(receipt.token);
  for (const key of ["receiptHash", "inputHash", "email", "mobile", "history"]) assert.equal(key in receipt, false);
  await api.change(t.appointments, row.appointmentId, { status: "called", data: { ...appointments[0], revision: 1 } });
  const fresh = await route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "a".repeat(64) });
  assert.equal(fresh.appointmentStatus, "called"); assert.equal(fresh.revision, 1);
});
test("guest last-slot failure rolls back patient and receipt; legacy pending decisions survive", async () => {
  await seed();
  await database.exec("update schedules set data=data || '{\"maxTokens\":1}'::jsonb");
  await book();
  const count = (await api.all(t.patients)).length;
  await assert.rejects(() => guest(), /capacity/);
  assert.equal((await api.all(t.patients)).length, count);
  assert.equal((await api.all(t.guestRequests)).length, 0);
  const row = await api.put(t.guestRequests, { id: "legacy", requestId: "legacy", receiptHash: api.guestHash("f".repeat(64)), inputHash: "old", clinicId: "c", branchId: "b", doctorId: "d", date: today,
    data: { fullName: "Legacy", sessionId: "d1", startTime: "09:00", qrReference: "guest-qr" } });
  const rejected = await api.decideGuestRequest(staff, row.id, { action: "reject", reason: "No remaining capacity" });
  assert.equal(rejected.token, null); assert.equal(rejected.status, "rejected");
  assert.equal((await api.decideGuestRequest(staff, row.id, { action: "reject", reason: "Retry" })).id, row.id);
  await assert.rejects(() => api.decideGuestRequest(staff, row.id, { action: "confirm", reason: "Retry" }), /already decided/);
});
test("guest QR scope and revocation are enforced at request", async () => {
  await seed();
  await assert.rejects(() => guest({ branchId: "b2", doctorId: "d2" }), /QR context/);
  await api.change(t.qrs, "guestqr", { status: "inactive" });
  await assert.rejects(() => guest(), /revoked/);
  assert.equal((await api.all(t.guestRequests)).length, 0);
});
test("guest optional contact is persisted without claiming verified mobile; invalid clinic and session cannot book", async () => {
  await seed();
  const booked = await guest({ email: "visitor@example.invalid", mobile: "+15555550123", date: tomorrow });
  const appointment = await api.one(t.appointments, booked.appointmentId);
  const p = await api.one(t.patients, appointment.patientId);
  assert.equal(p.mobile, "+15555550123"); assert.equal(p.email, "visitor@example.invalid");
  assert.equal(p.mobileVerified, false);
  await assert.rejects(() => guest({ requestId: "22345678-1234-4234-8234-123456789012", receiptSecret: "b".repeat(64), sessionId: "d2" }), /Session not found/);
  await api.change(t.branches, "b2", { clinicId: "other" });
  await assert.rejects(() => guest({ requestId: "32345678-1234-4234-8234-123456789012", receiptSecret: "c".repeat(64), branchId: "b2", doctorId: "d2" }), /QR context/);
});
test("private receipt and authenticated appointment reflect a rescheduled ticket and legacy address fallback", async () => {
  await seed();
  await api.change(t.branches, "b", { data: { name: "b", timezone: "UTC", address: "Original address" } });
  await api.change(t.branches, "b2", { data: { name: "b2", timezone: "UTC", address: "Destination address" } });
  const booked = await guest({ date: tomorrow });
  const original = await api.one(t.appointments, booked.appointmentId);
  assert.equal(original.branchAddress, "Original address");
  const old = await route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "a".repeat(64) });
  const moved = await globalThis.phaseDb.transaction(tx => api.reschedule(staff, booked.appointmentId,
    { branchId: "b2", doctorId: "d2", date: tomorrow, expectedRevision: 0 }, tx));
  const receipt = await route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "a".repeat(64) });
  for (const key of ["date", "sessionId", "startTime", "endTime", "timezone", "token", "doctorName", "branchName", "branchAddress"])
    assert.equal(receipt[key], moved[key], `${key} follows appointment, not original request`);
  assert.equal(receipt.appointmentStatus, "waiting");
  assert.equal(receipt.revision, 1);
  assert.equal(receipt.reference, old.reference);
  assert.equal(receipt.checkInUrl, old.checkInUrl);
  // Older persisted appointments have no address snapshot: detail and private
  // receipt resolve the current destination branch without exposing other data.
  await api.change(t.appointments, booked.appointmentId, { data: { ...moved, branchAddress: null } });
  const historicalRequest = await api.one(t.guestRequests, booked.id);
  await api.change(t.guestRequests, booked.id, { data: {
    fullName: historicalRequest.fullName, clinicName: historicalRequest.clinicName, branchName: historicalRequest.branchName,
    doctorName: historicalRequest.doctorName, sessionId: historicalRequest.sessionId, startTime: historicalRequest.startTime,
    endTime: historicalRequest.endTime, timezone: historicalRequest.timezone, token: old.token,
  } });
  assert.equal((await route(api.appointmentsRouter, "get", "/appointments/:id", staff, {}, { id: booked.appointmentId })).branchAddress, "Destination address");
  const historicalReceipt = await route(api.guestRequestsRouter, "post", "/public/guest-receipt", null, { receiptSecret: "a".repeat(64) });
  assert.equal(historicalReceipt.branchAddress, "Destination address");
  assert.equal(historicalReceipt.token, moved.token);
});
test("guest staff list SQL restricts clinic and branch before pagination", async () => {
  await seed();
  await guest();
  const list = await route(api.guestRequestsRouter, "get", "/guest-requests", staff, {}, {}, { status: "confirmed" });
  assert.equal(list.total, 1); assert.equal(list.items[0].mobile, null);
  assert.equal("receiptHash" in list.items[0], false);
  const outside = await route(api.guestRequestsRouter, "get", "/guest-requests", { ...staff, branchIds: ["b2"] }, {}, {}, { status: "confirmed" });
  assert.equal(outside.total, 0);
  await guest({ date: tomorrow, requestId: "22345678-1234-4234-8234-123456789012", receiptSecret: "b".repeat(64) });
  const dated = await route(api.guestRequestsRouter, "get", "/guest-requests", staff, {}, {}, { status: "confirmed", doctorId: "d", date: tomorrow, pageSize: "1" });
  assert.equal(dated.total, 1); assert.equal(dated.items.length, 1); assert.equal(dated.items[0].date, tomorrow);
  const otherDoctor = await route(api.guestRequestsRouter, "get", "/guest-requests", staff, {}, {}, { status: "confirmed", doctorId: "d2", pageSize: "1" });
  assert.equal(otherDoctor.total, 0);
  await assert.rejects(() => route(api.guestRequestsRouter, "get", "/guest-requests", staff, {}, {}, { date: "2030-02-30" }), /Invalid date/);
  await assert.rejects(() => route(api.guestRequestsRouter, "get", "/guest-requests", patient), /Reception/);
});
async function rows() { return api.all(t.appointments); }
async function queue(actor = patient, extra = {}) {
  return route(api.queueRouter, "get", "/queue", actor, {}, {}, { doctorId: "d", branchId: "b", date: today, ...extra });
}

test("real SQL immediate waiting preserves reservation order and explicit skip", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  assert.equal(a.status, "waiting");
  await assert.rejects(act(b.id, { action: "checkIn" }), /Earlier reservation/);
  let q = await queue({ ...patient, patientId: "p2" });
  assert.equal(q.ownEntry.patientsAhead, 1);
  assert.equal(q.ownEntry.estimatedWaitMinutes, 10, "no five-minute buffer");
  assert.equal(q.reserved, 2); assert.equal(q.arrived, 2); assert.equal(q.entries, undefined);
  assert.equal(q.blockedByAbsentReservation, false);
  await assert.rejects(act(b.id, { action: "call" }), /Earlier reservation/);
  await assert.rejects(act(a.id, { action: "noShow" }), /reason/);
  await act(a.id, { action: "noShow", reason: "Not present at reception" });
  await act(b.id, { action: "call" });
  q = await queue();
  assert.equal(q.currentToken, b.token);
});
test("re-entry requires reception, reason, fresh queue version, position; retains token and audits", async () => {
  await seed();
  const a = await book(), b = await book("p2"), c = await book("p3");
  const absent = await act(a.id, { action: "noShow", reason: "Stepped outside" });
  const version = api.queueVersion(await rows());
  const body = { action: "requeue", reason: "Returned; agreed after next reservation", position: 2, expectedRevision: absent.revision, expectedQueueVersion: version };
  await assert.rejects(act(a.id, body, { ...staff, role: "doctor", doctorId: "d" }), /Permission/);
  await assert.rejects(act(a.id, { ...body, reason: " " }), /reason/);
  await api.change(t.appointments, c.id, { data: { ...c, revision: 1 } });
  await assert.rejects(act(a.id, body), /Queue changed/);
  const returned = await act(a.id, { ...body, expectedQueueVersion: api.queueVersion(await rows()) });
  assert.equal(returned.token, a.token);
  assert.deepEqual(api.orderedReservations(await rows()).map(r => r.id), [b.id, a.id, c.id]);
  assert.equal(returned.history.at(-1).reason, body.reason);
  assert.ok((await api.all(t.auditLogs)).some(a => a.action === "requeue"));
});
test("atomic reschedule retains reference/history, changes destination token, rejects stale/check-in/cutoff/cross-tenant", async () => {
  await seed();
  const original = await book("p1", tomorrow);
  const destination = { doctorId: "d2", branchId: "b2", date: tomorrow, expectedRevision: 0 };
  const moved = await globalThis.phaseDb.transaction(tx => api.reschedule(patient, original.id, destination, tx));
  assert.equal(moved.id, original.id); assert.equal(moved.reference, original.reference); assert.equal(moved.token, "B-01");
  assert.equal(moved.history.at(-1).from.token, "A-01");
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule(patient, original.id, { doctorId: "d", branchId: "b", date: tomorrow, expectedRevision: 0 }, tx)), /changed/);
  const another = await book("p2", tomorrow);
  assert.equal(another.token, "A-02", "rescheduled source token never reissued");
  await api.change(t.branches, "b2", { clinicId: "other" });
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule({ ...patient, patientId: "p2" }, another.id, destination, tx)), /same clinic/);
  assert.equal((await api.one(t.appointments, another.id)).token, another.token);
});
test("full destination and failing audit roll back every reschedule write", async () => {
  await seed();
  const original = await book("p1", tomorrow), weekday = new Date(tomorrow).getUTCDay();
  const schedule = await api.one(t.schedules, "d2" + weekday);
  await api.change(t.schedules, schedule.id, { data: { ...schedule, maxTokens: 0 } });
  const body = { doctorId: "d2", branchId: "b2", date: tomorrow, expectedRevision: 0 };
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule(patient, original.id, body, tx)), /capacity/);
  assert.equal((await api.one(t.appointments, original.id)).token, "A-01");
  await api.change(t.schedules, schedule.id, { data: { ...schedule, maxTokens: 10 } });
  await database.exec("alter table audit_logs add constraint reject_reschedule check(action <> 'reschedule')");
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule(patient, original.id, body, tx)));
  assert.equal((await api.one(t.appointments, original.id)).token, "A-01");
  assert.equal((await api.one(t.appointments, original.id)).revision, 0);
  await database.exec("alter table audit_logs drop constraint reject_reschedule");
});
test("duration changes update booked future sessions but preserve running/past and other clinics until explicit confirmation", async () => {
  await seed(); const a = await book();
  const future = await book("p2", tomorrow);
  assert.equal(future.expectedDurationMinutes, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await api.put(t.appointments, { id: "past-duration", patientId: "p3", doctorId: "d", clinicId: "c", branchId: "b", date: yesterday, tokenNumber: 1, actorId: staff.id, data: { expectedDurationMinutes: 10, startTime: "00:00", timezone: "UTC" } });
  await api.put(t.appointments, { id: "other-clinic-duration", patientId: "p3", doctorId: "d", clinicId: "other", branchId: "foreign", date: tomorrow, tokenNumber: 1, actorId: staff.id, data: { expectedDurationMinutes: 10, startTime: "00:00", timezone: "UTC" } });
  const params = { id: "d", clinicId: "c" };
  const update = body => route(api.durationRouter, "patch", "/doctors/:id/duration/:clinicId", staff, { clinicId: "c", ...body }, params);
  await update({ expectedDurationMinutes: 30, effect: "futureOnly" });
  assert.equal((await queue()).expectedDurationMinutes, 10);
  assert.equal((await api.one(t.appointments, future.id)).expectedDurationMinutes, 30);
  assert.equal((await api.one(t.appointments, "past-duration")).expectedDurationMinutes, 10);
  assert.equal((await api.one(t.appointments, "other-clinic-duration")).expectedDurationMinutes, 10);
  await assert.rejects(update({ expectedDurationMinutes: 60, effect: "runningSession", branchId: "b", date: today }), /Confirm/);
  const q = await queue();
  await update({ expectedDurationMinutes: 60, effect: "runningSession", branchId: "b", date: today, confirmRunningSession: true, expectedQueueVersion: q.queueVersion });
  assert.equal((await queue()).expectedDurationMinutes, 60);
  assert.equal((await api.one(t.appointments, future.id)).expectedDurationMinutes, 60);
  assert.equal((await api.one(t.appointments, "past-duration")).expectedDurationMinutes, 10);
  assert.equal((await api.one(t.appointments, "other-clinic-duration")).expectedDurationMinutes, 10);
  assert.equal((await api.one(t.appointments, a.id)).revision, 1);
});
test("scoped staff ticket selection supplies ahead and ETA without broadening patient access", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  const selected = await queue(staff, { appointmentId: b.id });
  assert.equal(selected.ownEntry.appointmentId, b.id);
  assert.equal(selected.ownEntry.patientsAhead, 1);
  assert.equal(selected.ownEntry.estimatedWaitMinutes, 10);
  assert.equal((await queue(staff)).ownEntry, null);
  await assert.rejects(queue(patient, { appointmentId: b.id }), /do not have/);
  await assert.rejects(queue({ ...staff, branchIds: ["foreign"] }, { appointmentId: a.id }), /outside assigned scope/);
  const own = await queue(patient, { appointmentId: a.id });
  assert.equal(own.ownEntry.appointmentId, a.id);
  assert.equal(own.entries, undefined);
});
test("concurrent calls/start/completion have one winner; concurrent duplicate/capacity bookings are safe", async () => {
  await seed();
  const a = await book();
  let outcomes = await Promise.allSettled([act(a.id, { action: "call" }), act(a.id, { action: "call" })]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  outcomes = await Promise.allSettled([act(a.id, { action: "start" }), act(a.id, { action: "start" })]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  outcomes = await Promise.allSettled([act(a.id, { action: "complete" }), act(a.id, { action: "complete" })]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  outcomes = await Promise.allSettled([book("p2", tomorrow), book("p2", tomorrow)]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const s = await api.one(t.schedules, "d" + new Date(tomorrow).getUTCDay());
  await api.change(t.schedules, s.id, { data: { ...s, maxTokens: 2 } });
  outcomes = await Promise.allSettled([book("p3", tomorrow), book("p4", tomorrow)]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
});
test("patient/staff tenant privacy and duration restrictions", async () => {
  await seed(); const a = await book();
  await assert.rejects(queue({ ...patient, patientId: "stranger" }), /do not have/);
  await assert.rejects(act(a.id, { action: "checkIn" }, patient), /only cancel/);
  await assert.rejects(act(a.id, { action: "noShow", reason: "Absent" }, { ...staff, clinicIds: ["elsewhere"] }), /outside/);
  await assert.rejects(route(api.durationRouter, "patch", "/doctors/:id/duration/:clinicId", patient, { clinicId: "c", expectedDurationMinutes: 20, effect: "futureOnly" }, { id: "d", clinicId: "c" }), /Permission/);
  await assert.rejects(route(api.durationRouter, "patch", "/doctors/:id/duration/:clinicId", staff, { clinicId: "c", expectedDurationMinutes: 10, effect: "futureOnly" }, { id: "d", clinicId: "c" }));
});
test("cutoff and prior check-in forbid rescheduling without changing original", async () => {
  await seed();
  const a = await book(), body = { doctorId: "d2", branchId: "b2", date: tomorrow, expectedRevision: 0 };
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule(patient, a.id, body, tx)), /cutoff/);
  await act(a.id, { action: "checkIn" });
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.reschedule(patient, a.id, { ...body, expectedRevision: 1 }, tx)), /before check-in/);
  assert.equal((await api.one(t.appointments, a.id)).token, "A-01");
});
test("concurrent reschedule versus check-in has exactly one success, with coherent final session", async () => {
  await seed();
  const s = await api.one(t.schedules, "d" + new Date(today).getUTCDay());
  await api.change(t.schedules, s.id, { data: { ...s, startTime: "13:00" } });
  const a = await book();
  const outcomes = await Promise.allSettled([
    globalThis.phaseDb.transaction(tx => api.reschedule(patient, a.id, { doctorId: "d2", branchId: "b2", date: tomorrow, expectedRevision: 0 }, tx)),
    act(a.id, { action: "checkIn", expectedRevision: 0 }),
  ]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const final = await api.one(t.appointments, a.id);
  assert.ok(final.status === "waiting" && final.date === tomorrow || final.status === "inConsultation" && final.date === today);
});
test("patient cancellation frees capacity and retains ticket/reference/history; booking retry retains token", async () => {
  await seed();
  const a = await book("p1", tomorrow, { requestId: "phase-one-idempotency" });
  const retry = await book("p1", tomorrow, { requestId: "phase-one-idempotency" });
  assert.equal(retry.id, a.id); assert.equal(retry.token, a.token);
  const s = await api.one(t.schedules, "d" + new Date(tomorrow).getUTCDay());
  await api.change(t.schedules, s.id, { data: { ...s, maxTokens: 1 } });
  await assert.rejects(book("p2", tomorrow), /capacity/);
  const cancelled = await act(a.id, { action: "cancel", expectedRevision: 0 }, patient);
  assert.equal(cancelled.reference, a.reference); assert.equal(cancelled.token, a.token);
  assert.equal(cancelled.history.at(-1).status, "cancelled");
  const b = await book("p2", tomorrow);
  assert.equal(b.token, "A-02");
});
test("simultaneous re-entry position edits reject stale queue version instead of losing ranks", async () => {
  await seed();
  const a = await book(), b = await book("p2"), c = await book("p3");
  const aa = await act(a.id, { action: "noShow", reason: "Absent" });
  const bb = await act(b.id, { action: "noShow", reason: "Absent" });
  const version = api.queueVersion(await rows());
  const outcomes = await Promise.allSettled([
    act(a.id, { action: "requeue", reason: "Return A", position: 1, expectedRevision: aa.revision, expectedQueueVersion: version }),
    act(b.id, { action: "requeue", reason: "Return B", position: 1, expectedRevision: bb.revision, expectedQueueVersion: version }),
  ]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const pending = (await rows()).filter(a => api.pendingStatuses.includes(a.status));
  assert.equal(new Set(pending.map(api.rank)).size, pending.length);
  assert.ok(pending.some(a => a.id === c.id));
});
test("GET queue wire response preserves CURRENT/NEXT through generated response schema across call/start/complete", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  const response = async () => {
    // Exercise the real route and JSON transport, then the actual generated
    // response schema (not queueSummary alone or an equivalent handwritten schema).
    const wire = JSON.parse(JSON.stringify(await queue(staff)));
    const parsed = api.GetQueueResponse.parse(wire);
    assert.equal(parsed.currentToken, wire.currentToken);
    assert.equal(parsed.nextToken, wire.nextToken);
    return parsed;
  };
  let q = await response();
  assert.equal(q.currentToken, null);
  assert.equal(q.nextToken, a.token);
  assert.equal(q.arrived, 2);
  assert.equal(q.blockedByAbsentReservation, false);
  assert.ok(q.nextToken && !q.currentToken && !q.blockedByAbsentReservation, "aggregate call-next is enabled");
  await route(api.queueRouter, "post", "/queue/call-next", staff, { doctorId: "d", branchId: "b", date: today });
  q = await response();
  assert.equal(q.currentToken, a.token); assert.equal(q.nextToken, b.token);
  assert.equal(q.entries.find(row => row.id === a.id).status, "called");
  await act(a.id, { action: "start" });
  q = await response();
  assert.equal(q.currentToken, a.token); assert.equal(q.nextToken, b.token);
  assert.equal(q.inConsultation, 1);
  await act(a.id, { action: "complete" });
  q = await response();
  assert.equal(q.currentToken, b.token); assert.equal(q.nextToken, null);
  assert.equal(q.completed, 1);
  assert.equal(q.entries.find(row => row.id === b.id).status, "called");
  assert.equal(q.entries.find(row => row.id === b.id).checkedInAt, undefined);
});
test("checkout atomically calls once; concurrent check-in and legacy pending remain usable", async () => {
  await seed();
  const a = await book(), b = await book("p2"), c = await book("p3");
  await api.change(t.appointments, b.id, { status: "booked" });
  const started = await act(a.id, { action: "checkIn" });
  assert.ok(started.checkedInAt && started.consultationStartedAt);
  const results = await Promise.allSettled([act(a.id, { action: "complete" }), act(a.id, { action: "complete" })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal((await api.one(t.appointments, b.id)).status, "called");
  assert.equal((await api.one(t.appointments, c.id)).status, "waiting");
  const starts = await Promise.allSettled([act(b.id, { action: "checkIn" }), act(b.id, { action: "checkIn" })]);
  assert.equal(starts.filter(r => r.status === "fulfilled").length, 1);
  await act(c.id, { action: "noShow", reason: "Absent" });
  const skipped = await api.one(t.appointments, c.id);
  await act(c.id, { action: "requeue", reason: "Returned", position: 1, expectedRevision: skipped.revision, expectedQueueVersion: api.queueVersion(await rows()) });
  assert.equal((await api.one(t.appointments, b.id)).status, "inConsultation");
  assert.equal((await api.one(t.appointments, c.id)).token, c.token);
  const future = await book("p4", tomorrow);
  await assert.rejects(act(future.id, { action: "checkIn" }), /appointment date/);
  await assert.rejects(route(api.queueRouter, "post", "/queue/call-next", staff, { doctorId: "d", branchId: "b", date: tomorrow }), /appointment date/);
});
test("public display is branch-local, doctor-restricted, revocable and contains no patient fields", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  await book("p3", tomorrow);
  await api.put(t.qrs, { id: "qr", clinicId: "c", branchId: "b", publicReference: "display" });
  await act(a.id, { action: "checkIn" });
  const display = await api.publicDisplay("display");
  assert.equal(display.date, today);
  assert.equal(display.sessions.length, 1);
  assert.equal(display.sessions[0].doctorId, "d");
  assert.equal(display.sessions[0].currentToken, a.token);
  assert.deepEqual(display.sessions[0].waitingTokens, [b.token]);
  assert.equal(display.sessions[0].waitingCount, 1);
  assert.ok(!JSON.stringify(display).includes(a.reference));
  assert.ok(!JSON.stringify(display).includes("patient"));
  assert.equal(display.sessions[0].currentStatus, "inConsultation");
  assert.deepEqual(Object.keys(display.sessions[0]).sort(), ["doctorId", "doctorName", "sessionId", "presence", "startTime", "endTime", "currentToken", "currentStatus", "nextToken", "waitingTokens", "waitingCount", "completedCount"].sort());
  await api.change(t.qrs, "qr", { doctorId: "d" });
  assert.equal((await api.publicDisplay("display")).sessions.length, 1);
  await api.change(t.qrs, "qr", { branchId: null });
  await assert.rejects(api.publicDisplay("display"), /branch-specific/);
  await api.change(t.qrs, "qr", { branchId: "b", status: "inactive" });
  await assert.rejects(api.publicDisplay("display"), /expired or revoked/);
});
test("grouped status filters apply before pagination in appointment and queue routes", async () => {
  await seed();
  const a = await book(), b = await book("p2"), c = await book("p3"), d = await book("p4");
  await act(a.id, { action: "noShow", reason: "Absent" });
  await act(b.id, { action: "checkIn" });
  for (const [group, expected] of [["active", 3], ["waiting", 2], ["absent", 1], ["completed", 0], ["all", 4]]) {
    const listing = await route(api.appointmentsRouter, "get", "/appointments", staff, {}, {}, { statusGroup: group, pageSize: "1", page: "1" });
    assert.equal(listing.total, expected);
    assert.equal(listing.items.length, Math.min(1, expected));
    const q = await queue(staff, { statusGroup: group, pageSize: "1", page: "1" });
    assert.equal(q.entriesTotal, expected);
    assert.equal(q.entries.length, Math.min(1, expected));
    assert.equal(q.totalPages, expected);
  }
  const second = await queue(staff, { statusGroup: "waiting", pageSize: "1", page: "2" });
  assert.equal(second.entries[0].id, d.id);
  assert.equal(second.entriesTotal, 2);
  const intersect = await route(api.appointmentsRouter, "get", "/appointments", staff, {}, {}, { statusGroup: "waiting", status: "noShow" });
  assert.equal(intersect.total, 0);
});
test("session queue wait excludes advance booking lead time, respects timezone and preserves unknown", async () => {
  await seed();
  const a = await book();
  const row = await api.one(t.appointments, a.id);
  await api.change(t.appointments, a.id, { data: { ...row, waitingAt: "2029-12-01T00:00:00Z", startTime: "17:00", timezone: "Asia/Kolkata" } });
  const started = await act(a.id, { action: "checkIn" });
  assert.equal(started.waitMinutes, 30, "12:00Z minus 17:00 India session start, not reservation lead time");
  assert.equal(api.sessionQueueWaitMinutes({ ...row, waitingAt: null }), null);
  assert.equal(api.sessionQueueWaitMinutes({ ...row, startTime: null }), null);
  assert.equal(api.sessionQueueWaitMinutes({ ...row, timezone: "invalid-zone" }), null);
  assert.equal(api.sessionQueueWaitMinutes({ ...row, date: "2030-03-10", startTime: "02:30", timezone: "America/New_York" }), null, "nonexistent DST session start is unknown");
  assert.equal(api.sessionQueueWaitMinutes({ ...row, waitingAt: "2030-07-01T00:00:00Z", date: "2030-07-02", startTime: "08:00", timezone: "America/New_York" }, Date.parse("2030-07-02T12:45:00Z")), 45);
});
test("dashboard legacy pending counters match queue semantics and consultation check-in", async () => {
  await seed();
  const a = await book(), b = await book("p2"), c = await book("p3");
  await api.change(t.appointments, a.id, { status: "booked" });
  await api.change(t.appointments, b.id, { status: "checkedIn" });
  let metrics = await api.queryMetrics(staff, { date: today });
  assert.equal(metrics.waiting, 3); assert.equal(metrics.checkedIn, 0); assert.equal(metrics.activeQueues, 1);
  await act(a.id, { action: "checkIn" });
  metrics = await api.queryMetrics(staff, { date: today });
  assert.equal(metrics.waiting, 2); assert.equal(metrics.checkedIn, 1);
  assert.equal(metrics.waiting, (await queue(staff)).waiting);
});
test("inactive operational context does not roll back checkout or call pending reservations", async () => {
  for (const [table, id] of [[t.doctors, "d"], [t.users, "du"], [t.branches, "b"], [t.clinics, "c"]]) {
    await seed();
    const a = await book(), b = await book("p2");
    await act(a.id, { action: "checkIn" });
    await api.change(table, id, { status: "inactive" });
    assert.equal((await act(a.id, { action: "complete" })).status, "completed");
    assert.equal((await api.one(t.appointments, b.id)).status, "waiting");
  }
  await seed();
  const a = await book(), b = await book("p2");
  await act(a.id, { action: "checkIn" });
  await database.exec("delete from assignments where id='d'");
  assert.equal((await act(a.id, { action: "complete" })).status, "completed");
  assert.equal((await api.one(t.appointments, b.id)).status, "waiting");
});

test("multiple weekly sessions isolate availability capacity tokens queue and reschedule", async () => {
  await seed();
  const weekday = new Date(tomorrow).getUTCDay(), id = "d" + weekday;
  const original = await api.one(t.schedules, id);
  await api.change(t.schedules, id, { data: { ...original, startTime: "09:00", endTime: "10:00", maxTokens: 1 } });
  await api.put(t.schedules, { id: "afternoon", doctorId: "d", clinicId: "c", branchId: "b", dayOfWeek: weekday,
    data: { ...original, startTime: "14:00", endTime: "15:00", maxTokens: 1 } });
  await assert.rejects(api.availability("d", "b", tomorrow), /Select a session/);
  const sessions = await api.availabilitySessions("d", "b", tomorrow);
  assert.equal(sessions.length, 2);
  const morning = await book("p1", tomorrow, { sessionId: id });
  const afternoon = await book("p1", tomorrow, { sessionId: "afternoon" });
  assert.equal(morning.tokenNumber, 1); assert.equal(afternoon.tokenNumber, 1);
  assert.equal(api.sessionRows([morning, afternoon], morning).length, 1);
  assert.equal(api.sessionKey(morning) === api.sessionKey(afternoon), false);
  const filtered = await route(api.appointmentsRouter,"get","/appointments",staff,{}, {}, {doctorId:"d",branchId:"b",date:tomorrow,sessionId:id,pageSize:1});
  assert.equal(filtered.total,1); assert.equal(filtered.items[0].id,morning.id);
  await assert.rejects(book("p2", tomorrow, { sessionId: id }), /capacity/);
  await assert.rejects(book("p2", tomorrow, { sessionId: "afternoon" }), /capacity/);
  await act(afternoon.id, { action: "cancel" });
  const moved = await globalThis.phaseDb.transaction(tx => api.reschedule(staff, morning.id, { doctorId: "d", branchId: "b", date: tomorrow, sessionId: "afternoon", expectedRevision: 0 }, tx));
  assert.equal(moved.startTime, "14:00"); assert.equal(moved.tokenNumber, 2);
  assert.equal(moved.reference, morning.reference);
});

test("session-specific exception affects only selected session and retains breaks", async () => {
  await seed();
  const weekday = new Date(tomorrow).getUTCDay(), id = "d" + weekday;
  const original = await api.one(t.schedules, id);
  await api.change(t.schedules, id, { data: { ...original, startTime: "09:00", endTime: "12:00", breakStart: "10:00", breakEnd: "10:15" } });
  await api.put(t.schedules, { id: "late", doctorId: "d", clinicId: "c", branchId: "b", dayOfWeek: weekday, data: { ...original, startTime: "14:00", endTime: "16:00" } });
  await api.put(t.availabilityExceptions, { id: "closed", doctorId: "d", branchId: "b", date: tomorrow, data: { sessionId: "late", isClosed: true, reason: "Holiday" } });
  const [a,b] = await api.availabilitySessions("d","b",tomorrow);
  assert.equal(a.available,true); assert.equal(a.breakStart,"10:00");
  assert.equal(b.available,false); assert.equal(b.reason,"Holiday");
});

test("live away blocks new consultations and automatic calling but permits checkout", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  await act(a.id, { action: "checkIn" });
  assert.equal((await api.getPresence(a)).status, "available");
  await api.put(t.settings, { id: "presence:" + api.sessionKey(a), data: { status: "away", updatedAt: new Date().toISOString() } });
  await act(a.id, { action: "complete" });
  assert.equal((await api.one(t.appointments,b.id)).status,"waiting");
  await assert.rejects(act(b.id,{action:"checkIn"}),/break or away/);
  assert.equal((await book("p3",tomorrow)).status,"waiting");
});

test("clinic settings parity, independent live contacts and immutable URL", async () => {
  await seed();
  const owner = { id:"admin", role:"clinicAdmin" }, superAdmin = { id:"super", role:"superAdmin" };
  const save = (actor,body) => globalThis.phaseDb.transaction(tx => api.saveClinicSetup(actor,"c",body,tx));
  await save(owner,{clinic:{email:"clinic@example.com",phone:"100",slug:"clinic-one"},branches:[{id:"b",name:"Main",address:"Road",slug:"main-branch",inheritEmail:true,inheritPhone:false,phone:"200"}],policies:{bookingHorizonDays:14}});
  let view = await api.clinicSettingsResult("c");
  assert.equal(view.branches.find(b=>b.id==="b").effectiveEmail,"clinic@example.com");
  assert.equal(view.branches.find(b=>b.id==="b").effectivePhone,"200");
  await save(superAdmin,{clinic:{email:"new@example.com",phone:"300"}});
  view = await api.clinicSettingsResult("c");
  assert.equal(view.branches.find(b=>b.id==="b").effectiveEmail,"new@example.com");
  assert.equal(view.branches.find(b=>b.id==="b").effectivePhone,"200");
  assert.equal((await api.getSettings(globalThis.phaseDb,"c")).bookingHorizonDays,14);
  assert.equal((await api.getSettings()).bookingHorizonDays,60);
  await assert.rejects(save({id:"foreign",role:"clinicAdmin"},{clinic:{name:"Stolen"}}),/ownership/);
  await assert.rejects(save(owner,{clinic:{slug:"new-slug"}}),/locked/);
  assert.equal((await api.all(t.qrs)).length,1);
  await api.change(t.qrs,(await api.all(t.qrs))[0].id,{status:"inactive"});
  await save(owner,{branches:[{id:"b",name:"Rename",address:"Road",slug:"main-branch"}]});
  assert.equal((await api.all(t.qrs)).filter(q=>q.status==="active").length,0);
  assert.equal(api.validSlug("api"),false); assert.equal(api.validSlug("Clinic"),false);
  assert.equal(api.validSlug("scan-qr"),false); assert.equal(api.validSlug("guest-booking"),false);
  assert.equal(api.validSlug("demo-clinic"),true);
});

test("admin clinical attachment reconciles selected branches without admin branch assignments", async () => {
  await seed();
  await api.put(t.assignments,{id:"admin-clinic-own",userId:"admin",clinicId:"c"});
  const owner = await api.one(t.users,"admin");
  const before = await api.all(t.assignments);
  const own = await globalThis.phaseDb.transaction(tx => api.attachOwnDoctor(owner,{branchIds:["b"]},tx));
  assert.deepEqual(own.branchIds,["b"]);
  const updated = await globalThis.phaseDb.transaction(tx => api.attachOwnDoctor(owner,{branchIds:["b2"]},tx));
  assert.equal(own.id,updated.id);
  assert.deepEqual(updated.branchIds,["b2"]);
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.attachOwnDoctor(owner,{branchIds:["foreign-b"]},tx)));
  assert.deepEqual(await api.all(t.assignments),before);
  assert.equal((await api.one(t.users,"admin")).role,"clinicAdmin");
  const actor = {...owner,clinicIds:["c"],branchIds:["b","b2"]};
  const ownEdit = await route(api.resourcesRouter,"patch","/doctors/:id",actor,{
    fullName:owner.fullName,email:owner.email,branchIds:["b"],about:"Consulting today",
  },{id:own.id});
  assert.deepEqual(ownEdit.branchIds,["b"]);
  assert.deepEqual((await api.one(t.doctors,own.id)).branchIds,["b"]);
  assert.deepEqual(await api.all(t.assignments),before);
  await assert.rejects(route(api.resourcesRouter,"patch","/doctors/:id",actor,{
    fullName:owner.fullName,email:owner.email,branchIds:["foreign-b"],
  },{id:own.id}));
  assert.deepEqual((await api.one(t.doctors,own.id)).branchIds,["b"]);
  await route(api.resourcesRouter,"patch","/doctors/:id",actor,{fullName:"Ordinary Doctor",email:"doctor@example.invalid",status:"inactive"},{id:"d"});
  assert.equal((await api.one(t.doctors,"d")).status,"inactive");
  assert.equal((await api.one(t.users,"admin")).status,"active");
});

test("staff patient creation accepts omitted mobile and updates preserve verification only for unchanged mobile", async () => {
  await seed();
  const owner = {...await api.one(t.users,"admin"),clinicIds:["c"],branchIds:["b","b2"]};
  const create = data=>route(api.resourcesRouter,"post","/patients",owner,{fullName:"Staff-created patient",clinicId:"c",branchId:"b",...data});
  const withoutMobile = await create({});
  assert.ok(withoutMobile.id);
  assert.equal((await api.one(t.patients,withoutMobile.id)).mobile,null);
  assert.equal((await api.one(t.patients,withoutMobile.id)).mobileVerified,false);
  const mobile = "+15555550999";
  const withMobile = await create({mobile});
  assert.equal((await api.one(t.patients,withMobile.id)).mobile,mobile);
  assert.equal((await api.one(t.patients,withMobile.id)).mobileVerified,false);
  await api.change(t.patients,withMobile.id,{mobileVerified:true});
  const edit = data=>route(api.resourcesRouter,"patch","/patients/:id",owner,{fullName:"Edited patient",clinicId:"c",branchId:"b",...data},{id:withMobile.id});
  await edit({mobile});
  assert.equal((await api.one(t.patients,withMobile.id)).mobileVerified,true);
  await edit({mobile:"+15555550888"});
  assert.equal((await api.one(t.patients,withMobile.id)).mobileVerified,false);
  await api.change(t.patients,withMobile.id,{mobileVerified:true});
  await edit({});
  assert.equal((await api.one(t.patients,withMobile.id)).mobile,null);
  assert.equal((await api.one(t.patients,withMobile.id)).mobileVerified,false);
});

test("shared settings routes round-trip both admins and reject foreign clinic staff", async () => {
  await seed();
  const owner = {...await api.one(t.users,"admin"),clinicIds:["c"],branchIds:["b","b2"]};
  const other = await api.put(t.users,{id:"other-admin",email:"other@example.invalid",fullName:"Other",role:"clinicAdmin"});
  const setup = await globalThis.phaseDb.transaction(tx => api.createOwnedClinic(other,other,{
    clinic:{name:"Foreign clinic",address:"Other road"},branches:[{name:"Foreign branch",address:"Other road"}]
  },tx));
  assert.equal(setup.doctorId,null);
  const foreign = {...other,clinicIds:[setup.clinic.id],branchIds:[setup.branches[0].id]};
  const receptionist = await api.put(t.users,{id:"foreign-staff",email:"staff@example.invalid",fullName:"Foreign staff",role:"receptionist",managingAdminId:other.id});
  await api.put(t.assignments,{id:"foreign-staff-link",userId:receptionist.id,clinicId:setup.clinic.id,branchId:setup.branches[0].id});
  const superAdmin = {id:"super",role:"superAdmin"};
  const settings = (method,actor,body={},id="c") => route(api.clinicExpansionRouter,method,"/clinics/:id/settings",actor,body,{id});
  const hours = Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,startTime:"00:00",endTime:"23:59"}));
  await settings("patch",owner,{clinic:{email:"owner@example.invalid",phone:"111"},branches:[{id:"b",name:"Main",address:"Road",inheritEmail:true,inheritPhone:false,phone:"222",openingHours:hours}],policies:{bookingHorizonDays:21,cancellationCutoffMinutes:15}});
  assert.deepEqual(await settings("get",owner),await settings("get",superAdmin));
  await settings("patch",superAdmin,{clinic:{email:"super@example.invalid",phone:"333"},policies:{bookingHorizonDays:10,cancellationCutoffMinutes:20}});
  const view = await settings("get",owner);
  assert.deepEqual(view,await settings("get",superAdmin));
  assert.equal(view.branches.find(b=>b.id==="b").effectiveEmail,"super@example.invalid");
  assert.equal(view.branches.find(b=>b.id==="b").effectivePhone,"222");
  assert.deepEqual(view.branches.find(b=>b.id==="b").openingHours,hours);
  assert.equal(view.policies.bookingHorizonDays,10);
  assert.equal(view.policies.cancellationCutoffMinutes,20);
  for (const actor of [foreign,{...receptionist,clinicIds:foreign.clinicIds,branchIds:foreign.branchIds}]) {
    await assert.rejects(settings("get",actor),error=>error.status===403);
    await assert.rejects(settings("patch",actor,{clinic:{name:"Forbidden"}}),error=>error.status===403);
  }
  await assert.rejects(settings("get",owner,{},setup.clinic.id),error=>error.status===403);
  assert.equal((await settings("get",foreign,{},setup.clinic.id)).clinic.name,"Foreign clinic");
});

test("clinic admin retains ordinary doctors with scoped patient and visit route totals", async () => {
  await seed();
  const user = await api.one(t.users,"admin");
  const owner = {...user,clinicIds:["c"],branchIds:["b"]};
  const superAdmin = {id:"super",role:"superAdmin"};
  const other = await api.put(t.users,{id:"other-admin",email:"other@example.invalid",fullName:"Other",role:"clinicAdmin"});
  const setup = await globalThis.phaseDb.transaction(tx=>api.createOwnedClinic(other,other,{clinic:{name:"Other",address:"Road"},branches:[{name:"Other",address:"Road"}]},tx));
  assert.equal(setup.doctorId,null);
  const foreign = {...other,clinicIds:[setup.clinic.id],branchIds:[setup.branches[0].id]};
  await api.put(t.patients,{id:"foreign-patient",clinicId:setup.clinic.id,branchId:setup.branches[0].id,data:{fullName:"Foreign only"}});
  const create = (actor,doctorId,branchId,patientId,clinicId="c")=>route(api.appointmentsRouter,"post","/appointments",actor,{doctorId,branchId,patientId,clinicId,date:today,source:"phone"});
  for (const [doctorId,branchId,patientId] of [["d","b","p1"],["d2","b2","p2"]]) await create(owner,doctorId,branchId,patientId);
  // The administrator's branch list must not narrow clinic-wide access to ordinary doctors.
  await assert.rejects(create(owner,"d",setup.branches[0].id,"foreign-patient",setup.clinic.id),error=>error.status===403);
  await assert.rejects(create(foreign,"d","b","p1"),error=>error.status===403);
  const list = (actor,kind,query)=>route(kind==="patients"?api.resourcesRouter:api.appointmentsRouter,"get","/"+kind,actor,{}, {},query);
  for (const actor of [owner,superAdmin]) {
    const doctors = await route(api.resourcesRouter,"get","/doctors",actor,{}, {},{clinicId:"c",pageSize:1});
    assert.equal(doctors.total,2); assert.equal(doctors.items.length,1);
    const patients = await list(actor,"patients",{clinicId:"c",page:1,pageSize:1});
    assert.equal(patients.total,4); assert.equal(patients.items.length,1);
    const visits = await list(actor,"appointments",{clinicId:"c",date:today,page:1,pageSize:1});
    assert.equal(visits.total,2); assert.equal(visits.items.length,1);
    const filtered = await list(actor,"appointments",{clinicId:"c",doctorId:"d2",branchId:"b2",date:today,status:"waiting"});
    assert.equal(filtered.total,1); assert.equal(filtered.items[0].patientId,"p2");
    assert.equal((await list(actor,"patients",{clinicId:"c",search:"Patient 2"})).total,1);
  }
  assert.equal((await list(owner,"patients",{clinicId:setup.clinic.id})).total,0);
  assert.equal((await list(owner,"appointments",{clinicId:setup.clinic.id})).total,0);
  assert.equal((await list(foreign,"appointments",{clinicId:"c"})).total,0);
  assert.equal((await list(foreign,"patients",{clinicId:"c"})).total,0);
  assert.equal((await list(superAdmin,"patients",{clinicId:setup.clinic.id})).total,1);
  await create(superAdmin,"d","b","foreign-patient");
  // A patient registered elsewhere becomes readable through an authorized visit.
  assert.equal((await list(owner,"patients",{search:"Foreign only"})).total,1);
  assert.equal((await list(superAdmin,"patients",{search:"Foreign only"})).total,1);
  assert.equal((await list(owner,"appointments",{patientId:"foreign-patient",clinicId:"c"})).total,1);
  assert.equal((await list(foreign,"appointments",{patientId:"foreign-patient",clinicId:"c"})).total,0);
});

test("opening hours validate intervals and constrain sessions without changing legacy hours", () => {
  api.validateOpeningHours([{dayOfWeek:1,startTime:"09:00",endTime:"12:00"},{dayOfWeek:1,startTime:"14:00",endTime:"17:00"}]);
  assert.throws(()=>api.validateOpeningHours([{dayOfWeek:1,startTime:"09:00",endTime:"12:00"},{dayOfWeek:1,startTime:"11:00",endTime:"13:00"}]),/overlap/);
  const session = {isOpen:true,dayOfWeek:1,startTime:"08:00",endTime:"10:00",timezone:"UTC"};
  api.withinBranchHours({},session);
  api.withinBranchHours({openingHours:null},session);
  assert.throws(()=>api.withinBranchHours({openingHours:[]},session),/within branch/);
  assert.throws(()=>api.withinBranchHours({timezone:"UTC",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"12:00"}]},session),/within branch/);
});

test("explicit all-closed settings reject booking while absent and null hours retain legacy access", async () => {
  await seed();
  assert.equal((await api.availability("d","b",tomorrow)).available,true);
  await globalThis.phaseDb.transaction(tx=>api.saveClinicSetup({id:"admin",role:"clinicAdmin"},"c",{branches:[{id:"b",openingHours:[]}]},tx));
  assert.equal((await api.availability("d","b",tomorrow)).available,false);
  await assert.rejects(book("p1",tomorrow),/outside branch opening hours/);
  await globalThis.phaseDb.transaction(tx=>api.saveClinicSetup({id:"admin",role:"clinicAdmin"},"c",{branches:[{id:"b",openingHours:null}]},tx));
  assert.equal((await api.availability("d","b",tomorrow)).available,true);
});

test("queue GET uses legacy duration without writing appointments, settings or audits", async () => {
  await seed();
  const a = await book();
  await database.exec("delete from settings where id like 'session:%'; update appointments set data=data-'expectedDurationMinutes'");
  const before = { appointments:await api.all(t.appointments),settings:await api.all(t.settings),audits:await api.all(t.auditLogs) };
  const q = {doctorId:"d",branchId:"b",date:today,startTime:a.startTime};
  const first = await route(api.queueRouter,"get","/queue",staff,{}, {},q);
  const second = await route(api.queueRouter,"get","/queue",patient,{}, {},{...q,appointmentId:a.id});
  assert.equal(first.expectedDurationMinutes,10);
  assert.equal(second.queueVersion,first.queueVersion);
  assert.deepEqual({ appointments:await api.all(t.appointments),settings:await api.all(t.settings),audits:await api.all(t.auditLogs) },before);
  await act(a.id,{action:"call"});
  assert.equal((await api.one(t.appointments,a.id)).expectedDurationMinutes,10);
  assert.ok((await api.all(t.settings)).some(s=>s.id===api.sessionKey(a)));
});

test("authenticated session contexts retain edited/deleted template snapshots without leaking patients", async () => {
  await seed();
  const a = await book("p1",tomorrow);
  const schedule = await api.one(t.schedules,a.sessionId);
  await api.change(t.schedules,schedule.id,{data:{...schedule,startTime:"18:00",endTime:"19:00"}});
  const q = {doctorId:"d",branchId:"b",date:tomorrow};
  const contexts = await route(api.queueRouter,"get","/session-contexts",staff,{}, {},q);
  assert.equal(contexts.length,2);
  const historical = contexts.find(s=>s.startTime===a.startTime);
  assert.equal(historical.snapshotOnly,true); assert.equal(historical.available,false);
  assert.ok(contexts.some(s=>s.startTime==="18:00" && !s.snapshotOnly));
  assert.ok(!JSON.stringify(contexts).includes(a.patientId));
  assert.ok(!JSON.stringify(contexts).includes(a.reference));
  await api.change(t.schedules,schedule.id,{status:"inactive"});
  const remaining = await route(api.queueRouter,"get","/session-contexts",staff,{}, {},q);
  assert.equal(remaining.length,1); assert.equal(remaining[0].startTime,a.startTime);
  const queue = await route(api.queueRouter,"get","/queue",staff,{}, {},{...q,startTime:a.startTime,sessionId:a.sessionId});
  assert.equal(queue.entries[0].id,a.id);
  await assert.rejects(route(api.queueRouter,"get","/session-contexts",patient,{}, {},q),/access|role|permission/i);
  await assert.rejects(route(api.queueRouter,"get","/session-contexts",{id:"other",role:"receptionist",clinicIds:["foreign"],branchIds:[]},{}, {},q),/scope/);
});

test("actual TAT is nullable without completed timestamps and independent of configured duration", async () => {
  await seed();
  const a = await book();
  assert.equal((await api.queryMetrics({role:"superAdmin"},{})).averageConsultationMinutes,null);
  await api.change(t.appointments,a.id,{status:"completed",data:{...a,expectedDurationMinutes:60,consultationMinutesActual:999,consultationStartedAt:"2030-01-07T10:00:00.000Z",completedAt:"2030-01-07T10:12:00.000Z"}});
  assert.equal((await api.queryMetrics({role:"superAdmin"},{})).averageConsultationMinutes,12);
});

test("atomic owned clinic setup rolls back on branch slug conflict and retains one owner", async () => {
  await seed();
  const admin = await api.one(t.users,"admin");
  await assert.rejects(globalThis.phaseDb.transaction(tx => api.createOwnedClinic(admin,admin,{clinic:{name:"Second",address:"Street",slug:"second-clinic"},branches:[{name:"A",address:"One",slug:"same-branch"},{name:"B",address:"Two",slug:"same-branch"}]},tx)),/already in use/);
  assert.equal((await api.all(t.clinics)).length,1);
  assert.equal((await api.all(t.branches)).length,2);
  const input = {clinic:{name:"Second",address:"Street",slug:"second-clinic"},branches:[{name:"A",address:"One",slug:"main-branch",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"17:00"}]}]};
  const result = await globalThis.phaseDb.transaction(tx => api.createOwnedClinic(admin,admin,{...input,ownDoctor:true},tx));
  assert.equal(result.clinic.adminId,admin.id);
  assert.ok(result.doctorId);
  assert.equal(result.branches.length,1);
  assert.equal((await api.all(t.qrs)).filter(q=>q.branchId===result.branches[0].id).length,1);
});

test("public slug resolver is active-only, read-only, contact-effective and never restores revoked QR", async () => {
  await seed();
  const owner = {id:"admin",role:"clinicAdmin"};
  await globalThis.phaseDb.transaction(tx=>api.saveClinicSetup(owner,"c",{clinic:{slug:"public-clinic",email:"contact@example.com"},branches:[{id:"b",name:"Main",address:"Road",slug:"main-branch",inheritEmail:true}]},tx));
  const resolve = (branchSlug) => route(api.clinicExpansionRouter,"get","/public/clinics-by-slug/:clinicSlug{/:branchSlug}",null,{}, {clinicSlug:"public-clinic",...(branchSlug ? {branchSlug} : {})});
  const root = await resolve();
  assert.equal(root.branch,null);
  const branch = await resolve("main-branch");
  assert.equal(branch.branch.effectiveEmail,"contact@example.com");
  assert.ok(branch.qrReference);
  assert.equal(branch.doctors.length,1);
  assert.equal(branch.doctors[0].averageConsultationMinutes,null);
  const before = (await api.all(t.qrs)).length;
  await api.change(t.qrs,(await api.all(t.qrs))[0].id,{status:"inactive"});
  assert.equal((await resolve("main-branch")).qrReference,null);
  assert.equal((await api.all(t.qrs)).length,before);
  assert.ok(!JSON.stringify(branch).includes("adminId"));
  assert.ok(!JSON.stringify(branch).includes("patient"));
  await api.change(t.branches,"b",{status:"inactive"});
  await assert.rejects(resolve("main-branch"),/not found/);
  await api.change(t.clinics,"c",{status:"inactive"});
  await assert.rejects(resolve(),/not found/);
});

test("signup reference data only exposes active allowlisted names and IDs", async () => {
  await seed();
  for (const [id,category,status] of [["s","specialization","active"],["q","qualification","active"],["c","clinicCategory","active"],["secret","userRole","active"],["old","specialization","inactive"]]) {
    await api.put(t.masters,{id,category,code:id,status,data:{name:id,privateMetadata:"not-public"}});
  }
  const options = await route(api.clinicExpansionRouter,"get","/public/registration-options",null);
  assert.deepEqual(options,{categories:[{id:"c",name:"c"}],specialities:[{id:"s",name:"s"}],qualifications:[{id:"q",name:"q"}]});
});

test("guest request session SQL filters constrain rows and count before pagination", async () => {
  await seed();
  const weekday = new Date(tomorrow).getUTCDay(), id = "d" + weekday;
  const original = await api.one(t.schedules,id);
  await api.change(t.schedules,id,{data:{...original,startTime:"09:00",endTime:"10:00"}});
  await api.put(t.schedules,{id:"late",doctorId:"d",clinicId:"c",branchId:"b",dayOfWeek:weekday,data:{...original,startTime:"14:00",endTime:"15:00"}});
  const a = await guest({date:tomorrow,sessionId:id});
  await guest({date:tomorrow,sessionId:"late",requestId:"12345678-1234-4234-8234-123456789013",receiptSecret:"b".repeat(64)});
  const page = await route(api.guestRequestsRouter,"get","/guest-requests",staff,{}, {}, {status:"confirmed",date:tomorrow,sessionId:id,startTime:"09:00",pageSize:1});
  assert.equal(page.total,1); assert.equal(page.items[0].id,a.id); assert.equal(page.items[0].sessionId,id);
  const empty = await route(api.guestRequestsRouter,"get","/guest-requests",{id:"other",role:"clinicAdmin",clinicIds:["other"],branchIds:[]},{}, {}, {status:"confirmed",date:tomorrow,sessionId:id});
  assert.equal(empty.total,0);
  assert.equal((await api.one(t.appointments,a.appointmentId)).sessionId,id);
});

test("adding a weekly session binds legacy exceptions and rejects dated overlaps atomically", async () => {
  await seed();
  const weekday = new Date(tomorrow).getUTCDay(), id = "d"+weekday;
  const original = await api.one(t.schedules,id);
  await api.change(t.schedules,id,{data:{...original,startTime:"09:00",endTime:"12:00"}});
  await api.put(t.availabilityExceptions,{id:"legacy-exception",doctorId:"d",branchId:"b",date:tomorrow,data:{isClosed:false,startTime:"14:00",endTime:"15:00",reason:"Adjusted"}});
  const actor = {id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:["b","b2"]};
  const create = body => route(api.resourcesRouter,"post","/schedules",actor,{...original,...body});
  await assert.rejects(create({startTime:"14:00",endTime:"15:00"}),/dated session exception/);
  assert.equal((await api.one(t.availabilityExceptions,"legacy-exception")).sessionId,undefined);
  const added = await create({startTime:"16:00",endTime:"17:00"});
  assert.equal((await api.one(t.availabilityExceptions,"legacy-exception")).sessionId,id);
  const sessions = await api.availabilitySessions("d","b",tomorrow);
  assert.equal(sessions.find(s=>s.sessionId===id).startTime,"14:00");
  assert.equal(sessions.find(s=>s.sessionId===added.id).startTime,"16:00");
});

test("owner completes an hours-only clinic through existing schedule CRUD and its QR accepts a guest", async () => {
  await seed();
  // Reproduce onboarding's persisted shape: the location is open, the owner-doctor
  // is assigned, but no doctor session has been configured.
  await database.exec("delete from schedules");
  const weekday = new Date(tomorrow + "T12:00:00Z").getUTCDay();
  const location = await api.one(t.branches, "b");
  await api.change(t.branches, "b", {
    data: { ...location, timezone: "Asia/Calcutta", openingHours: [{ dayOfWeek: weekday, startTime: "09:00", endTime: "17:00" }] },
  });
  assert.deepEqual(await api.availabilitySessions("d", "b", tomorrow), []);
  const owner = { id: "admin", role: "clinicAdmin", clinicIds: ["c"], branchIds: ["b"] };
  const setup = {
    doctorId: "d", clinicId: "c", branchId: "b", dayOfWeek: weekday,
    isOpen: true, startTime: "09:00", endTime: "17:00", timezone: "Asia/Kolkata",
    maxTokens: 10, consultationMinutes: 10, tokenPrefix: "A", queueMode: "mixed",
  };
  await assert.rejects(route(api.resourcesRouter, "post", "/schedules",
    { id: "foreign", role: "clinicAdmin", clinicIds: ["other"], branchIds: [] }, setup), /scope|outside|manage/i);
  assert.deepEqual(await api.availabilitySessions("d", "b", tomorrow), []);
  const session = await route(api.resourcesRouter, "post", "/schedules", owner, setup);
  assert.equal((await api.availabilitySessions("d", "b", tomorrow))[0].sessionId, session.id);
  assert.equal((await api.availabilitySessions("d", "b", tomorrow))[0].available, true);
  // Retrying the same create is rejected rather than introducing duplicate capacity.
  await assert.rejects(route(api.resourcesRouter, "post", "/schedules", owner, setup), /overlap/i);
  assert.equal((await api.all(t.schedules)).length, 1);
  const ticket = await guest({ date: tomorrow, sessionId: session.id });
  assert.ok(ticket.appointmentId);
  assert.equal((await api.availabilitySessions("d", "b", tomorrow))[0].bookedTokens, 1);
});

test("generic clinic and branch updates cannot bypass owner-only settings permissions", async () => {
  await seed();
  const branch = await api.one(t.branches, "b");
  const clinic = await api.one(t.clinics, "c");
  const doctor = { id: "du", role: "doctor", doctorId: "d", managingAdminId: "admin", clinicIds: ["c"], branchIds: ["b"] };
  const foreign = { id: "foreign", role: "clinicAdmin", clinicIds: ["c"], branchIds: ["b"] };
  const owner = { id: "admin", role: "clinicAdmin", clinicIds: ["c"], branchIds: ["b"] };
  for (const body of [{ openingHours: [] }, { openingHours: null }, { timezone: "Asia/Kolkata" }, { inheritEmail: false }, { phone: "123" }]) {
    await assert.rejects(api.authorizeWrite(doctor, "branches", body, branch), /Only the owning Clinic Admin/);
    await assert.rejects(api.authorizeWrite(foreign, "branches", body, branch), /Only the owning Clinic Admin/);
    await api.authorizeWrite(owner, "branches", body, branch);
  }
  for (const body of [{ name: "Other name" }, { slug: "other-slug" }, { policies: { bookingHorizonDays: 7 } }]) {
    await assert.rejects(api.authorizeWrite(doctor, "clinics", body, clinic), /Only the owning Clinic Admin/);
    await assert.rejects(api.authorizeWrite(foreign, "clinics", body, clinic), /Only the owning Clinic Admin/);
  }
  await api.authorizeWrite(owner, "clinics", { name: "Permitted" }, clinic);
  // The ordinary doctor's existing scoped, non-settings edit path remains intact.
  await api.authorizeWrite(doctor, "branches", { name: "Clinical location" }, branch);
});

const ownerLinkedOptions = { maxTokens: 2, consultationMinutes: 20, tokenPrefix: "L", queueMode: "mixed" };
async function linkedFixture(extra = {}) {
  await seed();
  const admin = await api.one(t.users, "admin");
  const weekday = new Date(tomorrow + "T12:00:00Z").getUTCDay();
  const result = await globalThis.phaseDb.transaction(tx => api.createOwnedClinic(admin, admin, {
    clinic: { name: "Linked solo clinic", address: "Road", slug: "linked-solo-clinic" },
    branches: [{ name: "Linked location", address: "Road", slug: "linked-location", timezone: "Asia/Calcutta", openingHours: [{ dayOfWeek: weekday, startTime: "09:00", endTime: "17:00" }] }],
    ownDoctor: true, ownerSchedule: ownerLinkedOptions, ...extra,
  }, tx));
  const branch = result.branches[0];
  const session = (await api.all(t.schedules)).find(s => s.branchId === branch.id);
  const owner = { ...admin, clinicIds: [result.clinic.id], branchIds: [branch.id] };
  const save = branches => globalThis.phaseDb.transaction(tx => api.saveClinicSetup(owner, result.clinic.id, { branches }, tx));
  return { result, branch, session, owner, save };
}
test("linked owner onboarding atomically creates bookable sessions and keeps the original QR through a guest booking", async () => {
  const { result, branch, session } = await linkedFixture();
  assert.equal(branch.linkedSchedule.doctorId, result.doctorId);
  assert.equal(session.linkedBranchId, branch.id);
  const sessions = await api.availabilitySessions(result.doctorId, branch.id, tomorrow);
  assert.equal(sessions[0].available, true);
  assert.equal(sessions[0].remainingTokens, 2);
  const qr = (await api.all(t.qrs)).find(q => q.branchId === branch.id);
  const ticket = await api.createGuestRequest({ qrReference: qr.publicReference, fullName: "Linked patient", branchId: branch.id, doctorId: result.doctorId, date: tomorrow, sessionId: session.id, requestId: "87654321-1234-4234-8234-123456789012", receiptSecret: "f".repeat(64) });
  assert.ok(ticket.appointmentId);
  assert.equal((await api.availabilitySessions(result.doctorId, branch.id, tomorrow))[0].remainingTokens, 1);
  assert.equal((await api.one(t.qrs, qr.id)).publicReference, qr.publicReference);
  const booking = { qrReference: qr.publicReference, fullName: "Second linked patient", branchId: branch.id, doctorId: result.doctorId, date: tomorrow, sessionId: session.id, requestId: "87654321-1234-4234-8234-123456789013", receiptSecret: "d".repeat(64) };
  await api.createGuestRequest(booking);
  assert.equal((await api.availabilitySessions(result.doctorId, branch.id, tomorrow))[0].remainingTokens, 0);
  await assert.rejects(api.createGuestRequest({ ...booking, fullName: "Over capacity", requestId: "87654321-1234-4234-8234-123456789014", receiptSecret: "c".repeat(64) }), /capacity|available/i);
});
test("linked hours preview is read-only and saves are idempotent, support multiple locations and sync unused sessions", async () => {
  const { result, branch, session, owner, save } = await linkedFixture();
  const unchanged = { id: branch.id, name: branch.name, address: branch.address, openingHours: branch.openingHours };
  const preview = await api.previewClinicSetup(owner, result.clinic.id, { branches: [unchanged] });
  assert.deepEqual(preview.impacts[0], { branchId: branch.id, create: 0, update: 0, retire: 0, unlink: false });
  const wirePreview = await route(api.clinicExpansionRouter, "post", "/clinics/:id/settings/preview", owner, { branches: [unchanged] }, { id: result.clinic.id });
  assert.equal(wirePreview.allowed, true);
  const wireSave = await route(api.clinicExpansionRouter, "patch", "/clinics/:id/settings", owner, { branches: [unchanged] }, { id: result.clinic.id });
  assert.equal(wireSave.branches[0].linkedSchedule.enabled, true);
  await save([unchanged]); await save([unchanged]);
  assert.equal((await api.all(t.schedules)).filter(s => s.branchId === branch.id).length, 1);
  const changed = { ...unchanged, openingHours: [{ ...branch.openingHours[0], endTime: "16:00" }] };
  const p = await api.previewClinicSetup(owner, result.clinic.id, { branches: [changed] });
  assert.equal(p.allowed, true); assert.equal(p.impacts[0].create, 1); assert.equal(p.impacts[0].retire, 1);
  assert.equal((await api.one(t.schedules, session.id)).status, "active");
  await save([changed]);
  assert.equal((await api.one(t.schedules, session.id)).status, "inactive");
  assert.equal((await api.availabilitySessions(result.doctorId, branch.id, tomorrow))[0].endTime, "16:00");
  // A second location links independently, with a non-overlapping weekday.
  const second = await save([{ name: "Second location", address: "Road", openingHours: [{ dayOfWeek: (branch.openingHours[0].dayOfWeek + 1) % 7, startTime: "09:00", endTime: "17:00" }] }]);
  const other = second.branches.find(b => b.id !== branch.id);
  await globalThis.phaseDb.transaction(tx => api.attachOwnDoctor(owner, { branchIds: [branch.id, other.id] }, tx));
  await save([{ id: other.id, linkedSchedule: { enabled: true, ...ownerLinkedOptions } }]);
  assert.equal((await api.all(t.schedules)).filter(s => s.branchId === other.id && s.status === "active").length, 1);
});
test("linked session changes preserve booked session IDs/history and roll back clinic/hour edits on conflict", async () => {
  const { result, branch, session, owner, save } = await linkedFixture();
  const qr = (await api.all(t.qrs)).find(q => q.branchId === branch.id);
  const ticket = await api.createGuestRequest({ qrReference: qr.publicReference, fullName: "Protected patient", branchId: branch.id, doctorId: result.doctorId, date: tomorrow, sessionId: session.id, requestId: "97654321-1234-4234-8234-123456789012", receiptSecret: "e".repeat(64) });
  const original = await api.one(t.appointments, ticket.appointmentId);
  const input = { id: branch.id, name: branch.name, address: branch.address, openingHours: [{ ...branch.openingHours[0], startTime: "10:00" }] };
  const p = await api.previewClinicSetup(owner, result.clinic.id, { branches: [input] });
  assert.equal(p.allowed, false); assert.match(p.conflicts.join(" "), /booking history/);
  await assert.rejects(save([input]), /booking history/);
  await assert.rejects(save([{ id: branch.id, linkedSchedule: { ...branch.linkedSchedule, maxTokens: 1 } }]), /booking history/);
  assert.deepEqual((await api.one(t.branches, branch.id)).openingHours, branch.openingHours);
  assert.deepEqual(await api.one(t.appointments, ticket.appointmentId), original);
  assert.equal((await api.one(t.schedules, session.id)).status, "active");
});
test("linked configuration is owner-scoped, Super Admin accessible, and direct session edits require explicit unlink", async () => {
  const { result, branch, session, owner, save } = await linkedFixture();
  const foreign = { id: "du", role: "clinicAdmin", clinicIds: [result.clinic.id] };
  const ordinaryDoctor = { id: "du", role: "doctor", doctorId: "d", clinicIds: [result.clinic.id] };
  for (const actor of [foreign, ordinaryDoctor, staff, patient]) {
    await assert.rejects(api.previewClinicSetup(actor, result.clinic.id, {}), /ownership/);
    await assert.rejects(globalThis.phaseDb.transaction(tx => api.saveClinicSetup(actor, result.clinic.id, {}, tx)), /ownership/);
  }
  assert.equal((await api.previewClinicSetup({ id: "admin", role: "superAdmin" }, result.clinic.id, {})).allowed, true);
  await globalThis.phaseDb.transaction(tx => api.saveClinicSetup({ id: "admin", role: "superAdmin" }, result.clinic.id, { branches: [{ id: branch.id, linkedSchedule: { ...branch.linkedSchedule, maxTokens: 3 } }] }, tx));
  await assert.rejects(route(api.resourcesRouter, "patch", "/schedules/:id", owner, { ...session, maxTokens: 4 }, { id: session.id }), /Unlink/);
  await assert.rejects(route(api.resourcesRouter, "delete", "/schedules/:id", owner, {}, { id: session.id }), /Unlink/);
  await assert.rejects(route(api.resourcesRouter, "patch", "/branches/:id", owner, { ...branch, openingHours: [] }, { id: branch.id }), /Clinic settings/);
  await save([{ id: branch.id, linkedSchedule: { enabled: false } }]);
  assert.equal((await api.one(t.schedules, session.id)).linkedBranchId, null);
  await route(api.resourcesRouter, "patch", "/schedules/:id", owner, { ...session, maxTokens: 4 }, { id: session.id });
  assert.equal((await api.one(t.schedules, session.id)).maxTokens, 4);
});
test("linked schedules respect date closures and block unsafe exception-affecting changes", async () => {
  const { result, branch, session, save } = await linkedFixture();
  await api.put(t.availabilityExceptions, { id: "linked-exception", doctorId: result.doctorId, clinicId: result.clinic.id, branchId: branch.id, date: tomorrow, data: { isClosed: true, sessionId: session.id, reason: "Holiday" } });
  assert.equal((await api.availabilitySessions(result.doctorId, branch.id, tomorrow))[0].available, false);
  await assert.rejects(save([{ id: branch.id, openingHours: [] }]), /date exceptions/);
  assert.equal((await api.one(t.schedules, session.id)).status, "active");
});
test("linked onboarding requires explicit valid capacity and rolls back incomplete setup", async () => {
  await assert.rejects(linkedFixture({ ownerSchedule: { ...ownerLinkedOptions, maxTokens: 0 } }), /capacity/);
  assert.equal((await api.all(t.clinics)).some(c => c.slug === "linked-solo-clinic"), false);
  await assert.rejects(linkedFixture({ ownDoctor: false }), /consulting owner/);
});