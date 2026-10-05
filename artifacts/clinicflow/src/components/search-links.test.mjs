import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queueRecordHref, reportSearchHref, reportSearchRange, parseReportParams } from "../lib/search-links.ts";
const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
const rec = { id: "a1", reference: "REF-A1", today: true, clinicId: "c1", branchId: "b1", doctorId: "d1", date: "2026-10-05", startTime: "09:00", sessionId: "s1" };

test("today's record opens the exact queue session with the visit selected", () => {
  const url = new URL(queueRecordHref("receptionist", rec, true), "http://x");
  assert.equal(url.pathname, "/receptionist/queue");
  assert.deepEqual(Object.fromEntries(url.searchParams), { clinic: "c1", branch: "b1", doctor: "d1", date: "2026-10-05", appointment: "a1", sessionId: "s1", startTime: "09:00" });
  assert.equal(queueRecordHref("doctor", { ...rec, today: false }, true), "/doctor/appointments?view=all&search=REF-A1");
  assert.equal(queueRecordHref("doctor", rec, false), "/doctor/appointments?view=all&search=REF-A1", "no queue access falls back to the record");
  assert.doesNotMatch(new URL(queueRecordHref("doctor", { ...rec, sessionId: null, startTime: null }, true), "http://x").search, /sessionId|startTime/);
});

test("report links round-trip group/from/to/search into Reports state", () => {
  const range = reportSearchRange("2026-10-05");
  assert.deepEqual(range, { from: "2026-09-06", to: "2026-10-05" });
  const href = reportSearchHref("admin", { groupBy: "doctor", ...range, search: "Dr Meera Rao" });
  assert.equal(href.split("?")[0], "/admin/reports");
  assert.deepEqual(parseReportParams(href.split("?")[1], "2026-10-05"), { from: "2026-09-06", to: "2026-10-05", groupBy: "doctor", search: "Dr Meera Rao" });
  assert.deepEqual(parseReportParams("from=2026-10-09&to=2026-10-01&group=evil", "2026-10-05"), { from: "2026-10-05", to: "2026-10-05", groupBy: "date", search: "" }, "inverted/invalid values fall back");
  assert.equal(parseReportParams("from=bad&to=2026-10-01", "2026-10-05").from, "2026-10-05");
});

test("global search wires both record groups; Reports initializes from the URL", () => {
  const s = read("./WorkspaceSearch.tsx");
  assert.match(s, /api\.searchRecords\(/);
  assert.match(s, /href: queueRecordHref\(role, r, navigation\.includes\("queue"\)\)/);
  assert.match(s, /api\.getReports\(\{ \.\.\.range, groupBy, search, page: 1, pageSize: 5 \}/);
  assert.match(s, /Reports · \$\{range\.from\} to \$\{range\.to\}/, "date range is shown");
  const block = s.slice(s.indexOf("api.searchRecords("), s.indexOf('add("patients"'));
  assert.doesNotMatch(block, /`\/\$\{role\}\/queue`/, "record results never use an unfiltered queue link");
  const c = read("../clinic.tsx");
  assert.match(c, /parseReportParams\(window\.location\.search,today\(\)\)/);
  assert.match(c, /useState\(initialReport\.search\)/);
  assert.match(c, /useState<"date"\|"clinic"\|"doctor">\(initialReport\.groupBy\)/);
  const q = read("./queue/SessionQueue.tsx");
  assert.match(q, /searchParams\.get\("appointment"\)/);
});

test("legacy device views stay local and import only on explicit action", () => {
  const s = read("../lib/listing-views.ts");
  assert.match(s, /legacyViews: layout\.views/);
  const imp = s.slice(s.indexOf("importLegacyView"), s.indexOf("canShare:"));
  assert.match(imp, /sanitizeViewFilters\(view\.filters, allowedFilterKeys\)/);
  assert.match(imp, /shareWithRole: false/);
  assert.doesNotMatch(imp, /set\(/, "import never rewrites or deletes the local record");
  assert.doesNotMatch(s, /useEffect/, "no automatic sync");
  const c = read("./ListingViewControls.tsx");
  assert.match(c, /data-testid=\{`button-import-view-\$\{v\.id\}`\}/);
  assert.match(c, /On This Device Only/);
  for (const f of ["../clinic.tsx", "../resources.tsx", "../Users.tsx", "./SystemUsers.tsx"]) assert.match(read(f), /onImport=\{\w+\.importLegacyView\}/, f);
});
