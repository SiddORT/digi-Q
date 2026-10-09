// Behavioural data tests (transpiled real source) + structural checks for the system-standard checklist batch.
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const load = rel => {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {}; new Function("exports", "require", out)(exports, () => ({})); return exports;
};
const day = load("./appointments/CalendarDayPanel.tsx");
const follow = load("./schedule/FollowLocationHours.tsx");

test("calendar day panel groups by doctor/location/session ids (not names) in chronological order", () => {
  const a = (id, doctorId, branchId, sessionId, startTime, tokenNumber, doctorName = "Dr Rao", branchName = "Main") => ({ id, doctorId, branchId, sessionId, doctorName, branchName, startTime, endTime: "23:00", tokenNumber, createdAt: `2030-01-01T00:00:0${id}Z` });
  const groups = day.groupBySession([
    a("1", "d1", "b1", "s-eve", "17:00", 2), a("2", "d1", "b1", "s-am", "09:00", 3), a("3", "d1", "b1", "s-am", "09:00", 1),
    a("4", "d2", "b1", "s-x", "09:00", 1),            // namesake doctor, different id: separate group
    a("5", "d1", "b2", "s-y", "09:00", 1),            // same doctor + same location name, different location id
    a("6", "d3", "b1", undefined, undefined, 1, "Dr Ann"), // untimed session sorts last
  ]);
  assert.equal(groups.length, 5);
  assert.deepEqual(groups.map(g => g.startTime ?? "-"), ["09:00", "09:00", "09:00", "17:00", "-"]);
  assert.deepEqual(groups.find(g => g.sessionId === "s-am").items.map(i => i.id), ["3", "2"]);
  assert.ok(new Set(groups.map(g => g.key)).size === 5);
});

test("day panel never silently caps: true pagination with honest visible counts", () => {
  assert.equal(day.DAY_PAGE_SIZE, 100);
  assert.equal(day.dayRangeLabel(1, 40, 40), "40 visits");
  assert.equal(day.dayRangeLabel(1, 100, 230), "1–100 of 230 visits");
  assert.equal(day.dayRangeLabel(3, 30, 230), "201–230 of 230 visits");
  const panel = read("./appointments/CalendarDayPanel.tsx");
  assert.match(panel, /page, pageSize: DAY_PAGE_SIZE/);
  assert.match(panel, /data-testid="button-calendar-day-next"/);
  assert.doesNotMatch(panel, /Showing the first/);
});

test("day booking link pre-fills date and care scope only (availability is checked by booking, not assumed)", () => {
  assert.equal(day.dayBookingHref("admin", "2030-01-08", { clinicId: "c1", branchId: "b1", doctorId: "d1", status: "waiting", search: "x" }), "/admin/book?date=2030-01-08&clinic=c1&branch=b1&doctor=d1");
  assert.equal(day.dayBookingHref("receptionist", "2030-01-08", {}), "/receptionist/book?date=2030-01-08");
  assert.match(read("../clinic.tsx"), /const \[date,setDate\]=useState\(\(\)=>\{const requested=queryParams\.get\("date"\)/);
});

test("calendar drill opens the day panel, keeps month/filters, and never rewrites list date filters automatically", () => {
  const src = read("../clinic.tsx");
  assert.doesNotMatch(src, /onDrill=\{d=>\{setFrom\(d\)/, "drill no longer switches to list");
  assert.doesNotMatch(src, /if\(mode==="calendar"\)\{setFrom\(monthStart\(calMonth\)\)/, "calendar month no longer writes list from/to/All Visits");
  assert.match(src, /onDrill=\{setCalDay\}/);
  assert.match(src, /<CalendarDayPanel date=\{calDay\}/);
  assert.match(src, /onOpenList=\{\(\)=>\{setFrom\(calDay\);setTo\(calDay\);setPage\(1\);setMode\("list"\);setCalDay\(""\);\}\}/, "Open in list is the explicit, secondary path");
  const panel = read("./appointments/CalendarDayPanel.tsx");
  assert.match(panel, /<AppointmentDetails appointment=\{a\} \/>/);
  assert.match(panel, /data-testid="button-calendar-day-open-list"/);
});

test("follow location hours: only owner/Super Admin, only for the owner's own doctor profile", () => {
  const e = follow.followEligibility;
  assert.equal(e({ role: "clinicAdmin", userId: "adm", clinicAdminId: "adm", doctorUserId: "adm" }).canToggle, true);
  assert.equal(e({ role: "superAdmin", userId: "sa", clinicAdminId: "adm", doctorUserId: "adm" }).canToggle, true);
  assert.equal(e({ role: "clinicAdmin", userId: "adm2", clinicAdminId: "adm", doctorUserId: "adm" }).canToggle, false, "foreign admin");
  assert.equal(e({ role: "doctor", userId: "docu", clinicAdminId: "adm", doctorUserId: "docu" }).canToggle, false, "doctor");
  assert.equal(e({ role: "clinicAdmin", userId: "adm", clinicAdminId: "adm", doctorUserId: "docu" }).canToggle, false, "another doctor cannot be linked (server: owner profile only)");
  const body = follow.linkBody({ id: "b1", name: "Main", address: "1 Road", clinicId: "c1" }, { enabled: true, maxTokens: 20, consultationMinutes: 10, tokenPrefix: "A", queueMode: "mixed" });
  assert.deepEqual(body, { branches: [{ id: "b1", name: "Main", address: "1 Road", linkedSchedule: { enabled: true, maxTokens: 20, consultationMinutes: 10, tokenPrefix: "A", queueMode: "mixed" } }] });
});

test("shared header: compact mobile filters, stable search slot, compact staff title with contextual help", () => {
  const bar = read("./ListingControls.tsx");
  assert.match(bar, /data-testid="button-toggle-quick-filters"/);
  assert.match(bar, /hidden=\{compactFilters && !filtersOpen\}/);
  const css = read("./uniformity.css");
  assert.match(css, /\.lh-search-row \.lh-search\{flex:0 1 480px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:var\(--control-lg\);min-width:var\(--control-lg\)/);
  const users = read("../Users.tsx");
  assert.match(users, /<FilterBar compactToolbar title=\{<h2>Staff<\/h2>\}/);
  assert.match(users, /<HelpTip label="About account status" text="Account status and invitation status are separate\./);
  assert.doesNotMatch(users, /<p className="listing-hint">Account status and invitation status/);
});
