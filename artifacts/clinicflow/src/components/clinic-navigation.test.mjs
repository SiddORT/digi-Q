import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clinicLandingDestination, clinicDetailsHref, clinicsReturnHref, clinicWorkspaceHref, parseClinicWorkspace, clinicSections } from "../lib/clinic-navigation.ts";

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
 assert.ok(link.startsWith("/admin/clinics/clinic%261/details?"));
 assert.equal(parseClinicWorkspace(link.split("?")[0],link.split("?")[1]).clinicId,"clinic&1");
 assert.equal(clinicsReturnHref(link.split("?")[1]),`/admin/clinics?${state}`);
 for(const target of ["https://evil.invalid","//evil.invalid","/admin/clinics/1","/doctor/clinics"])
  assert.equal(clinicsReturnHref(`returnTo=${encodeURIComponent(target)}`),"/admin/clinics");
});
test("canonical and legacy sections retain identity and allowed context",()=>{
 for(const section of clinicSections){
  const search="clinicId=c%261&section="+section+"&branchId=b1&returnTo=%2Fadmin%2Fclinics%3Fpage%3D3";
  const legacy=parseClinicWorkspace("/admin/clinic",search);
  const target=clinicWorkspaceHref(legacy.clinicId,legacy.section,search);
  assert.deepEqual(parseClinicWorkspace(target.split("?")[0],target.split("?")[1]),legacy);
  assert.equal(new URLSearchParams(target.split("?")[1]).get("branchId"),"b1");
  assert.equal(clinicsReturnHref(target.split("?")[1]),"/admin/clinics?page=3");
 }
 for(const [alias,expected] of [["general","details"],["qrs","locations"],["sessions","locations"],["history","activity-history"],["invalid","details"]])
  assert.equal(parseClinicWorkspace("/admin/clinic",`clinicId=c&section=${alias}`).section,expected);
 assert.equal(parseClinicWorkspace("/admin/clinics/%xx/details","").clinicId,"");
 assert.equal(clinicWorkspaceHref("c","staff","returnTo=https%3A%2F%2Fevil.invalid").includes("evil"),false);
 for(const target of ["/admin/clinics\\evil","/admin/clinics?x=1#evil","/admin/clinics?x=\r\n"])
  assert.equal(clinicsReturnHref(`returnTo=${encodeURIComponent(target)}`),"/admin/clinics");
});
test("private clinic routes precede public slug resolution; opaque URL routes remain unchanged",()=>{
 const source=readFileSync(new URL("../App.tsx",import.meta.url),"utf8");
 assert.ok(source.indexOf('path="/admin/clinics/:clinicId/:section?"')<source.indexOf('path="/:clinicSlug/:branchSlug"'));
 for(const path of ["/book/:reference","/display/:reference","/set-password","/check-in"])assert.ok(source.includes(`path="${path}"`));
});
test("Superadmin navigation maps to one Clinic listing without changing other role configurations",()=>{
 const source=readFileSync(new URL("../clinic.tsx",import.meta.url),"utf8");
 assert.match(source,/p==="clinic"&&identity\.user!\.role==="superAdmin"\?"clinics":p/);
 assert.match(source,/doctor:\["dashboard","appointments","queue","patients","clinics","availability","profile","settings"\]/);
 assert.match(source,/clinicLandingDestination\(page,userRole,search\)/);
});
