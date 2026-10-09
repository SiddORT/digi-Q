import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeek, copyDay, addCopiedSlot, draftSignature, planWeek, dayErrors, setDayOpen, executePlan, reconcileDraft } from "./week-plan.ts";
const labels=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const base={doctorId:"d",clinicId:"c",branchId:"b",timezone:"UTC",isOpen:true,status:"active",tokenPrefix:"A",maxTokens:12,consultationMinutes:15,bufferMinutes:2,queueMode:"mixed"};
const rows=[{...base,id:"a",dayOfWeek:1,startTime:"09:00",endTime:"12:00",breakStart:"10:00",breakEnd:"10:15"},{...base,id:"b",dayOfWeek:2,startTime:"14:00",endTime:"17:00",tokenPrefix:"B"},{...base,id:"link",dayOfWeek:2,startTime:"18:00",endTime:"19:00",linkedBranchId:"b"}];
test("settings participate in dirty tracking and update payloads; legacy durations stay",()=>{
  const w=buildWeek(rows),sig=draftSignature(w);
  assert.equal(w[1].sessions[0].settings.consultationMinutes,15);
  w[1].sessions[0].settings.consultationMinutes=30;
  assert.notEqual(draftSignature(w),sig);
  const p=planWeek(rows,w,base,labels);
  assert.equal(p.updates[0].body.consultationMinutes,30);
  assert.equal(p.updates[0].body.breakStart,"10:00");
  assert.ok(p.updates[0].body.expectedSnapshot);
});
test("whole day copies compatible settings without identity or link metadata and keeps destination link",()=>{
  const w=buildWeek(rows),source=structuredClone(w[1]);
  const out=copyDay(w,1,[2]);
  const copy=out[2].sessions.find(s=>!s.locked);
  assert.equal(copy.id,"b");assert.equal(copy.settings.maxTokens,12);assert.equal(copy.settings.breakEnd,"10:15");
  assert.deepEqual(w[1],source);assert.ok(out[2].sessions.some(s=>s.id==="link"&&s.locked));
  assert.equal(planWeek(rows,out,base,labels).updates[0].body.branchId,"b");
});
test("single slot appends with new identity, independent settings and targeted conflict",()=>{
  const w=buildWeek(rows),out=addCopiedSlot(w,1,2,"a");
  const copy=out[2].sessions.at(-1);
  assert.equal(copy.id,undefined);assert.equal(copy.locked,undefined);
  assert.equal(out[2].sessions.length,3);copy.settings.maxTokens=33;
  assert.equal(w[1].sessions[0].settings.maxTokens,12);
  const duplicated=addCopiedSlot(w,1,1,"a");
  assert.equal(duplicated,w);
  const duplicate=addCopiedSlot(out,1,2,"a");
  assert.match(dayErrors(duplicate[2]).join(" "),/duplicates/);
});
test("turning a day off retains every slot and re-enabling restores the draft",()=>{
  const w=buildWeek(rows),off=setDayOpen(w[1],false,()=>{throw Error("no blank needed");});
  assert.equal(off.sessions,w[1].sessions);assert.equal(dayErrors(off).length,0);
  assert.deepEqual(setDayOpen(off,true,()=>{throw Error("no blank needed");}),w[1]);
});
test("advanced incompatible settings identify their slot",()=>{
  const w=buildWeek(rows);
  Object.assign(w[1].sessions[0].settings,{maxTokens:0,breakEnd:"13:00",bufferMinutes:-1,queueCloseTime:"22:00"});
  assert.equal(dayErrors(w[1]).length,4);
  for(const error of dayErrors(w[1]))assert.match(error,/Session 1:/);
});
test("partial saves reconcile duration and create identities, send deactivation preconditions last",async()=>{
  const w=buildWeek(rows);w[1].sessions[0].settings.consultationMinutes=30;
  w[3]={dayOfWeek:3,isOpen:true,sessions:[{key:"new",startTime:"09:00",endTime:"12:00",settings:{consultationMinutes:20}}]};
  w[2].sessions=w[2].sessions.filter(s=>s.locked);
  const p=planWeek(rows,w,base,labels),calls=[];
  const result=await executePlan(p,{update:async(id)=>{calls.push(id);},create:async()=>({id:"created"}),deactivate:async(id,snapshot)=>{calls.push([id,snapshot]);throw Error("stale");},message:e=>e.message});
  assert.equal(result.failedDeactivations.size,1);
  assert.equal(reconcileDraft(w,result.savedIds)[3].sessions[0].id,"created");
  assert.equal(calls.at(-1)[0],"b");assert.equal(typeof calls.at(-1)[1],"string");
  assert.equal(result.savedRows.find(r=>r.id==="a").consultationMinutes,30);
  assert.equal(result.savedRows.find(r=>r.id==="created").consultationMinutes,20);
});
test("persisted response baselines allow retry even if post-save reload fails",async()=>{
  const w=buildWeek(rows);
  w[3]={dayOfWeek:3,isOpen:true,sessions:[{key:"new",startTime:"09:00",endTime:"12:00"}]};
  const p=planWeek(rows,w,base,labels);
  const r=await executePlan(p,{update:async()=>{},create:async b=>({...b,id:"created",status:"active"}),deactivate:async()=>{},message:e=>e.message});
  // This is the write response, not a refetch that could include another writer's newer values.
  const baseline=[...rows,...r.savedRows];
  const retry=planWeek(baseline,reconcileDraft(w,r.savedIds),base,labels);
  assert.equal(retry.creates.length,0);
  assert.equal(retry.updates.length,0);
});
