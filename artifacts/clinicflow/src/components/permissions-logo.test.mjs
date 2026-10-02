import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const rules = readFileSync(new URL("./AccessRules.tsx", import.meta.url), "utf8");
const matrix = readFileSync(new URL("./permission-matrix.ts", import.meta.url), "utf8");
const et = readFileSync(new URL("./EmailTemplates.tsx", import.meta.url), "utf8");
const up = readFileSync(new URL("./logo-upload.ts", import.meta.url), "utf8");

test("permission editor uses generated hooks, revision and conflict retention", () => {
  assert.match(rules, /useGetPermissionPolicy\(\{ query: \{ queryKey \} \}\)/);
  assert.match(rules, /useSavePermissionPolicy\(\)/);
  assert.match(rules, /revision: base\.current\.revision, denied: serialize\(denied\)/);
  assert.match(rules, /=== 409\) setConflict\(true\)/);
  assert.ok(rules.includes("button-reset-local") && rules.includes("button-confirm-save"));
  assert.ok(!/[^e]fetch\(/.test(rules));
});
test("explains restriction-only semantics and Super Admin lockout protection", () => {
  assert.ok(rules.includes("never grants more than the built-in rules"));
  assert.ok(rules.includes("Super Admin cannot be restricted"));
  assert.match(rules, /filter\(r => r !== SUPER_ADMIN\)/);
  assert.match(matrix, /role === SUPER_ADMIN \|\|/);
  assert.match(matrix, /startsWith\(`\$\{SUPER_ADMIN\}:`\)\) return next/);
  assert.match(matrix, /`\$\{role\}:\$\{module\}:\$\{action\}`/);
});
test("logo upload: generated hooks, signed PUT without credentials, no publish", () => {
  assert.match(et, /requestLogo\.mutateAsync\(\{ data: \{ name: file\.name, size: file\.size, contentType: file\.type, clinicId: clinicId \|\| undefined \} \}\)/);
  assert.match(et, /completeLogo\.mutateAsync\(\{ id \}\)/);
  assert.match(et, /set\("logoUrl", logoUrl\)/);
  assert.ok(!/save\.mutate[^\n]*onLogoFile/.test(et));
  assert.match(up, /xhr\.withCredentials = false/);
  assert.ok(!/Authorization|X-CSRF/i.test(up));
  assert.ok(et.includes("max 2 MB") && et.includes("2048×2048"));
  assert.ok(et.includes('data-testid="input-logoUrl"'));
});
test("internal logo path and https validation", async () => {
  const m = et.match(/export const INTERNAL_LOGO = (\/.*\/i);/);
  const re = eval(m[1]);
  assert.ok(re.test("/api/branding/logos/123e4567-e89b-12d3-a456-426614174000"));
  assert.ok(!re.test("/api/branding/logos/../x"));
  assert.ok(!re.test("http://dev.local/api/branding/logos/123e4567-e89b-12d3-a456-426614174000"));
  assert.match(up, /image\/png", "image\/jpeg", "image\/webp/);
  assert.match(up, /2 \* 1024 \* 1024/);
});
