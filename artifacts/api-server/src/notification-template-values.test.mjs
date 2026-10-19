// Isolated PostgreSQL and fake transports; no live settings or recipients.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const bundle = resolve(import.meta.dirname, `.notification-values-${process.pid}.mjs`);
Object.assign(process.env, {
  NODE_ENV:"test", INTEGRATIONS_ENCRYPTION_KEY:"ef".repeat(32),
  CLINICFLOW_PUBLIC_ORIGIN:"https://booking.example.invalid",
  NOTIFICATION_SMS_PROVIDER:"keepInTouch", NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
  NOTIFICATION_SMS_KEY:"fictional-body-key", NOTIFICATION_SMS_BEARER_TOKEN:"fictional-bearer",
  NOTIFICATION_SMS_CLIENT_ID:"fictional-client", NOTIFICATION_SMS_SENDER_ID:"DIGIQ",
  NOTIFICATION_SMS_ENABLED:"true",
  SMTP_HOST:"smtp.example.invalid", SMTP_PORT:"587", SMTP_USER:"fixture",
  SMTP_PASSWORD:"fixture", SMTP_FROM:"sender@example.invalid", NOTIFICATION_EMAIL_ENABLED:"true",
});
let h, api;
const sa={id:"sa",role:"superAdmin"};
before(async()=>{
  h=await createQueueHarness({empty:true});
  await h.control.query(queueFixtureSql);
  globalThis.notificationValuesDb=h.db;
  await build({stdin:{contents:`
    export * from "./lib/notification-template-values";
    export * from "./lib/notification-template-store";
    export * from "./lib/notification-templates";
    export * from "./lib/notification-outbox";
    export * from "./lib/notification-sms-outbox";
    export * from "./lib/appointment-confirmation";
    export * from "./lib/notification-controls";
    export * from "./lib/notification-history";`,
    resolveDir:import.meta.dirname,loader:"ts"},outfile:bundle,bundle:true,platform:"node",format:"esm",packages:"external",
    plugins:[{name:"isolated",setup(b){
      b.onResolve({filter:/^@workspace\/db$/},()=>({path:"db",namespace:"fixture"}));
      b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:`export * from "${resolve(import.meta.dirname,"../../../lib/db/src/schema/core.ts")}";export const db=globalThis.notificationValuesDb;`,loader:"ts",resolveDir:import.meta.dirname}));
    }}]});
  api=await import(bundle);
  await h.control.query(`insert into users(id,role,email,full_name,mobile) values
    ('ca','clinicAdmin','owner@example.invalid','Owner Person','+919876543210'),
    ('du','doctor','doctor@example.invalid','Doctor Person','+919876543211'),
    ('ru','receptionist','reception@example.invalid','Reception Person','+919876543212'),
    ('pu','patient','patient@example.invalid','Patient Person','+919876543213');
    insert into clinics(id,admin_id,data) values('c','ca','{"name":"Fictional Clinic","slug":"fictional-clinic","dateFormat":"DD/MM/YYYY","timeFormat":"24h","policies":{"notificationsEnabled":true}}');
    insert into branches(id,clinic_id,data) values('b','c','{"name":"Fictional Location"}');
    insert into doctors(id,user_id,owner_admin_id,data) values('d','du','ca','{"fullName":"Doctor Person"}');
    insert into assignments(id,user_id,clinic_id,branch_id) values('r','ru','c','b'),('d','du','c','b');
    insert into patients(id,user_id,clinic_id,branch_id,mobile,data) values('p','pu','c','b','+919876543213','{"fullName":"Patient Person","email":"patient@example.invalid"}');`);
});
after(async()=>{if(h)await h.close();await rm(bundle,{force:true});delete globalThis.notificationValuesDb;});

