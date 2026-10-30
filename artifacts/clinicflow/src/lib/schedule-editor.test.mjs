import assert from "node:assert/strict";
import test from "node:test";
import { EDITOR_TABS, editorTabIndex } from "./form-tabs.ts";
import { queueModeLabel, scheduleAdditionalKeys } from "./schedule-facts.ts";
import { dayErrors } from "../components/schedule/week-plan.ts";

const visible = ["doctorName", "branchName", "dayOfWeek", "session", "break", "capacity", "isOpen"];
const row = { doctorName:"Doctor", branchName:"Clinic", dayOfWeek:1, isOpen:true, startTime:"09:00", endTime:"12:00", breakStart:"10:00", breakEnd:"10:15", tokenPrefix:"A", maxTokens:10, consultationMinutes:20, bufferMinutes:5 };
test("weekly availability no longer uses scalar generic tabs; unrelated mappings are unchanged", () => {
  assert.equal(EDITOR_TABS.availability,undefined);
  assert.equal(editorTabIndex("patients","Patient information"),0);
  assert.equal(EDITOR_TABS.exceptions,undefined);
  assert.equal(EDITOR_TABS.doctors,undefined);
});
test("visible schedule summaries consume endpoints and capacity constituents", () => {
  assert.deepEqual(scheduleAdditionalKeys(row, visible),[]);
   assert.deepEqual(scheduleAdditionalKeys({...row,timezone:"Asia/Kolkata",queueMode:"mixed",queueOpenTime:"08:00"},visible),["timezone","queueOpenTime"]);
});
test("shared context consumes matching values, not session-specific differences",()=>{
  const context={timezone:"Asia/Kolkata",timeFormat:"24h"};
  assert.deepEqual(scheduleAdditionalKeys({...row,...context,queueMode:"walkInsOnly"},visible,context),[]);
  assert.deepEqual(scheduleAdditionalKeys({...row,timezone:"UTC",timeFormat:"12h"},visible,context),["timezone","timeFormat"]);
  assert.deepEqual(scheduleAdditionalKeys({...row,queueMode:"appointmentsOnly",queueOpenTime:"08:00",queueCloseTime:"11:00"},visible,context),["queueOpenTime","queueCloseTime"]);
  assert.deepEqual(scheduleAdditionalKeys({...row,queueMode:"appointmentsOnly"},visible.filter(k=>k!=="session"),context),["session"]);
  assert.deepEqual(scheduleAdditionalKeys({...row,queueMode:"mixed",queueOpenTime:row.startTime,queueCloseTime:row.endTime},visible,context),[]);
  assert.equal(queueModeLabel("mixed"),"Appointments and walk-ins");
  assert.equal(queueModeLabel("appointmentsOnly"),"Appointments only");
  assert.equal(queueModeLabel("walkInsOnly"),"Walk-ins only");
  assert.equal(queueModeLabel(undefined),"Appointments and walk-ins");
});
test("hidden summaries remain reachable, without their separate constituent facts", () => {
  assert.deepEqual(scheduleAdditionalKeys(row, visible.filter(key=>!["session","capacity"].includes(key))),["session","capacity"]);
  assert.deepEqual(scheduleAdditionalKeys(row, []),["doctorName","branchName","dayOfWeek","session","break","capacity","isOpen"]);
});
test("page-fixed scope stays omitted while unfixed hidden scope remains accessible", () => {
  const scoped={...row,clinicName:"Group"};
  assert.deepEqual(scheduleAdditionalKeys(scoped,visible.filter(key=>!["doctorName","branchName"].includes(key)),{doctorId:"d",branchId:"b"}),[]);
  assert.deepEqual(scheduleAdditionalKeys(scoped,visible,{clinicId:"c"}),[]);
  assert.deepEqual(scheduleAdditionalKeys(scoped,visible),["clinicName"]);
});
test("break and queue errors are caught even when their tabs are hidden", () => {
  const errors=(patch)=>dayErrors({dayOfWeek:1,isOpen:true,sessions:[{key:"s",startTime:row.startTime,endTime:row.endTime,settings:{...row,...patch}}]});
  assert.match(errors({breakEnd:""}).join(" "),/break must have valid start and end/);
  assert.match(errors({breakStart:"08:00"}).join(" "),/break must have valid start and end/);
  assert.match(errors({queueOpenTime:"12:00"}).join(" "),/queue opening must precede/);
  assert.match(errors({queueCloseTime:"08:00"}).join(" "),/queue closing time must follow/);
  assert.deepEqual(errors({queueCloseTime:"12:00"}),[]);
});
test("whole-record check validates hidden controls independently of mounted field validation", () => {
  const day={dayOfWeek:1,isOpen:true,sessions:[{key:"s",startTime:row.startTime,endTime:row.endTime,settings:{...row,maxTokens:0,bufferMinutes:1441,queueCloseTime:"13:00"}}]};
  const errors=dayErrors(day);
  assert.equal(errors.length,3);
  for(const text of ["capacity","buffer","queue closing"])assert.match(errors.join(" "),new RegExp(text));
  day.sessions[0].settings={...row};
  assert.deepEqual(dayErrors(day),[]);
});
