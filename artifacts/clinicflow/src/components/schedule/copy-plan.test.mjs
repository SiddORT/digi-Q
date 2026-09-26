import assert from "node:assert/strict";
import test from "node:test";
import { planCopy } from "./copy-plan.ts";
const base={doctorId:"d",branchId:"b",clinicId:"c",startTime:"09:00",endTime:"12:00",maxTokens:20,isOpen:true,lineage:{x:1},linkedScheduleId:"z"};
test("creates missing days without lineage metadata",()=>{
  const r=planCopy([{...base,id:"1",dayOfWeek:1}],1,[2]);
  assert.equal(r.creates.length,1);assert.equal(r.creates[0].dayOfWeek,2);
  assert.equal(r.creates[0].lineage,undefined);assert.equal(r.creates[0].linkedScheduleId,undefined);assert.equal(r.creates[0].id,undefined);
});
test("skips exact equivalents and reports differing overlaps as conflicts",()=>{
  const rows=[{...base,id:"1",dayOfWeek:1},{...base,id:"2",dayOfWeek:2},{...base,id:"3",dayOfWeek:3,maxTokens:30}];
  const r=planCopy(rows,1,[2,3,1]);
  assert.equal(r.creates.length,0);assert.equal(r.skipped.length,1);assert.equal(r.conflicts.length,1);
});
