import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ClinicRegistration.tsx", import.meta.url), "utf8");
test("registration distinguishes group and location and uses selectable duration", () => {
  const wizard = readFileSync(new URL("./ClinicRegistrationWizard.tsx", import.meta.url), "utf8");
  assert.match(wizard, /Clinic location name/);
  assert.match(wizard, /Use Clinic Group Name for This Location/);
  assert.match(wizard, /Controller name="consultationMinutes"/);
  assert.match(wizard, /Expected Consultation Duration/);
  assert.match(wizard, /formatTime\(session.startTime,values\)/);
  assert.match(wizard, /formatTime\(session.endTime,values\)/);
});
test("copy hours synchronizes targets and announces draft-only feedback", () => {
  const hours = readFileSync(new URL("./ClinicRegistrationHours.tsx", import.meta.url), "utf8");
  assert.match(hours, /target !== day.dayOfWeek/);
  assert.match(hours, /setTargets\(current =>/);
  assert.match(hours, /role="status" data-testid="registration-copy-result"/);
  assert.match(hours, /finish registration to save/);
});

test("registration details advance to review without sending a registration request", () => {
  const details = source.slice(source.indexOf('if(step==="details"){'), source.indexOf('setBusy(true); setError("");'));
  assert.match(details, /validatePersonName/);
  assert.match(details, /validateEmail/);
  assert.match(details, /validatePassword/);
  assert.match(details, /setStep\("review"\);\s*return;/);
  assert.doesNotMatch(details, /authRequest/);
  assert.match(source, /if \(step === "review"\) \{[\s\S]*?const result = await authRequest/);
});

test("review shows normalized identity but never displays or persists the password", () => {
  const review = source.slice(source.indexOf('<section aria-label="Account details review">'), source.indexOf('</section> : <FormField'));
  assert.match(review, /fullName\.trim\(\)/);
  assert.match(review, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(review, /Edit Account Details/);
  assert.doesNotMatch(review, /\{password\}/);
  const draft = readFileSync(new URL("../lib/registration-draft.ts", import.meta.url), "utf8");
  assert.match(draft, /accountDraftSchema = z.object\(\{ fullName: text, email: text, step:/);
  assert.doesNotMatch(draft, /(?:password|code|challengeId|token):\s*z\./);
  assert.match(source, /setPassword\(""\);\s*setStep\("verify"\)/);
});

test("registration progress and step focus are accessible", () => {
  assert.match(source, /aria-label="Account registration progress"/);
  assert.match(source, /aria-current=\{step === item \? "step" : undefined\}/);
  assert.match(source, /stepHeading\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{stepHeading\} tabIndex=\{-1\}/);
});