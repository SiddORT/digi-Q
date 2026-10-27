import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const { outputFiles } = await build({ entryPoints: [new URL("./lib/arrival-estimate.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false });
const { arrivalEstimate } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
const row = (id, rank, extra = {}) => ({ id, queueRank: rank, tokenNumber: 100 - rank, status: "waiting", doctorId: "d", branchId: "b", date: "2030-01-07", startTime: "10:00", endTime: "16:00", timezone: "UTC", ...extra });
const now = time => Date.parse(`2030-01-07T${time}:00Z`);
const estimate = (a, rows, time = "09:00", duration = 30, presence = "available") => arrivalEstimate(a, rows, duration, presence, now(time));

test("three ahead means 90 minutes and 11:20; third in line means 60 and 10:50", () => {
  const rows = [row("a", 1), row("b", 2), row("c", 3), row("d", 4)];
  assert.equal(estimate(rows[3], rows).waitMinutes, 90);
  assert.equal(estimate(rows[3], rows).suggestedArrival, "11:20");
  assert.equal(estimate(rows[2], rows).waitMinutes, 60);
  assert.equal(estimate(rows[2], rows).suggestedArrival, "10:50");
  assert.equal(estimate(rows[2], rows).basis, "sessionStart");
});
test("queue ranks, equal-rank tie breaks and separate sessions ignore printed token magnitude", () => {
  const a = row("a", 3, { tokenNumber: 1 }), b = row("b", 1, { tokenNumber: 99 });
  assert.equal(estimate(a, [a, b, row("other", 0, { startTime: "17:00" })]).patientsAhead, 1);
  assert.equal(estimate(a, [a, { ...b, queueRank: 3, tokenNumber: 2 }]).patientsAhead, 0);
});
test("active sessions anchor to now; arrivals never drift into the past", () => {
  const a = row("a", 1), b = row("b", 2);
  const result = estimate(b, [a, b], "12:00");
  assert.equal(result.basis, "remainingQueue");
  assert.equal(result.waitMinutes, 30);
  assert.equal(result.suggestedArrival, "12:20");
  assert.equal(estimate(a, [a, b], "12:00").suggestedArrival, "12:00");
});
test("ongoing consultation uses its remaining snapshotted duration conservatively", () => {
  const active = row("a", 1, { status: "inConsultation", consultationStartedAt: "2030-01-07T10:00:00Z" });
  const pending = row("b", 2);
  const result = estimate(pending, [active, pending], "10:10");
  assert.equal(result.patientsAhead, 1);
  assert.equal(result.waitMinutes, 20);
  assert.equal(result.suggestedArrival, "10:20");
  assert.equal(estimate(pending, [active, pending], "10:31").waitMinutes, null);
  assert.equal(estimate(pending, [{ ...active, consultationStartedAt: null }, pending], "10:10").suggestedArrival, null);
});
test("called/current rows and missing, null or invalid duration never invent a pending time", () => {
  const a = row("a", 1, { status: "called", calledAt: "2030-01-07T10:00:00Z" });
  assert.equal(estimate(a, [a], "10:10").waitMinutes, 0);
  for (const duration of [null, 0, -1, NaN]) assert.equal(estimate(row("b", 2), [a, row("b", 2)], "10:10", duration).suggestedArrival, null);
});
test("pauses, configured breaks and beyond-closing estimates are explicit", () => {
  const a = row("a", 1), b = row("b", 2);
  for (const status of ["onBreak", "away"]) assert.equal(estimate(b, [a, b], "11:00", 30, status).state, "paused");
  const scheduled = { ...b, breakStart: "11:00", breakEnd: "11:30" };
  assert.equal(estimate(scheduled, [a, scheduled], "11:10").state, "paused");
  const afterBreak = { ...b, breakStart: "10:15", breakEnd: "10:45" };
  assert.equal(estimate(afterBreak, [a, afterBreak]).waitMinutes, 60);
  const closing = { ...b, endTime: "10:20" };
  assert.equal(estimate(closing, [a, closing]).beyondSessionEnd, true);
  assert.equal(estimate(closing, [a, closing]).suggestedArrival, null);
});
test("session-local date and timezone govern pre-session/ended boundaries", () => {
  const a = row("a", 1, { timezone: "Asia/Kolkata" });
  assert.equal(estimate(a, [a], "04:00").basis, "sessionStart");
  assert.equal(estimate(a, [a], "04:30").basis, "remainingQueue");
  assert.equal(estimate(a, [a], "11:00").state, "ended");
  assert.equal(estimate({ ...a, timezone: "Invalid/Zone" }, [a]).state, "unavailable");
});
test("terminal and missing session snapshots suppress guidance", () => {
  for (const status of ["completed", "cancelled", "noShow"]) {
    const a = row("a", 1, { status });
    assert.equal(estimate(a, [a]).state, "terminal");
    assert.equal(estimate(a, [a]).waitMinutes, null);
  }
  for (const patch of [{ timezone: null }, { startTime: null }, { endTime: "09:00" }]) {
    const a = row("a", 1, patch);
    assert.equal(estimate(a, [a]).suggestedArrival, null);
  }
});
test("daylight-saving gaps are rejected and elapsed estimates cross valid transitions correctly", () => {
  const a = row("a", 1, { date: "2030-03-10", startTime: "01:30", endTime: "06:00", timezone: "America/New_York" });
  const b = { ...a, id: "b", queueRank: 2 }, c = { ...a, id: "c", queueRank: 3 };
  const result = arrivalEstimate(c, [a,b,c], 30, "available", Date.parse("2030-03-10T05:00:00Z"));
  assert.equal(result.waitMinutes, 60);
  assert.equal(result.suggestedArrival, "03:20");
  const gap = { ...a, startTime: "02:30" };
  assert.equal(arrivalEstimate(gap, [gap], 30, "available", Date.parse("2030-03-10T05:00:00Z")).state, "unavailable");
});
