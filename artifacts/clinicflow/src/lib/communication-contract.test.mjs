import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { eventControlBody, canSendSmsTest, communicationRedirect, retiredSettingsDestination } from "./communication-routes.ts";
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
  const page = src("NotificationTemplatesPage.tsx"), t = src("EmailTemplates.tsx"), sms = src("SmsProviderPanel.tsx"), cs = src("CommunicationSettings.tsx");
  const management = src("useNotificationManagement.ts");
  assert.doesNotMatch(page, /useEffect\([^]*?\.mutate/);
  assert.match(t, /setConfirm\("draft"\)/);
  assert.match(t, /onSubmit=\{\(\) => run\(confirm\)\}/);
  assert.match(sms, /const runTest = async \(\) => \{\s*if \(!can\) return;[\s\S]*if \(!await confirm\.ask/);
  assert.match(sms, /onClick=\{\(\) => void runTest\(\)\}/);
  assert.match(management, /confirmed: true/);
  assert.match(management, /if \(!ok \|\| !alive.current\) return/);
});
test("provider screens are inline, not drawers", () => {
  assert.match(src("CommunicationSettings.tsx"), /NotificationSmsSettings key=\{`sms-\$\{resetN\}`\} inline/);
  assert.match(src("EmailProviderPanel.tsx"), /<EmailForm/);
  assert.doesNotMatch(src("IntegrationSettings.tsx"), /provider="smtp"/);
  assert.match(src("NotificationSmsSettings.tsx"), /inline\) return[\s\S]*<SmsProviderPanel/);
});