test("clinic date formats, midnight/noon, 24-hour clocks and invalid fields are handled without timezone conversion",()=>{
  const row={date:"2030-01-15",startTime:"00:05",endTime:"12:00"};
  for(const [dateFormat,date] of [["DD MMM YYYY","15 Jan 2030"],["DD/MM/YYYY","15/01/2030"],["MM/DD/YYYY","01/15/2030"],["YYYY-MM-DD","2030-01-15"]]){
    assert.deepEqual(api.formatTemplateSession(row,{dateFormat}),{date,start:"12:05 AM",end:"12:00 PM"});
  }
  assert.deepEqual(api.formatTemplateSession(row,{timeFormat:"24h"}),{date:"15 Jan 2030",start:"00:05",end:"12:00"});
  for(const date of ["2030-99-99","2030-02-30",null]){
    assert.deepEqual(api.formatTemplateSession({date,startTime:"25:00"},{}),{date:"",start:"",end:""});
  }
});
test("separate current/previous values retain prefixed and numeric tokens and no OTP or arbitrary username is allowed",()=>{
  const row={date:"2030-01-15",startTime:"09:00",endTime:"12:00",token:"Q-007",tokenNumber:7};
  const previous={date:"2030-01-14",startTime:"14:00",endTime:"17:00",medicalNotes:"never retain"};
  assert.deepEqual(api.previousSessionSnapshot(previous),{date:"2030-01-14",startTime:"14:00",endTime:"17:00"});
  const values=api.visitTemplateValues(row,{},"Owner Person",previous);
  assert.equal(values.recipient_name,"Owner Person");
  assert.equal(values.appointment_date,"15 Jan 2030");
  assert.equal(values.previous_date,"14 Jan 2030");
  assert.equal(values.previous_session_start,"2:00 PM");
  assert.equal(values.session_start,"9:00 AM");
  assert.equal(values.queue_token,"Q-007");assert.equal(values.token_number,"7");
  assert.deepEqual(api.missingVisitVariables(["{{previous_date}} {{queue_token}}"],api.visitTemplateValues(row,{},"Patient")),["previous_date"]);
  const content={...api.defaultTemplate("rescheduled"),enabled:true,prefix:"",footer:"",logoUrl:"",dltTemplateId:"DLT",senderId:"",dltEntityId:"",
    body:api.visitVariables.map(v=>`{{${v}}}`).join(" ")};
  assert(api.smsTemplateContent.safeParse(content).success);
  for(const name of ["username","password"])assert(!api.smsTemplateContent.safeParse({...content,body:`{{${name}}}`}).success);
  assert.equal(api.validEventContent("rescheduled",{...content,body:"{{otp}}"}),false);
});

