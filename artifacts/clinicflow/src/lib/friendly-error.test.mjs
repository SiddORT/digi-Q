import assert from "node:assert/strict";
import test from "node:test";
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
