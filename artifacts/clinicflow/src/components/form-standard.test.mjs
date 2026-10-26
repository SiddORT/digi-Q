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
  assert.match(read("../Users.tsx"), /<FormSection title=\{initial\.id\?"Staff details":"Account Details"\}/);
  assert.match(read("../Users.tsx"), /<FormSection title=\{initial\.id\?tab==="doctors"\?"Assignments":"Assignment":"Work Assignment"\}/);
  assert.match(read("./ClinicRegistrationWizard.tsx"), /<FormSection title="Administrator"/);
  assert.match(read("./IntegrationEditor.tsx"), /<FormSection title="Confirm identity"/);
  assert.match(read("./ClinicSettings.tsx"), /<FormDisclosure title="Copy Opening Hours From Another Location"/);
  for (const f of ["../auth/DemoLogin.tsx", "../auth/PatientLogin.tsx"]) assert.match(read(f), /<FormField /, f);
  assert.match(read("./GuestBooking.tsx"), /<BookingField /);
  assert.match(read("./booking/booking-fields.tsx"), /return <FormField /);
});

test("reschedule prompts only when something changed", () => {
  assert.match(read("./appointments/AppointmentRows.tsx"), /dirty=\{rescheduleDirty\}/);
  const expression = read("./appointments/RescheduleAppointment.tsx").match(/const dirty=([^;\n]+);/)?.[1];
  assert.ok(expression, "reschedule exposes its draft comparison");
  const compare = new Function("a", "branchId", "doctorId", "date", "selection", "reason", `return (${expression})`);
  const original = {branchId:"b1",doctorId:"d1",date:"2026-10-25",sessionId:"s1"};
  const changed = (patch={}) => compare(original, patch.branchId??original.branchId, patch.doctorId??original.doctorId, patch.date??original.date, {sessionId:patch.sessionId??original.sessionId}, patch.reason??"");
  assert.equal(changed(), false);
  assert.equal(changed({reason:"   "}), false);
  for (const patch of [{branchId:"b2"},{doctorId:"d2"},{date:"2026-10-26"},{sessionId:"s2"},{reason:"Patient requested"}]) assert.equal(changed(patch), true);
  assert.equal(compare({...original,sessionId:null},"b1","d1",original.date,{sessionId:""},""), false);
});
