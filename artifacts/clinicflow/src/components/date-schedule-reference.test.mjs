import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const out = name => new URL(`../../.${name}-test-${process.pid}.mjs`, import.meta.url);
let L, R;
before(async () => {
  for (const [entry, name] of [["../lib/date-picker-logic.ts", "dpl"], ["./DateRangeInput.tsx", "dri"]])
    await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile: fileURLToPath(out(name)), bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic" });
  L = await import(out("dpl").href); R = await import(out("dri").href);
});
after(async () => { for (const n of ["dpl", "dri"]) { await unlink(out(n)).catch(() => {}); await unlink(new URL(out(n).href.replace(/\.mjs$/, ".css"))).catch(() => {}); } });

test("time columns follow the configured clock format", () => {
  assert.deepEqual(L.hourOptions("12h").slice(0, 3), [12, 1, 2]);
  assert.equal(L.hourOptions("24h").length, 24);
  assert.equal(L.toHour24(12, "AM"), 0); assert.equal(L.toHour24(12, "PM"), 12); assert.equal(L.toHour24(4, "PM"), 16); assert.equal(L.toHour24(7, null), 7);
  assert.equal(L.composeTime(9, 5), "09:05");
  assert.deepEqual(L.minuteOptions(15), [0, 15, 30, 45]);
  assert.deepEqual(L.minuteOptions(15, 32), [0, 15, 30, 32, 45], "exact typed minute stays selectable");
  assert.ok(L.hourOutOfRange(8, "09:00")); assert.ok(!L.hourOutOfRange(9, "09:30")); assert.ok(L.hourOutOfRange(18, undefined, "17:00"));
});

test("range clicks start, end and restart a connected range", () => {
  let r = L.rangeClick({ from: "", to: "" }, "2026-04-10");
  assert.deepEqual(r, { from: "2026-04-10", to: "" });
  r = L.rangeClick(r, "2026-05-02"); assert.deepEqual(r, { from: "2026-04-10", to: "2026-05-02" });
  assert.deepEqual(L.rangeClick(r, "2026-06-01"), { from: "2026-06-01", to: "" }, "third click restarts");
  assert.deepEqual(L.rangeClick({ from: "2026-04-10", to: "" }, "2026-04-01"), { from: "2026-04-01", to: "" }, "earlier end restarts");
  assert.equal(L.monthOf("2026-12-19", 1), "2027-01-01");
});

test("range input renders two typeable fields and a calendar trigger", () => {
  const html = renderToStaticMarkup(createElement(R.DateRangeInput, { from: "2026-04-01", to: "2026-04-30", onChange() {}, fromTestId: "input-report-from", toTestId: "input-report-to", testId: "report-range", required: true, preferences: { dateFormat: "YYYY-MM-DD" } }));
  assert.match(html, /data-testid="input-report-from"/); assert.match(html, /data-testid="input-report-to"/);
  assert.match(html, /data-testid="button-report-range-calendar"[^>]*>|aria-haspopup="dialog"/);
  assert.match(html, /value="2026-04-30"/);
});

test("all From/To filters use the shared range picker and weekly editors use expandable rows", () => {
  const clinic = read("../clinic.tsx"), resources = read("../resources.tsx");
  assert.equal((clinic.match(/<DateRangeInput /g) || []).length, 2, "appointments and reports");
  assert.match(resources, /<DateRangeInput fromLabel="From date" toLabel="To date"/);
  assert.doesNotMatch(clinic + resources, /<label>(From|To)( date| \*)?<DateFormatInput/);
  for (const f of ["./ClinicRegistrationHours.tsx", "./schedule/WeeklyDraftDays.tsx"]) {
    const src = read(f);
    assert.match(src, /wdr-row/); assert.match(src, /aria-expanded=\{isExpanded\}/); assert.match(src, /wdr-summary/);
    assert.match(src, /Copy to Selected Days/); assert.match(src, /Add Session/);
  }
  assert.match(read("./schedule/WeeklyDraftDays.tsx"), /Follows clinic hours/);
  const input = read("./DateFormatInput.tsx");
  assert.match(input, /aria-label="Hour"/); assert.match(input, /aria-label="Minute"/); assert.match(input, /is12 && <div className="dtp-col"/);
  assert.match(input, /closest\('\[role="dialog"\],\[role="alertdialog"\]'\)/, "picker portals inside dialogs for the focus trap");
});

test("time picker focus: lands after portal positioning, Tab stays in panel, close returns to trigger", () => {
  const src = read("./DateFormatInput.tsx");
  assert.doesNotMatch(src, /visibility: "hidden"/, "hidden popovers cannot receive focus while positioning");
  assert.match(src, /opacity: 0, pointerEvents: "none"/);
  assert.match(src, /root\.contains\(document\.activeElement\) && \+\+tries < 10\) frame = requestAnimationFrame\(attempt\)/, "focus retries until the portaled panel is attached");
  assert.match(src, /if \(e\.key === "Tab"\) \{/); assert.match(src, /stops\[\(at \+ \(e\.shiftKey \? -1 : 1\) \+ stops\.length\) % stops\.length\]\.focus\(\)/);
  assert.match(src, /role="option" tabIndex=\{-1\}/, "options are reached by arrows, not sequential Tab");
  assert.match(src, /triggerRef\.current && !triggerRef\.current\.disabled \? triggerRef\.current : inputRef\.current/);
  assert.match(src, /e\.key === "Escape" && open\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); close\(\); \} \}\}>/);
});

test("weekly editor never prints an undefined timezone", () => {
  const src = read("./schedule/WeeklyScheduleEditor.tsx");
  assert.doesNotMatch(src, /Clinic timezone: \$\{branch\.data\.timezone\}`/);
  assert.match(src, /\|\| "Not set"\}`/);
});
