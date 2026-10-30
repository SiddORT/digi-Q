import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyError,canRetryLoad,retryWaitSeconds } from "./friendly-error.ts";
import { deliverySummary } from "./delivery-summary.ts";
test("technical transport and server details never reach ordinary errors",()=>{
  for(const text of ["HTTP 503", "Unexpected token < in JSON","SMTP authentication rejected","provider payload rejected","SQLSTATE 23505", "Error: ECONNRESET", "registration intent missing", "Invalid challenge", "Bearer secret"]){
    const result=friendlyError({status:503,message:text,data:{error:text}},"load","We couldn’t load this record.");
    assert.doesNotMatch(result,/HTTP|SMTP|provider|SQLSTATE|ECONN|challenge|registration intent|Bearer|JSON/);
  }
});
test("permanent load errors do not offer a retry; transient reads remain retryable",()=>{
  for(const status of [400,401,403,404,410,422])assert.equal(canRetryLoad({status}),false,status);
  for(const status of [408,429,500,502,503])assert.equal(canRetryLoad({status}),true,status);
  assert.equal(canRetryLoad({status:503,data:{code:"EMAIL_UNCONFIGURED"}}),false);
  assert.equal(canRetryLoad(new Error("network failure")),true);
});
test("server wait periods come from structured values and fixed safe messages",()=>{
  assert.equal(retryWaitSeconds({headers:new Headers({"Retry-After":"11"})}),11);
  assert.equal(retryWaitSeconds({data:{retryAfterSeconds:4}}),4);
  assert.equal(retryWaitSeconds({data:{error:"Too many attempts. Try again in 121 seconds."}}),121);
  assert.equal(retryWaitSeconds({data:{error:"Bearer secret 345"}}),0);
});
test("HTTP success cannot turn a rejected or uncertain test into a submitted success",()=>{
  for(const channel of ["email","SMS"]){
    assert.match(deliverySummary("provider_accepted",channel),/submitted.*isn’t confirmed/);
    assert.match(deliverySummary("provider_rejected",channel),/could not be sent/);
    assert.match(deliverySummary("pre_dispatch_failed",channel),/was not sent/);
    assert.match(deliverySummary("not_dispatched",channel),/was not sent/);
    assert.match(deliverySummary("delivery_unknown",channel),/couldn’t confirm whether.*same request/);
    assert.doesNotMatch(deliverySummary("not-a-real-state",channel),/submitted/);
  }
});