const body="Hello {{recipient_name}}; patient {{patient_name}}; {{clinic_name}}; Dr {{doctor_name}}; {{appointment_date}} {{session_start}}-{{session_end}}; old {{previous_date}} {{previous_session_start}}-{{previous_session_end}}; token {{queue_token}} ({{token_number}})";
test("SMS save errors use the SMS schema instead of misleading email-only key errors",()=>{
  const content={...api.defaultTemplate("booking"),enabled:false,prefix:"",footer:"",logoUrl:"",
    senderId:"",dltEntityId:"",dltTemplateId:"1700000000000000000",
    body:"Dear {{patient_name}}, Dr {{doctor_name}}, {{appointment_date}}, token {{token_number}}, {{session_start}}."};
  const input={channel:"sms",event:"booking",revision:0,mode:"publish",content};
  assert(api.templateSave.safeParse(input).success);
  const invalid=api.templateSave.safeParse({...input,content:{...content,body:"Hi {{appointment_time}}"}});
  assert(!invalid.success);
  assert.deepEqual(invalid.error.issues.map(i=>({path:i.path,message:i.message})),[
    {path:["content","body"],message:"Unsupported variable: appointment_time"},
  ]);
  assert(!api.templateSave.safeParse({...input,channel:"email"}).success);
  assert.equal(api.templateSave.parse({event:"booking",revision:0,mode:"draft",content:api.defaultTemplate("booking")}).channel,"email");
});
test("SMS draft, publish and activation work with only the event DLT ID and configured Sender ID",async()=>{
  const content={...api.defaultTemplate("cancelled"),enabled:false,prefix:"",footer:"",logoUrl:"",
    dltTemplateId:"1700000000000000000",body:"Dear {{patient_name}}, your visit on {{appointment_date}} is cancelled."};
  const input={channel:"sms",clinicId:"c",event:"cancelled",recipient:"patient"};
  const draft=await api.saveTemplate(sa,{...input,revision:0,mode:"draft",content});
  assert.equal(draft.items.find(i=>i.event==="cancelled").draft.dltTemplateId,content.dltTemplateId);
  assert(!(await api.resolvedTemplate("cancelled","c",h.db,"patient","sms")).content.enabled);
  await assert.rejects(api.saveTemplate(sa,{...input,revision:1,mode:"publish",content:{...content,body:"Hi {{appointment_time}}"}}),error=>{
    assert.equal(error.status,400);
    assert.match(error.message,/content\.body: Unsupported variable: appointment_time/);
    assert.doesNotMatch(error.message,/Unrecognized key/);
    return true;
  });
  const saved=await api.saveTemplate(sa,{...input,revision:1,mode:"publish",content});
  const row=saved.items.find(i=>i.event==="cancelled");
  assert.equal(row.content.senderId,"");
  assert.equal(row.content.dltEntityId,"");
  assert.equal(row.content.dltTemplateId,content.dltTemplateId);
  await api.changeActivation(sa,{...input,revision:row.revision,enabled:true});
  const active=await api.resolvedTemplate("cancelled","c",h.db,"patient","sms");
  assert(active.content.enabled);
  assert.equal(active.content.dltTemplateId,content.dltTemplateId);
});
test("published placeholders reach all four eligible SMS/email recipient groups with separate old/new times",async()=>{
  for(const recipient of api.templateRecipients.filter(r=>r!=="superAdmin"))for(const channel of ["sms","email"]){
    const content={...api.defaultTemplate("rescheduled"),enabled:true,body,
      ...(channel==="sms"?{prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:"REGISTERED_RESCHEDULED"}:{subject:"Hello {{recipient_name}}",prefix:"",footer:""})};
    await api.saveTemplate(sa,{channel,event:"rescheduled",clinicId:"c",recipient,revision:0,mode:"publish",content});
  }
  const catalog=await api.templateCatalog(sa,"c","patient","sms");
  for(const variable of api.visitVariables)assert(catalog.variables.includes(variable));
  const preview=catalog.items.find(i=>i.event==="rescheduled").previewBody;
  assert(!preview.includes("{{"));assert(preview.includes("15/01/2030"));
  const row={id:"visit",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-15",startTime:"09:00",endTime:"12:00",
    timezone:"Asia/Kolkata",reference:"FICTIONAL",status:"waiting",revision:1,token:"Q-007",tokenNumber:7,doctorName:"Doctor Person",clinicName:"Fictional Clinic",branchName:"Fictional Location"};
  await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,token_number,status,data) values('visit','c','b','d','p',$1,7,'waiting',$2)",[row.date,JSON.stringify(row)]);
  await api.enqueueEvent(h.db,"rescheduled",row,{...row,date:"2030-01-14",startTime:"14:00",endTime:"17:00",token:"OLD-001",revision:0});
  const smsCalls=[], emailCalls=[];
  await api.processSmsNotifications(h.db,async(env,to,message,meta)=>{
    smsCalls.push({to,message,meta});return "provider_accepted";
  });
  await api.processNotifications(h.db,async(to,subject,text)=>{emailCalls.push({to,subject,text});});
  assert.equal(smsCalls.length,4);assert.equal(emailCalls.length,4);
  for(const name of ["Patient Person","Owner Person","Doctor Person","Reception Person"]){
    for(const calls of [smsCalls,emailCalls]){
      const message=calls.map(c=>c.message||c.text).find(m=>m.startsWith(`Hello ${name};`));
      assert(message,`recipient name ${name}`);
      assert(message.includes("patient Patient Person; Fictional Clinic; Dr Doctor Person"));
      assert(message.includes("15/01/2030 09:00-12:00; old 14/01/2030 14:00-17:00; token Q-007 (7)"));
      assert(!message.includes("{{"));assert(!message.includes("OLD-001"));
    }
  }
  for(const call of smsCalls)assert.equal(call.meta.dltTemplateId,"REGISTERED_RESCHEDULED");
  const captured=(await h.control.query("select id,data from settings where id like '%outbox:rescheduled:visit:%'")).rows;
  assert.equal(captured.length,8);
  for(const {data} of captured)assert.deepEqual(data.previousSession,{date:"2030-01-14",startTime:"14:00",endTime:"17:00",
    doctorId:"d",doctorName:"Doctor Person"});
  // A historical job without structured prior values must not send blank old dates.
  const old=captured.find(row=>row.id.startsWith("sms-outbox:")).data;
  const historical={...old,previousSession:undefined,state:"pending",createdAt:Date.now(),dueAt:0,historyKey:"historical-no-previous"};
  await h.control.query("insert into settings(id,data) values('sms-outbox:historical-values',$1)",[JSON.stringify(historical)]);
  let calls=0;
  await api.processSmsNotifications(h.db,async()=>{calls++;return "provider_accepted";});
  assert.equal(calls,0);
  assert.equal((await h.control.query("select data->>'state' as state from settings where id='sms-outbox:historical-values'")).rows[0].state,"preparation_failed");
});
test("cancellation reason uses only the latest cancellation, with safe substitution and missing-reason text",()=>{
  const history=[{action:"cancel",status:"cancelled",reason:"Old reason"},{action:"requeue",status:"waiting",reason:"Unrelated reason"},
    {action:"cancel",status:"cancelled",reason:"  Patient unavailable <script> {{clinic_name}}  "}];
  const values=api.visitTemplateValues({status:"cancelled",history},{},"Patient");
  assert.equal(values.cancel_reason,"Patient unavailable <script> {{clinic_name}}");
  assert.equal(api.visitTemplateValues({status:"waiting",history},{},"Patient").cancel_reason,"");
  assert.equal(api.visitTemplateValues({status:"cancelled",history:[...history,{action:"cancel",status:"cancelled"}]},{},"Patient").cancel_reason,"Not specified");
  assert.equal(api.visitTemplateValues({status:"cancelled"},{},"Patient").cancel_reason,"Not specified");
  const email={...api.defaultTemplate("cancelled"),body:"Reason: {{cancel_reason}}"};
  assert.equal(api.templateContent.safeParse(email).success,true);
  assert.equal(api.smsTemplateContent.safeParse({...email,prefix:"",footer:"",logoUrl:""}).success,true);
  const rendered=api.renderNotification(email,values);
  assert.match(rendered.html,/&lt;script&gt;/);
  assert.match(rendered.text,/\{\{clinic_name\}\}/);
  assert.deepEqual(api.missingVisitVariables([email.body],values),[]);
  assert.deepEqual(api.missingVisitVariables([email.body],api.visitTemplateValues(null,{},"Patient")),["cancel_reason"]);
});

