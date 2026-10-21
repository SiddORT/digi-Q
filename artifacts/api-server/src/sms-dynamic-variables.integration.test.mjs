// Real booking/action routes and migrations, isolated PostgreSQL, fake mail and SMS.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

let h;
const cookies={}, captures=[];
const date=new Date().toISOString().slice(0,10);
const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
const expectOk=result=>{assert(result.status<300,JSON.stringify(result.data));return result.data;};
const call=(role,method,path,body)=>h.call(null,method,path,body,role?{cookie:cookies[role]}:{});
const rows=async(sql,args)=>(await h.pg.query(sql,args)).rows;
const sms=async(_env,to,message,content)=>{captures.push({to,message,content});return "provider_accepted";};
const rendered=(body,values)=>body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g,(_,key)=>values[key]);
const snapshot=async id=>{const [r]=await rows("select * from appointments where id=$1",[id]);return {...r.data,...r,patientId:r.patient_id,doctorId:r.doctor_id};};
const values=row=>({patient_name:row.patientName,doctor_name:row.doctorName,
  appointment_date:row.date.split("-").reverse().join("/"),session_start:row.startTime,
  token_number:String(row.token_number),cancel_reason:row.history?.at(-1)?.reason?.trim()||"Not specified"});
const registration=(event,group)=>h.approvedAppointmentSms.find(r=>r.event===event&&r.recipients.includes(group));
async function dispatchExpected(event,row,groups,now) {
  const before=captures.length;
  await h.dispatchSmsOutbox(sms,now);
  const sent=captures.slice(before);
  assert.equal(sent.length,groups.length,`${event}: ${JSON.stringify(await rows("select id,data from settings where id like 'sms-outbox:%' and data->>'state'='preparation_failed'"))}`);
  for(const group of groups){
    const approved=registration(event,group);
    const expected=rendered(approved.body,values(row));
    const to=group==="patient"?"+919876543210":group==="doctor"?(row.doctorId==="d2"?"+919876543215":"+919876543212"):"+919876543211";
    const message=sent.find(m=>m.to===to);
    assert(message,`${event}: ${group} actual contact`);
    assert.equal(message.message,expected,`${event}: ${group} exact approved wording and event values`);
    assert.equal(message.content.dltTemplateId,approved.dltTemplateId);
    assert(!message.message.includes("Asha Admin")&&!message.message.includes("Rina Desk"));
  }
  await h.dispatchSmsOutbox(sms,now);
  assert.equal(captures.length,before+groups.length,"accepted sends are never replayed");
}
async function book(mode,label=mode,day=date) {
  if(mode!=="guest"&&mode!=="patu")
    await h.pg.query("insert into patients(id,clinic_id,branch_id,mobile,data) values($1,'c1','b1','+919876543210',$2)",[label,{fullName:`Patient ${label}`,email:`${label}@test.invalid`}]);
  const body=mode==="guest"?{qrReference:"sms-qr",doctorId:"d1",branchId:"b1",date:day,fullName:"Guest Patient",
    mobile:"+919876543210",email:"guest@test.invalid",requestId:randomUUID(),receiptSecret:randomUUID().replaceAll("-","").repeat(2)}:
    {clinicId:"c1",branchId:"b1",doctorId:"d1",patientId:mode==="patu"?"p1":label,date:day,startTime:"00:00",source:mode==="patu"?"online":"phone",termsAccepted:true,requestId:randomUUID()};
  const result=expectOk(await call(mode==="guest"?null:mode,"POST",mode==="guest"?"/public/guest-requests":"/appointments",body));
  return snapshot(result.appointmentId||result.id);
}
before(async()=>{
  Object.assign(process.env,{AUTH_SESSION_MODE:"native",NODE_ENV:"test",CLINICFLOW_PUBLIC_ORIGIN:"https://booking.example.invalid",
    NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"fixture-key",NOTIFICATION_SMS_BEARER_TOKEN:"fixture-bearer",
    NOTIFICATION_SMS_CLIENT_ID:"fixture-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
    NOTIFICATION_SMS_ENABLED:"true",NOTIFICATION_SMS_MAPPING:"",INTEGRATIONS_ENCRYPTION_KEY:"de".repeat(32),
    SMTP_HOST:"mail.test.invalid",SMTP_PORT:"587",SMTP_USER:"fixture",SMTP_PASSWORD:"fixture",SMTP_FROM:"sender@test.invalid",NOTIFICATION_EMAIL_ENABLED:"true"});
  h=await createFeatureHarness({bookingLookups:true,postgres:true,fakeBookingMail:true});
  await seedFeatureFixtures(h.pg);
  for(const id of ["sa","adm","docu","rec","patu"]){
    const token=createHash("sha256").update(randomUUID()).digest("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",[createHash("sha256").update(token).digest("hex"),id,new Date(Date.now()+3600000)]);
    cookies[id]=`digiq_session=${token}`;
  }
  await h.pg.exec(`insert into settings(id,data) values('platform','{"notificationsEnabled":true,"requireMobileVerification":false}');
    update patients set mobile='+919876543210',data=data||'{"fullName":"Patient Ravi"}'::jsonb where id='p1';
    update users set mobile='+919876543211' where id='adm';
    update users set mobile='+919876543212',full_name='Meera Rao' where id='docu';
    update clinics set data=data||'{"dateFormat":"DD/MM/YYYY","timeFormat":"24h"}'::jsonb where id='c1';
    update branches set data=data||'{"timezone":"UTC"}'::jsonb where id='b1';
    insert into users(id,email,full_name,role,mobile) values('doc2u','doc2@test.invalid','Nila Sen','doctor','+919876543215');
    insert into doctors(id,user_id,owner_admin_id) values('d2','doc2u','adm');
    insert into assignments(id,user_id,clinic_id,branch_id) values('sms-d2','doc2u','c1','b1');
    insert into qrs(id,clinic_id,branch_id,doctor_id,public_reference,data) values('sms-qr','c1','b1','d1','sms-qr','{}');`);
  for(const doctorId of ["d1","d2"])for(const day of [date,tomorrow])
    expectOk(await call("adm","POST","/schedules",{doctorId,branchId:"b1",clinicId:"c1",dayOfWeek:new Date(`${day}T12:00:00Z`).getUTCDay(),
      startTime:doctorId==="d1"?"00:00":"13:00",endTime:"23:59",timezone:"UTC",isOpen:true,maxTokens:100,tokenPrefix:doctorId==="d1"?"DR":"NS",consultationMinutes:5,queueMode:"mixed"}));
  for(const approved of h.approvedAppointmentSms)for(const recipient of approved.recipients){
    const key=`sms-template:platform:${approved.event}${recipient==="patient"?"":`:${recipient}`}`;
    await h.pg.query("insert into settings(id,data) values($1,$2)",[key,{revision:1,published:{enabled:true,subject:"Approved appointment SMS",
      body:approved.body,prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:approved.dltTemplateId}}]);
  }
});
after(async()=>await h?.close());

