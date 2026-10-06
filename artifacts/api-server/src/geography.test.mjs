import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
const file=resolve(import.meta.dirname,`.geography-test-${process.pid}.mjs`);
await build({entryPoints:[resolve(import.meta.dirname,"lib/geography.ts")],outfile:file,bundle:true,platform:"node",format:"esm",packages:"external"});
const {searchGeographicNames: search, cityCompatible, resolveCountryCode}=await import(file);
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
 test("section C: states scoped to country, cities scoped to state, IN code accepted",()=>{
   const states=search("state","",{country:"IN"});
   assert.ok(search("state","Maha",{country:"IN"}).includes("Maharashtra"));
   assert.ok(!search("state","Bavaria",{country:"IN"}).includes("Bavaria"));
   assert.ok(states.length>0&&states.length<=20);
   assert.ok(search("city","Pune",{country:"India",state:"Maharashtra"}).includes("Pune"));
   assert.ok(!search("city","Bengaluru",{country:"IN",state:"Maharashtra"}).includes("Bengaluru"));
   assert.equal(resolveCountryCode("india"),"IN");
   assert.equal(resolveCountryCode("IN"),"IN");
   assert.equal(resolveCountryCode("Nowhere"),"");
 });
 test("section C: incompatible child city detected; manual or unscoped values preserved",()=>{
   assert.equal(cityCompatible("Pune",{country:"IN",state:"Maharashtra"}),true);
   assert.equal(cityCompatible("Pune",{country:"IN",state:"Karnataka"}),false);
   assert.equal(cityCompatible("My Village",{country:"IN",state:"Unknown State"}),true);
   assert.equal(cityCompatible("Springfield",{}),true);
 });
} finally { await rm(file,{force:true}); }
test("section C: official PIN directory returns localities with district context only", async () => {
  const { lookupPincode } = await import("./lib/pincode.ts");
  const rows = lookupPincode("110001");
  assert.ok(Array.isArray(rows) && rows.length > 1);
  assert.ok(rows.every(r => r.locality && r.district && r.state));
  assert.deepEqual(lookupPincode("012345"), []);
});
test("section C: public reference limiter is bounded per client", async () => {
  const { publicReferenceLimit } = await import("./lib/public-limit.ts");
  for (let i = 0; i < 3; i++) publicReferenceLimit("t", 3, 1000, 0);
  assert.throws(() => publicReferenceLimit("t", 3, 1000, 1), /Too many/);
  publicReferenceLimit("t", 3, 1000, 2000);
});

test("section C: PIN snapshot states are normalised only for exact official splits/renames", async () => {
  const { lookupPincode } = await import("./lib/pincode.ts");
  assert.ok(lookupPincode("500001").every(r => r.state === "Telangana"));
  assert.ok(lookupPincode("194101").every(r => r.state === "Ladakh"));
  assert.ok(lookupPincode("520001").every(r => r.state === "Andhra Pradesh"));
  assert.ok(lookupPincode("396210").every(r => r.state === "Dadra and Nagar Haveli and Daman and Diu"));
});
