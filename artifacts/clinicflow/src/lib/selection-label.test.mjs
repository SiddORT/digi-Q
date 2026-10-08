import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const path = `${import.meta.dirname}/.selection-label-${process.pid}.mjs`;
let labels;
before(async () => {
  await build({entryPoints:[`${import.meta.dirname}/selection-label.ts`],outfile:path,bundle:true,platform:"node",format:"esm"});
  labels=await import(path);
});
after(()=>rm(path,{force:true}));
const id="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
test("missing names and UUIDs are never human display labels",()=>{
  assert.equal(labels.readableLabel(id,id),"");
  assert.equal(labels.readableLabel(`${id} · Inactive`,id),"");
  assert.equal(labels.readableLabel(undefined,id),"");
  assert.equal(labels.recordLabel({id,name:id}),"Name unavailable");
  assert.equal(labels.recordLabel({id,name:"  Fixture Clinic  "}),"Fixture Clinic");
  assert.equal(labels.recordLabel({id,fullName:"Dr Fixture"}),"Dr Fixture");
});
test("appointments retain intentional tokens and booking references, not internal IDs",()=>{
  assert.equal(labels.recordLabel({id,token:7,doctorName:"Dr Fixture",branchName:"Fixture Location",date:"2026-10-08",reference:"VISIT-7"},true),"Token 7 · Dr Fixture · Fixture Location · 2026-10-08 · VISIT-7");
  assert.equal(labels.recordLabel({id,doctorName:id},true),"Appointment details unavailable");
  assert.equal(labels.readableLabel("24","24"),"24");
  assert.equal(labels.readableLabel("Asia/Kolkata","Asia/Kolkata"),"Asia/Kolkata");
});
