import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("./role-selection.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const m=await import("data:text/javascript,"+encodeURIComponent(js));
test("system keys and colliding custom IDs remain distinct and survive URL round trips",()=>{
  assert.notEqual(m.systemSelection("doctor"),m.customSelection("doctor"));
  const url=new URL(m.roleDestination("?search=kept&area=roles","permissions",m.customSelection("doctor")),"https://example.invalid");
  assert.equal(url.searchParams.get("role"),"custom:doctor");
  assert.equal(url.searchParams.get("search"),"kept");
  assert.equal(new URL(m.roleDestination(url.search,"roles"),url).searchParams.get("role"),"custom:doctor");
});
