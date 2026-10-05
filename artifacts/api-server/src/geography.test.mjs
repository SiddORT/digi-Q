import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
const file=resolve(import.meta.dirname,`.geography-test-${process.pid}.mjs`);
await build({entryPoints:[resolve(import.meta.dirname,"lib/geography.ts")],outfile:file,bundle:true,platform:"node",format:"esm",packages:"external"});
const {searchGeographicNames: search}=await import(file);
try {
 test("offline geographic directory finds real names without seeded masters",()=>{
   assert.ok(search("city","Pune").includes("Pune"));
   assert.ok(search("country","India").includes("India"));
   assert.ok(search("state","Maharashtra").includes("Maharashtra"));
 });
 test("geographic search trims, ignores case and bounds results",()=>{
   assert.deepEqual(search("city"," pune "),search("city","PUNE"));
   assert.ok(search("city","").length<=20);
   assert.deepEqual(search("city","zzzxxyynotaplace"),[]);
 });
} finally { await rm(file,{force:true}); }
