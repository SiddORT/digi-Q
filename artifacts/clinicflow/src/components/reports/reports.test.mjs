import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { unlink } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as m from "./report-model.ts";

const metrics = o => ({ appointments: 10, completed: 6, cancelled: 2, noShow: 1, uniquePatients: 8, registrations: 3, waiting: 1, checkedIn: 0, averageWaitMinutes: null, averageConsultationMinutes: 12, consultationMinutes: 72, timedConsultations: 6, reschedules: 0, rescheduledAppointments: 0, activity: 0, ...o });
const row = (id, o = {}) => ({ id, date: "2026-10-21", label: "Daily Appointment Summary", group: "g", clinicId: "c1", clinic: "Kushan Clinic", type: "Appointments", family: "appointments", status: "available", metrics: metrics(), ...o });

test("presets and relative resolution use today", () => {
  assert.deepEqual(m.presetRange("7d", "2026-10-21"), { from: "2026-10-15", to: "2026-10-21" });
  assert.deepEqual(m.presetRange("month", "2026-10-21"), { from: "2026-10-01", to: "2026-10-21" });
  const f = m.resolveFilters({ preset: "7d", from: "2020-01-01", to: "2020-01-07" }, "2026-11-30", m.defaultFilters("2026-11-30"));
  assert.equal(f.from, "2026-11-24"); assert.equal(f.preset, "7d");
  const c = m.resolveFilters({ preset: "custom", from: "2026-01-01", to: "2026-01-09", reportType: "bogus", status: "noData", compare: "1" }, "2026-11-30", m.defaultFilters("2026-11-30"));
  assert.equal(c.from, "2026-01-01"); assert.equal(c.reportType, "all"); assert.equal(c.status, "noData"); assert.equal(c.compare, true);
});
test("comparison handles zero baseline and missing data", () => {
  assert.equal(m.compareValue(5, null).direction, "none");
  assert.match(m.compareValue(5, 0).text, /previous period had 0/);
  assert.equal(m.compareValue(0, 0).direction, "flat");
  assert.equal(m.compareValue(112, 100).text, "12.0% vs previous");
  assert.equal(m.compareValue(90, 100).direction, "down");
});
test("export is one exportAll snapshot with no paging", async () => {
  const calls = [];
  const out = await m.buildReportExport(async p => { calls.push(p); return { total: 2, rows: [row("a"), row("b", { label: "=SUM(1)" })] }; }, { from: "a", to: "b", page: 3, pageSize: 20, compare: true }, d => d);
  assert.equal(calls.length, 1); assert.equal(calls[0].exportAll, true); assert.equal(calls[0].page, undefined); assert.equal(calls[0].pageSize, undefined); assert.equal(calls[0].compare, false);
  assert.equal(out.rows, 2); assert.ok(out.csv.includes("\"'=SUM(1)\""));
});
test("export refuses incomplete or duplicate snapshots", async () => {
  await assert.rejects(m.buildReportExport(async () => ({ total: 3, rows: [row("a")] }), {}, d => d), /every result/);
  await assert.rejects(m.buildReportExport(async () => ({ total: 2, rows: [row("a"), row("a")] }), {}, d => d), /changed/);
  await assert.rejects(m.buildReportExport(async () => { throw new Error("net"); }, {}, d => d), /net/);
});
test("row csv and detail metrics cover every metric", () => {
  const csv = m.rowDetailCsv(row("a"), "21 Oct 2026");
  assert.equal(csv.split("\r\n").length, 2); assert.ok(csv.includes("Kushan Clinic"));
  assert.equal(m.METRIC_LABELS.length, Object.keys(metrics()).length);
  assert.equal(m.metricText(null, "min"), "Not available"); assert.equal(m.metricText(12, "min"), "12 min");
});
test("visit links keep scope or are omitted", () => {
  const a = { from: "2026-10-15", to: "2026-10-21", groupBy: "date", clinicId: "", branchId: "b1", doctorId: "d1" };
  const l = m.rowVisitsLink(row("a"), a, "admin", false);
  assert.match(l, /from=2026-10-21&to=2026-10-21/); assert.match(l, /clinic=c1/); assert.match(l, /branch=b1/); assert.match(l, /doctor=d1/);
  assert.equal(m.rowVisitsLink(row("a"), { ...a, groupBy: "doctor" }, "admin", false), null);
  assert.equal(m.rowVisitsLink(row("a"), a, "admin", true), null);
  assert.equal(m.rowVisitsLink(row("a", { family: "activity" }), a, "admin", false), null);
  assert.match(m.rowVisitsLink(row("a"), { ...a, groupBy: "clinic" }, "admin", false), /from=2026-10-15&to=2026-10-21/);
});

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
async function load(file) {
  const out = new URL(`../../../.rp-${file}-${process.pid}.mjs`, import.meta.url);
  try {
    await build({ entryPoints: [fileURLToPath(new URL(`./${file}.tsx`, import.meta.url))], outfile: fileURLToPath(out), bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", loader: { ".css": "empty" }, alias: { "@": fileURLToPath(new URL("../../", import.meta.url)) } });
    return await import(out.href);
  } finally { await unlink(out).catch(() => {}); }
}
test("KPI cards render totals, comparison and loading", async () => {
  const { ReportKpis } = await load("ReportKpis");
  const html = renderToStaticMarkup(createElement(ReportKpis, { summary: metrics({ appointments: 1240 }), previous: metrics({ appointments: 1000, cancelled: 0 }), compare: true, loading: false, stale: false }));
  assert.match(html, /1,240/); assert.match(html, /24\.0% vs previous/); assert.match(html, /previous period had 0/); assert.match(html, /rp-delta bad/);
  assert.match(renderToStaticMarkup(createElement(ReportKpis, { summary: metrics(), compare: false, loading: false, stale: false })), /Comparison off/);
  assert.match(renderToStaticMarkup(createElement(ReportKpis, { compare: false, loading: true, stale: false })), /kpi-appointments-loading/);
});
test("trend renders error and empty states", async () => {
  const { ReportTrendPanel } = await load("ReportTrendPanel");
  assert.match(renderToStaticMarkup(createElement(ReportTrendPanel, { compare: false, loading: false, error: true, onRetry() {} })), /could not be loaded/);
  const pt = { date: "2026-10-21", appointments: 0, completed: 0, cancelled: 0, noShow: 0, waiting: 0 };
  assert.match(renderToStaticMarkup(createElement(ReportTrendPanel, { points: [pt], compare: false, loading: false, error: false, onRetry() {} })), /text-trend-empty/);
});
test("templates list families, saved configurations and empty state", async () => {
  const { ReportTemplates } = await load("ReportTemplates");
  const base = { onOpen() {}, onOpenUsage() {}, onOpenSaved() {}, onDeleteSaved() {}, canUsage: true };
  const none = renderToStaticMarkup(createElement(ReportTemplates, { ...base, saved: [] }));
  assert.equal((none.match(/data-testid="template-[a-zA-Z]+"/g) || []).length, 10); assert.match(none, /text-no-saved-configurations/);
  const some = renderToStaticMarkup(createElement(ReportTemplates, { ...base, saved: [{ id: "v1", name: "Weekly", filters: { preset: "7d", reportType: "noShow" }, ownedByMe: true }] }));
  assert.match(some, /Weekly/); assert.match(some, /No-show Analysis · 7 Days/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ReportTemplates, { ...base, canUsage: false, saved: [] })), /button-template-communication/);
});
test("Reports filters are drawer-only and applied as a complete draft", () => {
  const src = readFileSync(new URL("./ReportsDashboard.tsx", import.meta.url), "utf8");
  assert.match(src, /select\("Report Type", draft\.reportType/); assert.match(src, /kind="clinics" label="Clinic" value=\{draft\.clinicId\}/);
  assert.doesNotMatch(src, /report-inline-filters|button-report-apply|report-custom-range|filters=\{inline\}|choosePreset/);
  assert.match(src, /onOpen=\{openDrawer\}/); assert.match(src, /setDraft\(\{ \.\.\.applied, sessionId/);
  assert.match(src, /compactChips/); assert.match(src, /drawerTarget/);
  assert.match(src, /onResetDraft=\{resetDraft\}/); assert.match(src, /onCancel=\{\(\) => setDraft\(applied\)\}/);
  assert.match(src, /exportAll|buildReportExport\(api\.getReportAnalytics/);
});
test("Operational and Usage filters preserve shared transactional drawer semantics", () => {
  const legacy = readFileSync(new URL("../../clinic.tsx", import.meta.url), "utf8").split("function LegacyReports")[1];
  assert.ok(legacy);
  assert.doesNotMatch(legacy, /quick-filters-reports|reports-quick-range/);
  assert.match(legacy, /onCancel=\{openFilters\} onResetDraft=\{resetReportDraft\}/);
  const usage = readFileSync(new URL("../CommunicationUsage.tsx", import.meta.url), "utf8");
  assert.match(usage, /compactChips chips=\{usageChips\}/);
  assert.match(usage, /onResetDraft=\{\(\) => setDraft\(EMPTY_USAGE\)\}/);
  const shared = readFileSync(new URL("../ListingControls.tsx", import.meta.url), "utf8");
  assert.match(shared, /if \(onApply\?\.\(\) === false\)/);
  assert.match(shared, /onClick=\{e => openFilters\(chip.drawerTarget, e.currentTarget\)\}/);
});
test("report tabs reuse the shared wrapping style on narrow screens", () => {
  const css = readFileSync(new URL("../communication-usage.css", import.meta.url), "utf8");
  assert.match(css, /\.report-tabs\{[^}]*flex-wrap:wrap/);
});
