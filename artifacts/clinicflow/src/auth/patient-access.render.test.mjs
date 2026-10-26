import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let render, links;
before(async () => {
  const result = await build({
    stdin: { resolveDir: import.meta.dirname, contents: `
      import {createElement} from "react";
      import {renderToStaticMarkup} from "react-dom/server";
      import {PatientLogin} from "./PatientLogin";
      import {RegistrationMobileProof} from "./RegistrationMobileProof";
      export * as links from "./patient-access-links";
      export const render=(mode,channels,proof=false)=>{
        globalThis.patientAccessSearch=mode;
        return renderToStaticMarkup(createElement(proof?RegistrationMobileProof:PatientLogin,
          proof?{challengeId:"fictional",initialChannels:channels}:{}));
      };
    ` },
    bundle:true, platform:"node", format:"cjs", write:false, jsx:"automatic", loader:{".css":"empty"},
    external:["react","react-dom/server","react/jsx-runtime"],
    alias:{"@":new URL("../",import.meta.url).pathname},
    plugins:[{name:"patient-access-isolation",setup(b){
      b.onResolve({filter:/^(wouter)$|\/(AuthShell|native-auth|PhoneInput)$/}, args=>({path:args.path,namespace:"mock"}));
      b.onLoad({filter:/.*/,namespace:"mock"},({path})=>({loader:"tsx",contents:path==="wouter"
        ? `import React from "react"; export const useLocation=()=>["/patient-login",()=>{}]; export const useSearch=()=>globalThis.patientAccessSearch; export const Link=({href,children,...props})=><a href={href} {...props}>{children}</a>;`
        : path.endsWith("AuthShell")
        ? `import React from "react";export const AuthShell=({children})=><main>{children}</main>;export const AuthCard=({title,description,children})=><section><h1>{title}</h1><p>{description}</p>{children}</section>;`
        : path.endsWith("PhoneInput")
        ? `import React from "react";export const PhoneInput=({onChange,...props})=><input type="tel" {...props} onChange={event=>onChange(event.target.value)}/>;`
        : `export const useNativeAuth=()=>({refresh:async()=>{}});export const authRequest=async()=>{throw new Error("No transport permitted in render tests")};`}));
    }}],
  });
  const mod={exports:{}};
  new Function("module","exports","require",result.outputFiles[0].text)(mod,mod.exports,require);
  render=mod.exports.render;
  links=mod.exports.links;
  globalThis.sessionStorage={getItem:()=>null};
});
test("access presents three choices and never requires an account for guest booking",()=>{
  const html=render("?mode=access");
  for(const label of ["Patient Access","Guest Booking","Patient Sign Up","Patient Login","No account needed"]) assert(html.includes(label),label);
  assert.doesNotMatch(html,/<form/);
});
test("signup collects email and optional country-coded phone, with required email proof and later profile consent",()=>{
  const html=render("?mode=signup");
  assert.match(html,/<h1>Patient Sign Up/);
  for(const copy of ["Email address","Optional registration mobile","country code","Email OTP is required","name and consent","Existing accounts keep their saved details"]) assert(html.includes(copy),copy);
  assert.doesNotMatch(html,/button-patient-sms-login/);
  assert.match(html,/Send required email code/);
});
test("direct login retains both email and SMS but does not collect a registration phone",()=>{
  const html=render("");
  assert.match(html,/<h1>Patient Login/);
  assert.match(html,/button-patient-email-login/);
  assert.match(html,/button-patient-sms-login/);
  assert.doesNotMatch(html,/Optional registration mobile/);
});
test("initial SMS outcomes are visible and optional, never imply proof or receipt",()=>{
  for(const status of ["provider_accepted","provider_rejected","disabled","unavailable","delivery_unknown"]) {
    const html=render("",{sms:{status}},true);
    assert.match(html,/Mobile not verified/);
    assert.match(html,/Email verification is still required/);
    assert.match(html,/Request SMS again in 60s/);
    assert.match(html,/form="registration-mobile-proof-code"/);
    assert.doesNotMatch(html,/Mobile verified for this registration intent/);
    if(status==="provider_accepted") assert.match(html,/delivery is not confirmed/);
    if(status==="disabled") assert.match(html,/no SMS was sent/);
  }
});
test("legacy signup and unsigned clinic booking preserve the shared patient entry and clinic session context",()=>{
  const app=readFileSync(new URL("../App.tsx",import.meta.url),"utf8");
  const clinic=readFileSync(new URL("../clinic.tsx",import.meta.url),"utf8");
  assert.match(app,/patientSignupDestination\(ticket\)/);
  assert.match(app,/Route path="\/register"><Redirect to="\/patient-login\?mode=signup"/);
  assert.match(clinic,/sessionStorage.setItem\("clinicflow-qr",reference\)/);
  assert.match(clinic,/postOnboardingDestination\(me.data.user.role,sessionStorage.getItem\("clinicflow-qr"\)\)/);
  assert.match(clinic,/link-signup-booking/);
  assert.match(clinic,/mobile:me.data.user\?\.mobile\|\|""/);
  assert.match(clinic,/me.data.user\?\.mobile \? \[\{key:"mobile",type:"tel",disabled:true\}\] : \[\]/);
});
test("signup links and a mocked saved clinic context continue to the original booking after onboarding",()=>{
  assert.equal(links.patientSignupDestination(null),"/patient-login?mode=signup");
  assert.equal(links.patientSignupDestination("fictional+ticket"),"/set-password?token=fictional%2Bticket");
  const savedSession=new Map([["clinicflow-qr","fictional-return"]]);
  const reference=savedSession.get("clinicflow-qr");
  assert.equal(links.patientGuestDestination(reference),"/book/fictional-return");
  assert.equal(links.postOnboardingDestination("patient",reference),"/book/fictional-return");
  assert.equal(links.postOnboardingDestination("clinicAdmin",reference),"/book/fictional-return");
  savedSession.clear();
  assert.equal(links.patientGuestDestination(savedSession.get("clinicflow-qr")??null),"/guest-booking");
  assert.equal(links.postOnboardingDestination("patient",null),"/patient/dashboard");
  assert.equal(links.postOnboardingDestination("clinicAdmin",null),"/admin/dashboard");
});
test("onboarding editor applies the declared phone lock and required consent to actual controls",()=>{
  const editor=readFileSync(new URL("../resources.tsx",import.meta.url),"utf8");
  assert.match(editor,/<PhoneInput \{\.\.\.input\} disabled=\{field.disabled\}/);
  assert.match(editor,/<input type="checkbox"[^>]+required=\{field.required\}/);
  assert.match(editor,/form.register\(field.key,\{required:field.required \?/);
});
