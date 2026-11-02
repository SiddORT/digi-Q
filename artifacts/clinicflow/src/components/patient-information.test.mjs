import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (n) => readFileSync(new URL(n, import.meta.url), "utf8");

test("patient information: Profile default, Appointments renamed, documents not role-hidden", () => {
  const src = read("./PatientInformation.tsx");
  assert.match(src, /defaultTab = "profile"/);
  assert.match(src, /label: "Appointments"/);
  assert.doesNotMatch(src, /label: "Timeline"/);
  assert.match(src, /tab === "documents" && <PatientDocuments/);
  assert.doesNotMatch(src, /role\s*===\s*"doctor"/);
  for (const t of ["Basic Information", "Contact Information", "Address", "Clinic & Registration", "Emergency Contact"]) assert.ok(src.includes(`title="${t}"`), t);
  for (const bad of ["bloodGroup", "allergies", "lastVisit", "Medical History"]) assert.ok(!src.includes(bad), bad);
  assert.match(src, /Age \(calculated\)/);
  assert.match(src, /emptyDash/);
});

test("drawer and inline expansion share PatientInformation over one profile query", () => {
  const drawer = read("./PatientDetailsDrawer.tsx");
  assert.match(drawer, /<PatientInformation/);
  assert.equal((drawer.match(/useGetPatient\(/g) || []).length, 1);
  assert.doesNotMatch(read("./PatientInformation.tsx"), /useGetPatient\(/);
  const page = read("../resources.tsx");
  assert.match(page, /resource==="patients"\?<div data-testid=\{`expansion-\$\{resource\}-\$\{row\.id\}`\}><PatientInformation/);
  assert.match(page, /const editPatient=resource==="patients"&&config\.update\?/);
});

test("patient listing: code as secondary ID, contact/status columns, patient-only action divider", () => {
  const page = read("../resources.tsx");
  assert.match(page, /resource==="patients"\?\["fullName","mobile","email","status"\]/);
  assert.match(page, /patients-listing-table/);
  assert.match(read("./ResourceRecord.tsx"), /resource === "patients" \? \(row\.code \? `ID \$\{row\.code\}`/);
  const css = read("./patient-information.css");
  assert.match(css, /\.patients-listing-table td\.col-actions[^{]*\{[^}]*border-left/);
  assert.match(css, /repeat\(3,minmax\(0,1fr\)\)/);
  const info = read("./PatientInformation.tsx");
  assert.match(info, /useFilterNames/);
  assert.doesNotMatch(info, /\["(?:Clinic|Clinic group)",\s*patient\.(?:clinicId|branchId)\]/);
  assert.match(info, /onEdit=\{edit\}/);
});

test("dash for missing read-only values is opt-in", () => {
  const src = read("./ProfileCompletion.tsx");
  assert.match(src, /emptyDash = false/);
  assert.match(src, /<span className="muted">Not entered<\/span>/);
});
