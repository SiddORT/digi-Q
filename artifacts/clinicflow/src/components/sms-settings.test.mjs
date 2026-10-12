import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const rd = f => readFileSync(new URL(f, import.meta.url), "utf8");
const sms = rd("./NotificationSmsSettings.tsx"), map = rd("./sms-mapping.ts"), ev = rd("./EventControls.tsx"), tt = rd("./EventTemplateTest.tsx"), et = rd("./EmailTemplates.tsx"), sh = rd("./WorkspaceShell.tsx"), cl = rd("../clinic.tsx");
test("sms editor uses bounded write-only values with explicit mapping preservation", () => {
  assert.ok(sms.includes('smsConfigurationValues(url,apiKey,full,mapTouched,saved("NOTIFICATION_SMS_MAPPING"))'));
  assert.ok(sms.includes("PasswordInput") && sms.includes('provider: "notificationSms"'));
  assert.ok(!/localStorage|sessionStorage/.test(sms));
});
import {DEFAULT_MAPPING,smsConfigurationValues} from "./sms-mapping.ts";
test("first-time URL/key-only setup submits the displayed default mapping; untouched saved mappings survive key replacement",()=>{
  const initial=smsConfigurationValues("https://provider.example.invalid/send","synthetic-key",DEFAULT_MAPPING,false,false);
  assert.equal(initial.NOTIFICATION_SMS_URL,"https://provider.example.invalid/send");
  assert.equal(initial.NOTIFICATION_SMS_KEY,"synthetic-key");
  assert.deepEqual(JSON.parse(initial.NOTIFICATION_SMS_MAPPING),DEFAULT_MAPPING);
  const replacement=smsConfigurationValues("","replacement",DEFAULT_MAPPING,false,true);
  assert.deepEqual(replacement,{NOTIFICATION_SMS_KEY:"replacement"});
  const edited=smsConfigurationValues("","",{...DEFAULT_MAPPING,authMode:"bearer"},true,true);
  assert.equal(JSON.parse(edited.NOTIFICATION_SMS_MAPPING).authMode,"bearer");
});
test("mapping and url validation", () => {
  assert.ok(map.includes("A-Za-z][A-Za-z0-9_]{0,49}") && map.includes("Only port 443"));
});
test("tests need explicit recipient, confirmation, request id, no retries", () => {
  assert.match(tt, /confirmed: true, requestId: requestId\.current/);
  assert.match(tt, /retry: false/);
  assert.match(tt, /disabled=\{!confirmed \|\| !complete \|\| !to\.trim\(\)/);
});
test("event controls confirm before updating", () => {
  assert.ok(ev.includes("confirmed: true") && ev.includes("checkbox-confirm-control") && ev.includes("=== 409"));
});
test("templates support sms channel and dirty reporting", () => {
  assert.ok(et.includes("channel = \"email\"") && et.includes("SMS_BODY_MAX") && et.includes("onDirtyChange") && et.includes("EventTemplateTest"));
});
test("settings link only for actual superAdmin; legacy templates alias kept", () => {
  assert.ok(sh.includes('actualRole === "superAdmin"'));
  assert.ok(cl.includes('communicationRedirect(userRole,query.get("area"))') && cl.includes('page==="templates"&&["superAdmin","clinicAdmin"]'));
});
import { isRealSuperAdmin, internalHref } from "../lib/settings-access.ts";
test("only real superadmin; demo excluded", () => {
  assert.equal(isRealSuperAdmin({ role: "superAdmin", email: "root@clinic.org" }), true);
  assert.equal(isRealSuperAdmin({ role: "superAdmin", email: "x@clinicflow.example.com" }), true);
  assert.equal(isRealSuperAdmin({ role: "superAdmin", demoFixture: "demo-fixture" }), false);
  assert.equal(isRealSuperAdmin({ role: "clinicAdmin", email: "a@b.org" }), false);
});
test("template test: superadmin-only, semantic reset, immutable retry, shared controls", () => {
  assert.ok(et.includes("isRealSuperAdmin(identity.user) && <EventTemplateTest"));
  assert.ok(tt.includes("JSON.stringify") && tt.includes("submitted.current") && tt.includes("sending.current") && tt.includes("useChannelReadiness") && tt.includes("PhoneInput") && tt.includes("EmailInput") && tt.includes("LoadingButton"));
  assert.ok(et.includes("StatusSwitch") && ev.includes("StatusSwitch"));
});
test("sms drawer busy blocks close; mapping collapsed; anchors guarded", () => {
  assert.ok(sms.includes("busy={busy}") && sms.includes("onBusyChange") && sms.includes("<details") && sms.includes("Advanced API mapping"));
  assert.ok(rd("../lib/use-workspace-leave-guard.ts").includes("internalHref") && cl.includes("useWorkspaceLeaveGuard") && rd("../lib/use-workspace-leave-guard.ts").includes("Leave this page?"));
  assert.ok(ev.includes("getGetNotificationTemplatesQueryKey") && et.includes("getGetEventControlsQueryKey"));
});
