// Real scoped routers and migrated PostgreSQL; no workspace data or external mail.
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {createFeatureHarness} from "./test-support/feature-harness.mjs";
import {seedFeatureFixtures} from "./test-support/feature-fixtures.mjs";
let h;
before(async()=>{h=await createFeatureHarness({administration:true});await seedFeatureFixtures(h.pg);await h.pg.exec(`insert into patients(id,clinic_id,branch_id,data) values ('local','c1','b1','{"fullName":"Local Patient"}');`);});
after(async()=>await h?.close());
const rows=async(sql,params)=>(await h.pg.query(sql,params)).rows;
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.data));return r.data;};
test("staff demographic edits retain saved registration; null, blank and foreign moves fail",async()=>{
  for(const actor of ["adm","rec"]){
    ok(await h.call(actor,"PATCH","/patients/local",{fullName:"Updated Patient"}));
    assert.deepEqual((await rows("select clinic_id,branch_id from patients where id='local'"))[0],{clinic_id:"c1",branch_id:"b1"});
    for(const patch of [{branchId:"b2"},{clinicId:"c2"},{branchId:null},{branchId:""},{clinicId:null}])assert.ok((await h.call(actor,"PATCH","/patients/local",{fullName:"Forged Move",...patch})).status>=400,JSON.stringify(patch));
  }
  assert.equal((await h.call("adm2","PATCH","/patients/local",{fullName:"Foreign Edit"})).status,403);
  assert.equal(ok(await h.call("sa","PATCH","/patients/local",{fullName:"Super Admin Move",clinicId:"c2",branchId:"b2"})).branchId,"b2");
});
test("doctor/user intersections, pagination and search do not widen clinical assignments",async()=>{
  assert.equal(ok(await h.call("rec","GET","/clinics?doctorId=d1")).total,1);
  assert.equal(ok(await h.call("adm","GET","/clinics?doctorId=d1&pageSize=1")).total,2);
  assert.equal(ok(await h.call("adm","GET","/clinics?doctorId=d1&search=Lakeview")).total,1);
  for(const path of ["/clinics?doctorId=d3","/branches?doctorId=d3","/branches?doctorId=missing"])assert.equal(ok(await h.call("rec","GET",path)).total,0);
  assert.deepEqual(ok(await h.call("rec","GET","/branches?doctorId=d1")).items.map(b=>b.id),["b1"]);
  await h.pg.exec(`update users set status='inactive' where id='doc3u'`);
  assert.equal(ok(await h.call("sa","GET","/clinics?doctorId=d3")).total,0);
  await h.pg.exec(`update users set status='active' where id='doc3u'`);
});
test("administrator updates read back in a separate doctor identity with stable IDs, overrides and snapshots",async()=>{
  const before=await rows("select * from assignments where user_id='docu' order by id");
  const snapshots=await rows("select id,data from appointments order by id");
  for(let i=0;i<2;i++){
    ok(await h.call("adm","PATCH","/clinics/c1",{name:"Updated Group",address:"Fictional Group Road",phone:"+919000000011"}));
    ok(await h.call("sa","PATCH","/branches/b1",{clinicId:"c1",name:"Updated Location",address:"Fictional Location Road",phone:"+919000000022",inheritPhone:false}));
    ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Updated",email:"docu@test.invalid",mobile:"+919000000033",photoUrl:"https://example.invalid/doctor.png"}));
    assert.equal(ok(await h.call("docu","GET","/clinics/c1")).name,"Updated Group");
    assert.equal(ok(await h.call("docu","GET","/branches/b1")).effectivePhone,"+919000000022");
    assert.equal(ok(await h.call("docu","GET","/me")).user.fullName,"Dr Updated");
    assert.equal(ok(await h.call("docu","GET","/me")).user.photoUrl,"https://example.invalid/doctor.png");
    assert.equal(ok(await h.call("docu","GET","/doctors/d1")).fullName,"Dr Updated");
  }
  ok(await h.call("sa","PATCH","/users/docu",{fullName:"Dr Account Edit",email:"docu@test.invalid",role:"doctor",mobile:"+919000000044"}));
  const profile=(await rows("select data from doctors where id='d1'"))[0].data;
  assert.equal(profile.fullName,"Dr Account Edit");assert.equal(profile.mobile,"+919000000044");
  await h.pg.exec(`update users set data='{"address":"Saved Home","city":"Pune"}' where id='docu'`);
  ok(await h.call("docu","PATCH","/me",{fullName:"Dr Personal Edit",mobile:"+919000000055",photoUrl:"https://example.invalid/photo.png"}));
  assert.equal((await rows("select data from users where id='docu'"))[0].data.address,"Saved Home","identity edits preserve saved onboarding data");
  assert.equal((await rows("select data from doctors where id='d1'"))[0].data.fullName,"Dr Personal Edit");
  assert.deepEqual(await rows("select * from assignments where user_id='docu' order by id"),before);
  assert.deepEqual(await rows("select id,data from appointments order by id"),snapshots);
  assert.equal(ok(await h.call("doc3u","GET","/doctors/d3")).fullName,"Dr Foreign");
  assert.equal((await h.call("doc3u","GET","/branches/b1")).status,403);
});
test("explicit assignment changes reuse records and do not grant unrelated doctor access",async()=>{
  const counts=await rows("select (select count(*)::int from doctors) doctors,(select count(*)::int from clinics) clinics,(select count(*)::int from branches) branches");
  const original=await rows("select * from assignments where user_id='docu' order by id");
  ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Same",email:"docu@test.invalid",clinicIds:["c1","c2"],branchIds:["b1","b2"]}));
  assert.deepEqual(await rows("select * from assignments where user_id='docu' order by id"),original,"unchanged projected arrays cannot widen branch-only mappings");
  ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Assigned",email:"docu@test.invalid",clinicIds:["c1"],branchIds:["b1"]}));
  const selected=await rows("select * from assignments where user_id='docu' order by id");
  for(let i=0;i<2;i++)ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Assigned",email:"docu@test.invalid",clinicIds:["c1"],branchIds:["b1"]}));
  assert.deepEqual(await rows("select * from assignments where user_id='docu' order by id"),selected,"repeated explicit saves retain stable link IDs");
  assert.deepEqual(ok(await h.call("docu","GET","/doctors/d1")).branchIds,["b1"]);
  assert.equal(ok(await h.call("sa","GET","/branches?doctorId=d1")).total,1);
  assert.equal((await h.call("docu","GET","/branches/b2")).status,403);
  assert.deepEqual(await rows("select (select count(*)::int from doctors) doctors,(select count(*)::int from clinics) clinics,(select count(*)::int from branches) branches"),counts);
  assert.equal((await rows("select count(*)::int n from assignments where user_id='docu' and branch_id='b1'"))[0].n,1);
});
test("administrator-created locations are reused by the assigned doctor's workspace, never copied",async()=>{
  const group=ok(await h.call("sa","POST","/clinics",{name:"Created Group",address:"Fictional Group Street",adminId:"adm"}),201);
  const location=ok(await h.call("adm","POST","/branches",{clinicId:group.id,name:"Created Location",address:"Fictional Location Street"}),201);
  ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Created Context",email:"docu@test.invalid",clinicIds:["c1",group.id],branchIds:["b1",location.id]}));
  const mappings=await rows("select * from assignments where user_id='docu' order by id");
  const counts=await rows("select (select count(*)::int from doctors) doctors,(select count(*)::int from clinics) clinics,(select count(*)::int from branches) branches,(select count(*)::int from qrs) qrs");
  for(let i=0;i<2;i++){
    ok(await h.call("adm","PATCH",`/clinics/${group.id}`,{name:"Created Group Current",address:"Fictional Group Street"}));
    ok(await h.call("sa","PATCH",`/branches/${location.id}`,{clinicId:group.id,name:"Created Location Current",address:"Fictional Location Street"}));
    ok(await h.call("adm","PATCH","/doctors/d1",{fullName:"Dr Created Context",email:"docu@test.invalid",clinicIds:["c1",group.id],branchIds:["b1",location.id]}));
    assert.equal(ok(await h.call("docu","GET",`/clinics/${group.id}`)).name,"Created Group Current");
    assert.equal(ok(await h.call("docu","GET",`/branches/${location.id}`)).id,location.id);
    assert.equal(ok(await h.call("docu","GET","/me")).doctorId,"d1");
    assert.deepEqual(await rows("select * from assignments where user_id='docu' order by id"),mappings);
  }
  assert.deepEqual(await rows("select (select count(*)::int from doctors) doctors,(select count(*)::int from clinics) clinics,(select count(*)::int from branches) branches,(select count(*)::int from qrs) qrs"),counts);
  assert.equal((await h.call("doc3u","GET",`/branches/${location.id}`)).status,403);
});
