import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
let render;
before(async()=>{
  const result=await build({stdin:{resolveDir:import.meta.dirname,contents:`
    import {createElement} from "react";
    import {renderToStaticMarkup} from "react-dom/server";
    import {TemplateDrawerFields} from "./TemplateDrawerFields";
    export const render=(recipient,compact)=>renderToStaticMarkup(createElement(TemplateDrawerFields,{
      form:{enabled:false,subject:"Fictional",body:"Exact  literal {{otp}}; {{expiry_minutes}} minutes.",prefix:"",footer:"",logoUrl:"",dltTemplateId:"fictional"},
      sms:true,errors:{},variables:["otp","expiry_minutes"],scopeName:"System Default",set:()=>{},
      templateKey:"registration_mobile_otp",recipient,compact,active:null
    }));
  `},bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",loader:{".css":"empty"},external:["react","react-dom/server","react/jsx-runtime"]});
  const module={exports:{}};
  new Function("module","exports","require",result.outputFiles[0].text)(module,module.exports,require);
  render=module.exports.render;
});
test("compact and full registration editors explain exact owner wording, publication and provider prerequisites",()=>{
  for(const compact of [true,false]) {
    const html=render("clinicAdmin",compact);
    for(const text of ["required mobile proof before account details","public owner registration","Superadmin-led",
      "{{otp}}","{{expiry_minutes}}","preserve all approved literal text, spacing and punctuation",
      "Save Draft does not change requests","Publish the wording","enable the Clinic Admin SMS row",
      "do not establish DLT approval","Keep in Touch","no Entity ID","mapping requires DLT",
      "not patient SMS login","staff phone verification","post-creation clinic welcome SMS",
      "stop and resolve it","10 minutes","Exact  literal {{otp}}; {{expiry_minutes}} minutes."]) assert(html.includes(text),text);
    assert.doesNotMatch(html,/supported only for the patient login/);
  }
});
test("Patient guidance remains optional and directs configuration to its separate row",()=>{
  const html=render("patient",true);
  assert.match(html,/Patient: optional phone proof/);
  assert.match(html,/enable the Patient SMS row/);
  assert.doesNotMatch(html,/Clinic Admin: required mobile proof/);
});
