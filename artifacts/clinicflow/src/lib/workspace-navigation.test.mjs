import { test } from "node:test";
import assert from "node:assert/strict";
import { loadModule } from "../test/load-module.mjs";
const { workspaceHref, staffHref, workspaceFunctions } = await loadModule(new URL("./workspace-navigation.ts", import.meta.url));
const { permittedCategories, categorySources, recordHref } = await loadModule(new URL("./search-categories.ts", import.meta.url));
const url = value => new URL(value, "https://local.invalid");

test("staff exact records and continuation links never enter account administration", () => {
  for (const tab of ["admins", "doctors", "receptionists"]) {
    const exact=url(recordHref("admin","users","fictional&id","Fictional",{tab}));
    const continuation=url(staffHref("admin",tab,{search:"Fictional & Co"}));
    assert.equal(exact.pathname,"/admin/staff");assert.equal(exact.searchParams.get("tab"),tab);
    assert.equal(exact.searchParams.get("open"),"fictional&id");
    assert.equal(continuation.pathname,"/admin/staff");assert.equal(continuation.searchParams.get("search"),"Fictional & Co");
  }
  const doctor=url(recordHref("doctor","users","r1","Fictional",{tab:"receptionists"}));
  assert.equal(doctor.pathname,"/doctor/clinics");
  assert.equal(doctor.searchParams.get("area"),"staff");
  assert.equal(doctor.searchParams.get("open"),"r1");
  assert.equal(workspaceHref("admin","users"),"/admin/users");
});
test("actual identity enables nested functions without borrowing a broader role", () => {
  assert.deepEqual(permittedCategories("admin",[],"clinicAdmin"),["patients","appointments","staff","clinics","branches","schedules","reports"]);
  assert.deepEqual(categorySources("staff","admin","clinicAdmin"),["receptionists","doctors"]);
  assert.deepEqual(categorySources("staff","doctor","doctor"),["receptionists"]);
  assert.ok(permittedCategories("admin",[],"superAdmin").includes("audit"));
  assert.ok(permittedCategories("doctor",[],"doctor").includes("clinics"));
  assert.ok(!permittedCategories("doctor",["audit","users"],"doctor").includes("audit"));
  assert.deepEqual(permittedCategories("admin",["clinics","audit"],""),[]);
  assert.ok(!workspaceFunctions("clinicAdmin").includes("users"));
  assert.ok(!workspaceFunctions("patient").includes("staff"));
});
test("canonical location, audit, QR and clinic destinations retain only supplied context", () => {
  const location=url(workspaceHref("admin","branches",{clinicId:"c&1",branchId:"b1"}));
  assert.equal(location.pathname,"/admin/clinics/c%261/locations");
  assert.equal(location.searchParams.get("branchId"),"b1");
  assert.equal(workspaceHref("admin","audit",{search:"Update"}),"/admin/settings?search=Update&area=audit");
  assert.equal(workspaceHref("doctor","qrs"),"/doctor/clinics?area=qrs");
  assert.equal(workspaceHref("admin","clinic"),"/admin/clinics");
  assert.equal(workspaceHref("admin","staff",{search:"A"}),"/admin/staff?search=A&tab=doctors");
});
