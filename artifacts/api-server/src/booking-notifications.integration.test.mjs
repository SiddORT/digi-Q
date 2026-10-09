// Real native-session authorization, creation allocator, history and durable outbox.
// Disposable multi-connection PostgreSQL; auth-email replaced before import, never SMTP.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h, date, sessionId;
const cookies={};
process.env.AUTH_SESSION_MODE="native";
before(async()=>{
  h=await createFeatureHarness({bookingLookups:true,postgres:true,fakeBookingMail:true});
  await seedFeatureFixtures(h.pg);
  for(const role of ["sa","adm","adm2","docu","rec","patu"]){
    const token=createHash("sha256").update(randomUUID()).digest("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",[createHash("sha256").update(token).digest("hex"),role,new Date(Date.now()+3600000)]);
    cookies[role]=`digiq_session=${token}`;
  }
  await h.pg.exec(`insert into settings(id,data) values('platform','{"notificationsEnabled":true,"requireMobileVerification":false}');
    update patients set mobile='+919000000001' where id='p1';
    update clinics set data=data||'{"dateFormat":"DD/MM/YYYY","timeFormat":"24h"}'::jsonb where id='c1';
    update branches set data=data||'{"timezone":"UTC"}'::jsonb where id='b1';
    insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference,data) values('unified-qr','c1','b1','d1','unified-public','{}');`);
  date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
  const session=await call("adm","POST","/schedules",{doctorId:"d1",branchId:"b1",clinicId:"c1",dayOfWeek:new Date(`${date}T12:00:00Z`).getUTCDay(),startTime:"09:00",endTime:"12:00",timezone:"UTC",isOpen:true,maxTokens:40,tokenPrefix:"U",consultationMinutes:20,queueMode:"mixed"});
  assert.equal(session.status,201,JSON.stringify(session.data));sessionId=session.data.id;
});
after(async()=>{await h?.close();});
const call=(role,method,path,body)=>h.call(null,method,path,body,role?{cookie:cookies[role]}:{});
async function patient(id,email){
  await h.pg.query("insert into patients(id,clinic_id,branch_id,data) values($1,'c1','b1',$2)",[id,{fullName:"Fictional Unified Patient",email}]);
  return id;
}
const payload=patientId=>({clinicId:"c1",branchId:"b1",doctorId:"d1",patientId,date,sessionId,source:"phone",termsAccepted:true,requestId:randomUUID(),notes:"PRIVATE-NOTE-NEVER-EMAIL"});
async function assertNotice(appointmentId){
  const result=await call("adm","GET","/notifications");
  const notices=result.data.items.filter(n=>n.appointmentId===appointmentId);
  assert.equal(notices.length,1);
  assert.equal(notices[0].kind,"appointments");
  assert.match(notices[0].title,/^Booked/);
  assert.equal((await call("adm2","GET","/notifications")).data.items.some(n=>n.appointmentId===appointmentId),false);
  return notices[0];
}
test("guest, patient and every permitted staff creation agree with saved tickets, one owner notice and both emails",async()=>{
  for(const role of ["sa","adm","docu","rec","patu","guest"]){
    const patientId=role==="patu"?"p1":role==="guest"?null:await patient(`unified-${role}`,`${role}-patient@test.invalid`);
    const before=(await h.pg.query("select count(*)::int n from patients")).rows[0].n;
    const body=role==="guest"?{qrReference:"unified-public",branchId:"b1",doctorId:"d1",date,sessionId,fullName:"Fictional Unified Guest",email:"guest@test.invalid",requestId:randomUUID(),receiptSecret:"9".repeat(64)}:{...payload(patientId),source:role==="patu"?"online":"phone"};
    const path=role==="guest"?"/public/guest-requests":"/appointments";
    const created=await call(role==="guest"?null:role,"POST",path,body);
    assert.equal(created.status,201,`${role}: ${JSON.stringify(created.data)}`);
    assert.equal(created.data.confirmationEmail,"provider_accepted");
    const saved=(await h.pg.query("select id,data from appointments where data->>'reference'=$1",[created.data.reference])).rows[0];
    for(const key of ["reference","doctorName","clinicName","branchName","date","startTime","endTime","timezone"])assert.equal(created.data[key],saved.data[key],`${role}: ${key}`);
    assert.equal((await h.pg.query("select count(*)::int n from patients")).rows[0].n,before+(role==="guest"?1:0),"existing booking never clones a profile");
    const notice=await assertNotice(saved.id);
    if(role==="adm"){
      await call("adm","POST","/notifications/read",{ids:[notice.id]});
      assert.equal((await call("adm","GET","/notifications")).data.items.find(n=>n.id===notice.id).read,true);
    }
    const sentBefore=h.mail.messages.length;
    await h.dispatchOutbox();
    assert.equal(h.mail.messages.length,sentBefore+1,"owner email is asynchronous and exactly once");
    const messages=h.mail.messages.filter(m=>m.text.includes(created.data.reference));
    assert.equal(messages.length,2,role);
    for(const message of messages){
      for(const value of [saved.data.reference,saved.data.doctorName,saved.data.clinicName,saved.data.branchName,"09:00","12:00","UTC"])assert.ok(message.text.includes(value));
      const [y,m,d]=date.split("-");assert.ok(message.text.includes(`${d}/${m}/${y}`));
      assert.ok(!message.text.includes("PRIVATE-NOTE"));
      assert.ok(!message.text.includes(body.receiptSecret||"NONEXISTENT-SECRET"));
    }
    const retry=await call(role==="guest"?null:role,"POST",path,body);
    assert.equal(retry.data.reference,created.data.reference);
    await h.dispatchOutbox();
    assert.equal(h.mail.messages.filter(m=>m.text.includes(created.data.reference)).length,2,"idempotent retry sends nothing");
    await assertNotice(saved.id);
  }
});
test("no-email booking still notifies owner; uncertain patient/admin dispatch cannot create a second visit or resend",async()=>{
  const none=await call("adm","POST","/appointments",payload(await patient("unified-no-email")));
  assert.equal(none.data.confirmationEmail,"no_recipient");await assertNotice(none.data.id);
  await h.dispatchOutbox();
  assert.equal(h.mail.messages.filter(m=>m.text.includes(none.data.reference)).length,1);
  h.mail.fail=true;
  const body=payload(await patient("unified-failure","failure@test.invalid"));
  const failedMail=await call("rec","POST","/appointments",body);
  assert.equal(failedMail.status,201);assert.equal(failedMail.data.confirmationEmail,"unavailable");
  await h.dispatchOutbox();h.mail.fail=false;
  const retry=await call("rec","POST","/appointments",body);
  assert.equal(retry.data.id,failedMail.data.id);
  await h.dispatchOutbox();
  assert.equal(h.mail.messages.filter(m=>m.text.includes(failedMail.data.reference)).length,0);
  await assertNotice(failedMail.data.id);
  assert.equal((await h.pg.query("select count(*)::int n from appointments where request_id=$1",[body.requestId])).rows[0].n,1);
});
test("same patient/owner address is deduplicated; explicit template and clinic opt-outs stay unchanged",async()=>{
  const same=await call("adm","POST","/appointments",payload(await patient("unified-shared","adm@test.invalid")));
  await h.dispatchOutbox();assert.equal(h.mail.messages.filter(m=>m.text.includes(same.data.reference)).length,1);
  const content={enabled:false,subject:"Owner opt-out",body:"{{appointment_details}}",prefix:"",logoUrl:"",footer:""};
  await h.pg.query("insert into settings(id,data) values('notification-template:c1:booking:clinicAdmin',$1)",[{revision:1,published:content}]);
  const opted=await call("adm","POST","/appointments",payload(await patient("unified-opted","opted@test.invalid")));
  await h.dispatchOutbox();assert.equal(h.mail.messages.filter(m=>m.text.includes(opted.data.reference)).length,1);
  assert.deepEqual((await h.pg.query("select data from settings where id='notification-template:c1:booking:clinicAdmin'")).rows[0].data,{revision:1,published:content});
  await h.pg.exec(`update clinics set data=data||'{"policies":{"notificationsEnabled":false}}'::jsonb where id='c1'`);
  const disabled=await call("adm","POST","/appointments",payload(await patient("unified-disabled","disabled@test.invalid")));
  assert.equal(disabled.data.confirmationEmail,"disabled");
  await h.dispatchOutbox();assert.equal(h.mail.messages.filter(m=>m.text.includes(disabled.data.reference)).length,0);
  await assertNotice(disabled.data.id);
});
test("failed or revoked scope submissions produce no new history or outbox",async()=>{
  const before=(await h.pg.query("select count(*)::int n from appointment_history")).rows[0].n;
  const request=payload("p1");request.branchId="b3";
  assert.ok((await call("rec","POST","/appointments",request)).status>=400);
  await h.pg.exec("delete from assignments where user_id='rec'");
  assert.equal((await call("rec","POST","/appointments",payload("p1"))).status,403);
  assert.equal((await h.pg.query("select count(*)::int n from appointment_history")).rows[0].n,before);
});
