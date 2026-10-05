import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const bundle = new URL(`../../.date-picker-logic-test-${process.pid}.mjs`, import.meta.url);
let L;
before(async () => {
  await build({ entryPoints: [fileURLToPath(new URL("./date-picker-logic.ts", import.meta.url))], outfile: fileURLToPath(bundle), bundle: true, platform: "node", format: "esm" });
  L = await import(bundle.href);
});
after(async () => { await unlink(bundle).catch(() => {}); });

test("leap years and month lengths", () => {
  assert.equal(L.isLeapYear(2024), true);
  assert.equal(L.isLeapYear(2100), false);
  assert.equal(L.isLeapYear(2000), true);
  assert.equal(L.daysInMonth(2026, 1), 28);
  assert.equal(L.daysInMonth(2028, 1), 29);
  const grid = L.monthGrid(2028, 1);
  assert.equal(grid.filter(Boolean).length, 29);
  assert.equal(grid.at(-1), "2028-02-29");
  assert.equal(grid.indexOf("2028-02-01"), new Date(Date.UTC(2028, 1, 1)).getUTCDay());
});

test("month navigation clamps the day instead of overflowing", () => {
  assert.equal(L.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(L.addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(L.addMonths("2028-02-29", 12), "2029-02-28");
  assert.equal(L.addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(L.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(L.addDays("2026-12-31", 1), "2027-01-01");
});

test("calendar keyboard moves by day/week/month/week-edge and never leaves min/max", () => {
  const k = (f, key, min, max) => L.calendarKeyTarget(f, key, min, max);
  assert.equal(k("2026-09-30", "ArrowRight"), "2026-10-01");
  assert.equal(k("2026-09-01", "ArrowLeft"), "2026-08-31");
  assert.equal(k("2026-09-30", "ArrowDown"), "2026-10-07");
  assert.equal(k("2026-09-03", "ArrowUp"), "2026-08-27");
  assert.equal(k("2026-01-31", "PageDown"), "2026-02-28");
  assert.equal(k("2026-03-31", "PageUp"), "2026-02-28");
  assert.equal(k("2026-09-30", "Home"), "2026-09-27"); // Sunday
  assert.equal(k("2026-09-30", "End"), "2026-10-03"); // Saturday
  assert.equal(k("2026-09-10", "ArrowLeft", "2026-09-10"), "2026-09-10");
  assert.equal(k("2026-09-28", "ArrowDown", undefined, "2026-09-30"), "2026-09-30");
  assert.equal(k("2026-09-15", "PageDown", undefined, "2026-09-20"), "2026-09-20");
  assert.equal(k("2026-09-15", "Enter"), null);
  assert.equal(k("2026-09-15", "a"), null);
});

test("initial focus uses selection, else today clamped to bounds; out-of-range is inclusive", () => {
  assert.equal(L.initialFocus("2026-05-05", "2026-01-01", "2026-06-01"), "2026-05-05");
  assert.equal(L.initialFocus("", "2026-01-01", "2026-06-01"), "2026-06-01");
  assert.equal(L.initialFocus("", "2027-01-01", undefined, "2026-12-31"), "2026-12-31");
  assert.equal(L.isOutOfRange("2026-06-01", "2026-06-01", "2026-06-01"), false);
  assert.equal(L.isOutOfRange("2026-05-31", "2026-06-01"), true);
});

test("time options honour step and bounds and always include an exact typed minute", () => {
  const all = L.timeOptions(15);
  assert.equal(all.length, 96);
  assert.equal(all[0], "00:00");
  assert.equal(all.at(-1), "23:45");
  const bounded = L.timeOptions(30, "09:00", "10:30");
  assert.deepEqual(bounded, ["09:00", "09:30", "10:00", "10:30"]);
  assert.deepEqual(L.timeOptions(30, "09:00", "10:00", "09:07"), ["09:00", "09:07", "09:30", "10:00"]);
  assert.ok(!L.timeOptions(30, "09:00", "10:00", "11:07").includes("11:07"), "out-of-range typed value is not offered");
  assert.equal(L.timeOptions(1).length, 1440, "minute step lists every exact minute");
  assert.equal(L.timeOptions(0).length, 96, "invalid step falls back to 15");
});

test("popover placement flips above and clamps inside the dialog so it never clips", () => {
  const rect = (top, left, w, h) => ({ top, left, width: w, height: h, bottom: top + h, right: left + w });
  const dialog = rect(0, 600, 560, 800);
  const below = L.placePanel(rect(100, 640, 200, 36), dialog, { width: 260, height: 300 });
  assert.deepEqual(below, { top: 140, left: 40, placement: "below" });
  const above = L.placePanel(rect(700, 640, 200, 36), dialog, { width: 260, height: 300 });
  assert.equal(above.placement, "above");
  assert.equal(above.top, 700 - 4 - 300);
  const clampedRight = L.placePanel(rect(100, 1100, 50, 36), dialog, { width: 260, height: 300 });
  assert.equal(clampedRight.left, 560 - 8 - 260);
  const tiny = L.placePanel(rect(100, 640, 200, 36), rect(0, 0, 400, 320), { width: 260, height: 300 });
  assert.ok(tiny.top >= 8 && tiny.top + 300 <= 320, "short container keeps the panel inside");
  const scrolled = L.placePanel(rect(100, 10, 200, 36), rect(0, 0, 1280, 800), { width: 260, height: 300 }, 4, 8, { x: 0, y: 500 });
  assert.equal(scrolled.top, 640, "body placement adds page scroll");
});

test("range validation blocks inverted and, when required, incomplete ranges", () => {
  assert.equal(L.rangeError("2026-09-02", "2026-09-01"), "Select an end date on or after the start date.");
  assert.equal(L.rangeError("2026-09-01", "2026-09-01"), null);
  assert.equal(L.rangeError("", ""), null);
  assert.equal(L.rangeError("", "2026-09-01", true), "Select both a start and end date.");
  assert.equal(L.rangeError("2026-02-29", "2026-03-01"), null, "string compare only; parsing rejects impossible dates upstream");
});
test("month/year shortcut jumps keep the day, clamp month length and bounds (birth-date reach)", () => {
  assert.equal(L.jumpTo("2026-03-31", 1958, 1), "1958-02-28");
  assert.equal(L.jumpTo("2026-03-29", 1960, 1), "1960-02-29");
  assert.equal(L.jumpTo("2026-05-15", 1890, 4, "1900-01-01"), "1900-01-01");
  assert.equal(L.jumpTo("2026-05-15", 2030, 4, undefined, "2026-05-20"), "2026-05-20");
});
test("invalid typed text reports a combined validity message, not a misleading empty error", () => {
  assert.equal(L.rangeError("", "2026-09-10", true, true), "Enter valid start and end dates, with the end on or after the start.");
  assert.equal(L.rangeError("", "2026-09-10", true, false), "Select both a start and end date.");
});
