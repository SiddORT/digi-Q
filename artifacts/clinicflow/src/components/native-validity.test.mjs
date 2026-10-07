// Behavioural tests for tabbed/stepped form submission (real transpiled source, fake DOM elements).
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const load = (rel, deps = {}) => {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function("exports", "require", out)(exports, id => deps[id] ?? {}); return exports;
};
const validators = load("../lib/validators.ts");
const nv = load("./native-validity.ts", { "../lib/validators": validators });
const valid = { valid: true };
const el = (name, validity = valid, extra = {}) => ({ name, validity, willValidate: true, getAttribute: n => extra[n] ?? null, ...extra });

// Mimics react-hook-form: runs registered validators, then onValid or onInvalid. Records setError calls.
function fakeForm(rhfErrors = {}) {
  const set = [];
  return { set, setError: (n, e) => set.push([n, e.message]), handleSubmit: (ok, bad) => async () => { if (Object.keys(rhfErrors).length) return bad(rhfErrors); return ok({ fullName: "Asha" }); } };
}
const submitEvent = elements => ({ currentTarget: { elements }, preventDefault() {} });

test("AddPatient repro: invalid email on hidden Details tab blocks save and reaches onInvalid (no silent native cancel)", async () => {
  const elements = [el("fullName"), el("gender"), el("email", { valid: false, typeMismatch: true }, { type: "email" }), el("address")];
  const form = fakeForm(); let saved = false, invalid;
  await nv.submitWithNativeChecks(form, () => { saved = true; }, e => { invalid = e; })(submitEvent(elements));
  assert.equal(saved, false);
  assert.deepEqual(Object.keys(invalid), ["email"]);
  assert.deepEqual(form.set, [["email", "Enter a valid email address."]]);
});

test("custom validator errors and native errors merge in DOM order so the first invalid tab is chosen", async () => {
  const elements = [el("fullName"), el("email", { valid: false, typeMismatch: true }, { type: "email" }), el("maxTokens", { valid: false, rangeOverflow: true }, { type: "number", max: "1000" })];
  const form = fakeForm({ maxTokens: { message: "Must be 1000 or less" }, fullName: { message: "This field is required" } });
  let invalid; await nv.submitWithNativeChecks(form, () => assert.fail("must not save"), e => { invalid = e; })(submitEvent(elements));
  assert.deepEqual(Object.keys(invalid), ["fullName", "email", "maxTokens"]);
  assert.deepEqual(form.set.map(s => s[0]), ["email"], "RHF-owned errors are not overwritten");
});

test("valid form saves; disabled / non-validating / unnamed controls are ignored", async () => {
  const elements = [el("fullName"), { name: "x", disabled: true, willValidate: true, validity: { valid: false, badInput: true } }, { willValidate: true, validity: { valid: false, valueMissing: true } }, { name: "y", willValidate: false, validity: { valid: false } }];
  let saved = false; await nv.submitWithNativeChecks(fakeForm(), () => { saved = true; }, () => assert.fail())(submitEvent(elements));
  assert.equal(saved, true);
});

test("every native constraint kind maps to a message (nothing dropped by noValidate)", () => {
  const m = (v, extra) => nv.nativeMessage(el("f", { valid: false, ...v }, extra));
  assert.equal(m({ valueMissing: true }), validators.REQUIRED_MESSAGE);
  assert.equal(m({ typeMismatch: true }, { type: "url" }), "Enter a full web address, e.g. https://example.com.");
  assert.equal(m({ badInput: true }, { type: "number" }), "Enter a number.");
  assert.equal(m({ rangeUnderflow: true }, { type: "number", min: "1" }), "Must be at least 1.");
  assert.equal(m({ rangeOverflow: true }, { type: "date", max: "2030-01-01" }), "Choose a date on or before 2030-01-01.");
  assert.equal(m({ stepMismatch: true }), "Enter a whole number.");
  assert.equal(m({ patternMismatch: true }, { title: "Digits only" }), "Digits only");
  assert.equal(m({ tooLong: true }, { maxlength: "4" }), "Use at most 4 characters.");
});

test("custom validators are unchanged: the repro email still fails the registered rule", () => {
  assert.ok(validators.validateEmail("not-an-email"));
  assert.equal(validators.validateEmail("asha@example.com"), undefined);
});

test("all tabbed/stepped forms opt out of browser validation and route through the shared checks", () => {
  const editor = read("../resources.tsx");
  assert.match(editor, /<form className="form-grid field-grid" noValidate [^>]*onSubmit=\{submitWithNativeChecks\(form,values=>/);
  assert.match(editor, /field\.type==="email"\?validateEmail\(value\)/, "Editor email rule intact");
  assert.match(editor, /revealAndFocus\(element\)/);
  const users = read("../Users.tsx");
  assert.match(users, /noValidate onSubmit=\{submitWithNativeChecks\(form, onSubmit, onInvalid\)\}/);
  assert.match(users, /firstInvalidTab\(staffTabs, Object\.keys\(errors\)\)/);
  const wizard = read("./ClinicRegistrationWizard.tsx");
  assert.match(wizard, /<form noValidate onSubmit=\{event => \{[^]*?nativeInvalidFields\(/);
  assert.match(read("./GuestBooking.tsx"), /<form noValidate/);
  for (const src of [editor, users]) assert.doesNotMatch(src, /onSubmit=\{form\.handleSubmit\(/, "no tabbed form bypasses native checks");
});
