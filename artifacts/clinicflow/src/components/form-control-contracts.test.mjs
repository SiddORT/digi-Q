import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { notificationVariableField } from "../../../../lib/api-zod/src/notification-variable-contract.ts";
import { templateTestValue } from "../lib/template-test-fields.ts";
import { buildLogParams, EMPTY_FILTERS, dateTimeRangeError, kolkataToIso } from "../lib/notification-log-format.ts";
import { DATE_FORMATS, TIME_FORMATS, formatDate, formatTime } from "../lib/date-time.ts";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
test("all dynamic visit variables have explicit metadata, readable labels and rendered serialization", () => {
  for (const key of ["appointment_date", "previous_date"]) {
    assert.equal(notificationVariableField(key).kind, "date");
    for (const dateFormat of DATE_FORMATS) {
      const prefs = {dateFormat, timeFormat:"12h"};
      assert.equal(templateTestValue(key,"2030-01-15",prefs),formatDate("2030-01-15",prefs));
      assert.equal(templateTestValue(key,"2030-02-30",prefs),"");
    }
  }
  for (const key of ["session_start","session_end","previous_session_start","previous_session_end"]) {
    assert.equal(notificationVariableField(key).kind,"time");
    for (const timeFormat of TIME_FORMATS) {
      const prefs = {dateFormat:"DD MMM YYYY",timeFormat};
      for (const time of ["00:00","09:07","12:00","23:59"])
        assert.equal(templateTestValue(key,time,prefs),formatTime(time,prefs));
      assert.equal(templateTestValue(key,"24:00",prefs),"");
    }
  }
  assert.equal(notificationVariableField("previous_session_start").label,"Previous Session Start");
  assert.equal(notificationVariableField("otp").label,"OTP");
  for (const key of ["patient_name","appointment_details","reference","queue_token","token_number","unknown_field"])
    assert.equal(templateTestValue(key,"Q-007 Example",{dateFormat:"DD MMM YYYY",timeFormat:"12h"}),"Q-007 Example");
});
test("invalid, partial and reversed ranges cannot become unfiltered requests", () => {
  for (const from of ["2030-02-30T09:00","2030-01-01T","T09:00","2030-01-01T25:00","2030-01-01"]) {
    assert.ok(dateTimeRangeError(from,""));
    assert.throws(()=>buildLogParams({...EMPTY_FILTERS,from}));
    assert.equal(kolkataToIso(from),undefined);
  }
  assert.throws(()=>buildLogParams({...EMPTY_FILTERS,from:"2030-01-02T09:00",to:"2030-01-01T09:00"}));
  assert.equal(dateTimeRangeError("",""),undefined);
  assert.equal(buildLogParams({...EMPTY_FILTERS,to:"2030-01-01T05:30",clinicId:"deleted-clinic"}).to,"2030-01-01T00:00:00.000Z");
  assert.equal(buildLogParams({...EMPTY_FILTERS,clinicId:"deleted-clinic"}).clinicId,"deleted-clinic");
});
test("code entry normalizes digits, preserves zeroes, paste, autofill and manual submission", async () => {
  const r=await build({entryPoints:[new URL("./VerificationCodeInput.tsx",import.meta.url).pathname],bundle:true,write:false,format:"cjs",platform:"node",jsx:"automatic",external:["react","react/jsx-runtime"]});
  const m={exports:{}};new Function("require","module","exports",r.outputFiles[0].text)(require,m,m.exports);
  const {normalizeVerificationCode,VerificationCodeInput}=m.exports;
  assert.equal(normalizeVerificationCode("0 01-234 extra 5"),"001234");
  let changed, prevented=false;
  const el=VerificationCodeInput({value:"001234",onChange:v=>changed=v,"aria-label":"Code"});
  assert.equal(el.props.value,"001234");assert.equal(el.props.autoComplete,"one-time-code");
  assert.equal(el.props.pattern,"[0-9]{6}");assert.equal(el.props.maxLength,6);
  el.props.onPaste({preventDefault:()=>prevented=true,clipboardData:{getData:()=>"0 01-234 99"}});
  assert.equal(changed,"001234");assert.equal(prevented,true);
  el.props.onChange({target:{value:"00ab2"}});assert.equal(changed,"002");
});
test("optional mobile proof cannot participate in the enclosing email authentication form", () => {
  const src=readFileSync(new URL("../auth/RegistrationMobileProof.tsx",import.meta.url),"utf8");
  assert.match(src, /<VerificationCodeInput form="registration-mobile-proof-code"/);
  assert.match(src, /verify && !\/\^\\d\{6\}\$\/\.test\(code\)/);
  assert.doesNotMatch(src, /<VerificationCodeInput[^>]*required/);
});
test("linked duration retains an explicit legacy option and changes only the numeric duration draft", async () => {
  const r=await build({entryPoints:[new URL("./LinkedScheduleControls.tsx",import.meta.url).pathname],bundle:true,write:false,format:"cjs",platform:"node",jsx:"automatic",loader:{".css":"empty"},external:["react","react/jsx-runtime"],plugins:[{name:"no-api",setup(b){
    b.onResolve({filter:/^@workspace\/api-client-react$/},()=>({path:"api",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export const previewClinicSettings=async()=>{throw new Error('No API in duration unit test')};"}));
  }}]});
  const m={exports:{}};new Function("require","module","exports",r.outputFiles[0].text)(require,m,m.exports);
  const initial={enabled:true,consultationMinutes:17,maxTokens:25,tokenPrefix:"A",queueMode:"mixed"};
  let next;
  const el=m.exports.LinkedScheduleControls({value:initial,onChange:v=>next=v});
  const find=node=>{
    if (!node || typeof node !== "object") return undefined;
    if (node.props?.label === "Consultation Duration") return node;
    return [node.props?.children].flat(Infinity).map(find).find(Boolean);
  };
  const duration=find(el);
  assert.ok(duration);assert.equal(duration.props.value,"17");
  assert.deepEqual(duration.props.options.map(o=>o.value),["20","30","60","17"]);
  assert.match(duration.props.options[3].label,/legacy/);
  duration.props.onChange("");assert.equal(next,undefined);
  duration.props.onChange("30");assert.deepEqual(next,{...initial,consultationMinutes:30});
  assert.equal(initial.consultationMinutes,17);
});
