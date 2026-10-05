import assert from "node:assert/strict";
import test from "node:test";
test("rate limit preserves safe actionable retry duration", () => {
  assert.equal(friendlyError({status:429,data:{error:"Too many attempts. Try again in 58 seconds."}}), "Too many attempts. Try again in 58 seconds.");
  assert.equal(friendlyError({status:429,data:{error:"provider internal details"}}), FRIENDLY.rateLimited);
});
test("auth email failures give safe actionable guidance rather than generic service errors", () => {
  assert.match(friendlyError({status:503,data:{code:"EMAIL_UNCONFIGURED"}}, "auth"), /clinic administrator/);
  assert.match(friendlyError({status:503,data:{code:"PUBLIC_ORIGIN_UNCONFIGURED"}}, "auth"), /not configured/);
  assert.match(friendlyError({status:503,data:{code:"EMAIL_DELIVERY_FAILED"}}, "auth"), /could not confirm email delivery/);
});
import { friendlyError, FRIENDLY, isFriendlyText, fieldErrorsFrom } from "./friendly-error.ts";
import { summarizeBulk } from "./bulk-summary.ts";

const apiErr = (status, data, message = `HTTP ${status} X`) => Object.assign(new Error(message), { status, data });

test("never exposes HTTP status lines", () => {
  assert.equal(friendlyError(apiErr(401, undefined, "HTTP 401 Unauthorized")), FRIENDLY.sessionExpired);
  assert.equal(friendlyError(apiErr(404, { error: "row missing" })), FRIENDLY.notFound);
  assert.equal(friendlyError(apiErr(500, "stack at foo (a.js:1:2)"), "save"), FRIENDLY.saveFailed);
  assert.equal(friendlyError(new Error("HTTP 503 Service Unavailable")), FRIENDLY.generic);
  assert.equal(friendlyError(new TypeError("Failed to fetch")), FRIENDLY.network);
});
test("keeps human validation messages", () => {
  assert.equal(friendlyError(apiErr(400, { error: "Select a clinic" }, "HTTP 400 Bad Request: Select a clinic")), "Select a clinic");
  assert.equal(friendlyError(new Error("You cannot deactivate your own account.")), "You cannot deactivate your own account.");
  assert.equal(isFriendlyText('{"a":1}'), false);
});
test("auth 401 keeps credential message", () => {
  assert.equal(friendlyError(apiErr(401, { error: "Invalid email or password." }), "auth"), "Invalid email or password.");
});
test("field errors", () => {
  assert.deepEqual(fieldErrorsFrom(apiErr(400, { errors: [{ path: ["phone"], message: "Enter a valid phone." }] })), { phone: "Enter a valid phone." });
});
test("bulk summary consolidates", () => {
  assert.deepEqual(summarizeBulk([{ label: "A", ok: true }, { label: "B", ok: true }]), { tone: "success", title: "2 of 2 updated", failures: [] });
  const s = summarizeBulk([{ label: "A", ok: true }, { label: "B", ok: false, message: "Access denied." }]);
  assert.equal(s.tone, "warning"); assert.deepEqual(s.failures, ["B: Access denied."]);
});