test("approved registrations and fixed content remain byte-for-byte unchanged",async()=>{
  const source=await readFile(new URL("./lib/approved-appointment-sms.ts",import.meta.url));
  assert.equal(createHash("sha256").update(source).digest("hex"),"0db17698beb642cba9b5f0bc2e058019fc85116b83f4d2f39b8694269dd3b3ba");
  assert.equal(h.approvedAppointmentSms.reduce((n,r)=>n+r.recipients.length,0),11);
});
test("patient, staff and guest real bookings render distinct identities, then cancellation and completion reach all approved recipients",async()=>{
  for(const mode of ["patu","rec","guest"]){
    const row=await book(mode,mode,mode==="patu"?tomorrow:date);
    assert.notEqual(row.patientName,row.doctorName);
    await dispatchExpected("booking",row,["patient","clinicAdmin","doctor"]);
    if(mode==="patu"){
      expectOk(await call("patu","POST",`/appointments/${row.id}/actions`,{action:"cancel",expectedRevision:row.revision}));
      await dispatchExpected("cancelled",await snapshot(row.id),["patient","clinicAdmin","doctor"]);
    }
    if(mode==="rec"){
      // Follow the actual queue transition path after booking.
      const called=expectOk(await call("docu","POST","/queue/call-next",{doctorId:"d1",branchId:"b1",date,startTime:"00:00"}));
      assert.equal(called.appointment.id,row.id);
      expectOk(await call("docu","POST",`/appointments/${row.id}/actions`,{action:"start"}));
      expectOk(await call("docu","POST",`/appointments/${row.id}/actions`,{action:"complete"}));
      await dispatchExpected("completed",await snapshot(row.id),["patient","clinicAdmin","doctor"]);
    }
  }
});
test("cross-doctor rescheduling captures the new doctor/date/session and reminder renders that saved event",async()=>{
  let row=await book("rec","reschedule");
  await dispatchExpected("booking",row,["patient","clinicAdmin","doctor"]);
  expectOk(await call("adm","POST",`/appointments/${row.id}/reschedule`,{doctorId:"d2",branchId:"b1",date:tomorrow,startTime:"13:00",expectedRevision:row.revision,reason:"Patient requested another doctor"}));
  row=await snapshot(row.id);
  assert.equal(row.doctorName,"Nila Sen");assert.equal(row.date,tomorrow);assert.equal(row.startTime,"13:00");
  await dispatchExpected("rescheduled",row,["patient"]);
  const now=Date.parse(`${tomorrow}T13:00:00Z`)-3600000;
  await h.dispatchOutbox(async()=>{},now);
  // Reminder is queued by the real scheduler, not a fabricated event.
  await dispatchExpected("reminder",row,["patient"],now);
});
test("profile edits do not change event labels, recipient contact stays current, and equal names are legitimate",async()=>{
  let row=await book("rec","snapshot");
  await h.pg.exec(`update patients set data=data||'{"fullName":"Edited patient"}'::jsonb where id='snapshot';
    update users set full_name='Edited doctor' where id='docu';
    update clinics set data=data||'{"name":"Edited clinic"}'::jsonb where id='c1';`);
  await dispatchExpected("booking",row,["patient","clinicAdmin","doctor"]);
  const state=await rows("select data from settings where id like 'sms-outbox:%' and data->>'appointmentId'=$1",[row.id]);
  assert(state.every(r=>r.data.snapshot.patientName==="Patient snapshot"&&r.data.snapshot.doctorName==="Meera Rao"&&r.data.snapshot.clinicName==="Lakeview Clinic"));
  await h.pg.exec(`update users set full_name='Same Name' where id='docu';`);
  await h.pg.query("insert into patients(id,clinic_id,branch_id,mobile,data) values('equal','c1','b1','+919876543210','{\"fullName\":\"Same Name\"}')");
  const equal=expectOk(await call("rec","POST","/appointments",{clinicId:"c1",branchId:"b1",doctorId:"d1",patientId:"equal",date,startTime:"00:00",source:"phone"}));
  row=await snapshot(equal.id);assert.equal(row.patientName,row.doctorName);assert.notEqual(row.patientId,row.doctorId);
  await dispatchExpected("booking",row,["patient","clinicAdmin","doctor"]);
});
test("missing legacy labels and identity mismatches fail preparation without dispatch or rewriting published templates",async()=>{
  const before=(await rows("select id,data from settings where id like 'sms-template:%'")).map(r=>JSON.stringify(r));
  const row=await book("rec","missing");
  await h.pg.query(`update settings set data=jsonb_set(data,'{snapshot,patientName}','""') where id like 'sms-outbox:%' and data->>'appointmentId'=$1`,[row.id]);
  const n=captures.length;
  await h.dispatchSmsOutbox(sms);
  assert.equal(captures.length,n);
  const failed=await rows("select data from settings where id like 'sms-outbox:%' and data->>'appointmentId'=$1",[row.id]);
  assert.equal(failed.length,3);assert(failed.every(r=>r.data.state==="preparation_failed"&&r.data.preparationReason.includes("patient_name")));
  const mismatch=await book("rec","mismatch");
  await h.pg.query(`update settings set data=jsonb_set(data,'{snapshot,patientId}','"p3"') where id like 'sms-outbox:%' and data->>'appointmentId'=$1`,[mismatch.id]);
  await h.dispatchSmsOutbox(sms);assert.equal(captures.length,n);
  const after=(await rows("select id,data from settings where id like 'sms-template:%'")).map(r=>JSON.stringify(r));
  assert.deepEqual(after,before);
});

