// Real isolated PostgreSQL domain tests. No app listener, Clerk session, or production DB.
import { test, after, mock } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { build } from "esbuild";
import { resolve, join } from "node:path";
import { rm } from "node:fs/promises";

const root = import.meta.dirname, bundle = join(root, ".phase-one-test.mjs");
await build({
  stdin: { contents: `
    export * from "./lib/appointments";
    export * from "./lib/reschedule";
    export * from "./lib/queue-order";
    export * from "./lib/session-duration";
    export * from "./lib/store";
    export * from "./routes/appointments";
    export * from "./routes/queue";
    export * from "./routes/duration";
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
await database.exec(`
  create table users(id text primary key, clerk_id text, email text, full_name text, mobile text, role text, managing_admin_id text, invitation_status text default 'notRequired',status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table clinics(id text primary key,owner_id text,admin_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table branches(id text primary key,clinic_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table doctors(id text primary key,user_id text,owner_admin_id text,specialization_id text,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table assignments(id text primary key,user_id text,clinic_id text,branch_id text);
  create table patients(id text primary key,user_id text,clinic_id text,branch_id text,mobile text,mobile_verified boolean default false,status text default 'active',data jsonb not null default '{}',created_at timestamptz default now());
  create table schedules(id text primary key,doctor_id text,clinic_id text,branch_id text,day_of_week int,status text default 'active',data jsonb not null default '{}');
  create table availability_exceptions(id text primary key,doctor_id text,branch_id text,date text,status text default 'active',data jsonb not null default '{}');
  create table appointments(id text primary key,patient_id text,doctor_id text,clinic_id text,branch_id text,date text,token_number int,status text default 'booked',request_id text,actor_id text,data jsonb not null default '{}',created_at timestamptz default now());
  create unique index token_unique on appointments(doctor_id,branch_id,date,token_number);
  create unique index active_patient_unique on appointments(patient_id,doctor_id,branch_id,date) where status not in ('cancelled','completed','noShow');
  create unique index current_unique on appointments(doctor_id,branch_id,date) where status in ('called','inConsultation');
  create unique index request_unique on appointments(actor_id,request_id);
  create table appointment_history(id text primary key,appointment_id text,actor_id text,from_status text,to_status text,created_at timestamptz default now());
  create table audit_logs(id text primary key,actor_id text,clinic_id text,branch_id text,action text,entity_type text,entity_id text,summary text,created_at timestamptz default now());
  create table settings(id text primary key,data jsonb not null default '{}');
  create table masters(id text primary key,category text,code text,parent_id text,status text default 'active',data jsonb not null default '{}');
`);
mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const staff = { id: "r", role: "receptionist", clinicIds: ["c"], branchIds: ["b", "b2"] };
const patient = { id: "u1", role: "patient", patientId: "p1", clinicIds: [], branchIds: [] };
async function seed() {
  await database.exec("truncate users,clinics,branches,doctors,assignments,patients,schedules,availability_exceptions,appointments,appointment_history,audit_logs,settings,masters");
  await api.put(t.users, { id: "du", email: "d@example.com", fullName: "Doctor", role: "doctor" });
  await api.put(t.users, { id: "du2", email: "d2@example.com", fullName: "Doctor Two", role: "doctor" });
  await api.put(t.users, { id: "admin", email: "admin@example.com", fullName: "Admin", role: "clinicAdmin" });
  await api.put(t.clinics, { id: "c", adminId: "admin", data: { name: "Clinic" } });
  for (const id of ["b", "b2"]) await api.put(t.branches, { id, clinicId: "c", data: { name: id, timezone: "UTC" } });
  for (const [id, userId, branchId] of [["d", "du", "b"], ["d2", "du2", "b2"]]) {
    await api.put(t.doctors, { id, userId, ownerAdminId: "admin" });
    await api.put(t.assignments, { id, userId, clinicId: "c", branchId });
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) await api.put(t.schedules, { id: id + dayOfWeek, doctorId: id, clinicId: "c", branchId, dayOfWeek,
      data: { isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "UTC", consultationMinutes: 10, bufferMinutes: 5, maxTokens: 10, tokenPrefix: id === "d" ? "A" : "B" } });
  }
  for (let i = 1; i <= 4; i++) await api.put(t.patients, { id: "p" + i, userId: "u" + i, clinicId: "c", branchId: "b", data: { fullName: "Patient " + i }, mobile: "+1555555000" + i });
  await api.put(t.settings, { id: "platform", data: { cancellationCutoffMinutes: 0, bookingHorizonDays: 60 } });
}
async function route(router, method, path, actor, body = {}, params = {}, query = {}) {
  globalThis.phaseActor = actor;
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
  assert.ok(layer, path);
  let result;
  const response = { status: () => response, json: value => { result = value; } };
  await layer.route.stack[0].handle({ body, params, query }, response);
  return result;
}
async function book(patientId = "p1", date = today, extra = {}) {
  return route(api.appointmentsRouter, "post", "/appointments", staff, { patientId, doctorId: "d", branchId: "b", clinicId: "c", date, source: "phone", ...extra });
}
async function act(id, body, actor = staff) {
  return globalThis.phaseDb.transaction(tx => api.transition(actor, id, body, tx));
}
async function rows() { return api.all(t.appointments); }
async function queue(actor = patient, extra = {}) {
  return route(api.queueRouter, "get", "/queue", actor, {}, {}, { doctorId: "d", branchId: "b", date: today, ...extra });
}

test("real SQL reservation order survives reversed arrivals; absent reservations block both call paths", async () => {
  await seed();
  const a = await book(), b = await book("p2");
  await act(b.id, { action: "checkIn" }); await act(b.id, { action: "enqueue" });
  let q = await queue({ ...patient, patientId: "p2" });
  assert.equal(q.ownEntry.patientsAhead, 1);
  assert.equal(q.ownEntry.estimatedWaitMinutes, 10, "no five-minute buffer");
  assert.equal(q.reserved, 2); assert.equal(q.arrived, 1); assert.equal(q.entries, undefined);
  assert.equal(q.blockedByAbsentReservation, true);
  await assert.rejects(act(b.id, { action: "call" }), /Earlier reservation/);
  await assert.rejects(route(api.queueRouter, "post", "/queue/call-next", staff, { doctorId: "d", branchId: "b", date: today }), /Earlier reservation/);
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
  await act(c.id, { action: "checkIn" });
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
  const a = await book(); await act(a.id, { action: "checkIn" }); await act(a.id, { action: "enqueue" });
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
  assert.ok(final.status === "booked" && final.date === tomorrow || final.status === "checkedIn" && final.date === today);
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
  for (const appointment of [a, b]) {
    await act(appointment.id, { action: "checkIn" });
    await act(appointment.id, { action: "enqueue" });
  }
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
  assert.equal(q.currentToken, null); assert.equal(q.nextToken, b.token);
  assert.equal(q.completed, 1);
  assert.ok(q.nextToken && !q.currentToken && !q.blockedByAbsentReservation, "next call is enabled after completion");
});