// Real SQL, routers, native sessions and allocator on disposable multi-connection PostgreSQL.
// No live clinic, SMTP transport, production booking, or permission mocks.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
let h,date,weekday,sessionId;
const cookies={};
process.env.AUTH_SESSION_MODE="native";
before(async()=>{
  h=await createFeatureHarness({bookingLookups:true,postgres:true});
  await seedFeatureFixtures(h.pg);
  await h.pg.exec(`update branches set data=data||'{"timezone":"UTC","openingHours":[{"dayOfWeek":0,"startTime":"00:00","endTime":"23:59"}]}'::jsonb where id='b1';
    update branches set data=data||'{"timezone":"Pacific/Kiritimati"}'::jsonb where id='b2';
    insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference,data) values ('discovery-qr','c1','b1','d1','discovery-public','{}');`);
  await h.pg.exec("update patients set mobile='+919000000001' where id='p1'");
  for(const role of ["sa","adm","adm2","docu","rec","patu"]){
    const token=createHash("sha256").update(randomUUID()).digest("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",[createHash("sha256").update(token).digest("hex"),role,new Date(Date.now()+3600000)]);
    cookies[role]=`digiq_session=${token}`;
  }
  date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  weekday=new Date(`${date}T12:00:00Z`).getUTCDay();
});
after(async()=>{await h?.close();});
const call=(role,method,path,body)=>h.call(null,method,path,body,role?{cookie:cookies[role]}:{});
const daily=(d=date,b="b1")=>call(null,"GET",`/public/availability/sessions?doctorId=d1&branchId=${b}&date=${d}`);
const schedule=(startTime="09:00",endTime="12:00")=>({doctorId:"d1",branchId:"b1",clinicId:"c1",dayOfWeek:weekday,startTime,endTime,timezone:"UTC",isOpen:true,maxTokens:8,tokenPrefix:"D",consultationMinutes:20,queueMode:"mixed"});

