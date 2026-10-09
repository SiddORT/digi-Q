import assert from "node:assert/strict";
import test from "node:test";
import { EDITOR_TABS, editorTabIndex } from "./form-tabs.ts";
import { scheduleAdditionalKeys } from "./schedule-facts.ts";
import { scheduleFormErrors, scheduleTimeError } from "./schedule-validation.ts";

const visible = ["doctorName", "branchName", "dayOfWeek", "session", "break", "capacity", "isOpen"];
const row = { doctorName:"Doctor", branchName:"Clinic", dayOfWeek:1, isOpen:true, startTime:"09:00", endTime:"12:00", breakStart:"10:00", breakEnd:"10:15", tokenPrefix:"A", maxTokens:10, consultationMinutes:20, bufferMinutes:5 };
test("weekly availability has four stable tabs; other tab mappings are unchanged", () => {
  assert.deepEqual(EDITOR_TABS.availability.map(([label])=>label),["Schedule","Timing & Break","Capacity","Queue Settings"]);
  EDITOR_TABS.availability.forEach(([,groups],index)=>groups.forEach(group=>assert.equal(editorTabIndex("availability",group),index)));
  assert.equal(EDITOR_TABS.exceptions,undefined);
  assert.equal(EDITOR_TABS.doctors,undefined);
});
test("visible schedule summaries consume endpoints and capacity constituents", () => {
  assert.deepEqual(scheduleAdditionalKeys(row, visible),[]);
  assert.deepEqual(scheduleAdditionalKeys({...row,timezone:"Asia/Kolkata",queueMode:"mixed",queueOpenTime:"08:00"},visible),["timezone","queueMode","queueOpenTime"]);
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
  assert.equal(scheduleTimeError("endTime","08:00",row),"Closing time must follow opening time.");
  assert.equal(scheduleTimeError("breakEnd","",{...row,breakEnd:""}),"Both break times are required.");
  assert.equal(scheduleTimeError("breakStart","08:00",{...row,breakStart:"08:00"}),"Break must lie within the session.");
  assert.equal(scheduleTimeError("queueOpenTime","12:00",row),"Queue opening must precede session end.");
  assert.notEqual(scheduleTimeError("queueCloseTime","08:00",row),true);
  assert.equal(scheduleTimeError("queueCloseTime","12:00",row),true);
  assert.equal(scheduleTimeError("breakStart","",{...row,isOpen:false,breakEnd:""}),true);
});
test("whole-record check validates hidden controls independently of mounted field validation", () => {
  const fields=[{key:"doctorId",required:true},{key:"maxTokens",type:"number",required:true},{key:"bufferMinutes",type:"number"},{key:"queueCloseTime",type:"time"}];
  const errors=scheduleFormErrors({...row,maxTokens:0,bufferMinutes:1441,queueCloseTime:"13:00"},fields);
  assert.deepEqual(Object.keys(errors),["doctorId","maxTokens","bufferMinutes","queueCloseTime"]);
  assert.deepEqual(scheduleFormErrors({...row,doctorId:"d"},fields),{});
});
