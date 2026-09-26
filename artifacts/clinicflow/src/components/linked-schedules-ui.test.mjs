import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("both onboarding callers include explicit linked settings in the atomic request", () => {
  for (const name of ["ClinicRegistration.tsx", "ClinicAdminOnboarding.tsx"]) {
    const text = source(name);
    assert.match(text, /values\.alsoConsult && values\.linkConsultationHours/);
    assert.match(text, /ownerSchedule: \{ maxTokens: Number\(values\.sessionCapacity\), consultationMinutes: Number\(values\.consultationMinutes\)/);
    assert.doesNotMatch(text, /createSchedule\(/);
  }
});
test("linked mode is selected by default but capacity is explicit", () => {
  const text = source("ClinicRegistrationWizard.tsx");
  assert.match(text, /linkConsultationHours: true, sessionCapacity: "", consultationMinutes: ""/);
  assert.match(text, /Number\.isSafeInteger/);
  assert.match(text, /Custom consultation hours:/);
});
test("settings requires preview and blocks conflicting apply", () => {
  const text = source("LinkedScheduleControls.tsx");
  assert.match(text, /previewClinicSettings/);
  assert.match(text, /disabled=\{busy \|\| !result.allowed\}/);
  assert.match(text, /result.conflicts.map/);
  assert.match(source("ClinicSettings.tsx"), /submitLabel="Review changes"/);
});
test("all clinic configuration sections have retained-clinic navigation", () => {
  const text = source("ClinicSettings.tsx");
  for (const label of ["General", "Locations & Hours", "Doctors & Sessions", "Booking Rules", "Staff", "QR & Links", "History"]) assert.ok(text.includes(label));
  assert.match(text, /clinicId=\$\{encodeURIComponent\(clinicId\)\}/);
  assert.match(text, /window.history.replaceState/);
});