import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const clinic = read("../clinic.tsx"), resources = read("../resources.tsx"), users = read("../Users.tsx"), queue = read("./queue/SessionQueue.tsx");

test("appointment toolbar: sort lives in the filter drawer, updated time is an icon tip, suggestions omit references", () => {
  assert.match(clinic, /advanced=\{<><SearchableSelect label="Sort Appointments"/);
  assert.match(clinic, /<HelpTip label="Last Updated"/);
  assert.match(clinic, /description:\[a\.doctorName,formatDate\(a\.date,a\)\]/);
  assert.match(clinic, /value:a\.reference/); // selection still searches the backend reference
});
test("resource rows never print codes/references in the record cell", () => {
  assert.doesNotMatch(resources, /row\.code\|\|row\.reference\?<small>/);
  assert.match(resources, /function recordSecondary/);
});
test("staff assignments are a counted dialog trigger and Created is not a default column", () => {
  assert.match(users, /<AssignmentSummary /);
  assert.doesNotMatch(users, /sortable\("createdAt","Created"\)/);
});
test("queue notes, duration and quick switch open as overlays", () => {
  assert.doesNotMatch(queue, /<details className="sq-(switch|duration|note-details)"/);
  assert.doesNotMatch(queue, /showDuration/);
  const duration = read("./queue/DurationEditor.tsx");
  assert.match(duration, /variant="drawer"/);
  assert.match(duration, /data-testid="button-queue-duration"/);
  assert.match(duration, /dirty=\{minutes!==openedMinutes\|\|effect!=="futureOnly"\|\|confirm\}/);
  assert.match(queue, /title="Multi-doctor sessions · quick switch"/);
});
test("audit technical payload is available in a drawer", () => {
  assert.match(resources, /data-testid="audit-payload"/);
});
