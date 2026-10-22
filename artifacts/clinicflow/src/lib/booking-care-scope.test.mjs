import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const compiled = await build({
  entryPoints:[new URL("./booking-care-scope.ts",import.meta.url).pathname],
  bundle:true,write:false,platform:"node",format:"esm",
});
const { bookingCareScope } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

test("normal booking scopes locations to the group and doctors to group plus location, without reverse doctor filtering",()=>{
  const scope=bookingCareScope("g1","b1");
  assert.deepEqual(scope.clinics,{status:"active",doctorId:undefined});
  assert.deepEqual(scope.branches,{status:"active",clinicId:"g1",doctorId:undefined});
  assert.deepEqual(scope.doctors,{status:"active",clinicId:"g1",branchId:"b1"});
  const next=bookingCareScope("g2","b2");
  assert.equal(next.branches.clinicId,"g2");
  assert.equal(next.doctors.branchId,"b2");
  assert.equal(next.branches.doctorId,undefined);
});
test("fixed doctor restrictions remain in both parent lookups",()=>{
  const scope=bookingCareScope("g1","b1","fixed-doctor");
  assert.equal(scope.clinics.doctorId,"fixed-doctor");
  assert.equal(scope.branches.doctorId,"fixed-doctor");
});
test("Booking wires persistent dropdowns, resets dependent values, and isolates Queue defaults",()=>{
  const source=readFileSync(new URL("../clinic.tsx",import.meta.url),"utf8");
  const booking=source.slice(source.indexOf("function Booking("),source.indexOf("function Queue("));
  assert.equal((booking.match(/<CareLookup keepDropdown/g)||[]).length,3);
  assert.match(booking,/fixedBookingDoctorId=context\?\.doctorId\|\|restrictedDoctorId\|\|""/);
  assert.match(booking,/if\(value!==clinicId\)\{setClinic\(value\);setBranch\(""\);setDoctor\(fixedBookingDoctorId\);/);
  assert.match(booking,/if\(value!==branchId\)\{setBranch\(value\);setDoctor\(fixedBookingDoctorId\);/);
  assert.match(booking,/parentDoctorId:fixedBookingDoctorId/);
  for(const kind of ["clinics","branches","doctors"])assert.ok(booking.includes(`params={careScope.${kind}}`));
  const hook=readFileSync(new URL("../components/queue/useSoleCareDefaults.ts",import.meta.url),"utf8");
  assert.match(hook,/parentDoctorId=doctorId/);
  assert.match(hook,/doctorId:parentDoctorId\|\|undefined/);
});
