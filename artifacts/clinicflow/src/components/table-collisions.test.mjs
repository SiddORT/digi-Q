import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const css = ["./uniformity.css", "./compact-listing.css", "./admin-listing.css", "../index.css"].map(read).join("\n");
const rows = read("./appointments/AppointmentRows.tsx");
const columns = read("./TableColumns.tsx");

test("section D: every essential appointment column has an intentional width so cells cannot collide", () => {
  for (const key of ["date", "patient", "token", "location", "doctor"]) {
    assert.match(css, new RegExp(`\\.appt-table[^{]*\\.col-${key}\\s*\\{[^}]*(min-)?width:\\s*\\d+px`), `missing width for col-${key}`);
  }
});
test("section D: tables scroll horizontally instead of overlapping; actions stay contained", () => {
  assert.match(css, /\.table-scroll\{overflow-x:auto/);
  assert.match(css, /col-actions[^{]*\{[^}]*white-space:nowrap/);
  assert.match(rows, /className="col-actions sticky"/);
});
test("section D: column classes come from one shared helper (no ad-hoc per-table class names)", () => {
  assert.match(columns, /`col-\$\{key\}`/);
  assert.match(rows, /table-scroll appt-table/);
});
test("section D: essential date/doctor/location are visible text lines, not tooltip-only", () => {
  assert.match(rows, /formatDate\(a\.date,a\)/);
  assert.match(rows, /a\.doctorName/);
  assert.match(rows, /a\.branchName/);
});