test("every unsaved or in-flight surface uses the shared history/sidebar leave guard", () => {
  const g = src("../lib/use-workspace-leave-guard.ts");
  assert.match(g, /popstate/); assert.match(g, /closest\?\.\("a\[href\]"\)/);
  assert.match(src("CommunicationSettings.tsx"), /useWorkspaceLeaveGuard\("\/admin\/communication", any \|\| anyBusy/);
  assert.match(src("NotificationTemplatesPage.tsx"), /useWorkspaceLeaveGuard\("\/admin\/templates", dirty \|\| busy/);
  assert.match(src("IntegrationSettings.tsx"), /dirty=\{editorDirty\} busy=\{editorBusy\}/);
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
  return new Function("communicationRedirect", "clinicLandingDestination", "retiredSettingsDestination", `${body}; return legacyDestination;`)(communicationRedirect, () => null, retiredSettingsDestination);
}
test("actual legacyDestination redirects old settings areas to the new pages and keeps other query params", () => {
  const d = realLegacyDestination();
  assert.equal(d("settings", "superAdmin", "?area=sms"), "/admin/communication?tab=sms");
  assert.equal(d("settings", "superAdmin", "?area=email&x=1"), "/admin/communication?tab=email&x=1");
  assert.equal(d("settings", "superAdmin", "?area=email&tab=sms"), "/admin/communication?tab=email");
  assert.equal(d("settings", "superAdmin", "?area=events"), "/admin/templates");
  assert.equal(d("settings", "superAdmin", "?area=templates"), "/admin/templates");
  assert.equal(d("settings", "clinicAdmin", ""), "/admin/clinic");
  assert.equal(d("settings", "clinicAdmin", "?area=sms"), "/admin/clinic");
  for (const role of ["clinicAdmin", "doctor", "receptionist", "patient"]) {
    const landing = retiredSettingsDestination(role);
    assert.equal(d("settings", role, "?area=notifications"), role === "clinicAdmin" ? "/admin/templates" : landing);
    assert.equal(d("settings", role, "?area=notifications&clinicId=fictional"), role === "clinicAdmin" ? "/admin/templates?clinicId=fictional" : landing);
  }
  assert.equal(d("settings", "superAdmin", "?area=notifications"), "/admin/templates");
  assert.equal(d("settings", "superAdmin", "?area=smtp"), "/admin/communication?tab=email");
  assert.equal(d("communication", "superAdmin", "?tab=email"), null); // No redirect loop.
  assert.equal(d("integrations", "superAdmin", ""), "/admin/settings?area=integrations");
  assert.equal(d("templates", "superAdmin", ""), null);
  assert.equal(d("templates", "clinicAdmin", ""), null);
});
test("email panel: binding, no casts, guards, write-only credentials, confirmed test", () => {
  const e = src("EmailProviderPanel.tsx"), cs = src("CommunicationSettings.tsx");
  assert.ok(!/as never|as unknown as/.test(e));
  assert.match(cs, /<EmailProviderPanel[^>]*onDirtyChange=\{mark\("smtp"\)\}[^>]*onBusyChange=\{markBusy\("smtp"\)\}/);
  for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_FROM\\b", "SMTP_FROM_NAME", "SMTP_USER", "SMTP_PASSWORD", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "SMTP_NOTIFICATIONS_ENABLED"]) assert.match(e, new RegExp(k));
  assert.match(e, /if \(user\) v\.SMTP_USER = user/); assert.match(e, /if \(pass\) v\.SMTP_PASSWORD = pass/);
  assert.match(e, /f\.name !== base\.fromName \|\| f\.from !== base\.fromEmail\) v\.SMTP_FROM_NAME/);
  assert.match(e, /!saved\("SMTP_PORT"\)\) v\.SMTP_PORT/);
  assert.match(e, /set\(e\.target\.checked \? \{ tls: true, ssl: false \}/); assert.match(e, /set\(e\.target\.checked \? \{ ssl: true, tls: false \}/);
  assert.match(e, /Plain SMTP is not allowed/);
  assert.match(e, /setQueryData\([^)]*\), next\);[\s\S]*invalidateQueries/);
  assert.ok(!/onDirty\(false\)|dr\.current\?\.\(false\);?\s*\}\s*\)/.test(e.split("doSave")[1] ?? ""));
  assert.match(e, /if \(mode !== "database"\) return v;/);
  assert.match(e, /const runTest = async \(\) => \{\s*if \(!canTest\) return;\s*if \(testing\.current\) return;[\s\S]*if \(!await confirm\.ask/);
  assert.match(e, /canTest = ready &&/); assert.ok(!/canTest[^;]*editable/.test(e));
  assert.match(e, /Username is configured|\$\{noun\} is configured/); assert.match(e, /Replace \$\{label\}/);
});
test("removed preference UI has no rendering or obsolete direct links; inbox stays active", () => {
  const clinic = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(clinic, /NotificationSettings|id:"notifications"/);
  assert.match(clinic, /p==="settings"\?hasWorkspaceSettings\(identity\.user!\.role\)/);
  assert.match(clinic, /page==="communication"&&identity\.user!\.role==="superAdmin"/);
  assert.match(clinic, /function PlatformSettings\(\)\{\s*return <PlatformPreferences\/>;/);
  for (const file of ["NotificationsPanel.tsx", "NotificationTemplatesPage.tsx", "EmailTemplates.tsx", "ClinicSettings.tsx"]) {
    assert.doesNotMatch(src(file), /area=notifications|link-notification-settings/);
  }
  const inbox = src("NotificationsPanel.tsx");
  for (const token of ["useListNotifications", "useMarkNotificationsRead", "q.data?.unread", "button-mark-all-read"]) assert.ok(inbox.includes(token));
});
test("email diagnostics compose saved readiness, safe statuses and manual no-send checks", () => {
  const e = src("EmailProviderPanel.tsx"), d = src("EmailDiagnostics.tsx"), c = src("IntegrationConnectionCheck.tsx");
  assert.match(e, /<EmailDiagnostics r=\{data\.smtp\}/);
  for (const token of ["r.ready", "r.source", "r.keys.map", "r.revision", 'key={savedConfiguration}', "not unsaved edits", "does not confirm", "Refresh status"]) assert.ok(d.includes(token), token);
  assert.match(c, /onClick=\{\(\) => check\.mutate/);
  assert.doesNotMatch(c, /useEffect|useSend/);
});
