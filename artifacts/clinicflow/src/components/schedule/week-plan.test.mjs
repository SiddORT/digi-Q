import assert from "node:assert/strict";
import test from "node:test";
import { buildWeek, planWeek, copyDay, dayErrors, dayWarnings, weekSummary, outsideHours, executePlan, reconcileDraft } from "./week-plan.ts";
const L = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const base = { doctorId: "d", clinicId: "c", branchId: "b", tokenPrefix: "A", maxTokens: 20, consultationMinutes: 15, isOpen: true, status: "active" };
const rows = [{ ...base, id: "1", dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, { ...base, id: "2", dayOfWeek: 2, startTime: "09:00", endTime: "12:00", linkedBranchId: "b" }, { ...base, id: "3", dayOfWeek: 3, startTime: "16:00", endTime: "19:30" }];
const sess = (n, start = 6) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, startTime: `${String(start + i * 2).padStart(2, "0")}:00`, endTime: `${String(start + i * 2 + 1).padStart(2, "0")}:00` }));
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
