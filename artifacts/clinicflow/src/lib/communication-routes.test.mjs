import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { communicationRedirect, communicationTab, filterRows } from "./communication-routes.ts";
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
