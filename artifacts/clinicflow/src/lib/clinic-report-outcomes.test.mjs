import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { reportOtherVisits, reportOutcomeSummary } from "./clinic-report-outcomes.ts";

test("reported 13 visits reconcile including the two unlisted outcomes", () => {
  const row = { appointments: 13, completed: 8, cancelled: 1, noShow: 2 };
  assert.equal(reportOtherVisits(row), 2);
  assert.equal(row.completed + row.cancelled + row.noShow + reportOtherVisits(row), 13);
});
test("empty and entirely active groups reconcile without inventing terminal outcomes", () => {
  assert.equal(reportOtherVisits({ appointments: 0, completed: 0, cancelled: 0, noShow: 0 }), 0);
  assert.equal(reportOtherVisits({ appointments: 9, completed: 0, cancelled: 0, noShow: 0 }), 9);
});
test("inconsistent API totals surface explicitly rather than silently clamping", () => {
  const row = { appointments: 1, completed: 2, cancelled: 0, noShow: 0 };
  assert.equal(reportOtherVisits(row), -1);
  assert.match(reportOutcomeSummary(row), /inconsistent/);
});
const source = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
test("UI and existing CSV export share the residual outcome calculation", () => {
  assert.match(source, /reportOutcomeSummary\(r\)/);
  assert.match(source, /key==="other"\?reportOtherVisits\(row\)/);
  assert.match(source, /api\.getReports\(\{\.\.\.params,page:exportPage/);
});
test("legacy page size is retained alongside the approved 25 option", () => {
  assert.match(source, /\[10,20,25,50,100\]/);
  assert.match(source, /Number\(initialSearch\.get\("size"\)\):20/);
});
test("no browser alert or verification code leaks remain", () => {
  assert.doesNotMatch(source, /window\.alert|developmentCode|Development-only code/);
  assert.match(source, /DigiQ-report-/);
  assert.match(source, /DigiQ-appointment-/);
});