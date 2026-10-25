import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { buildWeek } from "./week-plan.ts";
const compiled=await build({entryPoints:[new URL("./day-overrides.ts",import.meta.url).pathname],bundle:true,platform:"node",format:"esm",write:false});
const {dayOverrideSlots}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const base={doctorId:"d",clinicId:"c",branchId:"b",timezone:"UTC",isOpen:true,status:"active",tokenPrefix:"A",maxTokens:12,consultationMinutes:20,bufferMinutes:0,queueMode:"mixed"};
const rows=[
  {...base,id:"first",dayOfWeek:1,startTime:"09:00",endTime:"12:00",linkedBranchId:"b"},
  {...base,id:"second",dayOfWeek:1,startTime:"14:00",endTime:"17:00",linkedBranchId:"b"},
];
test("complete override payload includes unchanged inherited intervals alongside changed settings",()=>{
  const day=buildWeek(rows)[1];
  day.sessions[0].settings.maxTokens=15;
  const slots=dayOverrideSlots(rows,day,base);
  assert.equal(slots.length,2);
  assert.equal(slots[0].id,"first");assert.equal(slots[0].session.maxTokens,15);
  assert.equal(slots[1].id,"second");assert.equal(slots[1].session.endTime,"17:00");
});
test("replacement without a draft id reuses the removed interval identity rather than recreating it",()=>{
  const day={dayOfWeek:1,isOpen:true,sessions:[{key:"copied",startTime:"10:00",endTime:"12:00",settings:{maxTokens:14}}]};
  const slots=dayOverrideSlots(rows,day,base);
  assert.equal(slots.length,1);
  assert.equal(slots[0].id,"first");
  assert.equal(slots[0].session.startTime,"10:00");
});
test("day off carries no retained inherited sessions; new intervals use real scope and settings",()=>{
  const day=buildWeek(rows)[1];day.isOpen=false;
  assert.deepEqual(dayOverrideSlots(rows,day,base),[]);
  const added={dayOfWeek:2,isOpen:true,sessions:[{key:"new",startTime:"10:00",endTime:"11:00",settings:{maxTokens:16,consultationMinutes:30}}]};
  const slot=dayOverrideSlots(rows,added,base)[0];
  assert.equal(slot.id,undefined);
  assert.equal(slot.session.doctorId,"d");
  assert.equal(slot.session.maxTokens,16);
  assert.equal(slot.session.dayOfWeek,2);
  assert.equal(slot.session.linkedBranchId,undefined);
});
