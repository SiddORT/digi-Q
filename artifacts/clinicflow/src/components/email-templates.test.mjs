import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./EmailTemplates.tsx", import.meta.url), "utf8");

test("uses generated hooks and patches the same query on success", () => {
  assert.match(src, /useGetNotificationTemplates\(params, \{ query: \{ enabled, queryKey \} \}\)/);
  assert.match(src, /queryClient\.setQueryData\(queryKey, next\)/);
  assert.ok(!/[^e]fetch\(/.test(src));
});
test("no password required, no email sending, delivery limitation shown", () => {
  assert.ok(!/password/i.test(src));
  assert.ok(!/sendSmtpTestEmail/.test(src));
  assert.ok(src.includes("Development never sends these queued emails automatically"));
});
test("conflict keeps drafts and offers explicit reload; logo preview opt-in", () => {
  assert.match(src, /=== 409\) setConflict\(true\)/);
  assert.ok(src.includes("button-reload"));
  assert.match(src, /\(showLogo \|\| isInternalLogo\(form\.logoUrl\)\)\s*\n?\s*\? <img/);
});
test("unsaved guard wraps scope and event navigation", () => {
  assert.equal((src.match(/guard\(\(\) =>/g) || []).length, 4);
});
test("background revision refresh preserves edits and saves use the editing revision", () => {
  assert.match(src, /!same\(form, editBase\.current\.content\)/);
  assert.match(src, /revision: editBase\.current\?\.revision \?\? item\.revision/);
});
test("recipient-aware: onboarding only for clinic admin, recipient sent on save", async () => {
  assert.ok(src.includes('e !== "onboarding" || recipient === "clinicAdmin"'));
  assert.ok(src.includes('event === "onboarding" ? "clinicAdmin" : current'));
  assert.match(src, /NotificationTemplateSaveEvent, recipient, revision/);
  assert.match(src, /useState<Recipient>\("patient"\)/);
  assert.ok(src.includes("adds real emails"));
});
