import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
let parse,feedback;
before(async()=>{
  const result=await build({entryPoints:[new URL("./owner-mobile-guidance.ts",import.meta.url).pathname],bundle:true,platform:"node",format:"cjs",write:false});
  const module={exports:{}};
  new Function("module","exports","require",result.outputFiles[0].text)(module,module.exports,require);
  ({ownerMobileGuidance:parse,ownerRequestFeedback:feedback}=module.exports);
});
const guidance=(minute=4,hour=9,ip=59)=>({
  subjectMinute:{remaining:minute,resetAfterSeconds:60},
  mobileHour:{remaining:hour,resetAfterSeconds:3600},
  sourceIp:{remaining:ip,resetAfterSeconds:600},retryAfterSeconds:0,
});
test("guidance labels initial-inclusive minute and mobile-hour counts and never overstates overlapping budgets",()=>{
  const result=feedback({guidance:guidance(),receivedAt:1000},1000);
  assert.match(result.text,/4 requests left in this minute/);
  assert.match(result.text,/9 requests left for this mobile in this hour/);
  assert.match(result.text,/include the first request and unsuccessful sends/);
  assert.equal(result.wait,0);
  const exhausted=guidance(0,0,0);
  assert.equal(feedback({guidance:exhausted,receivedAt:1000},1000).wait,3600);
  assert.equal(feedback({guidance:exhausted,receivedAt:1000},61000).wait,3540);
  assert.doesNotMatch(feedback({guidance:exhausted,receivedAt:1000},61000).text,/in this minute/);
  assert.deepEqual(feedback({guidance:exhausted,receivedAt:1000},3601000),{wait:0,text:""});
});
test("guidance validates and strips response fields and preserves unknown-delivery waits",()=>{
  const g=guidance();g.retryAfterSeconds=60;
  assert.deepEqual(parse({...g,key:"PRIVATE",mobile:"PRIVATE",subjectMinute:{...g.subjectMinute,otp:"PRIVATE"}}),g);
  for(const value of [null,{}, {...g,retryAfterSeconds:Infinity},{...g,subjectMinute:{remaining:6,resetAfterSeconds:60}}])
    assert.equal(parse(value),undefined);
  assert.equal(feedback({guidance:g,receivedAt:1000},30500).wait,31);
  assert.deepEqual(feedback(undefined,1000),{wait:0,text:""});
});
