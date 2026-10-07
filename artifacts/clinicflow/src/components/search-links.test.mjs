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
  assert.match(s, /appointmentHref\(role, a\)/);
  assert.match(s, /api\.getReports\(\{ \.\.\.range, groupBy, search, page, pageSize \}/);
  assert.match(s, /\$\{range\.from\} to \$\{range\.to\}/, "date range is shown");
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

import { permittedCategories, countLabel, canLoadMore, recordHref, appointmentHref } from "../lib/search-categories.ts";
test("search categories: permissions, honest counts, exact-record links", () => {
  assert.deepEqual(permittedCategories("patient", ["appointments", "book"]), ["appointments"]);
  assert.deepEqual(permittedCategories("receptionist", ["patients", "appointments", "queue"]), ["patients", "appointments"], "queue never adds a duplicate appointments group");
  assert.equal(countLabel(3, 47), "Showing 3 of 47");
  assert.equal(countLabel(2, 2), "2 matches");
  assert.equal(countLabel(0, 0), "No matches");
  assert.equal(canLoadMore(10, 47), true); assert.equal(canLoadMore(47, 47), false); assert.equal(canLoadMore(100, 400), false);
  assert.equal(new URL(recordHref("admin", "patients", "p1", "Asha Rao"), "http://x").searchParams.get("open"), "p1");
  assert.equal(new URL(appointmentHref("doctor", { id: "a1", reference: "REF" }), "http://x").searchParams.get("appointment"), "a1");
});

test("search sources: distinct record types, exact summed totals, cap hands off to the full listing", async () => {
  const m = await import("../lib/search-categories.ts");
  assert.deepEqual(m.categorySources("staff", "admin"), ["receptionists", "clinicAdmins", "doctors"]);
  assert.deepEqual(m.categorySources("staff", "clinic"), ["receptionists"]);
  assert.equal(m.categoryTotal([3, 0, 12]), 15);
  assert.equal(m.categoryTotal([3, null]), null, "no total claimed until every source reports");
  assert.equal(m.reachedCap(100, 240), true);
  assert.equal(m.reachedCap(40, 240), false);
  assert.equal(m.canLoadMore(100, 240), false);
  assert.ok(!m.recordHref("admin", "availability", "s9", "", { doctorId: "d1", branchId: "b1" }).includes("search="));
  const ws = read("./WorkspaceSearch.tsx");
  assert.match(ws, /search-full-\$\{source\}/);
  assert.match(ws, /api\.searchRecords\(\{ q: search \}, options\)\.then\(d => \(\{ total: null/, "queue-only search kept, no invented total");
  assert.doesNotMatch(ws, /catch\(\(\) => \(\{ items: \[\]/, "errors are never swallowed into empty results");
  assert.match(ws, /timeZone: settings\.data\.timezone/);
});

test("exact links fetch the target by id, not only when on the current page", () => {
  const res = read("../resources.tsx"), users = read("../Users.tsx"), rows = read("./appointments/AppointmentRows.tsx");
  for (const s of ["api.getPatient(openId)", "api.getClinic(openId)", "api.getBranch(openId)", "api.getDoctor(openId)", "api.getUser(openId)", "scanScopedPages(openId"]) assert.ok(res.includes(s), s);
  assert.match(res, /<RecordFacts facts=\{recordFacts\(row,/);
  assert.match(users, /api\.getDoctor\(linkedId\) : api\.getUser\(linkedId\)/);
  assert.match(rows, /useGetAppointment\(linkedId,\{query:\{queryKey:api\.getGetAppointmentQueryKey\(linkedId\),enabled:offPageLinked/);
  assert.match(read("../clinic.tsx"), /from=\$\{today\(timezone\)\}&to=\$\{today\(timezone\)\}/);
});

test("ticket screen and export share one model and one token set", async () => {
  const t = await import("./tickets/ticket-model.ts");
  const vars = t.ticketCssVars();
  assert.equal(vars["--vt-qr-size"], t.TICKET_THEME.qrSize);
  assert.ok(t.ticketCssVarString().includes(`--vt-accent:${t.TICKET_THEME.accent}`));
  const m = t.ticketModel({ patientName: "Mira Okafor", clinicName: "Harbor", branchName: "Pier 3", doctorName: "Dr Lune", waitingNumber: "A-07", reference: "QX12", dateText: "5 Oct", sessionText: "09:00–11:00" });
  assert.equal(m.reference, "Ref QX12");
  assert.equal(m.visitPrimary, "5 Oct · Pier 3");
});

test("records without an id endpoint use an abortable scoped scan to the end of the list", async () => {
  const { scanScopedPages } = await import("./RecordDetails.tsx").catch(() => ({}));
  const src = read("./RecordDetails.tsx");
  assert.match(src, /for \(let page = 1; ; page\+\+\)/);
  assert.match(src, /page \* pageSize >= result\.total\) throw new Error\(notFound\)/);
  assert.match(src, /signal\.aborted/);
  void scanScopedPages;
  const res = read("../resources.tsx");
  assert.match(res, /scanScopedPages\(openId,\(page,sig\)=>api\.listSchedules\(\{doctorId:filters\.doctorId\|\|undefined,branchId:filters\.branchId\|\|undefined,page/);
  assert.match(res, /scanScopedPages\(openId,\(page,sig\)=>api\.listAuditLogs\(\{search:linkedSearch\|\|undefined,page/);
  assert.match(read("./WorkspaceSearch.tsx"), /recordHref\(role, "audit", a\.id, search\)/);
  assert.match(read("../clinic.tsx"), /setTo\(range\.to\);setPage\(1\);/);
});
