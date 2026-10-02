import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

test("staff form has only local credentials and never falls into retired provider/device login", async () => {
  const source = await readFile(new URL("./StaffLogin.tsx", import.meta.url), "utf8");
  assert.match(source, /authRequest<LoginResponse>\("login",/);
  assert.match(source, /result\.authenticated !== true/);
  assert.doesNotMatch(source, /verify-device|requiresVerification|challengeId|OTPInput|staff-device-trust|setActive|provePassword/);
  await assert.rejects(access(new URL("./staff-device-trust.ts", import.meta.url)), { code: "ENOENT" });
});