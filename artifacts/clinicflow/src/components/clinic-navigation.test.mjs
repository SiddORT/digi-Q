import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clinicLandingDestination, clinicDetailsHref, clinicsReturnHref } from "../lib/clinic-navigation.ts";

test("only unscoped Superadmin clinic landings redirect",()=>{
 assert.equal(clinicLandingDestination("clinic","superAdmin",""),"/admin/clinics");
 for(const search of ["clinicId=c1","clinicId=c2&section=staff","section=qrs","branchId=b1"])
  assert.equal(clinicLandingDestination("clinic","superAdmin",search),null);
 for(const role of ["clinicAdmin","doctor"])
  assert.equal(clinicLandingDestination("clinic",role,""),null);
});
test("detail links round-trip every list control, and reject foreign return destinations",()=>{
 const state="search=Care+%26+Co&status=inactive&adminId=a1&sort=name&page=3&pageSize=50";
 const link=clinicDetailsHref("clinic&1",state);
 assert.ok(link.startsWith("/admin/clinic?"));
 assert.equal(new URLSearchParams(link.split("?")[1]).get("clinicId"),"clinic&1");
 assert.equal(clinicsReturnHref(link.split("?")[1]),`/admin/clinics?${state}`);
 for(const target of ["https://evil.invalid","//evil.invalid","/admin/clinics/1","/doctor/clinics"])
  assert.equal(clinicsReturnHref(`returnTo=${encodeURIComponent(target)}`),"/admin/clinics");
});
test("Superadmin navigation maps to one Clinic listing without changing other role configurations",()=>{
 const source=readFileSync(new URL("../clinic.tsx",import.meta.url),"utf8");
 assert.match(source,/p==="clinic"&&identity\.user!\.role==="superAdmin"\?"clinics":p/);
 assert.match(source,/doctor:\["dashboard","appointments","queue","patients","clinics","availability","profile"\]/);
 assert.match(source,/clinicLandingDestination\(page,userRole,search\)/);
});
