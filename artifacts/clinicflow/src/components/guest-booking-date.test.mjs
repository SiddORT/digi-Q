import assert from "node:assert/strict";
import test from "node:test";
import { findNextBookableDate, nextVisitDate } from "./guest-booking-date.ts";

test("next date handles month/year rollover without local timezone offsets",()=>{
  assert.equal(nextVisitDate("2026-12-31",1),"2027-01-01");
  assert.equal(nextVisitDate("2027-02-28",1),"2027-03-01");
});

test("only available patient sessions are suggested, and queries stop at the first matching day",async()=>{
  const queried=[];
  const day=await findNextBookableDate("2026-09-26",async date=>{
    queried.push(date);
    return date==="2026-09-28"?[{available:true,remainingTokens:2,queueMode:"mixed"}]
      :[{available:true,remainingTokens:3,queueMode:"walkInsOnly"},{available:false,remainingTokens:0}];
  });
  assert.equal(day,"2026-09-28");
  assert.deepEqual(queried,["2026-09-27","2026-09-28"]);
});

test("search stops after fourteen days and propagates actual availability failures",async()=>{
  let calls=0;
  assert.equal(await findNextBookableDate("2026-09-26",async()=>{calls++;return [{available:false,remainingTokens:0}];}),null);
  assert.equal(calls,14);
  await assert.rejects(()=>findNextBookableDate("2026-09-26",async()=>{throw new Error("Network unavailable");}),/Network unavailable/);
});

test("old location/doctor searches cannot suggest a stale result",async()=>{
  let current=true;
  assert.equal(await findNextBookableDate("2026-09-26",async()=>{current=false;return [{available:true,remainingTokens:4}];},()=>current),null);
});