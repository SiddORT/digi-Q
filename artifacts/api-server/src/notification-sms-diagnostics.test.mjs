import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
const path=resolve(import.meta.dirname,`.sms-diagnostics-${process.pid}.mjs`);
await build({entryPoints:[resolve(import.meta.dirname,"lib/notification-sms-diagnostics.ts")],outfile:path,bundle:true,platform:"node",format:"esm"});
const api=await import(path);
after(()=>rm(path,{force:true}));
test("recognized provider reasons produce safe categories, not raw messages",()=>{
  const cases=[
    [401,"", "authentication_failed"],[403,"", "authentication_failed"],[404,"","endpoint_not_found"],
    [429,"","rate_limited"],[200,"Invalid API key", "authentication_failed"],
    [200,"Invalid DLT Template ID","dlt_validation_failed"],[200,"Message does not match template","dlt_validation_failed"],
    [200,"Invalid Sender ID","sender_validation_failed"],[200,"Invalid mobile number","recipient_validation_failed"],
    [200,"Insufficient credits","insufficient_credit"],[200,"Account suspended","account_or_route_blocked"],
    [200,"Message too long","message_validation_failed"],
  ];
  for(const [status,message,code] of cases){
    const body=JSON.stringify({Success:false,Message:`${message} private-key private-bearer +919876543213`});
    const result=api.smsRejectionDiagnostic(status,body);
    assert.equal(result.code,code);assert.equal(result.httpStatus,status);
    assert(!JSON.stringify(result).includes("private-key"));assert(!JSON.stringify(result).includes("private-bearer"));
    assert(!JSON.stringify(result).includes("+919876543213"));
  }
});
test("malformed, unrecognized and nested responses never leak response data",()=>{
  for(const body of ["private-key","<html>private-bearer</html>","{}",JSON.stringify({Message:{secret:"private-key"}})]){
    const result=api.smsRejectionDiagnostic(200,body);
    assert.equal(result.code,"unspecified_rejection");assert(!JSON.stringify(result).includes("private-key"));
  }
  assert.equal(api.storedSmsDiagnostic("__proto__"),undefined);
  assert.equal(api.storedSmsDiagnostic("arbitrary private text"),undefined);
  assert.equal(api.storedSmsDiagnostic("authentication_failed","200").httpStatus,undefined);
});
