import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("./patient-qr.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function("exports", "require", compiled)(exports, require);
const { patientBookingPath } = exports;
const origin = "https://clinicflow.example";

test("clinic QR links open their own booking location", () => {
  assert.equal(patientBookingPath(`${origin}/book/demo_123`, origin), "/book/demo_123");
  assert.equal(patientBookingPath(`${origin}/demo-clinic/main-branch?book=1`, origin), "/demo-clinic/main-branch?book=1");
  assert.equal(patientBookingPath(`${origin}/app/book/demo_123`, origin, "/app/"), "/book/demo_123");
});
test("check-in, external sites, and unrelated links are rejected", () => {
  for (const input of [`${origin}/check-in?payload=secret`, `${origin}/book/demo_123?display=1`, `${origin}/demo-clinic/main-branch?display=1`, `${origin}/admin/dashboard`, `${origin}/admin/dashboard?book=1`, `${origin}/patient/appointments?book=1`, `${origin}/demo-clinic/guest-booking?book=1`, "not a qr code", "https://other.example/book/demo_123", `${origin}/app/book/demo_123`]) {
    assert.equal(patientBookingPath(input, origin), null, input);
  }
});