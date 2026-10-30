import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
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

describe("profile completion on competing PostgreSQL connections", () => {
  let pg;
  const admin = {id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:["b","b2"]};
  const self = {id:"du",role:"doctor",doctorId:"d",managingAdminId:"admin",clinicIds:["c"],branchIds:["b"]};
  const oldMobile = "+14155552671", newMobile = "+14155552672";
  let assignments, visits;
  before(async () => {
    pg = await createQueueHarness();
    await pg.control.query(`create table auth_challenges(
      id text primary key,user_id text,purpose text,consumed_at timestamptz,data jsonb not null default '{}')`);
  });
  after(async () => pg?.close());
  beforeEach(async () => {
    await pg.seed();
    await pg.control.query("truncate auth_challenges");
    await pg.control.query("update users set mobile=$1,data=$2 where id='du'", [oldMobile, JSON.stringify({
      staffMobileProof:{mobile:oldMobile,verifiedAt:"2026-01-01T00:00:00.000Z"}, photoUrl:"https://example.test/old.jpg", sentinel:"account",
    })]);
    await pg.control.query("update doctors set data=$1 where id='d'", [JSON.stringify({mobile:oldMobile,photoUrl:"https://example.test/old.jpg",sentinel:"doctor"})]);
    await pg.control.query("update patients set mobile_verified=true,data=data || '{\"email\":\"old@example.test\",\"sentinel\":\"patient\"}' where id='p1'");
    await pg.control.query("insert into auth_challenges values ('sms','du','staff-contact:sms',null,'{\"proof\":\"pending\"}'),('email','du','staff-contact:email',null,'{\"proof\":\"email\"}')");
    await pg.api.put(pg.t.appointments, {id:"profile-visit",patientId:"p1",doctorId:"d",clinicId:"c",branchId:"b",date:pg.today,tokenNumber:1,actorId:"admin",
      data:{bookingMobile:"+14155552673",patientEmail:"visit@example.test",notes:"Visit contact stays separate"}});
    assignments = (await pg.control.query("select * from assignments order by id")).rows;
    visits = (await pg.control.query("select * from appointments order by id")).rows;
  });
  const current = (kind, id) => pg.api.one(pg.t[kind], id);
  const patch = (kind, id, values, baseline, tx, actor = admin) =>
    pg.route(pg.api.resourcesRouter,"patch",`/${kind}/:id/profile-fields`,actor,{values,baseline},{id},{},tx);
  const own = (body, tx) => pg.route(pg.api.identityRouter,"patch","/me",self,body,{}, {},tx);
  async function race(operations, options) {
    let observed = false;
    const results = await pg.race(operations, {doctorIds:[],orderedWaiters:true,...options,onContention:({pids,waiting}) => {
      assert.equal(new Set(pids).size,2);
      assert.equal(waiting,2);
      observed = true;
    }});
    assert.equal(observed,true,"both independent workers were observed waiting before release");
    assert.deepEqual((await pg.control.query("select * from assignments order by id")).rows,assignments);
    assert.deepEqual((await pg.control.query("select * from appointments order by id")).rows,visits);
    return results;
  }
  function staleLoser(results) {
    assert.equal(results[0].status,"fulfilled");
    assert.equal(results[1].status,"rejected");
    assert.equal(results[1].reason.status,409);
    assert.match(results[1].reason.message,/profile field changed/);
  }
  for (const first of ["DOB","approximate age"]) {
    test(`${first} wins a competing demographic mode change without mixing modes`, async () => {
      const values = first === "DOB" ? [{dateOfBirth:"2000-02-29"},{age:26}] : [{age:26},{dateOfBirth:"2000-02-29"}];
      const baseline = {dateOfBirth:null,age:null};
      const results = await race(values.map(value => tx => patch("patients","p1",value,baseline,tx)),{lockKeys:["patients:p1"]});
      staleLoser(results);
      const saved = await current("patients","p1");
      if (first === "DOB") {
        assert.equal(saved.dateOfBirth,"2000-02-29");
        assert.ok(saved.age == null); assert.ok(saved.ageReferenceDate == null);
      } else {
        assert.equal(saved.age,26); assert.match(saved.ageReferenceDate,/^\d{4}-\d{2}-\d{2}$/);
        assert.ok(saved.dateOfBirth == null);
      }
      assert.equal(saved.sentinel,"patient");
    });
  }
  test("same-field patient contenders reject the stale editor and leave contact proof unchanged", async () => {
    const results = await race([
      tx => patch("patients","p1",{gender:"female"},{gender:null},tx),
      tx => patch("patients","p1",{gender:"male"},{gender:null},tx),
    ],{lockKeys:["patients:p1"]});
    staleLoser(results);
    const saved = await current("patients","p1");
    assert.equal(saved.gender,"female"); assert.equal(saved.mobileVerified,true);
    assert.equal(saved.mobile,"+15555550001");
  });
  test("separate patient fields both survive, with mobile proof invalidated only for the changed profile contact", async () => {
    const results = await race([
      tx => patch("patients","p1",{mobile:newMobile},{mobile:"+15555550001"},tx),
      tx => patch("patients","p1",{email:"new@example.test"},{email:"old@example.test"},tx),
    ],{lockKeys:["patients:p1"]});
    assert.deepEqual(results.map(r => r.status),["fulfilled","fulfilled"]);
    const saved = await current("patients","p1");
    assert.equal(saved.mobile,newMobile); assert.equal(saved.mobileVerified,false);
    assert.equal(saved.email,"new@example.test"); assert.equal(saved.sentinel,"patient");
  });
  test("replacing an exact DOB with an estimate cannot erase another editor's newer DOB", async () => {
    await pg.control.query("update patients set data=data || '{\"dateOfBirth\":\"2000-01-01\",\"age\":26,\"ageReferenceDate\":\"2026-01-01\"}' where id='p1'");
    const baseline = {dateOfBirth:"2000-01-01",age:26};
    const results = await race([
      tx => patch("patients","p1",{dateOfBirth:"2001-02-03"},baseline,tx),
      tx => patch("patients","p1",{dateOfBirth:null,age:27},baseline,tx),
    ],{lockKeys:["patients:p1"]});
    staleLoser(results);
    const saved = await current("patients","p1");
    assert.equal(saved.dateOfBirth,"2001-02-03"); assert.equal(saved.age,26);
    assert.equal(saved.ageReferenceDate,"2026-01-01","retained estimates keep their actual reference date");
  });
  for (const selfFirst of [true,false]) {
    test(`patient completion preserves a linked self-account contact update (${selfFirst ? "self first" : "completion first"})`, async () => {
      await pg.api.put(pg.t.users,{id:"u1",email:"patient@example.test",fullName:"Patient 1",role:"patient",mobile:"+15555550001"});
      const patient = {id:"u1",role:"patient",patientId:"p1",clinicIds:[],branchIds:[]};
      const completion = tx => patch("patients","p1",{gender:"female"},{gender:null},tx);
      const contact = tx => pg.route(pg.api.identityRouter,"patch","/me",patient,{mobile:newMobile},{},{},tx);
      const results = await race(selfFirst ? [contact,completion] : [completion,contact],{rowLocks:[{table:"patients",id:"p1"}]});
      assert.deepEqual(results.map(r => r.status),["fulfilled","fulfilled"],JSON.stringify(results));
      const saved = await current("patients","p1");
      assert.equal(saved.gender,"female"); assert.equal(saved.mobile,newMobile);
      assert.equal(saved.mobileVerified,false); assert.equal(saved.email,"old@example.test");
      assert.equal(saved.sentinel,"patient"); assert.equal((await current("users","u1")).mobile,newMobile);
    });
  }
  for (const kind of ["users","doctors"]) {
    for (const selfFirst of [true,false]) {
      test(`${kind} completion and self-account contact change preserve separate fields (${selfFirst ? "self first" : "completion first"})`, async () => {
        const id = kind === "users" ? "du" : "d";
        const completion = tx => patch(kind,id,{photoUrl:"https://example.test/new.jpg"},{photoUrl:"https://example.test/old.jpg"},tx,kind === "users" ? self : admin);
        const contact = tx => own({mobile:newMobile},tx);
        const results = await race(selfFirst ? [contact,completion] : [completion,contact],{rowLocks:[{table:"users",id:"du"}]});
        assert.deepEqual(results.map(r => r.status),["fulfilled","fulfilled"],JSON.stringify(results));
        const account = await current("users","du"), doctor = await current("doctors","d");
        assert.equal(account.mobile,newMobile); assert.equal(account.staffMobileProof,null);
        assert.equal(doctor.mobile,newMobile);
        assert.equal((kind === "users" ? account : doctor).photoUrl,"https://example.test/new.jpg");
        assert.equal(account.email,"d@example.com"); assert.equal(account.role,"doctor");
        assert.equal(account.sentinel,"account"); assert.equal(doctor.sentinel,"doctor");
        const challenges = (await pg.control.query("select * from auth_challenges order by id")).rows;
        assert.equal(challenges[0].consumed_at,null); assert.deepEqual(challenges[0].data,{proof:"email"});
        assert.ok(challenges[1].consumed_at); assert.deepEqual(challenges[1].data,{});
      });
    }
    test(`${kind} same-mobile completion rejects a stale baseline after a self-account change`, async () => {
      const id = kind === "users" ? "du" : "d";
      const results = await race([
        tx => own({mobile:newMobile},tx),
        tx => patch(kind,id,{mobile:"+14155552674"},{mobile:oldMobile},tx,kind === "users" ? self : admin),
      ],{rowLocks:[{table:"users",id:"du"}]});
      staleLoser(results);
      assert.equal((await current("users","du")).mobile,newMobile);
      assert.equal((await current("doctors","d")).mobile,newMobile);
      assert.equal((await current("users","du")).staffMobileProof,null);
    });
    test(`${kind} winning mobile completion invalidates proof without losing a later self-account photo`, async () => {
      const id = kind === "users" ? "du" : "d";
      const results = await race([
        tx => patch(kind,id,{mobile:newMobile},{mobile:oldMobile},tx,kind === "users" ? self : admin),
        tx => own({photoUrl:"https://example.test/self.jpg"},tx),
      ],{rowLocks:[{table:"users",id:"du"}]});
      assert.deepEqual(results.map(r => r.status),["fulfilled","fulfilled"],JSON.stringify(results));
      const account = await current("users","du"), doctor = await current("doctors","d");
      assert.equal(account.mobile,newMobile); assert.equal(doctor.mobile,newMobile);
      assert.equal(account.photoUrl,"https://example.test/self.jpg"); assert.equal(doctor.photoUrl,"https://example.test/self.jpg");
      assert.equal(account.staffMobileProof,null);
      const sms = (await pg.control.query("select * from auth_challenges where id='sms'")).rows[0];
      assert.ok(sms.consumed_at); assert.deepEqual(sms.data,{});
    });
  }
});
