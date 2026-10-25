import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const out = `${import.meta.dirname}/.staff-account-${process.pid}.mjs`;
await build({ stdin: { contents: 'export * from "./staff-input"; export * from "./lib/staff-account";', resolveDir: import.meta.dirname, loader: "ts" }, bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const { staffInput, passwordPairError, withoutPasswords } = await import(out);
await rm(out, { force: true });

test("password pair requires both fields, policy and a match", () => {
  assert.ok(passwordPairError("", "").password && passwordPairError("", "").confirmPassword);
  assert.ok(passwordPairError("short1", "short1").password);
  assert.deepEqual(passwordPairError("Longer123", "Longer124"), { confirmPassword: "Passwords do not match" });
  assert.deepEqual(passwordPairError("Longer123", "Longer123"), {});
});

test("credentials are sent on create only, never on edit", () => {
  const v = { fullName: "A B", email: "a@b.co", password: "Longer123", confirmPassword: "Longer123" };
  assert.equal(staffInput("receptionists", v, { create: true }).password, "Longer123");
  assert.equal("password" in staffInput("receptionists", v), false);
  assert.ok(readFileSync(new URL("./staff-controls.ts", import.meta.url), "utf8").includes("create:!(original as any).id"));
});

test("snapshots and drafts drop passwords", () => {
  assert.deepEqual(withoutPasswords({ a: 1, password: "x", confirmPassword: "x" }), { a: 1 });
});

test("creation orders assignments before account fields without reordering edit panels", () => {
  const users = readFileSync(new URL("./Users.tsx", import.meta.url), "utf8");
  const assignments = users.indexOf('<div id="doctor-assignments"');
  assert.ok(users.indexOf("{initial.id&&staffDetails}") < assignments);
  assert.ok(users.indexOf("{!initial.id&&staffDetails}") > assignments);
  assert.ok(users.includes('"Role & Locations"') && users.includes('"Staff Details"'));
  assert.ok(!users.includes('"Work Assignment"') && !users.includes('"Account Details"'));
  assert.ok(users.includes('label="About clinic assignment"') && users.includes('label="About location assignment"'));
});

test("source wiring: no create tabs, inherited panel, password caches or emoji-free copy", () => {
  const users = readFileSync(new URL("./Users.tsx", import.meta.url), "utf8");
  assert.ok(!users.includes("InheritedClinicSummary") && !users.includes("confirmInherited"));
  assert.ok(!/Clinic Group/.test(users));
  assert.ok(users.includes("credentials.current = null"));
  const verification = readFileSync(new URL("./components/StaffContactVerification.tsx", import.meta.url), "utf8");
  assert.ok(!/setQueryData|localStorage|sessionStorage/.test(verification));
  const wizard = readFileSync(new URL("./components/ClinicRegistrationWizard.tsx", import.meta.url), "utf8");
  assert.ok(wizard.includes("withoutPasswords(form.getValues()"));
});

test("onboarding never uses a mutation for credentials; bulk resend hidden when all password-ready", () => {
  const onboarding = readFileSync(new URL("./components/ClinicAdminOnboarding.tsx", import.meta.url), "utf8");
  assert.ok(!onboarding.includes("useOnboardClinicAdmin") && !onboarding.includes("setup.mutateAsync"));
  const users = readFileSync(new URL("./Users.tsx", import.meta.url), "utf8");
  assert.ok(users.includes('selection.selected.some((row:any)=>!(row.passwordEnabled===true'));
  const clinic = readFileSync(new URL("./clinic.tsx", import.meta.url), "utf8");
  assert.ok(clinic.includes('page!=="profile"&&<FirstLoginVerificationPrompt actor='));
});

test("admin mode is one page with one Save; public wizard keeps its steps", () => {
  const w = readFileSync(new URL("./components/ClinicRegistrationWizard.tsx", import.meta.url), "utf8");
  assert.ok(w.includes("const show = (n: number) => adminMode ? n <= 3 : step === n;"));
  assert.ok(w.includes("adminMode ? finishAdmin() : step === steps.length - 1"));
  assert.ok(w.includes("{!adminMode&&<aside className=\"registration-progress\">"));
  assert.ok(w.includes('for (const target of [0, 1, 2, 3])'));
  assert.ok(w.includes("Finish registration") && w.includes("Continue"));
  assert.ok(!/\{step === \d &&/.test(w));
});

test("verification requires exactly six digits, resets on contact change, keys are actor scoped", () => {
  const v = readFileSync(new URL("./components/StaffContactVerification.tsx", import.meta.url), "utf8");
  assert.ok(v.includes("code.length === 6") && v.includes('maxLength={6}') && v.includes('label="Confirm Code"'));
  assert.ok(v.includes("[value, verified]") && v.includes("staffVerificationKey(actor)"));
});

test("admin layout is a single column and password checklist tracks uncontrolled input", () => {
  const css = readFileSync(new URL("./components/clinic-registration.css", import.meta.url), "utf8");
  assert.match(css, /\.registration-layout\.admin-single\{grid-template-columns:minmax\(0,1fr\)/);
  assert.ok(css.indexOf(".registration-layout{display:grid") < css.indexOf(".registration-layout.admin-single"));
  const w = readFileSync(new URL("./components/ClinicRegistrationWizard.tsx", import.meta.url), "utf8");
  assert.ok(w.includes('adminMode?"registration-layout admin-single":"registration-layout"'));
  const p = readFileSync(new URL("./components/PasswordInput.tsx", import.meta.url), "utf8");
  assert.ok(p.includes("setTyped(event.target.value); onChange?.(event)") && p.includes('typeof value === "string" ? value : typed'));
});
