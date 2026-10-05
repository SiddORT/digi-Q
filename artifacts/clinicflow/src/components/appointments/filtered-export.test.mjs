import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { runInNewContext } from "node:vm";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const formatter = moduleUrl(compile(read("../../lib/date-time.ts")));
const { collectFilteredAppointments, filteredAppointmentsCsv } = await import(moduleUrl(compile(read("./filtered-export.ts")).replace('"../../lib/date-time"', JSON.stringify(formatter))));
const row = id => ({ id, reference: `R${id}`, patientName: "Test patient", clinicName: "Test group", branchName: "Test clinic", doctorName: "Test doctor", date: "2026-09-30", startTime: "09:00", endTime: "14:00", token: id, status: "booked" });

test("filtered export reads every authorized page with unchanged filters and sort", async () => {
  const params = { search: "query", from: "2026-09-01", to: "2026-10-01", clinicId: "c", branchId: "b", doctorId: "d", sessionId: "s", startTime: "09:00", statusGroup: "waiting", sort: "-date", page: 7, pageSize: 20 };
  const requests = [];
  const progress = [];
  const signal = new AbortController().signal;
  const records = await collectFilteredAppointments(params, async (batch, receivedSignal) => {
    assert.equal(receivedSignal, signal);
    requests.push(batch);
    return { items: batch.page === 1 ? Array.from({ length: 100 }, (_, i) => row(String(i))) : [row("100")], total: 101 };
  }, signal, (loaded, total) => progress.push([loaded, total]));
  assert.equal(records.length, 101);
  assert.deepEqual(requests, [{ ...params, page: 1, pageSize: 100 }, { ...params, page: 2, pageSize: 100 }]);
  assert.deepEqual(progress, [[100, 101], [101, 101]]);
  assert.equal(params.page, 7);
});

test("export rejects changed totals, duplicates, premature empty pages and invalid metadata", async () => {
  for (const batches of [
    [{ items: [row("1")], total: 2 }, { items: [row("2")], total: 3 }],
    [{ items: [row("1")], total: 2 }, { items: [row("1")], total: 2 }],
    [{ items: [row("1")], total: 2 }, { items: [], total: 2 }],
    [{ items: [row("1")], total: undefined }],
    [{ items: [row("1")], total: 0 }],
  ]) {
    await assert.rejects(collectFilteredAppointments({}, async () => batches.shift(), new AbortController().signal), /Export could not verify|Appointments changed/);
  }
});

test("empty results remain empty; API failures are not partial-success exports", async () => {
  assert.deepEqual(await collectFilteredAppointments({}, async () => ({ items: [], total: 0 }), new AbortController().signal), []);
  await assert.rejects(collectFilteredAppointments({}, async () => { throw new Error("Failure"); }, new AbortController().signal), /Failure/);
});

test("cancel stops before a request and after an in-flight request", async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  await assert.rejects(collectFilteredAppointments({}, async () => { requests++; }, controller.signal), { name: "AbortError" });
  assert.equal(requests, 0);
  const active = new AbortController();
  await assert.rejects(collectFilteredAppointments({}, async () => {
    active.abort();
    return { items: [row("1")], total: 1 };
  }, active.signal), { name: "AbortError" });
});

test("CSV uses each appointment's clinic format, quotes safely and neutralizes formulas", () => {
  const csv = filteredAppointmentsCsv([
    { ...row("1"), patientName: '=formula,"quoted"', dateFormat: "MM/DD/YYYY", timeFormat: "24h" },
    { ...row("2"), dateFormat: "DD MMM YYYY", timeFormat: "12h" },
  ]);
  assert.ok(csv.includes('"09/30/2026","09:00","14:00"'));
  assert.ok(csv.includes('"30 Sep 2026","9:00 AM","2:00 PM"'));
  assert.ok(csv.includes(`"'=formula,""quoted"""`));
});

test("new export and updated listing callers parse as TSX", () => {
  for (const file of ["./FilteredAppointmentExport.tsx", "./BulkAppointments.tsx", "../../clinic.tsx", "../queue/SessionQueue.tsx"]) {
    const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(tree.parseDiagnostics, [], file);
  }
});

test("export control supports cancel, ignores list pagination changes and blocks pending search", () => {
  const component = read("./FilteredAppointmentExport.tsx");
  assert.match(component, /page: _page, pageSize: _pageSize, \.\.\.filters/);
  assert.match(component, /controller\.current\?\.abort\(\)/);
  assert.match(component, /request\.signal\.throwIfAborted\(\)/);
  assert.match(component, /No file was downloaded/);
  assert.match(component, /if \(!records\.length\)/);
  assert.match(component, /\[context, contextKey\]/);
  assert.match(read("../../clinic.tsx"), /contextKey=\{search\}/);
  assert.match(read("../../clinic.tsx"), /FilteredAppointmentExport params=\{params\}[^>]*search!==debounced/);
  const bulk = read("./BulkAppointments.tsx");
  assert.match(bulk, /Export CSV/);
  assert.match(bulk, /this page only/);
  assert.match(bulk, /[Rr]ows on other pages are not included/);
});

test("queue clear-all resets optional list filters, not required session or page size", () => {
  const source = read("../queue/SessionQueue.tsx");
  const tree = ts.createSourceFile("queue.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let clear;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "clearListFilters") clear = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const calls = [];
  runInNewContext(compile(`(${clear})`), Object.fromEntries(["setSearch", "setStatus", "setSort", "setPage"].map(key => [key, value => calls.push([key, value])])) )();
  assert.deepEqual(calls, [["setSearch", ""], ["setStatus", ""], ["setSort", "queueRank"], ["setPage", 1]]);
  assert.match(source, /chips=\{filterChips\}/);
  assert.match(source, /button-clear-empty-queue-search/);
});

test("report headers and assigned clinic sorting use supported server parameters", () => {
  const clinic = read("../../clinic.tsx");
  assert.match(clinic, /sort:assignedSort/);
  assert.match(clinic, /useEffect\(\(\)=>setPage\(1\),\[assignedSort\]\)/);
  for (const field of ["appointments", "registrations", "averageWaitMinutes", "averageConsultationMinutes"]) {
    assert.ok(clinic.includes(`reportHeader("${field}"`));
  }
  assert.match(clinic, /groupBy==="date"\?"key":"label"/);
  assert.match(clinic, /search:debounced\|\|undefined,sort/);
  assert.doesNotMatch(clinic, /availableClinics\.sort|assignedClinics\.sort/);
});