test("cancellation reason reaches every SMS and email recipient through queued snapshots",async()=>{
  for(const recipient of api.templateRecipients.filter(r=>r!=="superAdmin"))for(const channel of ["sms","email"]){
    const content={...api.defaultTemplate("cancelled"),enabled:true,body:"Reason: {{cancel_reason}}",
      prefix:"",footer:"",logoUrl:"",...(channel==="sms"?{senderId:"",dltEntityId:"",dltTemplateId:"REGISTERED_CANCELLED"}:{})};
    const current=await api.resolvedTemplate("cancelled","c",h.db,recipient,channel);
    await api.saveTemplate(sa,{channel,event:"cancelled",clinicId:"c",recipient,revision:current.local.revision,mode:"publish",content});
    const catalog=await api.templateCatalog(sa,"c",recipient,channel);
    assert(catalog.variables.includes("cancel_reason"));
    assert.match(catalog.items.find(item=>item.event==="cancelled").previewBody,/\[Cancellation reason\]/);
  }
  const row={id:"cancel-visit",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-15",
    startTime:"09:00",endTime:"12:00",timezone:"Asia/Kolkata",reference:"CANCEL-FIXTURE",status:"cancelled",
    revision:1,token:"Q-008",tokenNumber:8,doctorName:"Doctor Person",clinicName:"Fictional Clinic",branchName:"Fictional Location",
    history:[{action:"cancel",status:"cancelled",reason:"Patient requested cancellation"}]};
  await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,token_number,status,data) values('cancel-visit','c','b','d','p',$1,8,'cancelled',$2)",[row.date,JSON.stringify(row)]);
  await api.enqueueEvent(h.db,"cancelled",row);
  const smsCalls=[],emailCalls=[];
  await api.processSmsNotifications(h.db,async(_env,_to,message)=>{smsCalls.push(message);return "provider_accepted";});
  await api.processNotifications(h.db,async(_to,_subject,text)=>{emailCalls.push(text);});
  assert.equal(smsCalls.length,4);assert.equal(emailCalls.length,4);
  for(const text of [...smsCalls,...emailCalls])assert.equal(text,"Reason: Patient requested cancellation");
});

