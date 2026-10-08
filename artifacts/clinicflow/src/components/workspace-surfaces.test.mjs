import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
test("global staff management remains separate, reachable and Super Admin only",()=>{
  const app=read("../App.tsx"),portal=read("../clinic.tsx"),settings=read("./ClinicSettings.tsx");
  assert.match(app,/page==="staff"&&me\.data\.user\.role!=="superAdmin"/);
  assert.match(app,/Redirect to="\/admin\/staff\?tab=doctors"/);
  assert.match(portal,/page==="staff"&&identity\.user!\.role==="superAdmin"\?<Users identity=\{identity\}\/>/);
  assert.match(settings,/href="\/admin\/staff" data-testid="link-global-staff"/);
  assert.match(read("./ClinicRegistrationComplete.tsx"),/\/admin\/clinic\?clinicId=.*&section=staff/);
});

test("patients can open their own records from Profile, not only through staff listings", () => {
  const s = read("../clinic.tsx");
  assert.match(s, /identity\.user\?\.role==="patient"&&identity\.patientId/);
  assert.match(s, /data-testid="button-my-patient-records"/);
  assert.match(s, /PatientDetailsDrawer patient=\{\{id:identity\.patientId/);
});

test("notifications come from the server with persisted read state; no Mentions tab or fake records", () => {
  const s = read("./NotificationsPanel.tsx");
  assert.match(s, /useListNotifications/);
  assert.match(s, /useMarkNotificationsRead/);
  assert.doesNotMatch(s, /Mentions|mentions/);
  for (const t of ["All", "Appointments", "Queue", "System"]) assert.match(s, new RegExp(`: "${t}"`));
  assert.doesNotMatch(s, /createdAt: "20\d\d/);
  assert.match(s, /useTabIds/);
});

test("workspace switcher uses the server API and clears caches", () => {
  const s = read("./WorkspaceShell.tsx");
  assert.match(s, /useSelectWorkspace/);
  assert.match(s, /client\.clear\(\)/);
  assert.match(s, /role="menuitemradio"/);
  assert.match(s, /menuKeyDown/);
  assert.doesNotMatch(s, /SWITCH_UNAVAILABLE/);
});

test("patient drawer: real timeline, server activity and private documents", () => {
  const s = read("./PatientDetailsDrawer.tsx");
  assert.match(s, /useListAppointments/);
  assert.match(s, /patientId: patient\.id/);
  assert.doesNotMatch(s, /UnavailableAction|DOCUMENTS_UNAVAILABLE/);
  assert.match(s, /<PatientActivity /);
  assert.match(s, /<PatientDocuments /);
  const a = read("./PatientActivity.tsx");
  assert.match(a, /useListPatientActivity/);
  assert.match(a, /setPage\(p => p \+ 1\)/);
  const d = read("./PatientDocuments.tsx");
  for (const fn of ["uploadPatientDocument", "downloadPatientDocument", "deletePatientDocument"]) assert.match(d, new RegExp(fn));
  assert.match(d, /Confirm Delete/);
});

test("saved views sync through the server and never send search text", () => {
  const s = read("../lib/listing-views.ts");
  assert.match(s, /createSavedView/);
  assert.match(s, /sanitizeViewFilters\(filters, allowedFilterKeys\)/);
});

test("report trends use the scoped trends API", () => {
  const s = read("./ReportTrends.tsx");
  assert.match(s, /useGetReportTrends/);
  assert.doesNotMatch(s, /Math\.random/);
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
  assert.match(s, /\{config\.update&&!\(OWNER_ONLY_FIELDS\[resource\]&&[^\n]*?\)&&\(resource==="clinics"&&portal==="admin"\?<IconAction label=\{`Configure/);
  assert.match(s, /colSpan=\{displayColumns\.length\+\(hasActions\?2:1\)\}/);
});
