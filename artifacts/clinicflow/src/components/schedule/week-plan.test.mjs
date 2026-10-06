import assert from "node:assert/strict";
import test from "node:test";
import { buildWeek, planWeek, copyDay, dayErrors, dayWarnings, weekSummary, outsideHours, executePlan, reconcileDraft } from "./week-plan.ts";
const L = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const base = { doctorId: "d", clinicId: "c", branchId: "b", tokenPrefix: "A", maxTokens: 20, consultationMinutes: 15, isOpen: true, status: "active" };
const rows = [{ ...base, id: "1", dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, { ...base, id: "2", dayOfWeek: 2, startTime: "09:00", endTime: "12:00", linkedBranchId: "b" }, { ...base, id: "3", dayOfWeek: 3, startTime: "16:00", endTime: "19:30" }];
const sess = (n, start = 6) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, startTime: `${String(start + i * 2).padStart(2, "0")}:00`, endTime: `${String(start + i * 2 + 1).padStart(2, "0")}:00` }));
test("copying short hours into all-day sessions fits queue windows on updates and creates",()=>{
 const source=[{...base,id:"wide",dayOfWeek:1,startTime:"00:00",endTime:"23:59",queueOpenTime:"00:00",queueCloseTime:"23:59"},{...base,id:"short",dayOfWeek:3,startTime:"09:00",endTime:"10:00"}];
 const p=planWeek(source,copyDay(buildWeek(source),3,[1,2]),source[0],L);
 for(const write of [...p.updates,...p.creates]){
  assert.equal(write.body.endTime,"10:00");
  assert.equal(write.body.queueCloseTime,"10:00");
  assert.equal(write.body.queueOpenTime,"00:00");
 }
 assert.equal(p.updates.length,1);assert.equal(p.creates.length,1);
});
test("moving a session beyond its old queue window resets invalid boundaries",()=>{
 const source=[{...base,id:"old",dayOfWeek:1,startTime:"16:00",endTime:"19:00",queueOpenTime:"15:00",queueCloseTime:"18:00"}];
 const week=buildWeek(source);week[1].sessions[0].startTime="09:00";week[1].sessions[0].endTime="10:00";
 const body=planWeek(source,week,source[0],L).updates[0].body;
 assert.equal(body.queueOpenTime,"09:00");assert.equal(body.queueCloseTime,"10:00");
});
const io = (fail = () => false) => { const calls = []; let n = 0; return { calls, update: async (id, b) => { calls.push(["update", id]); if (fail("update", id, b)) throw new Error("x"); }, create: async b => { calls.push(["create", b.startTime]); if (fail("create", b.startTime, b)) throw new Error("x"); return { id: `new${++n}` }; }, deactivate: async id => { calls.push(["deactivate", id]); if (fail("deactivate", id)) throw new Error("x"); }, message: () => "Unable to save changes" }; };

