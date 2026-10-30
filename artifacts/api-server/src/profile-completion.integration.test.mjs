import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
let h;
before(async () => { h = await createFeatureHarness({ administration: true, appointmentDetails: true }); await seedFeatureFixtures(h.pg); });
after(async () => h?.close());
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };
async function complete(actor, kind, id, values, baseline) {
  if (!baseline) {
    const current = ok(await h.call(actor, "GET", `/${kind}/${id}`));
    const keys=Object.keys(values);
    if(kind==="patients"&&(keys.includes("dateOfBirth")||keys.includes("age")))keys.push("dateOfBirth","age");
    baseline = Object.fromEntries(keys.map(key => [key, current[key] ?? null]));
  }
  return h.call(actor, "PATCH", `/${kind}/${id}/profile-fields`, {values, baseline});
}
test("patient completion persists each field group without clearing other data or visit contacts", async () => {
  const p = ok(await h.call("rec", "POST", "/patients", {fullName:"Completion Patient", clinicId:"c1", branchId:"b1"}), 201);
  const before = await h.pg.query("select id,data from appointments where patient_id='p1'");
  const groups = [{gender:"preferNotToSay"}, {age:0}, {mobile:"+919876543210"}, {email:"completion@example.test"},
    {address:"Test street",country:"IN",state:"Delhi",city:"New Delhi",pincode:"110001"},
    {emergencyContactName:"Emergency Person",emergencyContactPhone:"+919876543211"}];
  let expected = {};
  for (const values of groups) {
    const saved = ok(await complete("rec","patients",p.id,values));
    expected = {...expected,...values};
    const reopened = ok(await h.call("rec","GET",`/patients/${p.id}`));
    for (const [key,value] of Object.entries(expected)) {assert.deepEqual(saved[key],value);assert.deepEqual(reopened[key],value);}
    assert.equal(saved.fullName,p.fullName);assert.equal(saved.clinicId,"c1");assert.equal(saved.branchId,"b1");assert.equal(saved.mobileVerified,false);
  }
  const saved = ok(await h.call("rec","GET",`/patients/${p.id}`));
  assert.match(saved.ageReferenceDate,/^\d{4}-\d{2}-\d{2}$/);assert.ok(!saved.dateOfBirth);
  assert.deepEqual((await h.pg.query("select id,data from appointments where patient_id='p1'")).rows,before.rows);
  assert.equal((await h.pg.query("select count(*)::int n from users where email='completion@example.test'")).rows[0].n,0);
});
test("DOB validation, legacy age, exact/approximate switching and optional contacts", async () => {
  const p = ok(await h.call("rec","POST","/patients",{fullName:"Age Patient",clinicId:"c1",age:30}),201);
  await h.pg.query("update patients set data=data-'ageReferenceDate' where id=$1",[p.id]);
  ok(await h.call("rec","PATCH",`/patients/${p.id}`,{fullName:"Age Patient Updated",age:30}));
  assert.ok(!ok(await h.call("rec","GET",`/patients/${p.id}`)).ageReferenceDate);
  for (const dateOfBirth of ["2025-02-29","2024-02-30","2999-01-01"]) assert.equal((await complete("rec","patients",p.id,{dateOfBirth})).status,400);
  ok(await complete("rec","patients",p.id,{dateOfBirth:"2000-02-29"}));
  assert.equal(ok(await h.call("rec","GET",`/patients/${p.id}`)).age,30,"exact DOB does not overwrite retained estimate");
  const retained=ok(await h.call("rec","PATCH",`/patients/${p.id}`,{fullName:"Age Patient Updated",dateOfBirth:null,age:30,ageReferenceDate:"2001-01-01"}));
  assert.equal(retained.dateOfBirth,null);assert.equal(retained.age,30);
  assert.ok(!retained.ageReferenceDate,"full-editor DOB removal cannot date an unchanged legacy estimate");
  ok(await complete("rec","patients",p.id,{dateOfBirth:"2000-02-29"}));
  const switched=ok(await complete("rec","patients",p.id,{dateOfBirth:null,age:26}));
  assert.equal(switched.dateOfBirth,null);assert.equal(switched.age,26);assert.ok(switched.ageReferenceDate);
  await h.pg.query("update patients set data=jsonb_set(data,'{ageReferenceDate}','\"2020-01-01\"') where id=$1",[p.id]);
  ok(await complete("rec","patients",p.id,{dateOfBirth:"2000-02-29"}));
  const dated=ok(await h.call("rec","PATCH",`/patients/${p.id}`,{fullName:"Age Patient Updated",dateOfBirth:null,age:26}));
  assert.equal(dated.ageReferenceDate,"2020-01-01","unchanged estimates retain their actual reference date");
  ok(await h.call("patu","PATCH","/patients/p1",{fullName:"Patient Without Mobile"}));
});
test("stale baseline, invalid values, unauthorized fields and denied/revoked access cannot save", async () => {
  const p = ok(await h.call("rec","POST","/patients",{fullName:"Concurrency Patient",clinicId:"c1",branchId:"b1"}),201);
  ok(await complete("rec","patients",p.id,{gender:"female"}));
  assert.equal((await complete("rec","patients",p.id,{gender:"male"},{gender:null})).status,409);
  for (const values of [{age:-1},{age:131},{age:1.5},{gender:"inferred"},{mobile:"123"},{email:"invalid"},{pincode:"123"},{clinicId:"c2"},{status:"inactive"},{userId:"sa"}])
    assert.equal((await complete("rec","patients",p.id,values)).status,400,JSON.stringify(values));
  assert.equal((await complete("docu","patients",p.id,{gender:"male"})).status,403);
  assert.deepEqual(ok(await h.call("docu","GET",`/patients/${p.id}/profile-fields`)).fields,[]);
  assert.equal((await h.call("adm2","PATCH",`/patients/${p.id}/profile-fields`,{values:{gender:"male"},baseline:{gender:"female"}})).status,403);
  await h.pg.query("insert into settings(id,data) values ('permission-policy',$1) on conflict(id) do update set data=excluded.data",[JSON.stringify({revision:1,denied:["receptionist:patients:update"]})]);
  try {
    assert.deepEqual(ok(await h.call("rec","GET",`/patients/${p.id}/profile-fields`)).fields,[]);
    assert.equal((await complete("rec","patients",p.id,{gender:"male"})).status,403);
  } finally {await h.pg.exec("delete from settings where id='permission-policy'");}
  assert.equal(ok(await h.call("rec","GET",`/patients/${p.id}`)).gender,"female");
});
test("doctor and staff completion preserve mappings and login identity", async () => {
  const before=ok(await h.call("adm","GET","/doctors/d1"));
  const mappings=(await h.pg.query("select * from assignments order by id")).rows;
  for (const values of [{dateOfBirth:"1980-01-02"},{consultationFee:0,experienceYears:0},{about:"Doctor biography",registrationNumber:"REG-TEST"},{languages:["English","Hindi"]}]) ok(await complete("adm","doctors","d1",values));
  const saved=ok(await h.call("adm","GET","/doctors/d1"));
  assert.equal(saved.consultationFee,0);assert.equal(saved.experienceYears,0);assert.equal(saved.email,before.email);
  assert.deepEqual((await h.pg.query("select * from assignments order by id")).rows,mappings);
  assert.equal((await complete("adm","doctors","d1",{email:"other@example.test"})).status,400);
  ok(await complete("adm","users","rec",{city:"New Delhi"}));
  assert.equal(ok(await h.call("adm","GET","/users/rec")).city,"New Delhi");
  ok(await complete("rec","users","rec",{photoUrl:"https://example.test/photo.jpg"}));
  assert.equal(ok(await h.call("rec","GET","/users/rec")).photoUrl,"https://example.test/photo.jpg");
});
test("all professional field groups persist and stale demographic groups are rejected", async () => {
  const specialty=ok(await h.call("sa","POST","/masters",{category:"specialization",name:"Test specialty",code:"completion-specialty"}),201);
  const qualification=ok(await h.call("sa","POST","/masters",{category:"qualification",name:"Test qualification",code:"completion-qualification"}),201);
  for (const values of [
    {specializationId:specialty.id}, {qualificationIds:[qualification.id]},
    {photoUrl:"https://example.test/doctor.jpg"}, {address:"Doctor street",country:"IN",state:"Delhi",city:"New Delhi",pincode:"110001"},
  ]) {
    const saved = ok(await complete("adm","doctors","d1",values));
    for (const [key,value] of Object.entries(values))assert.deepEqual(saved[key],value);
  }
  const p = ok(await h.call("rec","POST","/patients",{fullName:"Demographic Race Patient",clinicId:"c1"}),201);
  ok(await complete("rec","patients",p.id,{dateOfBirth:"2000-01-01"}));
  assert.equal((await complete("rec","patients",p.id,{age:20},{age:null,dateOfBirth:null})).status,409);
  assert.equal((await complete("rec","patients",p.id,{age:20},{age:null})).status,400);
  assert.equal((await complete("rec","patients",p.id,{dateOfBirth:null},{dateOfBirth:"2000-01-01"})).status,400);
  ok(await complete("rec","patients",p.id,{gender:"female"}));
  const saved=ok(await complete("rec","patients",p.id,{email:"race@example.test"},{email:null}));
  assert.equal(saved.gender,"female");assert.equal(saved.dateOfBirth,"2000-01-01");
});
test("private appointment information refreshes from patient data without changing visit contacts",async()=>{
  const before = ok(await h.call("rec","GET","/appointments/a1"));
  ok(await complete("rec","patients","p1",{gender:"preferNotToSay",age:0}));
  const after = ok(await h.call("rec","GET","/appointments/a1"));
  assert.equal(after.privatePatient.gender,"preferNotToSay");
  assert.equal(after.privatePatient.age,0);assert.match(after.privatePatient.ageReferenceDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(after.bookingMobile,before.bookingMobile);
  assert.equal(after.patientId,before.patientId);
});
