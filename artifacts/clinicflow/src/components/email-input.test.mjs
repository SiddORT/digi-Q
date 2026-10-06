import test from "node:test"; import assert from "node:assert/strict"; import { readFile } from "node:fs/promises";
const read = p => readFile(new URL(p, import.meta.url), "utf8");
test("form email fields use shared EmailInput", async () => {
  for (const p of ["../Users.tsx","./GuestBooking.tsx","./IntegrationSettings.tsx","./ClinicRegistration.tsx","./ClinicRegistrationWizard.tsx"]) {
    const s = await read(p); assert.match(s, /<EmailInput/, p); assert.doesNotMatch(s, /type="email"/, p);
  }
});
test("EmailInput trims only, preserving case", async () => {
  const s = await read("./EmailInput.tsx");
  assert.match(s, /\.trim\(\)/); assert.doesNotMatch(s, /toLowerCase/); assert.match(s, /maxLength = 254/);
});
test("guest email is validated and surfaced", async () => {
  const s = await read("./GuestBooking.tsx"); assert.match(s, /validateEmail\(v\)/); assert.match(s, /error-guest-email/);
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
test("weekly day switch shares the switch track but keeps Working/Off labels", async () => {
  const s = await read("./schedule/WeeklyDraftDays.tsx");
  assert.match(s, /status-switch day-open-switch/); assert.match(s, /status-switch-track/); assert.match(s, /"Working"/); assert.doesNotMatch(s, /StatusSwitch/);
});