test("composite details use the same snapshot labels while recipient, optional contacts and scoped public link remain current",async()=>{
  const content={enabled:true,subject:"Fixture snapshot",body:"{{recipient_name}} | {{patient_name}} | {{doctor_name}} | {{clinic_name}} | {{appointment_details}} | {{booking_link}} | {{clinic_contact}}",
    prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:"FICTIONAL_COMPOSITE"};
  await h.pg.query("insert into settings(id,data) values('sms-template:c1:booking:clinicAdmin',$1)",[{revision:1,published:content}]);
  const row=await book("rec","composite");
  await h.pg.exec(`update users set full_name='Current Owner' where id='adm';
    update users set full_name='Changed doctor again' where id='docu';
    update patients set data=data||'{"fullName":"Changed patient again"}'::jsonb where id='composite';
    update clinics set data=data||'{"name":"Changed clinic again","email":"","phone":""}'::jsonb where id='c1';`);
  const before=captures.length;
  await h.dispatchSmsOutbox(sms);
  const sent=captures.slice(before);
  assert.equal(sent.length,3);
  const owner=sent.find(m=>m.to==="+919876543211").message;
  assert(owner.startsWith(`Current Owner | ${row.patientName} | ${row.doctorName} | ${row.clinicName} | `));
  assert(owner.includes(`${row.clinicName} · ${row.branchName}`));
  assert(owner.includes(`Doctor: ${row.doctorName}`));
  assert(owner.includes("https://booking.example.invalid/lakeview"));
  assert(!owner.includes("/foreign")&&!owner.includes("Changed doctor again")&&!owner.includes("Changed clinic again")&&!owner.includes("Changed patient again"));
  assert(owner.endsWith(" | "),"optional clinic contact may be empty");
});