test("unchanged week produces no writes", () => {
  const p = planWeek(rows, buildWeek(rows), rows[0], L);
  assert.deepEqual([p.creates.length, p.updates.length, p.deactivations.length], [0, 0, 0]);
});
test("more than four sessions is a soft warning, not an error, and all are planned", () => {
  const day = { dayOfWeek: 4, isOpen: true, sessions: sess(6) };
  assert.equal(dayErrors(day).length, 0); assert.equal(dayWarnings(day).length, 1);
  const w = buildWeek(rows); w[4] = day;
  assert.equal(planWeek(rows, w, rows[0], L).creates.length, 6);
});
test("replacement on a day reuses the removed record as an update, never deactivate-then-create", () => {
  const w = buildWeek(rows); w[1].sessions = [{ key: "n", startTime: "10:00", endTime: "13:00" }];
  const p = planWeek(rows, w, rows[0], L);
  assert.equal(p.deactivations.length, 0); assert.equal(p.creates.length, 0); assert.equal(p.updates[0].id, "1"); assert.equal(p.updates[0].body.endTime, "13:00");
});
test("linked sessions are never written; real removals become deactivations", () => {
  const w = buildWeek(rows); w[2].isOpen = false; w[3].isOpen = false;
  const p = planWeek(rows, w, rows[0], L);
  assert.deepEqual(p.deactivations.map(d => d.id), ["3"]); assert.equal(p.updates.length, 0);
});
test("failed create blocks deactivations and keeps failed edits for retry", async () => {
  const w = buildWeek(rows); w[3].isOpen = false; w[1].sessions.push({ key: "n", startTime: "16:00", endTime: "20:00" }); w[1].sessions[0].endTime = "12:32";
  const p = planWeek(rows, w, rows[0], L);
  const r = await executePlan(p, io((kind) => kind === "create"));
  assert.ok(!r.outcomes.find(o => o.label.startsWith("Deactivate")).ok); assert.ok(r.outcomes.find(o => o.label.startsWith("Deactivate")).skipped);
  assert.ok(!io().calls.length);
  const kept = reconcileDraft(w, r.savedIds);
  const stored = rows.map(x => x.id === "1" ? { ...x, endTime: "12:32" } : x);
  const retry = planWeek(stored, kept, rows[0], L);
  assert.equal(retry.creates.length, 1); assert.equal(retry.updates.length, 0); assert.deepEqual(retry.deactivations.map(d => d.id), ["3"]);
});
test("successful create attaches id so retry does not duplicate", async () => {
  const w = buildWeek(rows); w[5] = { dayOfWeek: 5, isOpen: true, sessions: sess(2, 9) };
  const r = await executePlan(planWeek(rows, w, rows[0], L), io((k, t) => k === "create" && t === "11:00"));
  const stored = [...rows, { ...base, id: "new1", dayOfWeek: 5, startTime: "09:00", endTime: "10:00" }];
  const retry = planWeek(stored, reconcileDraft(w, r.savedIds), rows[0], L);
  assert.equal(retry.creates.length, 1); assert.equal(retry.creates[0].body.startTime, "11:00");
});
test("execution order: updates, creates, then deactivations", async () => {
  const w = buildWeek(rows); w[1].sessions[0].startTime = "08:00"; w[6] = { dayOfWeek: 6, isOpen: true, sessions: sess(1, 9) }; w[3].isOpen = false;
  const x = io(); await executePlan(planWeek(rows, w, rows[0], L), x);
  assert.deepEqual(x.calls.map(c => c[0]), ["update", "create", "deactivate"]);
});
test("copy keeps target linked sessions and reuses ids", () => {
  const w = copyDay(buildWeek(rows), 1, [2, 3]);
  assert.ok(w[2].sessions.some(s => s.locked)); assert.equal(w[3].sessions[0].id, "3");
});
test("validation and summary", () => {
  assert.equal(dayErrors({ dayOfWeek: 1, isOpen: true, sessions: [{ key: "a", startTime: "09:00", endTime: "12:00" }, { key: "b", startTime: "11:00", endTime: "13:00" }] }).length, 1);
  assert.equal(dayErrors({ dayOfWeek: 1, isOpen: true, sessions: [{ key: "a", startTime: "12:00", endTime: "09:00" }] }).length, 1);
  assert.ok(outsideHours({ key: "a", startTime: "18:00", endTime: "20:32" }, [{ startTime: "09:00", endTime: "19:30" }]));
  assert.match(weekSummary(buildWeek(rows), L, t => t), /^Mon–Tue: 09:00 – 12:00\. Wed: 16:00 – 19:30\. Thu–Sun: Off\.$/);
});
import { canOpenDetails, openDetails } from "./week-plan.ts";
test("linked session Details never calls the generic editor", () => {
  const calls = [];
  openDetails(rows[1], r => calls.push(r.id)); openDetails({ ...rows[1], isOpen: false }, r => calls.push(r.id)); openDetails(undefined, r => calls.push(r));
  assert.deepEqual(calls, []); assert.equal(canOpenDetails(rows[1]), false);
  openDetails(rows[0], r => calls.push(r.id)); assert.deepEqual(calls, ["1"]);
});
test("section F: weekday omitted from a configured plan is outside-hours (warning), unconfigured is never outside", () => {
  assert.equal(outsideHours({ key: "a", startTime: "08:00", endTime: "12:00" }, [], true), true);
  assert.equal(outsideHours({ key: "a", startTime: "08:00", endTime: "12:00" }, [], false), false);
  assert.equal(outsideHours({ key: "a", startTime: "09:00", endTime: "12:00" }, [{ startTime: "09:00", endTime: "17:00" }], true), false);
  assert.equal(outsideHours({ key: "a", startTime: "15:00", endTime: "18:00" }, [{ startTime: "09:00", endTime: "17:00" }], true), true);
});
import { scheduleReadiness } from "./week-plan.ts";
import { exceptionImpact } from "./exception-impact.ts";
test("section F readiness: hours alone never imply availability; absent hours are not closure", () => {
  assert.equal(scheduleReadiness([], [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }]).ready, false);
  const none = scheduleReadiness([{ isOpen: true, maxTokens: 5 }], null);
  assert.equal(none.ready, true); assert.match(none.notes[0], /No location hours configured/); assert.doesNotMatch(none.notes.join(), /closed/i);
  assert.match(scheduleReadiness([{ isOpen: true, maxTokens: 5 }], []).missing[0], /closed on all days/);
});
test("section F exception impact preview counts day-off and out-of-window bookings", () => {
  const rows = [{ status: "booked", startTime: "09:00" }, { status: "waiting", startTime: "16:00" }, { status: "cancelled", startTime: "10:00" }];
  assert.equal(exceptionImpact(rows, { isClosed: true }).affected, 2);
  assert.equal(exceptionImpact(rows, { startTime: "08:00", endTime: "12:00" }).affected, 1);
  assert.match(exceptionImpact([], { isClosed: true }).message, /No active bookings/);
});
import { prefillFromHours } from "./week-plan.ts";
test("F: copy location hours once fills the draft, keeps linked sessions, reuses ids, respects absent vs explicit closure", () => {
  const week = buildWeek([{ id: "s1", dayOfWeek: 1, startTime: "10:00", endTime: "11:00" }, { id: "L", dayOfWeek: 2, startTime: "09:00", endTime: "12:00", linkedBranchId: "b" }, { id: "s3", dayOfWeek: 3, startTime: "08:00", endTime: "09:00" }]);
  const opening = [{ dayOfWeek: 1, startTime: "09:00", endTime: "13:00" }, { dayOfWeek: 1, startTime: "16:00", endTime: "19:00" }, { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" }, { dayOfWeek: 2, startTime: "15:00", endTime: "18:00" }];
  const next = prefillFromHours(week, opening);
  assert.deepEqual(next[1].sessions.map(s => [s.id, s.startTime, s.endTime]), [["s1", "09:00", "13:00"], [undefined, "16:00", "19:00"]]);
  assert.ok(next[2].sessions.some(s => s.locked && s.startTime === "09:00"));
  assert.equal(next[2].sessions.filter(s => s.startTime === "09:00").length, 1); // overlap with linked skipped
  assert.deepEqual(next[3], week[3]); // weekday absent from hours is not treated as closed
  const closed = prefillFromHours(week, []);
  assert.equal(closed[3].isOpen, false); // explicit all-closed plan
});

test("applyWeekTo copies own intervals to another location, keeps its linked sessions, reuses ids", async () => {
  const { applyWeekTo, toOwnerSessions, buildWeek } = await import("./week-plan.ts");
  const source = buildWeek([{ id: "s1", dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, { id: "s2", dayOfWeek: 1, startTime: "14:00", endTime: "16:00" }]);
  const target = buildWeek([{ id: "t1", dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }, { id: "L", dayOfWeek: 1, startTime: "14:30", endTime: "15:00", linkedBranchId: "b" }, { id: "t2", dayOfWeek: 3, startTime: "10:00", endTime: "11:00" }]);
  const out = applyWeekTo(target, source);
  assert.deepEqual(out[1].sessions.map(s => [s.id, s.startTime, s.locked || false]), [["t1", "09:00", false], ["L", "14:30", true]]);
  assert.equal(out[3].isOpen, false);
  assert.deepEqual(toOwnerSessions([source, out]).map(s => [s.branchIndex, s.dayOfWeek, s.startTime]), [[0, 1, "09:00"], [0, 1, "14:00"], [1, 1, "09:00"], [1, 1, "14:30"]]);
});
