import assert from "node:assert/strict";
import { test } from "node:test";
import { weekDuration, applyWeekDuration, ensureWeekDuration, needsWeekDurationChoice } from "./week-duration.ts";
import { buildWeek, planWeek, prefillFromHours, copyDay } from "./week-plan.ts";

const base={doctorId:"doctor",clinicId:"clinic",branchId:"location",timezone:"Asia/Kolkata",tokenPrefix:"A",maxTokens:20,isOpen:true,status:"active",queueMode:"mixed"};
const rows=[
  {...base,id:"morning",dayOfWeek:1,startTime:"10:00",endTime:"13:00",consultationMinutes:30,bufferMinutes:0},
  {...base,id:"evening",dayOfWeek:1,startTime:"19:00",endTime:"21:00",consultationMinutes:30,bufferMinutes:5},
  {...base,id:"tuesday",dayOfWeek:2,startTime:"11:00",endTime:"14:00",consultationMinutes:20,breakStart:"12:00",breakEnd:"12:30"},
];
const labels=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
test("mixed legacy duration is accurately reported without mutating loaded settings",()=>{
  const w=buildWeek([{...rows[0],consultationMinutes:15},rows[2]]);
  assert.deepEqual(weekDuration(w),{value:"",mixed:true,values:[15,20]});
  w[1].sessions[0].endTime="13:30";
  const p=planWeek([{...rows[0],consultationMinutes:15},rows[2]],w,base,labels);
  assert.equal(p.updates.length,1);assert.equal(p.updates[0].body.consultationMinutes,15);
  assert.equal(w[2].sessions[0].settings.consultationMinutes,20);
});
test("explicit common duration preserves independent hours, capacity, buffers and breaks",()=>{
  const w=buildWeek(rows),out=applyWeekDuration(w,60);
  assert.deepEqual(weekDuration(out),{value:"60",mixed:false,values:[60]});
  assert.equal(out[1].sessions[0].startTime,"10:00");assert.equal(out[1].sessions[1].endTime,"21:00");
  assert.equal(out[1].sessions[1].settings.bufferMinutes,5);assert.equal(out[2].sessions[0].settings.breakEnd,"12:30");
  assert.equal(w[1].sessions[0].settings.consultationMinutes,30);
});
test("off-day retained slots participate in common choice but not active writes",()=>{
  const w=buildWeek(rows);w[2].isOpen=false;
  const out=applyWeekDuration(w,30);
  assert.equal(out[2].sessions[0].settings.consultationMinutes,30);
  assert.equal(out[2].isOpen,false);
  const p=planWeek(rows,out,base,labels);
  assert.equal(p.updates.length,0);assert.equal(p.deactivations[0].id,"tuesday");
});
test("new supported slots inherit common duration without resetting existing settings",()=>{
  assert.equal(weekDuration(buildWeek([]),{consultationMinutes:20}).value,"20");
  const w=buildWeek([rows[0]]);w[3]={dayOfWeek:3,isOpen:true,sessions:[{key:"new",startTime:"09:00",endTime:"11:00",settings:{maxTokens:8}}]};
  const out=ensureWeekDuration(w,30);
  assert.equal(out[3].sessions[0].settings.consultationMinutes,30);
  assert.equal(out[3].sessions[0].settings.maxTokens,8);
  assert.equal(needsWeekDurationChoice(out),false);
  assert.equal(ensureWeekDuration(w,15),w);
  assert.equal(needsWeekDurationChoice(w),true);
});
test("clinic-hour draft copy preserves reused session settings and duration",()=>{
  const w=buildWeek([rows[0]]);
  const out=prefillFromHours(w,[{dayOfWeek:1,startTime:"09:00",endTime:"12:00"}]);
  assert.equal(out[1].sessions[0].id,"morning");
  assert.equal(out[1].sessions[0].settings.consultationMinutes,30);
  assert.equal(out[1].sessions[0].settings.maxTokens,20);
  assert.equal(w[1].sessions[0].startTime,"10:00");
});
test("day copy remains scoped and does not carry another doctor or location identity",()=>{
  const w=buildWeek([rows[0]]),out=copyDay(w,1,[3]);
  assert.equal(out[3].sessions[0].settings.consultationMinutes,30);
  assert.equal(out[3].sessions[0].id,undefined);
  assert.equal(out[2],w[2]);assert.equal(out[1],w[1]);
  assert.deepEqual(weekDuration(buildWeek([])),{value:"",mixed:false,values:[]});
});
test("protected sessions remain untouched and their real duration stays visible",()=>{
  const w=buildWeek([{...rows[0],linkedBranchId:"location"}]);
  assert.equal(weekDuration(w).value,"30");
  assert.equal(applyWeekDuration(w,60)[1].sessions[0].settings.consultationMinutes,30);
});
test("30-minute consultations fit six morning and four evening windows before breaks/capacity",()=>{
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  assert.deepEqual(rows.slice(0,2).map(r=>Math.floor((minutes(r.endTime)-minutes(r.startTime))/r.consultationMinutes)),[6,4]);
});
