import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(new URL(f, import.meta.url), "utf8");

test("notifications default to not-connected with no fake records or counts", () => {
  const s = read("./NotificationsPanel.tsx");
  assert.match(s, /adapter\?\.list \?\? unavailable\(NOTIFICATIONS_UNAVAILABLE\)/);
  for (const t of ["All", "Appointments", "System", "Mentions"]) assert.match(s, new RegExp(`label: "${t}"`));
  assert.match(s, /disabled=\{!canMarkAll\}/);
  assert.doesNotMatch(s, /createdAt: "20\d\d/);
});

test("workspace switcher never fakes switching", () => {
  const s = read("./WorkspaceShell.tsx");
  assert.match(s, /data-testid="menu-switch-workspace"/);
  assert.match(s, /disabled aria-disabled="true"[^>]*data-testid="menu-switch-workspace"/);
});

test("patient documents are disabled with a visible reason; timeline uses real appointments", () => {
  const s = read("./PatientDetailsDrawer.tsx");
  assert.match(s, /useListAppointments/);
  assert.match(s, /patientId: patient\.id/);
  assert.equal((s.match(/<UnavailableAction /g) || []).length, 3);
  assert.match(s, /unavailable\(ACTIVITY_UNAVAILABLE\)/);
  assert.match(s, /setPage\(p => p \+ 1\)/);
  assert.match(s, /text-activity-scope/);
});

test("report chart only reads loaded rows", () => {
  const s = read("./ReportChart.tsx");
  assert.match(s, /if \(!rows\) return null/);
  assert.doesNotMatch(s, /Math\.random|Math\.max\(0/);
  assert.match(s, /accessibilityLayer/);
  assert.match(s, /report-chart-unavailable/);
});

test("patient details is read-only for any listing role; edit stays gated", () => {
  const s = readFileSync(new URL("../resources.tsx", import.meta.url), "utf8");
  assert.match(s, /const hasActions=!!config\.update\|\|resource==="patients"/);
  assert.match(s, /\{config\.update&&<><HelpTip text=\{resource==="clinics"/);
  assert.match(s, /colSpan=\{displayColumns\.length\+\(hasActions\?2:1\)\}/);
});
