import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { eventControlBody, canSendSmsTest, communicationRedirect } from "./communication-routes.ts";
import { previewText } from "./template-preview.ts";
const src = f => readFileSync(new URL(`../components/${f}`, import.meta.url), "utf8");

test("event gate change is explicit, confirmed, future-only and scoped", () => {
  const b = eventControlBody({ channel: "sms", event: "booking", recipient: "patient", revision: 4 }, true, "");
  assert.deepEqual(b, { channel: "sms", event: "booking", recipient: "patient", clinicId: undefined, revision: 4, enabled: true, confirmed: true });
  assert.equal(eventControlBody({ channel: "email", event: "reminder", recipient: "doctor", revision: 1 }, false, "c1").clinicId, "c1");
});
test("SMS test needs explicit confirmation and ready config", () => {
  const ok = { ready: true, confirmed: true, recipient: "+910000000000", message: "hi", pending: false };
  assert.equal(canSendSmsTest(ok), true);
  for (const k of [{ ready: false }, { confirmed: false }, { recipient: "" }, { message: " " }, { pending: true }]) assert.equal(canSendSmsTest({ ...ok, ...k }), false);
});
test("preview substitution is identical for email and SMS and never emits markup", () => {
  assert.equal(previewText("Hi {{ patient_name }} at {{clinic_name}}", "Asha Clinic"), "Hi [patient name] at Asha Clinic");
  assert.equal(previewText("<b>{{x}}</b>", "C"), "<b>[x]</b>");
});
test("auth flows are never routed to optional templates", () => {
  assert.equal(communicationRedirect("clinicAdmin", "sms"), null);
});
test("nothing sends or writes on page load, draft save goes through confirm, SMS test is button-only", () => {
  const page = src("NotificationTemplatesPage.tsx"), t = src("EmailTemplates.tsx"), sms = src("SmsTestMessage.tsx"), cs = src("CommunicationSettings.tsx");
  assert.ok(!/useEffect/.test(page), "no effects that could mutate on load");
  assert.match(t, /setConfirm\("draft"\)/);
  assert.match(t, /onSubmit=\{\(\) => run\(confirm\)\}/);
  assert.match(sms, /onSubmit=\{e => \{\s*e\.preventDefault\(\); if \(!can\) return;/);
  assert.match(page, /confirmed/);
});
test("provider screens are inline, not drawers", () => {
  assert.match(src("CommunicationSettings.tsx"), /NotificationSmsSettings key=\{`sms-\$\{resetN\}`\} inline/);
  assert.match(src("IntegrationSettings.tsx"), /inline && data\.editable && <IntegrationEditor/);
  assert.match(src("NotificationSmsSettings.tsx"), /inline && d\.editable && <Editor/);
});

test("every unsaved or in-flight surface uses the shared history/sidebar leave guard", () => {
  const g = src("../lib/use-workspace-leave-guard.ts");
  assert.match(g, /popstate/); assert.match(g, /closest\?\.\("a\[href\]"\)/);
  assert.match(src("CommunicationSettings.tsx"), /useWorkspaceLeaveGuard\("\/admin\/communication", any \|\| anyBusy/);
  assert.match(src("NotificationTemplatesPage.tsx"), /useWorkspaceLeaveGuard\("\/admin\/templates", dirty \|\| busy/);
  assert.match(readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8"), /useWorkspaceLeaveGuard\("\/admin\/settings"/);
});
test("tab discard remounts provider forms so secrets are cleared; secrets use Configured + Replace", () => {
  const c = src("CommunicationSettings.tsx");
  assert.match(c, /discardAll\(\)/); assert.match(c, /key=\{`smtp-\$\{resetN\}`\}/); assert.match(c, /key=\{`sms-\$\{resetN\}`\}/);
  assert.match(src("SecretField.tsx"), /Configured/); assert.match(src("SecretField.tsx"), /Replace/);
  assert.match(src("IntegrationEditor.tsx"), /<SecretField/); assert.match(src("NotificationSmsSettings.tsx"), /<SecretField/);
});
test("template Cancel confirms before discarding and never resets the server draft", () => {
  const t = src("EmailTemplates.tsx");
  assert.match(t, /onCancel=\{\(\) => guard\(\(\) => \{ setForm\(\{ \.\.\.base! \}\)/);
});

// Executes the real legacyDestination from clinic.tsx (types stripped, landing helper stubbed) so wiring regressions surface.
function realLegacyDestination() {
  const text = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  const start = text.indexOf("export function legacyDestination");
  let i = text.indexOf("{", text.indexOf(")", start)), depth = 0, end = i;
  for (; end < text.length; end++) { if (text[end] === "{") depth++; else if (text[end] === "}" && --depth === 0) break; }
  const body = text.slice(start, end + 1).replace("export function legacyDestination(page:string,userRole:string,search:string):string|null", "function legacyDestination(page,userRole,search)").replace(/\b(base|area):string/g, "$1");
  return new Function("communicationRedirect", "clinicLandingDestination", `${body}; return legacyDestination;`)(communicationRedirect, () => null);
}
test("actual legacyDestination redirects old settings areas to the new pages and keeps other query params", () => {
  const d = realLegacyDestination();
  assert.equal(d("settings", "superAdmin", "?area=sms"), "/admin/communication?tab=sms");
  assert.equal(d("settings", "superAdmin", "?area=email&x=1"), "/admin/communication?tab=email&x=1");
  assert.equal(d("settings", "superAdmin", "?area=events"), "/admin/templates");
  assert.equal(d("settings", "superAdmin", "?area=templates"), "/admin/templates");
  assert.equal(d("settings", "clinicAdmin", ""), "/admin/templates");
  assert.equal(d("settings", "clinicAdmin", "?area=sms"), null);
  assert.equal(d("templates", "superAdmin", ""), null);
  assert.equal(d("templates", "clinicAdmin", ""), null);
});
