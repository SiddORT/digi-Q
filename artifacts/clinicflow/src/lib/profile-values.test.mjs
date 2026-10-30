import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({entryPoints:[new URL("./profile-values.ts",import.meta.url).pathname],bundle:true,platform:"node",format:"esm",write:false});
const {patientAgeLabel,isMissingProfileValue}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
test("missing values differ from zero, prefer-not-to-say and malformed DOB",()=>{
  for(const v of [null,undefined,"","  ",[]])assert.equal(isMissingProfileValue(v),true);
  for(const v of [0,"preferNotToSay","bad-date"])assert.equal(isMissingProfileValue(v),false);
  assert.equal(patientAgeLabel({dateOfBirth:"bad-date"}),"Invalid date");
  assert.equal(patientAgeLabel({dateOfBirth:null}),"Not entered");
});
test("birthdays, leap-day birthdays and exact DOB authority",()=>{
  assert.equal(patientAgeLabel({dateOfBirth:"2000-10-30"},new Date(2026,9,29)),"25 years");
  assert.equal(patientAgeLabel({dateOfBirth:"2000-10-30",age:60},new Date(2026,9,30)),"26 years");
  assert.equal(patientAgeLabel({dateOfBirth:"2000-02-29"},new Date(2025,1,28)),"24 years");
  assert.equal(patientAgeLabel({dateOfBirth:"2000-02-29"},new Date(2025,2,1)),"25 years");
});
test("approximate ages never advance automatically or invent legacy reference dates",()=>{
  assert.equal(patientAgeLabel({age:0}),"Approximately 0 years (reference date unknown)");
  assert.equal(patientAgeLabel({age:30,ageReferenceDate:"2020-01-01"},new Date(2026,9,30)),"Approximately 30 years (as of 01 Jan 2020)");
});
