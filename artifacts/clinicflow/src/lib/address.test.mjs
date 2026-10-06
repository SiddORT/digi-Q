import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
const file=resolve(import.meta.dirname,`.address-test-${process.pid}.mjs`);
await build({entryPoints:[resolve(import.meta.dirname,"address.ts")],outfile:file,bundle:true,platform:"node",format:"esm"});
const m=await import(file);
try {
 test("C: new address defaults to IN; saved international country preserved",()=>{
  assert.deepEqual(m.geoScope({}),{country:"IN",state:""});
  assert.deepEqual(m.geoScope({country:"DE",state:" Bavaria "}),{country:"DE",state:"Bavaria"});
  assert.equal(m.DEFAULT_ADDRESS_COUNTRY,"IN"); assert.equal(m.DEFAULT_PHONE_COUNTRY,"IN");
 });
 test("C: PIN boundaries",()=>{
  assert.equal(m.validatePostalCode("411001"),true);
  assert.equal(m.validatePostalCode("",undefined),true);
  assert.notEqual(m.validatePostalCode("011001","IN"),true);
  assert.notEqual(m.validatePostalCode("41100","India"),true);
  assert.notEqual(m.validatePostalCode("4110011","IN"),true);
  assert.equal(m.validatePostalCode("SW1A 1AA","GB"),true);
  assert.notEqual(m.validatePostalCode("<script>","GB"),true);
 });
 test("C: parent change clears dependent children only",()=>{
  assert.deepEqual(m.dependentAddressFields("country"),["state","city"]);
  assert.deepEqual(m.dependentAddressFields("state"),["city"]);
 });
} finally { await rm(file,{force:true}); }