test("booking links use the canonical public clinic route and fail closed when unavailable",()=>{
  assert.equal(api.clinicBookingLink({slug:"fictional-clinic"}),"https://booking.example.invalid/fictional-clinic");
  assert.equal(api.clinicBookingLink({data:{slug:"second-clinic"}},"https://other.example.invalid/"),"https://other.example.invalid/second-clinic");
  for(const origin of ["","http://example.invalid","https://user:password@example.invalid","https://example.invalid/path","https://example.invalid/?redirect=other","not a URL"])
    assert.equal(api.clinicBookingLink({slug:"fictional-clinic"},origin),"");
  assert.equal(api.clinicBookingLink({}),"");
  assert.equal(api.clinicBookingLink({slug:"../private-ticket"}),"");
  assert.equal(api.visitTemplateValues(null,{slug:"fictional-clinic"},"Owner").booking_link,"https://booking.example.invalid/fictional-clinic");
  assert.deepEqual(api.missingVisitVariables(["Your booking link: {{booking_link}}."],{booking_link:""}),["booking_link"]);
  assert(api.smsTemplateContent.safeParse({...api.defaultTemplate("onboarding"),prefix:"",footer:"",logoUrl:"",
    body:"Welcome to Digi-Q, {{clinic_name}}! Complete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link. Your booking link: {{booking_link}}."}).success);
  assert.equal(api.validEventContent("patient_login_otp",{...api.defaultTemplate("patient_login_otp"),body:"{{otp}} {{booking_link}}"}),false);
});

test("onboarding fills the owner's recipient name and booking link in SMS and email",async()=>{
  await api.saveTemplate(sa,{channel:"sms",event:"onboarding",clinicId:"c",recipient:"clinicAdmin",revision:0,mode:"publish",
    content:{...api.defaultTemplate("onboarding"),enabled:true,body:"Welcome {{recipient_name}} to {{clinic_name}}. Your booking link: {{booking_link}}.",prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:"REGISTERED_ONBOARDING"}});
  await api.saveTemplate(sa,{channel:"email",event:"onboarding",clinicId:"c",recipient:"clinicAdmin",revision:0,mode:"publish",
    content:{...api.defaultTemplate("onboarding"),body:"Your booking link: {{booking_link}}."}});
  const catalog=await api.templateCatalog(sa,"c","clinicAdmin","sms");
  assert(catalog.variables.includes("booking_link"));
  assert(catalog.items.find(item=>item.event==="onboarding")?.previewBody.includes("https://booking.example.invalid/fictional-clinic"));
  await api.enqueueEvent(h.db,"onboarding",{id:"c",clinicId:"c"});
  const calls=[],emails=[];
  await api.processSmsNotifications(h.db,async(env,to,message)=>{calls.push(message);return "provider_accepted";});
  await api.processNotifications(h.db,async(_to,_subject,text)=>{emails.push(text);});
  assert.deepEqual(calls,["Welcome Owner Person to Fictional Clinic. Your booking link: https://booking.example.invalid/fictional-clinic."]);
  assert(emails.some(text=>text.includes("Your booking link: https://booking.example.invalid/fictional-clinic.")));
});
test("System Admin onboarding targets active platform admins and rechecks their status before dispatch",async()=>{
  await h.control.query(`insert into users(id,role,email,full_name,mobile) values
    ('system-onboarding','superAdmin','system@example.invalid','System Admin','+919876543214'),
    ('inactive-system','superAdmin','inactive-system@example.invalid','Inactive Admin','+919876543215');
    update users set status='inactive' where id='inactive-system';
    insert into clinics(id,admin_id,data) values('system-clinic','ca','{"name":"New Fictional Clinic","policies":{"notificationsEnabled":true}}');`);
  await api.saveTemplate(sa,{channel:"sms",event:"onboarding",recipient:"superAdmin",revision:0,mode:"publish",
    content:{...api.defaultTemplate("onboarding","superAdmin"),enabled:true,dltTemplateId:"FIXTURE_SYSTEM_ONBOARDING",senderId:"",dltEntityId:""}});
  const controls=await api.eventControls(sa);
  const activated=controls.items.find(row=>row.event==="onboarding"&&row.recipient==="superAdmin"&&row.channel==="sms");
  await api.changeActivation(sa,{channel:"sms",event:"onboarding",recipient:"superAdmin",revision:activated.revision,enabled:false});
  await api.changeActivation(sa,{channel:"sms",event:"onboarding",recipient:"superAdmin",revision:activated.revision+1,enabled:true});
  assert(controls.items.some(row=>row.event==="onboarding"&&row.recipient==="superAdmin"&&row.channel==="email"));
  assert(controls.items.some(row=>row.event==="patient_login_otp"&&row.recipient==="patient"&&row.channel==="sms"));
  assert(!controls.items.some(row=>row.event==="patient_login_otp"&&row.channel==="email"));
  await api.enqueueEvent(h.db,"onboarding",{id:"system-clinic",clinicId:"system-clinic"});
  const sms=[],email=[];
  await api.processSmsNotifications(h.db,async(_env,to,message)=>{sms.push({to,message});return "provider_accepted";});
  await api.processNotifications(h.db,async(to,_subject,text)=>{email.push({to,text});});
  assert(sms.some(row=>row.to==="+919876543214"&&row.message.includes("New Fictional Clinic")));
  assert(email.some(row=>row.to==="system@example.invalid"&&row.text.includes("System Admin")));
  assert(!email.some(row=>row.to==="inactive-system@example.invalid"));
  await h.control.query(`insert into clinics(id,admin_id,data) values('system-clinic-second','ca','{"name":"Second Fictional Clinic","policies":{"notificationsEnabled":true}}');`);
  await api.enqueueEvent(h.db,"onboarding",{id:"system-clinic-second",clinicId:"system-clinic-second"});
  await h.control.query("update users set status='inactive' where id='system-onboarding'");
  const second=[];
  await api.processSmsNotifications(h.db,async(_env,to)=>{second.push(to);return "provider_accepted";});
  await api.processNotifications(h.db,async(to)=>{second.push(to);});
  assert(!second.includes("system@example.invalid")&&!second.includes("+919876543214"));
});

