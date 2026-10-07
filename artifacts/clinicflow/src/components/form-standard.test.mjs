import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const r = read("../resources.tsx");

test("exceptions: Day Off and Extra Interval are mutually exclusive; legacy both-set shown as the API treats it", () => {
  assert.match(r, /exclusive&&event\.target\.checked&&form\.getValues\(exclusive\)\)form\.setValue\(exclusive,false,\{shouldDirty:true\}\)/);
  assert.match(r, /if\(legacyBoth\)initialValues\.isClosed=false;/);
  const api = readFileSync(new URL("../../../api-server/src/lib/availability.ts", import.meta.url), "utf8");
  assert.match(api, /isExtra: true, isOpen: true, isClosed: false/, "API semantics the UI mirrors");
});

test("patient editor: numbered reference groups, status folded into clinic group, derived age, saved-detail summary", () => {
  assert.match(r, /\["Clinic and status",\["clinicId","branchId","status"\]\]/);
  assert.doesNotMatch(r.match(/PATIENT_EDITOR_GROUPS:[^\n]*/)[0], /"Status"/);
  assert.match(r, /\{editorKind==="patient"&&<span className="editor-group-index"/);
  assert.match(r, /<output aria-labelledby="label-derived-age"/);
  assert.match(r, /data-testid="text-patient-saved-details">\{secondarySummary\|\|"Nothing added yet"\}/);
  assert.match(r, /label:"Mobile"\}/);
});

test("schedule capacity row: four equal intentional widths with short labels", () => {
  for (const re of [/tokenPrefix","text",true\),width:"sm"/, /label:"Max Tokens",width:"sm"/, /label:"Consultation Duration",width:"sm"/, /label:"Buffer \(min\)",width:"sm"/]) assert.match(r, re);
});

test("dedicated forms use the shared FormSection", () => {
  assert.match(read("../Users.tsx"), /<FormSection title="Staff details"/);
  assert.match(read("../Users.tsx"), /<FormSection title="Assignment"/);
  assert.match(read("./ClinicRegistrationWizard.tsx"), /<FormSection title="Administrator"/);
  assert.match(read("./IntegrationEditor.tsx"), /<FormSection title="Confirm identity"/);
  assert.match(read("./ClinicSettings.tsx"), /<FormDisclosure title="Copy Opening Hours From Another Location"/);
  for (const f of ["../auth/DemoLogin.tsx", "../auth/PatientLogin.tsx", "./GuestBooking.tsx"]) assert.match(read(f), /<FormField /, f);
});

test("reschedule prompts only when something changed", () => {
  assert.match(read("./appointments/AppointmentRows.tsx"), /dirty=\{rescheduleDirty\}/);
  assert.match(read("./appointments/RescheduleAppointment.tsx"), /const dirty=branchId!==a\.branchId\|\|doctorId!==a\.doctorId\|\|date!==a\.date\|\|!!reason\.trim\(\);/);
});
