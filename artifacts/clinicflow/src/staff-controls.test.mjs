import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("./staff-controls.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("./Users.tsx",import.meta.url),"utf8");
const staffInputSource=readFileSync(new URL("./staff-input.ts",import.meta.url),"utf8");
const moduleOptions={compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}};
const inputs={};
new Function("exports",ts.transpileModule(staffInputSource,moduleOptions).outputText)(inputs);
const scoped={};
new Function("exports","staffInput",ts.transpileModule(source.replace(/^import .*staff-input.*;\n/m,""),moduleOptions).outputText)(scoped,inputs.staffInput);
const { clinicScopedStaffInput }=scoped;
test("embedded staff queries always include the fixed clinic",()=>{
  assert.match(ui,/clinicId:\s*clinicId \|\| context\.clinicId \|\| undefined/);
  assert.match(ui,/!clinicId&&draftTab !== "admins"/);
  assert.match(ui,/onOpen=\{openFilters\} onApply=\{applyFilters\}/);
});
test("account status is a drafted drawer filter with read-only counts; no status/sort tabs",()=>{
  assert.doesNotMatch(ui,/className="status-tabs"/);
  assert.match(ui,/<SearchableSelect label="Account Status" testId="select-staff-status" value=\{draft\.status\|\|"all"\}[^]*?counts\[index\]\.data\.total/);
  assert.doesNotMatch(ui,/role="tablist" aria-label="Staff type"/);
  assert.doesNotMatch(ui,/<SearchableSelect label="Status"/);
  assert.doesNotMatch(ui,/<SearchableSelect label="Sort"/);
  assert.match(ui,/aria-sort=/);
  assert.match(ui,/<StatusSwitch label=\{`Account active for/);
  assert.match(ui,/<StatusSwitch label="Staff Account Active"/);
  assert.doesNotMatch(ui,/type="checkbox" role="switch"/);
});
test("scoped assignment payload explicitly preserves foreign clinic and unknown branches",()=>{
  const existing={clinicIds:["fixed","other"],branchIds:["fixed-old","foreign","unknown"]};
  const records=new Map([["fixed-old",{clinicId:"fixed"}],["foreign",{clinicId:"other"}]]);
  const body=clinicScopedStaffInput("receptionists",{fullName:"Staff",email:"staff@example.com",clinicIds:[],branchIds:["fixed-new"],status:"active"},existing,"fixed",records);
  assert.deepEqual(body.clinicIds,["other","fixed"]);
  assert.deepEqual(body.branchIds,["fixed-new","foreign","unknown"]);
  assert.deepEqual(clinicScopedStaffInput("doctors",{fullName:"Doctor",email:"doctor@example.com",clinicIds:["fixed"],branchIds:["fixed-old"]},existing,"fixed",records).branchIds,["fixed-old","foreign","unknown"]);
  assert.deepEqual(clinicScopedStaffInput("receptionists",{fullName:"Staff",email:"staff@example.com",clinicIds:["fixed"],branchIds:["fixed-old"]},existing,undefined,records).branchIds,["fixed-old"]);
  assert.match(ui,/clinicScopedStaffInput/);
  assert.match(ui,/const current=await api\.getUser\(row\.id\)/);
  assert.match(ui,/api\.updateUser\(row\.id,\{fullName:current\.fullName,email:current\.email,mobile:current\.mobile\|\|undefined,role:current\.role,status\}\)/);
  assert.doesNotMatch(ui,/window\.confirm|[^.\w]confirm\(/);
  assert.match(ui,/await confirmAction\.ask\(\{title:`Deactivate/);
  assert.match(ui,/confirmLabel:"Deactivate",tone:"danger"/);
  assert.match(ui,/confirmAction\.dialog/);
  assert.match(ui,/context\?\.previous\.forEach/);
});