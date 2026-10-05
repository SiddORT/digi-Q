import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const tx = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const js = tx("./ui-glossary.ts") + "\n" + tx("./title-case.ts").replace(/^import .*ui-glossary.*$/m, "");
const { titleCase } = await import(`data:text/javascript,${encodeURIComponent(js)}`);

test("acronyms keep capitals in any input casing", () => {
  assert.equal(titleCase("export selected csv"), "Export Selected CSV");
  assert.equal(titleCase("smtp settings"), "SMTP Settings");
  assert.equal(titleCase("Sms and otp"), "SMS and OTP");
  assert.equal(titleCase("private appointment qr"), "Private Appointment QR");
  assert.equal(titleCase("download pdf"), "Download PDF");
  assert.equal(titleCase("api key"), "API Key");
});
test("minor words are lowercase except first and last", () => {
  assert.equal(titleCase("rows per page"), "Rows per Page");
  assert.equal(titleCase("copy to selected days"), "Copy to Selected Days");
  assert.equal(titleCase("the end of"), "The End Of");
  assert.equal(titleCase("reset to default"), "Reset to Default");
});
test("hyphens, spacing and mixed-case brand words are preserved", () => {
  assert.equal(titleCase("check-in desk"), "Check-In Desk");
  assert.equal(titleCase("DigiQ demo clinic"), "DigiQ Demo Clinic");
  assert.equal(titleCase("WebP logo"), "WebP Logo");
  assert.equal(titleCase("  weekly  overview "), "Weekly  Overview");
});

test("approved glossary phrases always get one casing", () => {
  assert.equal(titleCase("sign in to your account"), "Sign In to Your Account");
  assert.equal(titleCase("check in"), "Check In");
  assert.equal(titleCase("set up clinic admin"), "Set Up Clinic Admin");
  assert.equal(titleCase("roles & permissions"), "Roles & Permissions");
  assert.equal(titleCase("book appointment"), "Book Appointment");
});