test("saved active session reopens and appears only on matching location and weekday, without a reload",async()=>{
  assert.deepEqual((await daily()).data,[]);
  const saved=await call("sa","POST","/schedules",schedule());
  assert.equal(saved.status,201,JSON.stringify(saved.data));sessionId=saved.data.id;
  assert.equal((await call("adm","GET",`/schedules/${sessionId}`)).data.id,sessionId);
  const matching=await daily();assert.equal(matching.status,200);assert.equal(matching.data[0].sessionId,sessionId);assert.equal(matching.data[0].available,true);
  assert.deepEqual((await daily(new Date(Date.parse(date)+86400000).toISOString().slice(0,10))).data,[]);
  assert.deepEqual((await daily(date,"b2")).data,[]);
});
test("public date context is location-owned even on an empty date, with no weekly/private configuration",async()=>{
  const r=await call(null,"GET","/public/availability/context?doctorId=d1&branchId=b2");
  assert.equal(r.status,200);assert.equal(r.data.timezone,"Pacific/Kiritimati");
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en",{timeZone:r.data.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  assert.equal(r.data.today,`${parts.year}-${parts.month}-${parts.day}`);
  assert.deepEqual(Object.keys(r.data).sort(),["lastBookableDate","timezone","today"]);
  assert.equal((await call(null,"GET","/public/availability/context?doctorId=d1&branchId=b3")).status,409);
  assert.equal((await daily("not-a-date")).status,400);
});
test("schedule management capability retains ownership, assignment, role and administrator policy",async()=>{
  for(const role of ["sa","adm","docu","rec"])assert.equal((await call(role,"GET","/booking/schedule-access?doctorId=d1&branchId=b1")).data.allowed,true,role);
  for(const role of ["patu","adm2"])assert.equal((await call(role,"GET","/booking/schedule-access?doctorId=d1&branchId=b1")).data.allowed,false,role);
  assert.equal((await call(null,"GET","/booking/schedule-access?doctorId=d1&branchId=b1")).status,401);
  await h.pg.exec(`insert into settings(id,data) values('permission-policy','{"revision":1,"denied":["receptionist:schedules:update"]}')`);
  assert.equal((await call("rec","GET","/booking/schedule-access?doctorId=d1&branchId=b1")).data.allowed,false);
  await h.pg.exec("delete from settings where id='permission-policy'");
});
test("multiple sessions, date overrides, closures, inactive rows and extras remain authoritative",async()=>{
  const second=await call("adm","POST","/schedules",schedule("14:00","17:00"));assert.equal(second.status,201,JSON.stringify(second.data));
  assert.equal((await daily()).data.length,2);
  await h.pg.query("update schedules set data=data||'{\"isOpen\":false}'::jsonb where id=$1",[second.data.id]);
  assert.equal((await daily()).data.find(s=>s.sessionId===second.data.id).available,false);
  assert.match((await daily()).data.find(s=>s.sessionId===second.data.id).reason,/No open weekly session/i);
  await h.pg.query("update schedules set status='inactive' where id=$1",[second.data.id]);
  assert.equal((await daily()).data.length,1);
  await h.pg.query("update schedules set status='active',data=data||'{\"isOpen\":true,\"maxTokens\":0}'::jsonb where id=$1",[second.data.id]);
  assert.match((await daily()).data.find(s=>s.sessionId===second.data.id).reason,/setup is incomplete/i);
  await h.pg.query("update schedules set data=data||'{\"maxTokens\":2,\"queueMode\":\"walkInsOnly\"}'::jsonb where id=$1",[second.data.id]);
  assert.equal((await daily()).data.find(s=>s.sessionId===second.data.id).queueMode,"walkInsOnly");
  await h.pg.exec("update users set status='inactive' where id='docu'");
  assert.equal((await daily()).status,409);
  await h.pg.exec("update users set status='active' where id='docu'");
  const exception=await call("adm","POST","/availability-exceptions",{doctorId:"d1",branchId:"b1",date,sessionId,isClosed:true,isExtra:false,reason:"Fictional dated closure"});
  assert.equal(exception.status,201,JSON.stringify(exception.data));
  let rows=(await daily()).data;assert.equal(rows.find(s=>s.sessionId===sessionId).available,false);assert.equal(rows.find(s=>s.sessionId===sessionId).reason,"Fictional dated closure");
  assert.equal(rows.find(s=>s.sessionId===second.data.id).available,true);
  await h.pg.query("delete from availability_exceptions where id=$1",[exception.data.id]);
  const timing=await call("adm","POST","/availability-exceptions",{doctorId:"d1",branchId:"b1",date,sessionId,isClosed:false,isExtra:false,startTime:"10:00",endTime:"12:00",reason:"Fictional timing change"});
  assert.equal(timing.status,201,JSON.stringify(timing.data));assert.equal((await daily()).data[0].startTime,"10:00");
  await h.pg.query("update availability_exceptions set status='inactive' where id=$1",[timing.data.id]);
  await h.pg.query("update schedules set status='inactive' where id=$1",[second.data.id]);
  assert.equal((await daily()).data.length,1);
  const extraDate=new Date(Date.parse(date)+86400000).toISOString().slice(0,10);
  const extra=await call("adm","POST","/availability-exceptions",{doctorId:"d1",branchId:"b1",date:extraDate,isClosed:false,isExtra:true,startTime:"18:00",endTime:"20:00",maxTokens:3,reason:"Fictional extra"});
  assert.equal(extra.status,201,JSON.stringify(extra.data));assert.equal((await daily(extraDate)).data[0].sessionId,extra.data.id);
});
test("each permitted staff role and signed-in patient confirms directly to a private issued ticket; capacity is rechecked",async()=>{
  for(const role of ["sa","adm","docu","rec","patu"]){
    const patientId=role==="patu"?"p1":`discovery-patient-${role}`;
    if(role!=="patu")await h.pg.query("insert into patients(id,clinic_id,branch_id,data) values($1,'c1','b1',$2)",[patientId,{fullName:`Fictional ${role} Patient`}]);
    const r=await call(role,"POST","/appointments",{clinicId:"c1",branchId:"b1",doctorId:"d1",patientId,date,sessionId,source:role==="patu"?"online":"phone",termsAccepted:true,requestId:randomUUID()});
    assert.equal(r.status,201,`${role}: ${JSON.stringify(r.data)}`);assert.ok(r.data.token);assert.ok(r.data.reference);assert.equal(r.data.startTime,"09:00");
    const qr=await call(role,"GET",`/appointments/${r.data.id}/qr`);assert.equal(qr.status,200);assert.ok(qr.data.checkInUrl);
  }
  const guest=await call(null,"POST","/public/guest-requests",{qrReference:"discovery-public",branchId:"b1",doctorId:"d1",date,sessionId,fullName:"Fictional Discovery Guest",requestId:randomUUID(),receiptSecret:"a".repeat(64)});
  assert.equal(guest.status,201,JSON.stringify(guest.data));assert.ok(guest.data.token);assert.ok(guest.data.checkInUrl);assert.notEqual(guest.data.status,"pending");
  await h.pg.query("update schedules set data=data||'{\"maxTokens\":6}'::jsonb where id=$1",[sessionId]);
  const full=(await daily()).data[0];assert.equal(full.available,false);assert.equal(full.reason,"Session capacity reached");
  const refused=await call("rec","POST","/appointments",{clinicId:"c1",branchId:"b1",doctorId:"d1",patientId:"p1",date,sessionId,source:"phone",termsAccepted:true,requestId:randomUUID()});
  assert.equal(refused.status,409);
});
test("location dates cross midnight and year boundaries independently of zero-session selection",async(t)=>{
  t.mock.timers.enable({apis:["Date"],now:Date.parse("2026-12-31T12:30:00Z")});
  try{
    const utc=await call(null,"GET","/public/availability/context?doctorId=d1&branchId=b1");
    const island=await call(null,"GET","/public/availability/context?doctorId=d1&branchId=b2");
    assert.equal(utc.data.today,"2026-12-31");assert.equal(island.data.today,"2027-01-01");
    assert.equal((await daily("2027-01-01","b2")).data.length,0);
  }finally{t.mock.timers.reset();}
});
