import assert from "node:assert/strict";
import test from "node:test";
import { gatePatientSubmit, secondaryFieldErrors, PATIENT_SECONDARY } from "./patient-details.ts";

test("collapsed invalid emergency phone (+1123) blocks save and reports the field", () => {
  const saved = []; const reported = [];
  // Values retained by the form while More details is collapsed.
  const values = { fullName: "Deepa Rao", emergencyContactPhone: "+1123" };
  const ok = gatePatientSubmit(values, () => saved.push(values), e => reported.push(e));
  assert.equal(ok, false); assert.equal(saved.length, 0);
  assert.ok(reported[0].emergencyContactPhone); assert.ok(PATIENT_SECONDARY.includes(Object.keys(reported[0])[0]));
  assert.equal(values.emergencyContactPhone, "+1123"); // retained, not cleared
});
test("invalid emergency name blocks; valid or empty secondary fields allow save", () => {
  assert.ok(secondaryFieldErrors({ emergencyContactName: "123" }).emergencyContactName);
  const saved = [];
  assert.equal(gatePatientSubmit({ emergencyContactPhone: "+14155552671", emergencyContactName: "Asha K" }, () => saved.push(1), () => {}), true);
  assert.equal(gatePatientSubmit({ emergencyContactPhone: "", address: "" }, () => saved.push(2), () => {}), true);
  assert.deepEqual(saved, [1, 2]);
});
