import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
const read = p => readFile(new URL(p, import.meta.url), "utf8");
test("status edit uses shared StatusSwitch in Users and generic editor", async () => {
  const users = await read("../Users.tsx"), res = await read("../resources.tsx");
  assert.equal((users.match(/<StatusSwitch /g) || []).length, 2);
  assert.match(res, /<StatusSwitch [^>]*switch-user-status-editor/);
  assert.match(res, /<StatusSwitch [^>]*switch-user-status-\$\{row\.id\}/);
  assert.doesNotMatch(users + res, /type="checkbox" role="switch"/);
});
test("no native date inputs remain in migrated clinic screens", async () => {
  for (const p of ["../resources.tsx", "./queue/SessionQueue.tsx", "./appointments/RescheduleAppointment.tsx", "./GuestBooking.tsx"])
    assert.doesNotMatch(await read(p), /type="date"/, p);
});
test("PhoneInput has a single implementation using the shared phone library", async () => {
  const src = await read("./PhoneInput.tsx");
  assert.match(src, /from "\.\.\/lib\/phone"/);
  assert.doesNotMatch(src, /callingCodes=/);
});
test("remaining raw phone and timestamp callers use shared controls", async () => {
  const guest = await read("./GuestBooking.tsx"), clinic = await read("../clinic.tsx"), display = await read("./ClinicDisplay.tsx");
  assert.match(guest, /<DateFormatInput data-testid="input-guest-date"[^>]*preferences=\{\{[^}]*context\.dateFormat/);
  assert.match(guest, /<PhoneInput \{\.\.\.field\}[^>]*input-guest-mobile/);
  assert.match(clinic, /<PhoneInput aria-label="Mobile number" value=\{mobile\} onChange=\{setMobile\}\/>/);
  for (const src of [guest, clinic]) assert.doesNotMatch(src, /type="tel"/);
  assert.match(display, /formatConfiguredTimestamp\(new Date\(q\.dataUpdatedAt\), data\?\.branch\.timezone/);
  assert.doesNotMatch(display, /toLocaleTimeString\(\[\]/);
});
