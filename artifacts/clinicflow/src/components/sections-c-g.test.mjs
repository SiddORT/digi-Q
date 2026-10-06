// Static regression coverage for Sections C–G (source contracts; behaviour of pure helpers is covered in lib/address.test.mjs and api-server tests).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const resources=read("../resources.tsx"), phone=read("./PhoneInput.tsx"), select=read("./SearchableSelect.tsx");
test("C: phone defaults to IN, closed control shows compact code, names stay searchable",()=>{
  assert.match(phone,/splitPhone\(value, DEFAULT_PHONE_COUNTRY\)/);
  assert.doesNotMatch(phone,/suggestedCountry\(\)/);
  assert.match(phone,/label: `\$\{item\.name\} \$\{item\.code\}`, selectedLabel: `\$\{item\.code\} \$\{item\.country\}`/);
  assert.match(select,/option\.selectedLabel \|\| option\.label/);
});
test("C: state/city suggestions scoped by parent, incompatible child cleared only after user parent change, PIN validated, manual entry kept",()=>{
  const a=read("./AddressFields.tsx");
  assert.match(a,/kind: "city", city: current\.city/);
  assert.match(a,/if \(!changed\) return; \/\/ value changed from outside/);
  assert.match(a,/setTimeout\(/); // waits for typing pause before any clearing
  assert.match(a,/validatePostalCode\(value\.pincode, scope\.country\)/);
  assert.match(a,/districts and post offices are never used as the city/);
  assert.match(a,/<HelpTip /);
  assert.doesNotMatch(a,/<datalist/);
  assert.match(a,/<SearchableSelect id=\{`\$\{idPrefix\}country`\}/);
  assert.match(a,/selectedLabel: c\.country/); // closed control shows compact ISO code
  assert.match(a,/\(saved value\)/); // saved non-ISO country preserved
});
test("D: Check In/Out are compact distinct icon actions with accessible name and tooltip, first in Actions",()=>{
  const rows=read("./appointments/AppointmentRows.tsx");
  assert.match(rows,/<IconAction className=\{`row-primary row-primary-\$\{primary==="complete"\?"out":"in"\}`\} label=\{`\$\{label\(primary\)\}: \$\{a\.patientName\}`\}/);
  assert.doesNotMatch(rows,/<button className="row-primary"/);
  assert.ok(rows.indexOf("row-primary row-primary")<rows.indexOf('className="row-details"'));
  assert.ok(rows.indexOf('className="row-details"')<rows.indexOf("<RowMenu"));
  assert.match(read("./uniformity.css"),/row-primary-out\{/);
});
test("E: selects never expose raw IDs while labels load",()=>{
  assert.match(select,/selectedLabel \|\| \(loading \? "Loading…" : error \? "Selected item unavailable" : value\)/);
});
test("F: outside-hours is a save warning (not 'on hold') and a shared downstream booking warning",()=>{
  const editor=read("./schedule/WeeklyScheduleEditor.tsx");
  assert.doesNotMatch(editor,/still on hold/);
  assert.match(editor,/Save With Extended Hours/);
  assert.match(read("./GuestBooking.tsx"),/<HoursWarning warning=\{available\.hoursWarning\}\/>/);
  assert.match(read("../clinic.tsx"),/<HoursWarning warning=\{availability\.data\.hoursWarning\}\/>/);
});
test("G: in-app QR validation dialog with Close; public booking only via explicit labelled new tab; no auto navigation",()=>{
  const queue=read("./queue/SessionQueue.tsx"), checkIn=read("../CheckIn.tsx");
  assert.match(queue,/<QrValidationDialog open=\{qrOpen\}/);
  assert.doesNotMatch(queue,/href="\/check-in"/);
  assert.match(checkIn,/button-qr-validation-close/);
  assert.match(checkIn,/link-check-in-return/);
  assert.doesNotMatch(resources,/window\.location\.assign\(url\)/);
  assert.match(resources,/in new tab<\/a>/);
  assert.match(resources,/rel="noopener noreferrer" data-testid="link-open-public-new-tab"/);
});

const src = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("section C: shared address layout on resource, patient, staff, doctor and public registration forms", () => {
  const r = src("../resources.tsx");
  assert.match(r, /export const addressFields=/);
  assert.equal((r.match(/\.\.\.addressFields\(/g) || []).length, 4); // locations(+clinics), patients, doctors, users
  assert.match(src("./ClinicRegistrationWizard.tsx"), /<AddressFields directory="public"/);
  assert.match(r, /if\(field\.type==="address"\)return <EditorAddress/);
  assert.match(r, /if\(field\.type==="addressPart"\)return null;/);
  assert.doesNotMatch(r, /PinLocalities/); // single address implementation lives in AddressFields
  assert.match(src("./AddressFields.tsx"), /searchPublicGeography/);
});
test("section C: PIN locality pick never fills the city and only acts on explicit choice", () => {
  const pin = src("./PinLocalities.tsx"), addr = src("./AddressFields.tsx"), r = src("../resources.tsx");
  assert.match(pin, /onClick=\{\(\) => onPick\(row\)\}/);
  assert.doesNotMatch(addr.slice(addr.indexOf("onPick=")), /city:/); // city only cleared (never filled) when the user changes state
});
test("section E: one booking progression and one patient editor that returns the new patient selected", () => {
  const c = src("../clinic.tsx");
  assert.match(src("./BookingSteps.tsx"), /"Visit details", "Patient details", "Confirmation", "Ticket"/);
  assert.match(c, /<StagedBooking testId="staff-staged-booking" step=\{step as 1\|2\|3\} visit=\{/); assert.match(c, /<BookingSteps step=\{4\}\/>/);
  assert.match(src("./GuestBooking.tsx"), /<BookingSteps step=/);
  assert.match(c, /<PatientEditor initial=/);
  assert.match(c, /onSuccess:p=>\{setPatient\(p\.id\)/);
  assert.match(src("../resources.tsx"), /PATIENT_CONTACT_RULE/);
});
test("section F: follow vs copy-once labels, exceptions beside weekly schedule, doctor profile links", () => {
  const w = src("./schedule/WeeklyScheduleEditor.tsx"), e = src("./schedule/WeeklyScheduleEditor.tsx"), r = src("../resources.tsx");
  assert.match(w, /Copy Location Hours Once/); assert.match(w, /Follow Location Hours \(Linked\)/);
  assert.match(e, /link-week-exceptions/); assert.match(e, /schedule-readiness/);
  assert.match(r, /link-doctor-weekly-/); assert.match(r, /ExceptionImpactPreview/);
  assert.match(r, /Extra Interval/);
});
test("section C: PIN directory state is never auto-filled; user must press an explicit Use State button", () => {
  const pin = src("./PinLocalities.tsx"), addr = src("./AddressFields.tsx"), r = src("../resources.tsx");
  assert.match(pin, /dated snapshot/); assert.match(pin, /button-pin-use-state/);
  assert.doesNotMatch(addr.slice(addr.indexOf("onPick=")), /state: row\.state/);
  assert.match(addr, /onUseState=\{state =>/);
});
test("section E: guest booking is staged and only the Confirmation stage can create a booking", () => {
  const g = src("./GuestBooking.tsx"), staged = src("./booking/StagedBooking.tsx");
  assert.match(g, /<StagedBooking testId="guest-staged-booking" step=\{step\}/);
  assert.match(g, /if\(lock\.current\|\|step!==3\)return;/);
  assert.match(g, /form\.trigger\(\["fullName","email","mobile","permission"\]\)/);
  assert.match(staged, /hidden=\{step !== 1\}/); // stages stay mounted, Back preserves input
  assert.equal((src("../clinic.tsx").match(/<BookingStageActions /g) || []).length, 3);
});
