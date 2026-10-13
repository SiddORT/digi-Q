import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { communicationRedirect, communicationTab, filterRows, eventControlError, eventSetupReasons, templateSaveError } from "./communication-routes.ts";
test("legacy settings areas redirect", () => {
  assert.equal(communicationRedirect("superAdmin", "sms"), "/admin/communication?tab=sms");
  assert.equal(communicationRedirect("superAdmin", "email"), "/admin/communication?tab=email");
  assert.equal(communicationRedirect("superAdmin", "events"), "/admin/templates");
  assert.equal(communicationRedirect("clinicAdmin", "templates"), "/admin/templates");
  assert.equal(communicationRedirect("clinicAdmin", "sms"), null);
  assert.equal(communicationRedirect("superAdmin", "platform"), null);
  assert.equal(communicationRedirect("superAdmin", null), null);
});
test("profile Settings opens general settings, not communication settings", () => {
  const shell = readFileSync(new URL("../components/WorkspaceShell.tsx", import.meta.url), "utf8");
  const settingsLink = shell.match(/^.*<Link\b[^\n]*data-testid="menu-settings"[^\n]*$/m)?.[0];
  assert.ok(settingsLink);
  assert.match(settingsLink, /href="\/admin\/settings"/);
});
test("tab and filters", () => {
  assert.equal(communicationTab("x"), "sms");
  const rows = [{ channel: "sms", event: "booking", recipient: "patient", enabled: true, ready: false, source: "", inherited: true, preview: "hi" }, { channel: "email", event: "reminder", recipient: "doctor", enabled: false, ready: true, source: "", inherited: false, preview: "" }];
  assert.equal(filterRows(rows, { q: "", channel: "sms", recipient: "", status: "blocked" }).length, 1);
  assert.equal(filterRows(rows, { q: "", channel: "", recipient: "", status: "off" })[0].event, "reminder");
});
test("activation validation reports the API reason instead of claiming a stale edit", () => {
  const error = eventControlError({status:400,data:{error:"Publish this event's DLT Template ID before enabling SMS."}});
  assert.match(error,/DLT Template ID/);
  assert.doesNotMatch(error,/latest values|try again/i);
  assert.match(eventControlError({status:409,data:{error:"Template changed"}}),/latest values are being reloaded/);
  assert.match(eventControlError({status:403,data:{error:"Real Superadmin access required"}}),/Real Superadmin/);
  assert.equal(eventControlError(new Error("Network unavailable")),"The change was not saved. Please try again.");
  assert.equal(eventControlError(null),"The change was not saved. Please try again.");
});
test("off SMS rows expose missing DLT configuration without calling activation-off a setup error", () => {
  assert.deepEqual(eventSetupReasons({blockedReasons:["Publish a DLT Template ID for this event","Published activation is off"]}),["Publish a DLT Template ID for this event"]);
  assert.deepEqual(eventSetupReasons({blockedReasons:["Published activation is off"]}),[]);
});
test("template saves preserve the exact sanitized validation or configuration reason", () => {
  for (const detail of [
    "Invalid input: content.body Unsupported variable: appointment_time",
    "Sender ID and this event's DLT Template ID are required for activation",
    "Configure notification SMS before activation",
    "Superadmin access required",
    "Service unavailable. Please retry.",
  ]) assert.equal(templateSaveError({data:{error:detail}}),`The template was not saved. ${detail}`);
});
test("template saves do not expose raw errors or transport data when no server detail exists", () => {
  const fallback="The template was not saved. No detailed error was returned. Please try again.";
  for (const error of [null, undefined, new Error("fictional-private-transport-data"), {data:null}, {data:{error:" "}}, {data:{error:{debug:"fictional-private-debug-data"}}}]) {
    assert.equal(templateSaveError(error),fallback);
  }
});
test("both template editor views show the server detail and retain the separate conflict flow", () => {
  const editor=readFileSync(new URL("../components/EmailTemplates.tsx",import.meta.url),"utf8");
  assert.equal((editor.match(/templateSaveError\(save\.error\)/g)||[]).length,2);
  assert.equal((editor.match(/save\.isError && !conflict/g)||[]).length,2);
  assert.doesNotMatch(editor,/The template was not saved\. Check the fields and try again\./);
  assert.match(editor,/onError: e => \{ setConfirm\(null\); if \(status\(e\) === 409\) setConflict\(true\); \}/);
});
