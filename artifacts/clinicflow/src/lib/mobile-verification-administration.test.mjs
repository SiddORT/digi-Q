import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const source=await readFile(new URL("./mobile-verification-administration.ts",import.meta.url),"utf8");
const {code}=await transform(source,{loader:"ts",format:"esm"});
const api=await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("presentation merges only mobile proof events, never their underlying purpose",()=>{
  assert.equal(api.administrationEvent("registration_mobile_otp"),"mobile_verification");
  assert.equal(api.administrationEvent("staff_mobile_otp"),"mobile_verification");
  for(const event of ["patient_login_otp","staff_email_otp","patient_email_otp","clinic_registration_otp","booking","staff_welcome"])
    assert.equal(api.administrationEvent(event),event);
  assert.notEqual(api.mobileVerificationContext("registration_mobile_otp"),api.mobileVerificationContext("staff_mobile_otp"));
});
test("shared recipient presentation retains original targets, saved previews, filters and editor guards",async()=>{
  const ui=await readFile(new URL("../components/NotificationTemplatesPage.tsx",import.meta.url),"utf8");
  assert.match(ui,/new Set\(rows\.map\(r => r\.recipient\)\)/);
  assert.match(ui,/const event = r\.event/);
  assert.match(ui,/setEditing\(\{ channel: r\.channel, event, recipient: r\.recipient \}\)/);
  assert.match(ui,/management\.change\(r\.row\)/);
  assert.match(ui,/it\.content\.body/);
  assert.match(ui,/DLT Template ID:/);
  assert.match(ui,/filterRows/);
  assert.match(ui,/useWorkspaceLeaveGuard/);
  assert.match(ui,/dirty \? setDiscard/);
  assert.match(ui,/!mobile && group\.optional\.length/,"no ambiguous switch activating both purposes");
  assert.match(ui,/notificationGroup\(items, targetEvent\)/,"purpose bulk controls use the full unfiltered original event");
  assert.match(ui,/management\.changeGroup\(targetEvent\)/,"existing purpose-specific batch operations are retained");
});
