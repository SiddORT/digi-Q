import test from "node:test";
import assert from "node:assert/strict";
import { resolveBookingSession } from "./session-selection.ts";

const a={sessionId:"a",available:true,remainingTokens:4,queueMode:"mixed",startTime:"09:00"};
const b={...a,sessionId:"b"};
test("sole eligible defaults; multiple options require a deliberate choice",()=>{
  assert.equal(resolveBookingSession([a],"","advance").sessionId,"a");
  assert.equal(resolveBookingSession([a,b],"","advance").session,undefined);
  assert.equal(resolveBookingSession([a,{...b,queueMode:"walkInsOnly"}],"","advance").sessionId,"a");
});
test("explicit choices cannot survive capacity, mode, availability, or removal changes",()=>{
  for(const session of [{...a,remainingTokens:0},{...a,available:false},{...a,queueMode:"walkInsOnly"}]){
    const selected=resolveBookingSession([session,b],"a","advance");
    assert.equal(selected.session,undefined);
    assert.ok(selected.selectionIssue);
    assert.equal(selected.sessionId,"a","never silently substitute b");
  }
  assert.ok(resolveBookingSession([b],"a","advance").selectionIssue);
  assert.equal(resolveBookingSession([{...a,available:false}],"","advance").session,undefined);
});
test("walk-in date, queue opening and break restrictions are part of eligibility",()=>{
  assert.equal(resolveBookingSession([a],"a","walkIn","2030-01-01","2030-01-02","10:00").session,undefined);
  assert.equal(resolveBookingSession([a],"a","walkIn","2030-01-01","2030-01-01","08:00").session,undefined);
  assert.equal(resolveBookingSession([{...a,breakStart:"10:00",breakEnd:"11:00"}],"a","walkIn","2030-01-01","2030-01-01","10:30").session,undefined);
  assert.equal(resolveBookingSession([a],"a","walkIn","2030-01-01","2030-01-01","09:00").sessionId,"a");
});
test("operational filters can still select unavailable historical sessions",()=>{
  assert.equal(resolveBookingSession([{...a,available:false}],"a").sessionId,"a");
});
