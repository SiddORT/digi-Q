import assert from "node:assert/strict";
import test from "node:test";
import * as v from "./validators.ts";

test("required trims whitespace", () => {
  assert.equal(v.required()("   "), v.REQUIRED_MESSAGE);
  assert.equal(v.required()(" a "), undefined);
});
test("person names allow international names", () => {
  for (const ok of ["Anne-Marie O'Neil", "Dr. Priya", "José Álvarez", "李 小龙"]) assert.equal(v.validatePersonName(ok), undefined, ok);
  for (const bad of ["A", "John3", "<b>", "-Ann"]) assert.ok(v.validatePersonName(bad), bad);
});
test("phone requires + country code and digits", () => {
  assert.ok(v.validatePhone("+"));
  assert.ok(v.validatePhone("9876543210"));
  assert.equal(v.validatePhone("+91 98765-43210"), undefined);
  assert.equal(v.normalizePhone("+91 98765-43210"), "+919876543210");
});
test("password: 8+ with letters and numbers", () => {
  assert.ok(v.validatePassword("abcdefgh"));
  assert.ok(v.validatePassword("abc1"));
  assert.equal(v.validatePassword("abcdefg1"), undefined);
});
test("date of birth blocks future and computes age", () => {
  const now = new Date(2026, 8, 30);
  assert.ok(v.validateDateOfBirth("2026-10-01", now));
  assert.ok(v.validateDateOfBirth("2026-02-30", now));
  assert.equal(v.ageFromDateOfBirth("2000-10-01", now), 25);
  assert.equal(v.ageFromDateOfBirth("2000-09-30", now), 26);
});
test("numeric ranges", () => {
  assert.ok(v.validateNumberRange("1.5", { integer: true }));
  assert.ok(v.validateNumberRange(0, { min: 1, max: 10 }));
  assert.equal(v.validateNumberRange("5", { min: 1, max: 10 }), undefined);
});
