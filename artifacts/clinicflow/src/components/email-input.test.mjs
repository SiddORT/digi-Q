import test from "node:test"; import assert from "node:assert/strict"; import { readFile } from "node:fs/promises";
const read = p => readFile(new URL(p, import.meta.url), "utf8");
test("form email fields use shared EmailInput", async () => {
  for (const p of ["./StaffAccountFields.tsx","./GuestBooking.tsx","./ClinicRegistration.tsx","./ClinicRegistrationWizard.tsx"]) {
    const s = await read(p); assert.match(s, /<EmailInput/, p); assert.doesNotMatch(s, /type="email"/, p);
  }
});
test("EmailInput trims only, preserving case", async () => {
  const s = await read("./EmailInput.tsx");
  assert.match(s, /\.trim\(\)/); assert.doesNotMatch(s, /toLowerCase/); assert.match(s, /maxLength = 254/);
});
test("guest email is validated and surfaced", async () => {
  const s = await read("./GuestBooking.tsx");
  assert.match(s, /validate:\s*bookingValidation\.email/);
  assert.match(s, /name="email" error=\{form\.formState\.errors\.email\?\.message\}/);
  const { loadModule } = await import("../test/load-module.mjs");
  const { bookingValidation } = await loadModule(new URL("./booking/booking-fields.tsx", import.meta.url));
  assert.equal(bookingValidation.email(""), true, "email remains optional");
  assert.equal(bookingValidation.email("patient@example.invalid"), true);
  assert.equal(typeof bookingValidation.email("not-an-email"), "string");
});
test("auth email fields use EmailInput without trimming", async () => {
  for (const p of ["../auth/StaffLogin.tsx","../auth/PatientLogin.tsx","../auth/PasswordFlows.tsx"]) {
    const s = await read(p); assert.match(s, /<EmailInput trimOnBlur=\{false\}/, p); assert.doesNotMatch(s, /type="email"/, p);
  }
  assert.match(await read("./EmailInput.tsx"), /trimOnBlur = true/);
});
test("generic resource editor email branch uses EmailInput", async () => {
  assert.match(await read("../resources.tsx"), /field\.type==="email"\?<EmailInput/);
});
test("access rules use SearchableSelect with preserved test ids", async () => {
  const s = await read("./AccessRules.tsx");
  assert.doesNotMatch(s, /<select/); assert.match(s, /testId="select-role"/); assert.match(s, /testId="select-module"/);
});
test("shared weekly day switch keeps its working-day label", async () => {
  const s = await read("./schedule/CompactDayEditor.tsx");
  assert.match(s, /role="switch"/); assert.match(s, /Working day/); assert.doesNotMatch(s, /StatusSwitch/);
});
