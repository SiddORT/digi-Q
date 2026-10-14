import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const {build} = createRequire(import.meta.resolve("vite"))("esbuild");
let render, summary, policy;
before(async()=>{
  const result=await build({
    stdin:{resolveDir:import.meta.dirname,contents:`
      import {createElement} from "react";
      import {renderToStaticMarkup} from "react-dom/server";
      import {SecurityChannelNotice,securityChannelSummary} from "./SecurityChannelNotice";
      export * from "../lib/security-template-events";
      export const render=channels=>renderToStaticMarkup(createElement(SecurityChannelNotice,{channels}));
      export const summary=securityChannelSummary;
    `},
    bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",
    external:["react","react-dom/server","react/jsx-runtime"],
  });
  const module={exports:{}};
  new Function("module","exports","require",result.outputFiles[0].text)(module,module.exports,require);
  ({render,summary,...policy}=module.exports);
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
test("required event rules keep booking optional and security controls non-optional",()=>{
  for(const event of policy.SECURITY_EVENTS)assert(policy.requiredSecurityEvent(event));
  assert(!policy.requiredSecurityEvent("booking"));
  assert(policy.securityTemplateTarget("clinic_registration_otp","clinicAdmin","email"));
  assert(!policy.securityTemplateTarget("clinic_registration_otp","clinicAdmin","sms"));
  assert(policy.securityTemplateTarget("registration_mobile_otp","patient","sms"));
  assert(policy.securityTemplateTarget("staff_setup","superAdmin","email"));
  const root=new URL("../",import.meta.url);
  const templates=readFileSync(new URL("components/EmailTemplates.tsx",root),"utf8");
  const controls=readFileSync(new URL("components/NotificationTemplatesPage.tsx",root),"utf8");
  assert.match(templates,/disabled=\{save.isPending \|\| requiredSecurityEvent\(event\)\}/);
  assert.match(controls,/requiredSecurityEvent\(event\) \? "Required"/);
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
