import assert from "node:assert/strict";
import test from "node:test";
import { findNextBookableDate, nextVisitDate, bookingSessionIssue, validVisitDate } from "./guest-booking-date.ts";

test("next date handles month/year rollover without local timezone offsets",()=>{
  assert.equal(nextVisitDate("2026-12-31",1),"2027-01-01");
  assert.equal(nextVisitDate("2027-02-28",1),"2027-03-01");
});
test("invalid and rolled-over dates never enter date discovery",()=>{
  assert.equal(validVisitDate("2026-99-99"),false);
  assert.equal(validVisitDate("2026-02-30"),false);
  assert.equal(validVisitDate(""),false);
  assert.equal(validVisitDate("2028-02-29"),true);
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
test("booking horizon bounds the actual requests, including a selected date at the horizon",async()=>{
  const queried=[];
  assert.equal(await findNextBookableDate("2026-09-26",async d=>{queried.push(d);return [];},()=>true,14,"2026-09-28"),null);
  assert.deepEqual(queried,["2026-09-27","2026-09-28"]);
  assert.equal(await findNextBookableDate("2026-09-28",async()=>{throw Error("must not query");},()=>true,14,"2026-09-28"),null);
});
test("walk-in and advance eligibility share mode, today, queue opening, break and capacity rules",()=>{
  const s={available:true,remainingTokens:1,queueMode:"mixed",startTime:"09:00",breakStart:"12:00",breakEnd:"12:30"};
  assert.equal(bookingSessionIssue(s),null);
  assert.match(bookingSessionIssue({...s,queueMode:"walkInsOnly"}),/walk-ins only/);
  assert.match(bookingSessionIssue({...s,queueMode:"appointmentsOnly"},true,"2026-09-26","2026-09-26","10:00"),/advance appointments only/);
  assert.match(bookingSessionIssue(s,true,"2026-09-27","2026-09-26","10:00"),/today-only/);
  assert.match(bookingSessionIssue(s,true,"2026-09-26","2026-09-26","08:00"),/not opened/);
  assert.match(bookingSessionIssue(s,true,"2026-09-26","2026-09-26","12:10"),/break/);
  assert.equal(bookingSessionIssue(s,true,"2026-09-26","2026-09-26","12:30"),null);
  assert.match(bookingSessionIssue({...s,remainingTokens:0}),/full/);
});