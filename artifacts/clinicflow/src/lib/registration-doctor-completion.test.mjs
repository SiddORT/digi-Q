import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registrationDoctorIssue, requireRegistrationDoctor } from "./registration-doctor-completion.ts";

test("consulting registration cannot silently succeed without its same-account doctor", () => {
  for (const result of [{ doctorId: null }, {}]) {
    assert.match(registrationDoctorIssue(result, true), /Do not register again/);
    assert.throws(() => requireRegistrationDoctor(result, true), /consulting doctor profile/);
  }
  const saved = { doctorId: "persisted-owner-profile" };
  assert.equal(requireRegistrationDoctor(saved, true), saved);
  assert.equal(registrationDoctorIssue(saved, true), undefined);
  assert.equal(registrationDoctorIssue({ doctorId: null }, false), undefined);
});

test("both onboarding submitters preserve the consulting choice and guard every completion source", () => {
  for (const file of ["ClinicRegistration.tsx", "ClinicAdminOnboarding.tsx"]) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
    assert.match(source, /ownDoctor: values\.alsoConsult/);
    assert.match(source, /registrationDoctorIssue\([^,]+,\s*pending\?\.values\.alsoConsult === true\)/);
    assert.equal((source.match(/requireRegistrationDoctor\(/g) || []).length, 3,
      `${file}: preflight, direct response and uncertain-response recovery must all check the choice`);
  }
});
