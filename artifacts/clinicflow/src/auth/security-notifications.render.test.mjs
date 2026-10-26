import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const {build} = createRequire(import.meta.resolve("vite"))("esbuild");
let render, renderRegistration, summary, friendly, policy;
before(async()=>{
  const result=await build({
    stdin:{resolveDir:import.meta.dirname,contents:`
      import {createElement} from "react";
      import {renderToStaticMarkup} from "react-dom/server";
      import {SecurityChannelNotice,securityChannelSummary} from "./SecurityChannelNotice";
      import {RegistrationEmailNotice} from "./RegistrationEmailNotice";
      export {friendlyError as friendly} from "../lib/friendly-error";
      export * from "../lib/security-template-events";
      export const render=channels=>renderToStaticMarkup(createElement(SecurityChannelNotice,{channels}));
      export const renderRegistration=channels=>renderToStaticMarkup(createElement(RegistrationEmailNotice,{channels}));
      export const summary=securityChannelSummary;
    `},
    bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",
    external:["react","react-dom/server","react/jsx-runtime"],
  });
  const module={exports:{}};
  new Function("module","exports","require",result.outputFiles[0].text)(module,module.exports,require);
  ({render,renderRegistration,summary,friendly,...policy}=module.exports);
});
test("required registration email errors are prominent, actionable and independent of expected absent SMS",()=>{
  for(const status of ["provider_rejected","pre_dispatch_failed","delivery_unknown","disabled"]) {
    const html=renderRegistration({email:{status},sms:{status:"unavailable"}});
    assert.match(html,/role="alert"/);
    assert.match(html,/email verification is not complete/);
    assert.match(html,/registration details are retained/);
    assert.match(html,/optional SMS cannot replace/);
    assert.doesNotMatch(html,/SMS:|Approved template and provider configuration/);
    if(status==="delivery_unknown")assert.match(html,/Wait and check/);
    if(status==="provider_rejected")assert.match(html,/System Admin.*Resend code/);
  }
  const accepted=renderRegistration({email:{status:"provider_accepted"},sms:{status:"unavailable"}});
  assert.match(accepted,/delivery is not confirmed/);
  assert.doesNotMatch(accepted,/role="alert"|SMS:/);
  assert.match(renderRegistration(undefined),/Email verification is still required/);
  for(const code of ["REGISTRATION_EMAIL_REJECTED","REGISTRATION_EMAIL_NOT_SENT"]) {
    const message=friendly({status:503,data:{code,error:"unsafe-response"}},"auth");
    assert.match(message,/System Admin/);
    assert.match(message,/previous code and registration details are retained/);
    assert.doesNotMatch(message,/unsafe-response/);
  }
});
test("channel feedback renders independent outcomes, masked destinations and no delivery claim",()=>{
  const html=render({email:{status:"provider_accepted",destination:"e***@example.invalid"},sms:{status:"delivery_unknown",destination:"***3210"}});
  assert.match(html,/role="status"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/delivery is not confirmed/);
  assert.match(html,/Outcome uncertain/);
  assert.match(html,/\*\*\*3210/);
  assert.doesNotMatch(html,/\+919876543210/);
  assert.match(summary({sms:{status:"unavailable"}}),/SMS: Unavailable/);
  for(const status of ["provider_rejected","pre_dispatch_failed","not_requested"])assert(!summary({email:{status}}).includes("undefined"));
});
test("security events stay outside Optional Delivery and retain platform-owned activation",()=>{
  for(const event of policy.SECURITY_EVENTS)assert(policy.requiredSecurityEvent(event));
  assert(!policy.requiredSecurityEvent("booking"));
  assert(policy.securityTemplateTarget("clinic_registration_otp","clinicAdmin","email"));
  assert(!policy.securityTemplateTarget("clinic_registration_otp","clinicAdmin","sms"));
  assert(policy.securityTemplateTarget("registration_mobile_otp","patient","sms"));
  assert(policy.securityTemplateTarget("staff_setup","superAdmin","email"));
  for(const role of ["superAdmin","clinicAdmin","doctor","receptionist"]) {
    assert(policy.requiredSecurityEvent("staff_email_otp"));
    assert(policy.requiredSecurityEvent("staff_mobile_otp"));
    assert(policy.securityTemplateTarget("staff_email_otp",role,"email"));
    assert(policy.securityTemplateTarget("staff_mobile_otp",role,"sms"));
    assert(!policy.securityTemplateTarget("staff_mobile_otp",role,"email"));
  }
  assert(policy.requiredSecurityEvent("patient_login_otp"));
  assert(!policy.securityTemplateTarget("staff_mobile_otp","patient","sms"));
  const root=new URL("../",import.meta.url);
  const templates=readFileSync(new URL("components/EmailTemplates.tsx",root),"utf8");
  const controls=readFileSync(new URL("components/NotificationTemplatesPage.tsx",root),"utf8");
  assert.match(templates,/<ActivationNote on=\{isOn\} required=\{requiredSecurityEvent\(event\)\}/);
  assert.match(controls,/const rowCan = r\.row\.canActivate \?\? gateCan/);
  assert.match(controls,/disabled=\{!rowCan \|\| unavailable \|\| !!editing\}/);
  assert.match(controls,/Platform security delivery; ignores Optional Delivery and operational opt-outs/);
});
test("email registration collects optional phone but separate proof cannot replace required email code",()=>{
  const root=new URL("../",import.meta.url);
  const registration=readFileSync(new URL("components/ClinicRegistration.tsx",root),"utf8");
  const patient=readFileSync(new URL("auth/PatientLogin.tsx",root),"utf8");
  const proof=readFileSync(new URL("auth/RegistrationMobileProof.tsx",root),"utf8");
  assert.match(registration,/Required email verification code/);
  assert.match(registration,/RegistrationMobileProof/);
  assert.match(patient,/Optional registration mobile/);
  assert.match(patient,/If this account is eligible/);
  assert.match(proof,/registration\/mobile\/verify/);
  assert.doesNotMatch(proof,/refresh\(|navigate\(|authenticated/);
  assert.match(proof,/type="button"/);
});
