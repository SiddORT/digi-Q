import test from "node:test";
import assert from "node:assert/strict";
import { DATE_FORMATS, TIME_FORMATS, formatDate, formatTime, parseDateInput, parseTimeInput, formatConfiguredTimestamp, isCanonicalDate } from "./date-time.ts";

test("all display formats roundtrip without date/timezone conversion", () => {
  for (const dateFormat of DATE_FORMATS) {
    assert.equal(parseDateInput(formatDate("2024-02-29", { dateFormat }), { dateFormat }), "2024-02-29");
  }
  for (const timeFormat of TIME_FORMATS) for (const value of ["00:00", "12:00", "23:59"]) {
    assert.equal(parseTimeInput(formatTime(value, { timeFormat }), { timeFormat }), value);
  }
  assert.equal(formatDate("2026-09-30"), "30 Sep 2026");
  assert.equal(formatTime("00:00"), "12:00 AM");
  assert.equal(formatTime("12:00"), "12:00 PM");
});
test("rejects overflow, mismatched formats, ambiguous instants and invalid zones", () => {
  for (const date of ["2025-02-29", "2024-04-31", "0000-01-01", "2024-13-01"]) assert.equal(isCanonicalDate(date), false);
  assert.equal(parseDateInput("09/30/2026", { dateFormat: "DD/MM/YYYY" }), null);
  assert.equal(parseDateInput("2026-09-30"), null);
  assert.equal(parseTimeInput("24:00", { timeFormat: "24h" }), null);
  assert.equal(parseTimeInput("13:00 PM"), null);
  assert.equal(formatConfiguredTimestamp("2026-09-30T09:00:00", "UTC"), "Invalid date");
  assert.equal(formatConfiguredTimestamp("2026-02-30T09:00:00Z", "UTC"), "Invalid date");
  assert.equal(formatConfiguredTimestamp("2026-09-30T09:00:00Z", "bad/zone"), "Invalid timezone");
});
test("DST transitions use the actual instant, never browser-local interpretation", () => {
  const prefs = { dateFormat: "YYYY-MM-DD", timeFormat: "24h" };
  assert.equal(formatConfiguredTimestamp("2026-03-08T06:59:00Z", "America/New_York", {}, prefs), "2026-03-08, 01:59");
  assert.equal(formatConfiguredTimestamp("2026-03-08T07:00:00Z", "America/New_York", {}, prefs), "2026-03-08, 03:00");
  assert.equal(formatConfiguredTimestamp("2026-11-01T05:30:00Z", "America/New_York", {}, prefs), "2026-11-01, 01:30");
  assert.equal(formatConfiguredTimestamp("2026-11-01T06:30:00Z", "America/New_York", {}, prefs), "2026-11-01, 01:30");
});