test("the separate patient booking email path substitutes the same fields and does not send missing tokens",async()=>{
  await api.saveTemplate(sa,{channel:"email",event:"booking",clinicId:"c",recipient:"patient",revision:0,mode:"publish",
    content:{...api.defaultTemplate("booking"),enabled:true,subject:"Hi {{recipient_name}}",prefix:"",footer:"",
      body:"{{patient_name}} {{appointment_date}} {{session_start}}-{{session_end}} {{queue_token}} {{token_number}}"}});
  for(const [id,token,expected] of [["booking-values","Q-007","provider_accepted"],["booking-missing",null,"unavailable"]]){
    const row={id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-15",startTime:token?"10:00":"11:00",endTime:"12:00",
      timezone:"Asia/Kolkata",reference:id,status:"waiting",revision:0,token,tokenNumber:7,doctorName:"Doctor Person",clinicName:"Fictional Clinic",branchName:"Fictional Location"};
    await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,token_number,status,data) values($1,'c','b','d','p',$2,7,'waiting',$3)",[id,row.date,JSON.stringify(row)]);
    await api.capturePatientConfirmation(h.db,row);
    const calls=[];
    const outcome=await api.confirmAppointmentEmail(id,h.db,async(to,subject,text)=>{calls.push({to,subject,text});});
    assert.equal(outcome,expected);
    assert.equal(calls.length,token?1:0);
    if(token) {
      assert.equal(calls[0].to,"patient@example.invalid");
      assert.equal(calls[0].subject,"Hi Patient Person");
      assert(calls[0].text.startsWith("Patient Person 15/01/2030 10:00-12:00 Q-007 7"));
      for(const value of ["Reference: booking-values","Token: Q-007","Fictional Clinic","Fictional Location","Doctor Person","Asia/Kolkata","Clinic contact:"])assert(calls[0].text.includes(value));
    }
  }
});
