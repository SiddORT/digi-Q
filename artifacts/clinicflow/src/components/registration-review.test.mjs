import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./ClinicRegistration.tsx", import.meta.url), "utf8");

test("registration details advance to review without sending a registration request", () => {
  const details = source.slice(source.indexOf('if(step==="details"){'), source.indexOf('setBusy(true); setError("");'));
  assert.match(details, /validatePersonName/);
  assert.match(details, /validateEmail/);
  assert.match(details, /validatePassword/);
  assert.match(details, /setStep\("review"\);\s*return;/);
  assert.doesNotMatch(details, /authRequest/);
  assert.match(source, /if \(step === "review"\) \{\s*const result = await authRequest/);
});

test("review shows normalized identity but never displays or persists the password", () => {
  const review = source.slice(source.indexOf('<section aria-label="Account details review">'), source.indexOf('</section> : <FormField'));
  assert.match(review, /fullName\.trim\(\)/);
  assert.match(review, /email\.trim\(\)\.toLowerCase\(\)/);
  assert.match(review, /Edit Account Details/);
  assert.doesNotMatch(review, /\{password\}/);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.setItem/);
  assert.match(source, /setPassword\(""\);\s*setStep\("verify"\)/);
});

test("registration progress and step focus are accessible", () => {
  assert.match(source, /aria-label="Account registration progress"/);
  assert.match(source, /aria-current=\{step === item \? "step" : undefined\}/);
  assert.match(source, /stepHeading\.current\?\.focus\(\)/);
  assert.match(source, /ref=\{stepHeading\} tabIndex=\{-1\}/);
});