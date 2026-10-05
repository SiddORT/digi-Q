import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./AppointmentRows.tsx", import.meta.url), "utf8");
// Cells are rendered through the shared column renderer (`cell`), so include it with the table markup.
const table = source.slice(source.indexOf("const cols=useTableColumns"), source.indexOf("</tbody>"));
test("default appointment rows omit technical references and duplicate waiting explanations", () => {
  assert.doesNotMatch(table, /<small>\{a\.reference\}<\/small>|Awaiting consultation|Patient \/ reference/);
  assert.match(table, /label:"Patient"/);
  assert.match(table, /data-label=\{cols\.label\(k\)\}/);
});
test("operational tokens remain prominent in session queues, not repeated session prose", () => {
  assert.match(table, /sessionScoped\?<strong>\{a\.token\}<\/strong>/);
  assert.doesNotMatch(table, /<small>\{sessionScoped/);
  assert.match(table, /Token and booking reference are available in Details and Ticket/);
});
test("appointment metadata omitted from the list stays available in authorized Details", () => {
  const details = readFileSync(new URL("./AppointmentDetails.tsx", import.meta.url), "utf8");
  for (const field of ["a.reference", "a.doctorName", "a.clinicName", "a.branchName", "a.date", "a.startTime", "a.token"]) assert.ok(details.includes(field), field);
});