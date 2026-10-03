import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./IntegrationSettings.tsx", import.meta.url), "utf8");
const ed = readFileSync(new URL("./IntegrationEditor.tsx", import.meta.url), "utf8");
test("only supported providers, storage env-only with docs", () => {
  assert.ok(src.includes('{ value: "smtp", label: "SMTP" }') && src.includes('{ value: "twilio", label: "Twilio" }'));
  for (const k of ["MEDIA_STORAGE", "MEDIA_ROOT", "MEDIA_URL"]) assert.ok(src.includes(k));
  assert.match(src, /useCheckIntegrationConnection\(\)/);
  assert.match(src, /check\.mutate\(\{ provider \}(\)|, \{ onSuccess)/);
  assert.match(src, /useGetStorageConfiguration\(/);
});
test("smtp test requires explicit confirmation", () => {
  assert.match(src, /disabled=\{!confirmSend \|\|/);
  assert.match(src, /if \(confirmSend\) send\.mutate/);
});
test("editor keeps password confirmation, env switch and masked secrets", () => {
  assert.ok(ed.includes('mode === "environment" ? {}'));
  assert.ok(ed.includes("currentPassword: password"));
  assert.ok(ed.includes('"TWILIO_AUTH_TOKEN", "Twilio auth token", "password"'));
});
