// Disposable PostgreSQL, synthetic credentials and fake transports only. No live sends.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";
import { keepInTouchNetworkPlugin } from "./test-support/keep-in-touch-network.mjs";
const bundle=resolve(import.meta.dirname,`.notification-settings-${process.pid}.mjs`);
const mapping={encoding:"json",authMode:"header",authField:"X-API-Key",fields:{recipient:"to",message:"message",senderId:"sender",dltEntityId:"entity",dltTemplateId:"template"},staticFields:{route:"transactional"},acceptedStatuses:[200,202],responseField:"result.status",responseValue:"accepted",dltRequired:true};
const env={NOTIFICATION_SMS_URL:"https://sms.example.invalid/send",NOTIFICATION_SMS_KEY:"synthetic-notification-key",NOTIFICATION_SMS_BEARER_TOKEN:"fictional-settings-bearer",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_MAPPING:JSON.stringify(mapping)};
Object.assign(process.env,env,{NODE_ENV:"test",INTEGRATIONS_ENCRYPTION_KEY:"cd".repeat(32),DIGI_SMTP_HOST:"smtp.example.invalid",DIGI_SMTP_PORT:"587",DIGI_SMTP_USER:"fixture-user",DIGI_SMTP_PASSWORD:"fixture-pass",DIGI_SMTP_FROM:"sender@example.invalid"});
let h,api;
const context=new AsyncLocalStorage();
const sa={id:"sa",role:"superAdmin"};
before(async()=>{
  h=await createQueueHarness({empty:true});
  await h.control.query(queueFixtureSql);
  await h.control.query(`insert into users(id,role,email,full_name,mobile) values
    ('sa','superAdmin','sa@example.invalid','Super Admin',null),
    ('ca','clinicAdmin','owner@example.invalid','Owner','+919876543210'),
    ('du','doctor','doctor@example.invalid','Doctor','+919876543211'),
    ('ru','receptionist','reception@example.invalid','Reception','+919876543212'),
    ('pu','patient','patient@example.invalid','Patient','+919876543213');
    insert into clinics(id,admin_id,data) values('c','ca','{"name":"Synthetic clinic","policies":{"notificationsEnabled":true}}');
    insert into branches(id,clinic_id,data) values('b','c','{"name":"Synthetic location"}');
    insert into doctors(id,user_id,owner_admin_id,data) values('d','du','ca','{"fullName":"Doctor"}');
    insert into assignments(id,user_id,clinic_id,branch_id) values('r','ru','c','b'),('d','du','c','b');
    insert into patients(id,user_id,clinic_id,branch_id,mobile,data) values('p','pu','c','b','+919876543213','{"fullName":"Synthetic patient","email":"patient@example.invalid"}');`);
  globalThis.notificationSettingsDb=new Proxy({}, {get:(_,key)=>{
    const conn=context.getStore()||h.db,value=conn[key];
    return typeof value==="function"?value.bind(conn):value;
  }});
  await build({stdin:{contents:`export * from "./lib/notification-sms-transport"; export * from "./lib/integration-vault"; export * from "./lib/integration-config";
    export * from "./lib/notification-templates"; export * from "./lib/notification-template-store";
    export * from "./lib/notification-controls"; export * from "./lib/notification-sms-outbox";
    export * from "./lib/notification-outbox"; export * from "./lib/store"; export * from "@workspace/db";
    export * from "./lib/notification-history"; export * from "./lib/notification-test-dispatch";
    export * from "./lib/appointment-confirmation";
    export * from "./lib/notification-preferences";
    export * from "./lib/personal-notification-settings";
    export * from "./lib/managed-notification-settings";
    export { requiredEvent } from "./lib/security-template-definitions";
    export * from "./lib/security-notifications";
    export * from "./lib/patient-login-sms";
    export { listNotificationsFor } from "./routes/workspace-features";
    import { notificationSettingsRouter } from "./routes/notification-settings";
    import {notificationHistoryRouter} from "./routes/notification-history";
    import {notificationTemplatesRouter} from "./routes/notification-templates";
    import {integrationsRouter} from "./routes/integrations";
    import express from "express";
    export const app=express();app.use(express.json());
    app.use((req,res,next)=>{req.authUserId=req.headers["x-user"];req.authSessionHash="fixture";next();});
    app.use(notificationTemplatesRouter);app.use(integrationsRouter);app.use(notificationHistoryRouter);app.use(notificationSettingsRouter);
    app.use((err,req,res,next)=>res.status(err.status||400).json({error:"Sanitized",code:err.code}));`,
    resolveDir:import.meta.dirname,loader:"ts"},outfile:bundle,bundle:true,platform:"node",format:"esm",packages:"external",
    plugins:[keepInTouchNetworkPlugin,{name:"isolated",setup(b){
      b.onResolve({filter:/^@workspace\/db$/},()=>({path:"db",namespace:"fixture"}));
      b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:`export * from "${resolve(import.meta.dirname,"../../../lib/db/src/schema/core.ts")}";export const db=globalThis.notificationSettingsDb;`,loader:"ts",resolveDir:import.meta.dirname}));
      b.onResolve({filter:/^@workspace\/api-zod$/},()=>({path:resolve(import.meta.dirname,"../../../lib/api-zod/src/index.ts")}));
      // Authentication is an injected fixture at the router boundary; the real guards still run.
      b.onResolve({filter:/\/auth$/},args=>args.importer.includes("/routes/")?{path:"auth",namespace:"fixture-auth"}:undefined);
      b.onLoad({filter:/.*/,namespace:"fixture-auth"},()=>({contents:`export async function requireUser(req){const id=req.headers["x-user"];return {id,role:id==="ca"?"clinicAdmin":id||"patient",clinicIds:["c"]};} export async function findUser(){return null;} export function roles(u,rs){if(!rs.includes(u.role))throw Object.assign(new Error("Forbidden"),{status:403});}`}));
    }}]});
  api=await import(bundle);
});
test("Keep in Touch encrypted save/reload preserves generic mapping, optional switches, blank secrets and redacts audit/readiness",async()=>{
 const original=await api.resolvedIntegration("notificationSms");
 const values={NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"fictional-kit-body-key",
  NOTIFICATION_SMS_BEARER_TOKEN:"fictional-kit-distinct-bearer",NOTIFICATION_SMS_CLIENT_ID:"fictional-kit-client",
  NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus"};
 const beforeJobs=(await h.control.query("select count(*)::int n from settings where id like 'sms-outbox:%'")).rows[0].n;
 await api.saveIntegration("notificationSms",values,original.revision,"database",sa.id);
 try {
  const saved=await api.resolvedIntegration("notificationSms");
  const cfg=api.notificationSmsConfig(saved.env);assert.equal(cfg.provider,"keepInTouch");
  assert.equal(saved.env.NOTIFICATION_SMS_MAPPING,original.env.NOTIFICATION_SMS_MAPPING);
  assert.equal(saved.env.NOTIFICATION_SMS_ENABLED,original.env.NOTIFICATION_SMS_ENABLED);
  const publicSettings=await api.integrationSettings();
  assert.equal(publicSettings.notificationSms.smsProvider,"keepInTouch");
  assert.equal(publicSettings.notificationSms.countryCodeFormat,"plus");
  assert.equal(publicSettings.notificationSms.ready,true);
  const ciphertext=(await h.control.query("select encrypted from integration_credentials where provider='notificationSms'")).rows[0].encrypted;
  const audit=await h.control.query("select summary from audit_logs");
  for(const value of [values.NOTIFICATION_SMS_KEY,values.NOTIFICATION_SMS_BEARER_TOKEN,values.NOTIFICATION_SMS_CLIENT_ID]){
   for(const text of [JSON.stringify(publicSettings),ciphertext,JSON.stringify(audit.rows)])assert(!text.includes(value));
  }
  await api.saveIntegration("notificationSms",{NOTIFICATION_SMS_KEY:"",NOTIFICATION_SMS_BEARER_TOKEN:""},saved.revision,"database",sa.id);
  const preserved=await api.resolvedIntegration("notificationSms");
  assert.equal(preserved.env.NOTIFICATION_SMS_KEY,values.NOTIFICATION_SMS_KEY);
  assert.equal(preserved.env.NOTIFICATION_SMS_BEARER_TOKEN,values.NOTIFICATION_SMS_BEARER_TOKEN);
  await assert.rejects(api.saveIntegration("notificationSms",{},saved.revision,"database",sa.id),{status:409});
  assert.equal((await h.control.query("select count(*)::int n from settings where id like 'sms-outbox:%'")).rows[0].n,beforeJobs);
  // Return to Custom API deliberately: its stored mapping is still the original.
  await api.saveIntegration("notificationSms",{NOTIFICATION_SMS_PROVIDER:"generic"},preserved.revision,"database",sa.id);
  assert.deepEqual(api.notificationSmsConfig((await api.resolvedIntegration("notificationSms")).env).mapping,JSON.parse(original.env.NOTIFICATION_SMS_MAPPING));
 }finally{
  const latest=await api.resolvedIntegration("notificationSms");
  await api.saveIntegration("notificationSms",{},latest.revision,"environment",sa.id);
 }
});
test("Keep in Touch explicit tests and eligible automatic notifications use the same exact contract, without Entity ID or unknown retries",async()=>{
 const original=await api.resolvedIntegration("notificationSms");
 const values={NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"fictional-kit-body-key",
  NOTIFICATION_SMS_BEARER_TOKEN:"fictional-kit-distinct-bearer",NOTIFICATION_SMS_CLIENT_ID:"fictional-kit-client",
  NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits"};
 await api.saveIntegration("notificationSms",values,original.revision,"database",sa.id);
 globalThis.kitNetwork=[];
 const id="kit-visit";
 const eventKeys=["sms-template:c:completed","sms-template:c:cancelled"];
 const existing=await h.control.query("select id,data from settings where id=any($1::text[])",[eventKeys]);
 try {
   const content={...smsContent("completed"),dltEntityId:"",senderId:"",dltTemplateId:"KIT_COMPLETED",
    body:"Dear {{patient_name}},\nyour visit at {{clinic_name}} has been completed. Thank you for choosing our clinic. Contact reception if you need any further help."};
  await h.control.query("delete from settings where id=any($1::text[])",[eventKeys]);
  await assert.rejects(api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"completed",revision:0,mode:"publish",content:{...content,enabled:true,dltTemplateId:""}}),{status:400});
  await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"completed",revision:0,mode:"publish",content:{...content,enabled:true}});
  await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"cancelled",revision:0,mode:"publish",content:{...content,enabled:false,dltTemplateId:""}});
   await assert.rejects(api.changeActivation(sa,{channel:"sms",clinicId:"c",event:"cancelled",recipient:"patient",revision:1,enabled:true}),error=>{
    assert.equal(error.status,400);
    assert.match(error.message,/DLT Template ID/);
    assert.match(error.message,/saved drafts do not count/);
    assert.match(error.message,/does not require an Entity ID/);
    return true;
   });
  const reasons=(await api.eventControls(sa,"c")).items.find(i=>i.channel==="sms"&&i.event==="cancelled"&&i.recipient==="patient").blockedReasons.join(" ");
  assert(reasons.includes("Template ID"));assert(!reasons.includes("Entity IDs"));
  const prepared=await api.prepareTemplateTest(sa,{channel:"sms",event:"completed",clinicId:"c",recipientGroup:"patient",revision:1,content,values:{patient_name:"Fictional",clinic_name:"Test"},
   recipient:"+919876543213",confirmed:true,requestId:randomUUID()});
  assert.equal((await api.testTemplate(sa,prepared)).status,"provider_accepted");
  const explicit=globalThis.kitNetwork[0];
  assert.equal(explicit.body.templateId,"KIT_COMPLETED");assert.equal(explicit.body.mobile,"9876543213");
  assert.equal(explicit.body.message,prepared.rendered.text);
  assert(explicit.body.message.length>50);assert(explicit.body.message.includes("\n"));
  const row={id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-01",startTime:"10:00",endTime:"11:00",timezone:"Asia/Kolkata",reference:"KIT",status:"completed",revision:1};
  await h.db.insert(api.appointments).values({id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:row.date,status:row.status,data:row});
  await api.enqueueSmsEvent(h.db,"completed",row);
   globalThis.kitResponse={Success:true,Message:"SMS sent successfully"};
  // Other historical pending jobs must not enter this assertion.
  await h.control.query("update settings set data=jsonb_set(data,'{state}','\"disabled\"') where id like 'sms-outbox:%' and id not like 'sms-outbox:completed:kit-visit:%' and data->>'state'='pending'");
  await api.processSmsNotifications(h.db);
  const automatic=globalThis.kitNetwork[1];assert(automatic);
  for(const wire of [explicit,automatic]){
   assert.equal(wire.url,api.KEEP_IN_TOUCH_URL);assert.equal(wire.options.method,"POST");
   assert.equal(wire.options.headers.Authorization,"Bearer fictional-kit-distinct-bearer");
   assert.equal(wire.options.headers["Content-Type"],"application/json");
   assert.deepEqual(Object.keys(wire.body).sort(),["countryCode","mobile","senderId","message","apiKey","clientId","templateId"].sort());
   assert.equal(wire.body.countryCode,"91");assert.equal(wire.body.apiKey,values.NOTIFICATION_SMS_KEY);
   assert.equal(wire.body.templateId,"KIT_COMPLETED");
   assert(wire.body.message.length>50);assert(wire.body.message.includes("\n"));
  }
   assert.equal((await h.control.query("select data->>'state' state from settings where id like 'sms-outbox:completed:kit-visit:%'")).rows[0].state,"provider_accepted");
  const count=globalThis.kitNetwork.length;
  await api.processSmsNotifications(h.db);assert.equal(globalThis.kitNetwork.length,count);
   globalThis.kitResponse={Success:false,Message:"Invalid DLT template. fictional-kit-body-key +919876543213"};
   const rejectedPrepared=await api.prepareTemplateTest(sa,{...prepared.body,confirmed:true,requestId:randomUUID()});
   const rejected=await api.testTemplate(sa,rejectedPrepared);
   assert.equal(rejected.status,"provider_rejected");assert.match(rejected.message,/HTTP 200/);
   assert.match(rejected.message,/DLT\/template problem/);
   assert(!rejected.message.includes("fictional-kit-body-key"));assert(!rejected.message.includes("+919876543213"));
   const rejectedCount=globalThis.kitNetwork.length;
   assert.deepEqual(await api.testTemplate(sa,rejectedPrepared),rejected,"a replay retains the safe diagnosis");
   assert.equal(globalThis.kitNetwork.length,rejectedCount,"rejection replay never sends again");
   const unknownId="kit-visit-unknown";
   const unknownRow={...row,id:unknownId};
   await h.db.insert(api.appointments).values({id:unknownId,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:row.date,status:row.status,data:unknownRow});
   await api.enqueueSmsEvent(h.db,"completed",unknownRow);
   globalThis.kitResponse={Success:"true",Message:"SMS sent successfully"};
   await api.processSmsNotifications(h.db);
   assert.equal((await h.control.query("select data->>'state' state from settings where id like 'sms-outbox:completed:kit-visit-unknown:%'")).rows[0].state,"delivery_unknown");
   const unknownCount=globalThis.kitNetwork.length;
   await api.processSmsNotifications(h.db);assert.equal(globalThis.kitNetwork.length,unknownCount);
 }finally{
  const latest=await api.resolvedIntegration("notificationSms");
  await api.saveIntegration("notificationSms",{},latest.revision,"environment",sa.id);
   await h.control.query("delete from settings where id=any($1::text[]) or id like 'sms-outbox:completed:kit-visit:%' or id like 'sms-outbox:completed:kit-visit-unknown:%'",[eventKeys]);
  for(const row of existing.rows)await h.control.query("insert into settings(id,data) values($1,$2)",[row.id,row.data]);
   await h.control.query("delete from appointments where id=any($1::text[])",[[id,"kit-visit-unknown"]]);
  delete globalThis.kitNetwork;delete globalThis.kitResponse;
 }
});
after(async()=>{await h?.close();await rm(bundle,{force:true});delete globalThis.notificationSettingsDb;});
test("email form saves its name and optional switch without changing security SMTP or replaying pending mail",async()=>{
  const original=await api.resolvedIntegration("smtp");
  await h.control.query("insert into settings(id,data) values('mail-outbox:channel-disable-fixture',$1)",[JSON.stringify({state:"pending",dueAt:0})]);
  await api.saveIntegration("smtp",{SMTP_NOTIFICATIONS_ENABLED:"false",SMTP_FROM_NAME:"DigiQ Clinic"},original.revision,"database",sa.id);
  try{
    const current=await api.resolvedIntegration("smtp");
    assert.equal(api.smtpConfig(current.env).from,'"DigiQ Clinic" <sender@example.invalid>');
    assert.equal(api.emailNotificationsEnabled(current.env),false);
    const readiness=(await api.integrationSettings()).smtp;
    assert.equal(readiness.notificationsEnabled,false);assert.equal(readiness.fromName,"DigiQ Clinic");assert.equal(readiness.ready,true);
    for(const secret of ["fixture-user","fixture-pass"])assert.equal(JSON.stringify(readiness).includes(secret),false);
    assert.equal((await h.control.query("select data from settings where id='mail-outbox:channel-disable-fixture'")).rows[0].data.state,"disabled");
    const before=(await h.control.query("select count(*)::int count from settings where id like 'mail-outbox:%'")).rows[0].count;
    // A ready, opted-in SMS channel must still capture the same new event
    // while optional email is off. No provider transport is invoked here.
    await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"booking",recipient:"patient",revision:0,mode:"publish",content:{...smsContent(),enabled:true}});
    await api.enqueueEvent(h.db,"booking",{id:"disabled-email-fixture",clinicId:"c",patientId:"p",branchId:"b",doctorId:"d"});
    assert.equal((await h.control.query("select count(*)::int count from settings where id like 'mail-outbox:%'")).rows[0].count,before);
    const smsJobs=await h.control.query("select data from settings where id like 'sms-outbox:booking:disabled-email-fixture:%'");
    assert.equal(smsJobs.rows.length,1,"email opt-out must not suppress SMS capture");
    assert.equal(smsJobs.rows[0].data.state,"pending");
    assert.equal(smsJobs.rows[0].data.recipientGroup,"patient");
    await api.saveIntegration("smtp",{SMTP_NOTIFICATIONS_ENABLED:"true",SMTP_FROM_NAME:""},current.revision,"database",sa.id);
    assert.equal(api.smtpConfig((await api.resolvedIntegration("smtp")).env).from,"sender@example.invalid");
    let sent=0;await api.processNotifications(h.db,async()=>{sent++;});
    assert.equal(sent,0);
  }finally{
    const latest=await api.resolvedIntegration("smtp");
    await api.saveIntegration("smtp",{},latest.revision,"environment",sa.id);
    await h.control.query("delete from settings where id='mail-outbox:channel-disable-fixture'");
    await h.control.query("delete from settings where id='sms-template:c:booking' or id like 'sms-outbox:booking:disabled-email-fixture:%'");
  }
});
test("screenshot provider fields persist privately and the disabled channel neither captures nor replays SMS jobs",async()=>{
  const original=await api.resolvedIntegration("notificationSms");
  const values={
    NOTIFICATION_SMS_ENABLED:"false",NOTIFICATION_SMS_CLIENT_ID:"private-client-fixture",
    NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_ENTITY_ID:"entity-fixture",
    NOTIFICATION_SMS_STATUS_URL:"https://receipts.example.invalid/status",
  };
  await h.control.query("insert into settings(id,data) values('sms-outbox:channel-disable-fixture',$1)",[JSON.stringify({state:"pending",dueAt:0})]);
  await api.saveIntegration("notificationSms",values,original.revision,"database",sa.id);
  try{
    const saved=await api.resolvedIntegration("notificationSms");
    for(const [key,value] of Object.entries(values))assert.equal(saved.env[key],value);
    const readiness=await api.integrationSettings();
    assert.equal(readiness.notificationSms.notificationsEnabled,false);
    assert.equal(readiness.notificationSms.statusApiUrl,values.NOTIFICATION_SMS_STATUS_URL);
    assert.equal((await h.control.query("select data from settings where id='sms-outbox:channel-disable-fixture'")).rows[0].data.state,"disabled");
    assert.equal(JSON.stringify(readiness).includes(values.NOTIFICATION_SMS_CLIENT_ID),false);
    assert.equal(JSON.stringify(readiness).includes(values.NOTIFICATION_SMS_ENTITY_ID),false);
    const before=(await h.control.query("select count(*)::int count from settings where id like 'sms-outbox:%'")).rows[0].count;
    await api.enqueueSmsEvent(h.db,"booking",{id:"disabled-fixture",clinicId:"c"});
    assert.equal((await h.control.query("select count(*)::int count from settings where id like 'sms-outbox:%'")).rows[0].count,before);
    await api.saveIntegration("notificationSms",{},saved.revision,"database",sa.id);
    const preserved=await api.resolvedIntegration("notificationSms");
    assert.equal(preserved.env.NOTIFICATION_SMS_CLIENT_ID,values.NOTIFICATION_SMS_CLIENT_ID);
    assert.equal(preserved.env.NOTIFICATION_SMS_ENABLED,"false");
    await api.saveIntegration("notificationSms",{NOTIFICATION_SMS_ENABLED:"true"},preserved.revision,"database",sa.id);
    let sent=0;await api.processSmsNotifications(h.db,async()=>{sent++;return "provider_accepted";});
    assert.equal(sent,0);
  }finally{
    const latest=await api.resolvedIntegration("notificationSms");
    await api.saveIntegration("notificationSms",{},latest.revision,"environment",sa.id);
    await h.control.query("delete from settings where id='sms-outbox:channel-disable-fixture'");
  }
});
function smsContent(event="booking"){return {...api.defaultTemplate(event),enabled:false,prefix:"",footer:"",logoUrl:"",body:"Hello {{patient_name}} at {{clinic_name}}",senderId:"DIGIQ",dltEntityId:"12345",dltTemplateId:"67890"};}
test("vault binds ciphertext to channel, redacts readiness and protects optimistic revisions",async()=>{
  const cipher=api.encryptIntegration("notificationSms",env);
  assert(!cipher.includes(env.NOTIFICATION_SMS_KEY));
  assert.deepEqual(api.decryptIntegration("notificationSms",cipher),env);
  assert.throws(()=>api.decryptIntegration("sms",cipher));
  await api.saveIntegration("notificationSms",env,null,"database","sa");
  const readiness=await api.integrationSettings();
  assert(readiness.notificationSms.ready);
  assert(!JSON.stringify(readiness).includes(env.NOTIFICATION_SMS_KEY));
  assert.equal(readiness.notificationSms.apiUrl,env.NOTIFICATION_SMS_URL);
  await assert.rejects(api.saveIntegration("notificationSms",env,null,"database","sa"),{status:409});
  const resolved=await api.resolvedIntegration("notificationSms");
  assert.equal(resolved.env.NOTIFICATION_SMS_KEY,env.NOTIFICATION_SMS_KEY);
  const audit=await h.control.query("select summary from audit_logs");
  assert(!JSON.stringify(audit.rows).includes(env.NOTIFICATION_SMS_KEY));
});
test("request mappings support JSON/form and header/Bearer/body without collisions or unsafe headers",()=>{
  for(const encoding of ["json","form"])for(const authMode of ["header","bearer","body"]){
    const map={...mapping,encoding,authMode,authField:authMode==="body"?"api_key":"X-API-Key"};
    const cfg=api.notificationSmsConfig({...env,NOTIFICATION_SMS_MAPPING:JSON.stringify(map)});
    const req=api.smsPayload(cfg,"+919876543213","Fixture",{senderId:"DIGIQ",dltEntityId:"1",dltTemplateId:"2"});
    const body=encoding==="json"?JSON.parse(req.body):Object.fromEntries(new URLSearchParams(req.body));
    assert.equal(body.to,"+919876543213");assert.equal(body.message,"Fixture");
    if(authMode==="body")assert.equal(body.api_key,env.NOTIFICATION_SMS_KEY);
    else assert.equal(req.headers[authMode==="bearer"?"Authorization":"X-API-Key"],authMode==="bearer"?`Bearer ${env.NOTIFICATION_SMS_BEARER_TOKEN}`:env.NOTIFICATION_SMS_KEY);
  }
  for(const authField of ["Host","Cookie","Content-Length","Proxy-Authorization"])assert(!api.smsMappingSchema.safeParse({...mapping,authField}).success);
  assert(!api.smsMappingSchema.safeParse({...mapping,staticFields:{to:"collision"}}).success);
  assert.throws(()=>api.notificationSmsConfig({...env,NOTIFICATION_SMS_MAPPING:JSON.stringify({...mapping,staticFields:{token:"hidden-secret"}})}));
  assert.throws(()=>api.smsPayload(api.notificationSmsConfig(env),"+919876543213","Fixture",{}));
});
test("HTTPS/SSRF rules reject credentials, query strings, ports, reserved IPv4/IPv6 and mapped/transition addresses",async()=>{
  for(const url of ["http://sms.example.invalid","https://user:key@host.invalid","https://host.invalid?key=secret","https://host.invalid:444","https://localhost/send","https://127.0.0.1/send","https://[::1]/send"])assert.throws(()=>api.smsUrl(url));
  for(const ip of ["0.0.0.0","10.1.1.1","100.64.0.1","127.0.0.1","169.254.169.254","172.16.0.1","192.168.1.1","192.0.2.1","198.18.0.1","224.0.0.1","::","::1","::ffff:8.8.8.8","fc00::1","fe80::1","2001:db8::1","2002:0808:0808::1","64:ff9b::808:808"])assert(!api.publicSmsAddress(ip),ip);
  assert(api.publicSmsAddress("8.8.8.8"));assert(api.publicSmsAddress("2606:4700:4700::1111"));
  assert.equal(await api.sendNotificationSms({...env,NOTIFICATION_SMS_URL:"https://127.0.0.1/send"},"+919876543213","Fixture",smsContent()),"pre_dispatch_failed");
});
test("acceptance, rejection and uncertain responses never echo provider data",()=>{
  assert.equal(api.classifySmsResponse(mapping,200,'{"result":{"status":"accepted"}}'),"provider_accepted");
  assert.equal(api.classifySmsResponse(mapping,202,'{"result":{"status":"rejected"}}'),"provider_rejected");
  for(const body of ["private secret","{}",'{"result":{"status":{}}}'])assert.equal(api.classifySmsResponse(mapping,200,body),"delivery_unknown");
  assert.equal(api.classifySmsResponse(mapping,500,"private diagnostic"),"delivery_unknown");
  assert.equal(api.classifySmsResponse(mapping,401,"private diagnostic"),"provider_rejected");
  assert.equal(api.classifySmsResponse(mapping,302,"private diagnostic"),"provider_rejected");
});
test("appointment SMS defaults on, valid recipients, DLT activation, draft isolation and published policy synchronization",async()=>{
  const operational = items => items.filter(i=>!i.required);
  assert.equal(operational((await api.templateCatalog(sa,undefined,"patient","sms")).items).length,5);
  assert.equal(operational((await api.templateCatalog(sa,undefined,"clinicAdmin","sms")).items).length,6);
  assert(operational((await api.templateCatalog(sa,undefined,"patient","sms")).items).every(i=>i.content.enabled));
  await assert.rejects(api.templateCatalog({role:"clinicAdmin",id:"ca"},"c","patient","sms"),{status:403});
  await assert.rejects(api.saveTemplate(sa,{channel:"sms",event:"onboarding",recipient:"patient",revision:0,mode:"publish",content:smsContent()}),{status:400});
  await assert.rejects(api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:0,mode:"publish",content:{...smsContent(),enabled:true,dltTemplateId:""}}),{status:400});
  await api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:0,mode:"draft",content:{...smsContent(),enabled:true}});
  assert((await api.resolvedTemplate("booking","c",h.db,"patient","sms")).content.enabled);
  await api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:1,mode:"publish",content:smsContent()});
  await api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:2,mode:"draft",content:{...smsContent(),body:"Unpublished {{patient_name}}"}});
  await api.changeActivation(sa,{channel:"sms",event:"booking",recipient:"patient",revision:3,enabled:true});
  const result=await api.resolvedTemplate("booking",undefined,h.db,"patient","sms");
  assert(result.content.enabled);assert(result.local.draft.body.startsWith("Unpublished"));
  assert((await api.eventControls(sa)).items.find(r=>r.channel==="sms"&&r.event==="booking"&&r.recipient==="patient").enabled);
  await assert.rejects(api.changeActivation(sa,{channel:"sms",event:"booking",recipient:"patient",revision:3,enabled:false}),{status:409});
  await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"booking",recipient:"patient",revision:0,mode:"publish",content:smsContent()});
  assert(!(await api.resolvedTemplate("booking","c",h.db,"patient","sms")).content.enabled);
  assert((await api.resolvedTemplate("booking",undefined,h.db,"patient","sms")).content.enabled);
});
test("Required security effective-state ignores optional gates and security previews use fictional credentials only",async()=>{
  await h.control.query("update settings set data=data||'{\"emailNotificationsEnabled\":false}'::jsonb where id='integration:smtp'");
  const controls=await api.eventControls(sa);
  const email=controls.items.find(i=>i.event==="patient_email_otp"&&i.channel==="email");
  assert.equal(email.required,true);
  assert(!email.blockedReasons.some(reason=>/notifications are disabled|clinic-wide/.test(reason)));
  const sms=controls.items.find(i=>i.event==="registration_mobile_otp"&&i.recipient==="patient");
  assert(sms.required);
  assert(sms.blockedReasons.some(reason=>/approved security SMS wording/.test(reason)));
  const content=api.defaultTemplate("patient_email_otp");
  const prepared=await api.prepareTemplateTest(sa,{channel:"email",event:"patient_email_otp",recipientGroup:"patient",
    revision:0,content,values:{otp:"654321",expiry_minutes:"99"}});
  assert(prepared.rendered.text.includes("123456"));
  assert(!prepared.rendered.text.includes("654321"));
  await assert.rejects(api.testTemplate(sa,prepared,()=>assert.fail("No SMS"),()=>assert.fail("No SMTP")),{status:400});
});
test("draft tests use exact bounded placeholders, explicit recipient and durable replay without publishing",async()=>{
  const content=smsContent();
  const base={channel:"sms",event:"completed",recipientGroup:"patient",revision:0,content,values:{patient_name:"Synthetic",clinic_name:"Test clinic"}};
  await assert.rejects(api.prepareTemplateTest({id:"ca",role:"clinicAdmin"},base),{status:403});
  await assert.rejects(api.prepareTemplateTest(sa,{...base,values:{patient_name:"Synthetic"}}),{status:400});
  await assert.rejects(api.prepareTemplateTest(sa,{...base,values:{...base.values,password:"forbidden"}}),{status:400});
  const prepared=await api.prepareTemplateTest(sa,base);
  assert.equal(prepared.rendered.text,"Hello Synthetic at Test clinic");
  await assert.rejects(api.testTemplate(sa,prepared),{status:400});
  const input={...base,requestId:randomUUID(),confirmed:true,recipient:"+919876543213"};
  let calls=0;const send=async()=>{calls++;return "delivery_unknown";};
  const preparedInput=await api.prepareTemplateTest(sa,input);
  const clients=await Promise.all([h.connect(),h.connect()]);
  const results=await Promise.all(clients.map(client=>context.run(drizzle(client),()=>api.testTemplate(sa,preparedInput,send))));
  assert.equal(calls,1);assert(results.every(r=>r.status==="delivery_unknown"));
  assert((await api.resolvedTemplate("completed",undefined,h.db,"patient","sms")).content.enabled);
  const persisted=await h.control.query("select data from settings where id like 'notification-test:%'");
  assert(!JSON.stringify(persisted.rows).includes("Synthetic"));assert(!JSON.stringify(persisted.rows).includes("+919876543213"));
});
test("a known pre-dispatch failure stays replay-safe and a fresh confirmed request can send",async()=>{
  const input={channel:"sms",event:"completed",recipientGroup:"patient",revision:0,content:smsContent(),
    values:{patient_name:"Fictional",clinic_name:"Fictional clinic"},recipient:"+919876543213",
    confirmed:true,requestId:randomUUID()};
  const prepared=await api.prepareTemplateTest(sa,input);
  let calls=0;
  assert.equal((await api.testTemplate(sa,prepared,async()=>{calls++;return "pre_dispatch_failed";})).status,"pre_dispatch_failed");
  assert.equal((await api.testTemplate(sa,prepared,async()=>{calls++;return "provider_accepted";})).status,"pre_dispatch_failed");
  assert.equal(calls,1,"repeating the same request never dispatches again");
  const fresh=await api.prepareTemplateTest(sa,{...input,requestId:randomUUID()});
  assert.equal((await api.testTemplate(sa,fresh,async()=>{calls++;return "provider_accepted";})).status,"provider_accepted");
  assert.equal(calls,2,"only a fresh explicit request can try after known no-dispatch");
});
test("disabled email tests use the existing sender interface, exact sample values and sanitized outcomes without normal jobs",async()=>{
  const content={enabled:false,subject:"Hello {{doctor_name}}",body:"Clinic {{clinic_name}}",prefix:"",footer:"",logoUrl:""};
  const base={channel:"email",event:"reminder",recipientGroup:"doctor",revision:0,content,
    values:{doctor_name:"Fictional <Doctor>",clinic_name:"Test clinic"},recipient:"controlled@example.invalid",confirmed:true};
  const before=await h.control.query("select count(*)::int n from settings where id like '%outbox:%'");
  for(const [code,expected] of [[null,"provider_accepted"],["EMAIL_REJECTED","provider_rejected"],["EMAIL_PRE_DISPATCH_FAILED","pre_dispatch_failed"],["EMAIL_DELIVERY_FAILED","delivery_unknown"]]){
    const result=await api.testTemplate(sa,await api.prepareTemplateTest(sa,{...base,requestId:randomUUID()}),undefined,async(to,subject,text,_env,rendered)=>{
      assert.equal(to,base.recipient);assert.equal(subject,"Hello Fictional <Doctor>");assert.equal(text,"Clinic Test clinic");
      assert(rendered.html.includes("&lt;Doctor&gt;"));
      if(code)throw Object.assign(Error("Secret provider response must be hidden"),{code});
    });
    assert.equal(result.status,expected);assert(!result.message.includes("Secret"));
  }
  assert.equal((await h.control.query("select count(*)::int n from settings where id like '%outbox:%'")).rows[0].n,before.rows[0].n);
});
test("all six lifecycle events enqueue once per channel and eligible recipient; unknown dispatch is never resent",async()=>{
  await h.control.query("delete from settings where id like 'sms-template:%' or id like 'sms-outbox:%' or id like 'mail-outbox:%'");
  for(const event of api.templateEvents)for(const group of api.templateRecipients){
    // Patient authentication codes are not lifecycle jobs. Keep this scenario's
    // four visit recipients plus clinic-owner onboarding; Superadmin onboarding
    // and OTP delivery have their own coverage.
    if(api.requiredEvent(event) || !api.validTemplateTarget(event,group,"sms") ||
      group==="superAdmin" || event==="onboarding"&&group!=="clinicAdmin")continue;
    await api.saveTemplate(sa,{channel:"sms",event,recipient:group,revision:0,mode:"publish",content:{...smsContent(event),enabled:true}});
  }
  const row={id:"visit",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-01",startTime:"10:00",endTime:"11:00",timezone:"UTC",reference:"FIXTURE",status:"waiting",revision:0};
  await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,status,data) values('visit','c','b','d','p','2030-01-01','waiting',$1)",[JSON.stringify(row)]);
  for(const event of api.templateEvents) {
    const target=event==="onboarding"?{id:"c",clinicId:"c"}:row;
    await api.enqueueEvent(h.db,event,target);await api.enqueueEvent(h.db,event,target);
  }
  const rows=await h.control.query("select data from settings where id like 'sms-outbox:%'");
  assert.equal(rows.rows.length,21); // 5 lifecycle events × four groups, plus owning admin onboarding.
  let calls=0;
  const send=async()=>{calls++;return "delivery_unknown";};
  await api.processSmsNotifications(h.db,send);
  assert.equal(calls,9); // booking/rescheduled × four plus onboarding; obsolete statuses/reminder skipped.
  await api.processSmsNotifications(h.db,send);assert.equal(calls,9);
  const outcomes=await h.control.query("select data->>'state' as state from settings where id like 'sms-outbox:%'");
  assert.equal(outcomes.rows.filter(r=>r.state==="delivery_unknown").length,9);
});
test("missing contacts and disabled gate skip, old queued events don't resume after reactivation, email is independent",async()=>{
  const row=await api.one(api.appointments,"visit",h.db);
  await h.control.query("update users set mobile=null where id='pu';update patients set mobile=null where id='p'");
  await api.enqueueEvent(h.db,"booking",{...row,id:"other",revision:9});
  const queued=await h.control.query("select data from settings where id like 'sms-outbox:booking:other:%'");
  assert.equal(queued.rows.length,3);
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','false') where id='c'");
  await api.enqueueEvent(h.db,"booking",{...row,id:"gated"});
  assert.equal((await h.control.query("select id from settings where id like '%outbox:booking:gated:%'")).rows.length,0);
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','true') where id='c'; delete from settings where id like 'mail-outbox:%'");
  await api.enqueueEvent(h.db,"booking",{...row,id:"independent"});
  const rows=await h.control.query("select id from settings where id like '%outbox:booking:independent:%'");
  assert(rows.rows.some(r=>r.id.startsWith("sms-outbox:")));assert(rows.rows.some(r=>r.id.startsWith("mail-outbox:")));
  await h.control.query("update settings set data=jsonb_set(data,'{createdAt}','1') where id like 'sms-outbox:booking:independent:%'");
  let calls=0;await api.processSmsNotifications(h.db,async()=>{calls++;return "provider_accepted";});
  assert.equal(calls,0); // only pending 'other' jobs have no real appointment and are obsolete too.
});
test("completed/cancelled/reminder dispatch eligibility uses exact revision, status and session timezone",async()=>{
  await h.control.query("update users set mobile='+919876543213' where id='pu';update patients set mobile='+919876543213' where id='p';delete from settings where id like 'sms-outbox:%';update appointments set status='completed' where id='visit'");
  for(const [event,status] of [["completed","completed"],["cancelled","cancelled"],["reminder","waiting"]]){
    const row={id:`eligible-${event}`,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-01",startTime:"10:00",endTime:"11:00",timezone:"Asia/Kolkata",reference:"FIXTURE",status,revision:2};
    await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,status,data) values($1,'c','b','d','p','2030-01-01',$2,$3)",[row.id,status,JSON.stringify(row)]);
    await api.enqueueEvent(h.db,event,row);
  }
  const seen=[];const now=Date.parse("2030-01-01T03:30:00Z"); // 09:00 India, one hour before session.
  await api.processSmsNotifications(h.db,async(_env,to)=>{seen.push(to);return "provider_accepted";},now);
  assert.equal(seen.length,12);
  await api.processSmsNotifications(h.db,async()=>{throw Error("Must not retry");},now+100);
  // Enqueue a valid event, then revoke staff membership/change contact before dispatch.
  const originalRow=await api.one(api.appointments,"eligible-completed",h.db);
  await h.control.query("delete from settings where id like 'sms-outbox:completed:eligible-completed:%'");
  await api.enqueueEvent(h.db,"completed",originalRow);
  assert.equal((await h.control.query("select id from settings where id like 'sms-outbox:completed:eligible-completed:%'")).rows.length,0,"Permanent capture claims survive outbox deletion");
  const row={...originalRow,revision:3};
  await h.control.query("update appointments set data=$1 where id=$2",[JSON.stringify(row),row.id]);
  await api.enqueueEvent(h.db,"completed",row);
  await h.control.query("delete from assignments where user_id='ru';update users set mobile='+919876543219' where id='du'");
  let sent=0;await api.processSmsNotifications(h.db,async()=>{sent++;return "provider_rejected";},now);
  assert.equal(sent,2); // Patient and owning admin only; changed contact/assignment are not sent.
});
test("routes enforce global control/test/SMS/template/credential role boundary independently of UI",async()=>{
  const server=api.app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const role of ["clinicAdmin","doctor","receptionist","patient"]){
      for(const [path,method,body] of [
        ["/management/templates?channel=sms","GET"],["/management/event-controls","GET"],
        ["/settings/integrations","GET"],["/settings/integrations","PUT",{}],
        ["/management/templates/preview","POST",{}],["/management/templates/test","POST",{}],
        ["/management/event-controls","PUT",{}],["/management/notification-logs","GET"],
        ["/management/notification-logs/notification-history:"+"a".repeat(64),"GET"],
      ]){
        const response=await fetch(origin+path,{method,headers:{"x-user":role,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
        assert.equal(response.status,403,`${role} ${method} ${path}`);
      }
    }
  }finally{await new Promise(r=>server.close(r));}
});
test("history snapshots are encrypted, credential/private-link redacted, immutable and filtered with stable bounded pages",async()=>{
  const now=Date.now(),reference="PROTECTED_HISTORY";
  for(let i=0;i<3;i++){
    const entry={channel:i===0?"sms":"email",event:"booking",recipientGroup:"patient",clinicId:"c",reference,occurrence:`prospective-${i}`,createdAt:now+i};
    await api.recordNotification(h.db,`protected-${i}`,entry,"pending",undefined,[],now+i);
    await api.recordNotification(h.db,`protected-${i}`,entry,"sending",{
      sender:"sent@example.invalid",recipient:"actual@example.invalid",subject:"Fictional appointment",message:"Visit https://example.invalid/book/private-token Token: PRIVATE_QR synthetic-secret",
      templateId:"email:booking:patient",templateScope:"platform",templateRevision:4,provider:"smtp",
    },["synthetic-secret"],now+i+10);
    await api.recordNotification(h.db,`protected-${i}`,entry,"provider_accepted",undefined,[],now+i+20);
    // Recapture or today's changed contact/content must never replace dispatched values.
    await api.recordDecision(h.db,`protected-${i}`,entry,"pending");
  }
  const raw=(await h.control.query("select data from settings where id=$1",[api.historyId("protected-0")])).rows[0].data;
  for(const forbidden of ["actual@example.invalid","sent@example.invalid","Fictional appointment","PRIVATE_QR","synthetic-secret","private-token"])
    assert(!JSON.stringify(raw).includes(forbidden),forbidden);
  const first=await api.listNotificationLogs(sa,{reference,pageSize:2},h.db,now+100);
  assert.equal(first.items.length,2);assert(first.nextCursor);
  const second=await api.listNotificationLogs(sa,{reference,pageSize:2,cursor:first.nextCursor},h.db,now+100);
  assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,3);
  const item=await api.getNotificationLog(sa,api.historyId("protected-0"),h.db,now+100);
  assert.equal(item.status,"provider_accepted");assert.equal(item.sender,"sent@example.invalid");assert.equal(item.templateRevision,4);
  assert(item.message.includes("[link withheld]"));assert(item.message.includes("[protected value withheld]"));assert(item.message.includes("[credential withheld]"));
  assert.equal(item.timeline.length,3);assert.equal(item.dispatchAt,now+10);
  for(const [filter,count] of [
    [{channel:"sms"},1],[{channel:"email"},2],[{event:"booking",status:"provider_accepted",clinicId:"c",recipientGroup:"patient",source:"automatic"},3],
    [{sender:"sent@example.invalid",recipient:"actual@example.invalid"},3],
    [{recipient:"changed@example.invalid"},0],[{from:new Date(now+1).toISOString(),to:new Date(now+2).toISOString()},2],
  ])assert.equal((await api.listNotificationLogs(sa,{reference,...filter},h.db,now+100)).items.length,count,JSON.stringify(filter));
  for(const bad of [{pageSize:101},{pageSize:0},{status:"delivered"},{cursor:"invalid"},{from:"yesterday"},{from:new Date(now+2).toISOString(),to:new Date(now).toISOString()},{channel:["email","sms"]}])
    await assert.rejects(api.listNotificationLogs(sa,bad,h.db),{status:400});
  for(const user of [{role:"patient"},{role:"clinicAdmin"},{role:"superAdmin",demo:true}])
    await assert.rejects(api.getNotificationLog(user,item.id,h.db),{status:403});
});
test("stale claims become uncertain without resend; legacy fields stay unavailable and retention keeps permanent safeguards",async()=>{
  const now=Date.now(),entry={channel:"sms",event:"reminder",recipientGroup:"patient",clinicId:"c",reference:"STALE_HISTORY",createdAt:now-600000};
  await api.recordNotification(h.db,"stale-protected",entry,"sending",{sender:"DIGIQ",recipient:"+919876543213",message:"Session begins in an hour"},[],now-600000);
  const item=await api.getNotificationLog(sa,api.historyId("stale-protected"),h.db,now);
  assert.equal(item.status,"delivery_unknown");assert.equal(item.reason,"abandoned_dispatch_claim");
  assert.equal(item.timeline.at(-1).reason,"abandoned_dispatch_claim");
  assert.equal((await api.listNotificationLogs(sa,{reference:"STALE_HISTORY",status:"delivery_unknown"},h.db,now)).items.length,1);
  await h.control.query("insert into settings(id,data) values($1,$2)",["mail-outbox:booking:legacy-history",{event:"booking",state:"provider_accepted",createdAt:now,clinicId:"c",recipientGroup:"clinicAdmin",snapshot:{reference:"LEGACY_HISTORY"}}]);
  const legacy=(await api.listNotificationLogs(sa,{reference:"LEGACY_HISTORY"},h.db,now)).items[0];
  assert(legacy.legacy);assert.equal(legacy.sender,null);assert.equal(legacy.recipient,null);assert.equal(legacy.message,null);assert.equal(legacy.dispatchAt,null);assert.deepEqual(legacy.timeline,[]);
  assert.equal((await api.getNotificationLog(sa,legacy.id,h.db,now)).status,"provider_accepted");
  await api.recordNotification(h.db,"expired-history",{...entry,createdAt:now-91*86400000},"disabled",undefined,[],now-91*86400000);
  await h.control.query("insert into settings(id,data) values('notification-test:retained:claim','{\"status\":\"delivery_unknown\"}'),('notification-occurrence:retained:claim','{}')");
  await api.cleanupNotificationHistory(h.db,now);
  assert.equal((await h.control.query("select id from settings where id=$1",[api.historyId("expired-history")])).rows.length,0);
  assert.equal((await h.control.query("select id from settings where id in ('notification-test:retained:claim','notification-occurrence:retained:claim','mail-outbox:booking:legacy-history')")).rows.length,3);
});
test("provider test dispatch uses a configurable Keep in Touch endpoint, independent keys and durable request identity",async()=>{
  const original=await api.resolvedIntegration("notificationSms");
  try{
    await api.saveIntegration("notificationSms",{
      NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEEP_IN_TOUCH_URL:"https://sms.example.invalid/alternate",
      NOTIFICATION_SMS_KEY:"fictional-body-key",NOTIFICATION_SMS_BEARER_TOKEN:"fictional-independent-bearer",NOTIFICATION_SMS_CLIENT_ID:"fictional-client",
      NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus",
    },original.revision,"database",sa.id);
    const readiness=(await api.integrationSettings()).notificationSms;
    assert.equal(readiness.keepInTouchApiUrl,"https://sms.example.invalid/alternate");
    assert.equal(readiness.customApiUrl,"https://sms.example.invalid/send");
    assert.equal(api.notificationSmsConfig({...env,NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"fictional-body-key",NOTIFICATION_SMS_BEARER_TOKEN:"fictional-independent-bearer",NOTIFICATION_SMS_CLIENT_ID:"fictional-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus"}).url.href,"https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS");
    globalThis.kitNetwork=[];
    const input={channel:"sms",event:"provider_test",recipientGroup:"explicit",recipient:"+919876543213",subject:"",message:"Fictional SMS",requestId:randomUUID(),confirmed:true,content:{dltTemplateId:"TEST_REGISTERED"}};
    assert.equal(await api.dispatchNotificationTest(sa.id,input,h.db),"provider_accepted");
    assert.equal(await api.dispatchNotificationTest(sa.id,input,h.db),"provider_accepted");
    assert.equal(globalThis.kitNetwork.length,1);assert.equal(globalThis.kitNetwork[0].url,"https://sms.example.invalid/alternate");
    assert.equal(globalThis.kitNetwork[0].options.headers.Authorization,"Bearer fictional-independent-bearer");
    assert.deepEqual(globalThis.kitNetwork[0].body,{countryCode:"+91",mobile:"9876543213",senderId:"DIGIQ",message:"Fictional SMS",apiKey:"fictional-body-key",clientId:"fictional-client",templateId:"TEST_REGISTERED"});
    const detail=await api.getNotificationLog(sa,api.historyId(`notification-test:${sa.id}:${input.requestId}`),h.db);
    assert.equal(detail.httpStatus,200);assert.equal(detail.source,"test");assert.equal(detail.dltTemplateId,"TEST_REGISTERED");
    await assert.rejects(api.dispatchNotificationTest(sa.id,{...input,message:"Changed"},h.db),{status:409});
    let sends=0;const unknown={...input,requestId:randomUUID()};
    assert.equal(await api.dispatchNotificationTest(sa.id,unknown,h.db,async()=>{sends++;throw Error("Raw authentication payload");}),"delivery_unknown");
    assert.equal(await api.dispatchNotificationTest(sa.id,unknown,h.db,async()=>{sends++;return "provider_accepted";}),"delivery_unknown");
    assert.equal(sends,1);
    await api.saveIntegration("notificationSms",{NOTIFICATION_SMS_PROVIDER:"generic"},(await api.resolvedIntegration("notificationSms")).revision,"database",sa.id);
    assert.equal(api.notificationSmsConfig((await api.resolvedIntegration("notificationSms")).env).url.href,"https://sms.example.invalid/send");
    await api.saveIntegration("notificationSms",{NOTIFICATION_SMS_PROVIDER:"keepInTouch"},(await api.resolvedIntegration("notificationSms")).revision,"database",sa.id);
    assert.equal(api.notificationSmsConfig((await api.resolvedIntegration("notificationSms")).env).url.href,"https://sms.example.invalid/alternate");
  }finally{
    await api.saveIntegration("notificationSms",{},(await api.resolvedIntegration("notificationSms")).revision,"environment",sa.id);
    delete globalThis.kitNetwork;
  }
});
test("history failures are isolated savepoints and never turn an accepted test into a second dispatch",async()=>{
  await h.control.query(`create or replace function fail_fictional_history() returns trigger language plpgsql as $$
    begin if NEW.id like 'notification-history:%' then raise exception 'synthetic history unavailable'; end if; return NEW; end $$;
    create trigger fail_fictional_history before insert or update on settings for each row execute function fail_fictional_history();`);
  try{
    let sends=0;
    const input={channel:"email",event:"provider_test",recipientGroup:"explicit",recipient:"fictional@example.invalid",subject:"Fixture",message:"Fixture",requestId:randomUUID(),confirmed:true};
    const send=async()=>{sends++;};
    assert.equal(await api.dispatchNotificationTest(sa.id,input,h.db,undefined,send),"provider_accepted");
    assert.equal(await api.dispatchNotificationTest(sa.id,input,h.db,undefined,send),"provider_accepted");
    assert.equal(sends,1);
  }finally{await h.control.query("drop trigger fail_fictional_history on settings;drop function fail_fictional_history();");}
});
test("history APIs are no-store and failed filters are not broadened",async()=>{
  const server=api.app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const response=await fetch(origin+"/management/notification-logs?reference=PROTECTED_HISTORY",{headers:{"x-user":"superAdmin"}});
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    const data=await response.json();assert.equal(data.items.length,3);
    const detail=await fetch(origin+"/management/notification-logs/"+data.items[0].id,{headers:{"x-user":"superAdmin"}});
    assert.equal(detail.status,200);assert.equal(detail.headers.get("cache-control"),"no-store");
    const bad=await fetch(origin+"/management/notification-logs?unrecognized=anything",{headers:{"x-user":"superAdmin"}});
    assert.equal(bad.status,400);assert.equal(bad.headers.get("cache-control"),"no-store");
  }finally{await new Promise(r=>server.close(r));}
});
test("resetting an explicit clinic SMS opt-out stamps future-only activation without changing inheritance",async()=>{
  await h.control.query("delete from settings where id='sms-template:c:booking'");
  // Patient is the default booking recipient and shares the legacy un-suffixed key.
  await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"booking",recipient:"patient",revision:0,mode:"publish",content:smsContent()});
  const before=Date.now();await new Promise(r=>setTimeout(r,2));
  await api.saveTemplate(sa,{channel:"sms",clinicId:"c",event:"booking",recipient:"patient",revision:1,mode:"reset"});
  const effective=await api.resolvedTemplate("booking","c",h.db,"patient","sms");
  assert(effective.content.enabled);assert.equal(effective.source,"platform");assert(effective.activatedAt>before);
  assert.equal(effective.local.revision,2);
});
test("email preparation failure cannot roll back booking or scheduler SMS jobs in a caller transaction",async()=>{
  const ids=["notification-template:c:booking:clinicAdmin","notification-template:c:reminder"];
  const saved=await h.control.query("select id,data from settings where id=any($1::text[])",[ids]);
  try{
    for(const id of ids)await h.control.query(
      "insert into settings(id,data) values($1,$2) on conflict(id) do update set data=excluded.data",
      [id,JSON.stringify({revision:1,published:{...api.defaultTemplate("booking"),subject:"invalid\nemail header",enabled:true}})]);
    const row={id:"email-failed-booking",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-02",startTime:"08:00",endTime:"09:00",timezone:"Asia/Kolkata",reference:"FIXTURE",status:"waiting",revision:0};
    await h.db.transaction(async tx=>{
      await tx.insert(api.appointments).values({id:row.id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:row.date,status:row.status,data:row});
      await api.enqueueEvent(tx,"booking",row);
    });
    assert.equal((await api.one(api.appointments,row.id,h.db)).status,"waiting");
    const booking=await h.control.query("select id from settings where id like 'sms-outbox:booking:email-failed-booking:%'");
    assert(booking.rowCount>0,"SMS savepoint survives email rollback and outer visit commit");
    assert.equal((await h.control.query("select id from settings where id like 'mail-outbox:booking:email-failed-booking:%'")).rowCount,0);
    const reminder={...row,id:"email-failed-reminder",startTime:"10:00",endTime:"11:00"};
    await h.db.insert(api.appointments).values({id:reminder.id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:reminder.date,status:reminder.status,data:reminder});
    // Exercise the scheduler's enclosing transaction, not only direct enqueue.
    await api.processNotifications(h.db,async()=>({status:"provider_accepted"}),Date.parse("2030-01-02T03:30:00Z"));
    const jobs=await h.control.query("select id from settings where id like 'sms-outbox:reminder:email-failed-reminder:%'");
    assert(jobs.rowCount>0,"SMS reminder survives failed email preparation in scheduler transaction");
    assert.equal((await h.control.query("select id from settings where id like 'mail-outbox:reminder:email-failed-reminder:%'")).rowCount,0);
  }finally{
    await h.control.query("delete from settings where id=any($1::text[])",[ids]);
    for(const row of saved.rows)await h.control.query("insert into settings(id,data) values($1,$2)",[row.id,row.data]);
  }
});
test("an SMS poll before scheduler commit does not lose reminders at the next poll outside the capture window",async()=>{
  await h.control.query("delete from settings where id like 'sms-outbox:%'");
  const row={id:"delayed-reminder",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-03",startTime:"10:00",endTime:"11:00",timezone:"Asia/Kolkata",reference:"FIXTURE",status:"waiting",revision:0};
  await h.db.insert(api.appointments).values({id:row.id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:row.date,status:row.status,data:row});
  const scheduled=Date.parse("2030-01-03T03:31:45Z"); // 09:01:45 local: last part of capture window.
  let calls=0;const send=async()=>{calls++;return "provider_accepted";};
  await api.processSmsNotifications(h.db,send,scheduled);assert.equal(calls,0);
  await api.processNotifications(h.db,async()=>({status:"provider_accepted"}),scheduled);
  const jobs=await h.control.query("select id from settings where id like 'sms-outbox:reminder:delayed-reminder:%'");
  assert(jobs.rowCount>0);
  const nextPoll=scheduled+30000;
  assert.equal(api.reminderDue(row,nextPoll),false,"strict scheduler capture window is already closed");
  assert.equal(api.reminderDispatchEligible(row,nextPoll),true);
  await api.processSmsNotifications(h.db,send,nextPoll);
  assert.equal(calls,jobs.rowCount,"every queued eligible recipient survives the scheduling/poll race");
  await api.processSmsNotifications(h.db,send,nextPoll+30000);
  assert.equal(calls,jobs.rowCount,"accepted reminder jobs are not resent");
  const late={...row,id:"expired-reminder",startTime:"11:00",endTime:"12:00"};
  await h.db.insert(api.appointments).values({id:late.id,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:late.date,status:late.status,data:late});
  await api.processNotifications(h.db,async()=>({status:"provider_accepted"}),scheduled+3600000);
  const expired=scheduled+3600000+330000; // 10:07:15 local: beyond five-minute allowance.
  assert.equal(api.reminderDispatchEligible(late,expired),false);
  await api.processSmsNotifications(h.db,send,expired);
  assert.equal(calls,jobs.rowCount,"bounded grace never drains an old reminder backlog");
  const terminal=await h.control.query("select data->>'state' as state from settings where id like 'sms-outbox:reminder:expired-reminder:%'");
  assert(terminal.rowCount>0&&terminal.rows.every(r=>r.state==="obsolete"));
  assert.equal(api.reminderDispatchEligible({...row,status:"cancelled"},nextPoll),false);
  assert.equal(api.reminderDispatchEligible({...row,checkedInAt:nextPoll},nextPoll),false);
});
test("patient booking confirmation has one prospective history and immutable dispatch details despite retry/contact edits",async()=>{
  const existing=(await h.control.query("select id,data from settings where id='notification-template:c:booking'")).rows;
  const originalPatient=(await h.control.query("select email from users where id='pu'")).rows[0].email;
  try{
    await h.control.query("delete from settings where id='notification-template:c:booking';update users set email='captured@example.invalid' where id='pu'");
    await api.saveTemplate(sa,{channel:"email",clinicId:"c",event:"booking",recipient:"patient",revision:0,mode:"publish",content:{...api.defaultTemplate("booking"),enabled:true}});
    const row={id:"prospective-patient-confirmation",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",clinicName:"Fictional clinic",branchName:"Fictional branch",doctorName:"Fictional doctor",date:"2030-02-03",startTime:"10:00",endTime:"11:00",timezone:"Asia/Kolkata",reference:"PATIENT_HISTORY",token:"A-01",status:"waiting",revision:0};
    await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,status,data) values($1,'c','b','d','p',$2,'waiting',$3)",[row.id,row.date,row]);
    await api.capturePatientConfirmation(h.db,row);await api.capturePatientConfirmation(h.db,row);
    let sends=0;
    assert.equal(await api.confirmAppointmentEmail(row.id,h.db,async(to,subject,text)=>{sends++;assert.equal(to,"captured@example.invalid");assert.match(text,/session/i);}),"provider_accepted");
    await h.control.query("update users set email='later-contact@example.invalid' where id='pu'");
    assert.equal(await api.confirmAppointmentEmail(row.id,h.db,async()=>{sends++;}),"provider_accepted");
    assert.equal(sends,1);
    const items=(await api.listNotificationLogs(sa,{reference:"PATIENT_HISTORY",channel:"email"},h.db)).items;
    assert.equal(items.length,1);assert.equal(items[0].recipient,"captured@example.invalid");assert.equal(items[0].sender,"sender@example.invalid");
    assert.equal(items[0].templateId,"email:booking:patient");assert.equal(items[0].templateRevision,1);assert.equal(items[0].templateScope,"clinic");
    assert.deepEqual(items[0].timeline.map(t=>t.status),["pending","sending","provider_accepted"]);
    // Draft revision is not a published-content revision.
    await api.saveTemplate(sa,{channel:"email",clinicId:"c",event:"booking",recipient:"patient",revision:1,mode:"draft",content:{...api.defaultTemplate("booking"),subject:"Unpublished"}});
    assert.equal((await api.resolvedTemplate("booking","c",h.db,"patient","email")).effectiveRevision,1);
    assert.equal((await api.getNotificationLog(sa,items[0].id,h.db)).templateRevision,1);
  }finally{
    await h.control.query("delete from settings where id='notification-template:c:booking'");
    await h.control.query("update users set email=$1 where id='pu'",[originalPatient]);
    for(const row of existing)await h.control.query("insert into settings(id,data) values($1,$2)",[row.id,row.data]);
  }
});
test("skips remain traceable but never become a backlog on repeated capture after policy activation",async()=>{
  const row={id:"prospective-skip",clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",date:"2030-01-04",startTime:"10:00",endTime:"11:00",timezone:"Asia/Kolkata",reference:"SKIP_HISTORY",status:"waiting",revision:0};
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','false') where id='c'");
  try{await api.enqueueEvent(h.db,"reminder",row);await api.enqueueEvent(h.db,"reminder",row);}
  finally{await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','true') where id='c'");}
  const items=(await api.listNotificationLogs(sa,{reference:"SKIP_HISTORY"},h.db)).items;
  assert.equal(items.length,8);assert(items.every(i=>i.status==="disabled"&&i.templateId));
  await api.enqueueEvent(h.db,"reminder",row);
  assert.equal((await api.listNotificationLogs(sa,{reference:"SKIP_HISTORY"},h.db)).items.length,8);
  assert.equal((await h.control.query("select id from settings where id like '%outbox:reminder:prospective-skip:%'")).rows.length,0);
});

const patientActor={id:"pu",role:"patient",patientId:"p",clinicIds:[],branchIds:[]};
const ownerActor={id:"ca",role:"clinicAdmin",clinicIds:["c"],branchIds:[]};
const preferenceRow=(data,key)=>data.items.find(row=>row.key===key);
async function resetChoices(){
  await h.control.query("delete from settings where id like 'notification-preferences:%'");
}
async function prefSave(user,choices,conn=h.db){
  const current=await api.personalPreferences(user.id,conn);
  return api.savePersonalNotificationSettings(user,{revision:current.revision,choices},conn);
}
function fictionalVisit(suffix,event="booking"){
  return {id:`pref-${suffix}`,clinicId:"c",branchId:"b",doctorId:"d",patientId:"p",
    date:`2035-02-${String(1+Number(suffix.replace(/\D/g,"")||0)%27).padStart(2,"0")}`,startTime:"10:00",endTime:"11:00",
    timezone:"Asia/Kolkata",reference:`PREF_${suffix}`,token:"P-01",tokenNumber:1,status:event==="cancelled"?"cancelled":"waiting",revision:0};
}
async function storeVisit(row){
  await h.control.query("insert into appointments(id,clinic_id,branch_id,doctor_id,patient_id,date,status,data) values($1,'c','b','d','p',$2,$3,$4)",[row.id,row.date,row.status,row]);
}
async function publishPreferenceTemplates(){
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','true') where id='c'");
  for(const channel of ["email","sms"])for(const event of ["booking","cancelled"]){
    const current=await api.resolvedTemplate(event,"c",h.db,"patient",channel);
    const content={...current.content,enabled:true,...(channel==="sms"?{senderId:"DIGIQ",dltEntityId:"synthetic-entity",dltTemplateId:"synthetic-template"}:{})};
    await api.saveTemplate(sa,{channel,event,recipient:"patient",clinicId:"c",revision:current.local.revision,mode:"publish",content});
  }
}
test("personal settings inherit current behavior, enforce independent supported choices, revisions and required exemptions",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  const initial=await api.personalNotificationSettings(patientActor,h.db);
  assert.equal(initial.revision,0);
  assert.equal(preferenceRow(initial,"email:booking").saved,null);
  assert.equal(preferenceRow(initial,"email:booking").selected,true);
  assert.equal(preferenceRow(initial,"email:booking").state,"On");
  assert.equal(initial.canManage,false);
  assert(!initial.items.some(row=>row.event==="system"||row.event==="onboarding"));
  const required=initial.items.filter(row=>row.state==="Required");
  assert(required.length>0);
  await assert.rejects(api.savePersonalNotificationSettings(patientActor,{revision:0,choices:[{key:required[0].key,enabled:false}]},h.db),{status:400});
  await assert.rejects(api.savePersonalNotificationSettings(patientActor,{revision:0,choices:[{key:"email:unknown",enabled:true}]},h.db),{status:400});
  const saved=await prefSave(patientActor,[{key:"email:booking",enabled:false},{key:"inApp:queue",enabled:false}]);
  assert.equal(saved.revision,1);assert.equal(preferenceRow(saved,"email:booking").state,"Off");
  assert.equal(preferenceRow(saved,"sms:booking").selected,true);
  assert.equal(preferenceRow(saved,"inApp:queue").selected,false);
  await assert.rejects(api.savePersonalNotificationSettings(patientActor,{revision:0,choices:[]},h.db),{status:409});
  const reloaded=await api.personalNotificationSettings(patientActor,h.db);
  assert.equal(preferenceRow(reloaded,"email:booking").saved,false);
  const inherited=await prefSave(patientActor,[{key:"email:booking",enabled:null}]);
  assert.equal(preferenceRow(inherited,"email:booking").saved,null);
  assert.equal(preferenceRow(inherited,"email:booking").selected,true);
  assert.equal((await api.recipientPreference(h.db,"pu","sms",required.find(r=>r.channel==="sms")?.event||"patient_login_otp")).enabled,true);
  await resetChoices();
});
test("personal opt-outs affect capture, linked patient confirmation and guests without overriding published/template/provider gates",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  await prefSave(patientActor,[{key:"email:cancelled",enabled:false},{key:"email:booking",enabled:false}]);
  const cancelled=fictionalVisit("capture1","cancelled");await storeVisit(cancelled);
  await h.db.transaction(tx=>api.enqueueEvent(tx,"cancelled",cancelled));
  const email=(await h.control.query("select data from settings where id like $1",[`mail-outbox:cancelled:${cancelled.id}:%`])).rows;
  assert.equal(email.filter(r=>r.data.recipientGroup==="patient").length,0);
  const sms=(await h.control.query("select data from settings where id like $1",[`sms-outbox:cancelled:${cancelled.id}:%`])).rows;
  assert.equal(sms.filter(r=>r.data.recipientGroup==="patient").length,1);
  const booking=fictionalVisit("confirmation2");await storeVisit(booking);
  await h.db.transaction(tx=>api.capturePatientConfirmation(tx,booking));
  let sends=0;
  assert.equal(await api.confirmAppointmentEmail(booking.id,h.db,async()=>sends++),"disabled");
  assert.equal(sends,0);
  // The guest contact is not silently matched by address to the signed-in account.
  await h.control.query("insert into patients(id,clinic_id,mobile,data) values('preference-guest','c','+919876543214','{\"fullName\":\"Fictional guest\",\"email\":\"guest@example.invalid\"}')");
  const guest={...fictionalVisit("guest3"),patientId:"preference-guest"};await storeVisit(guest);
  // storeVisit intentionally writes the standard fixture patient; make this relation authoritative.
  await h.control.query("update appointments set patient_id='preference-guest' where id=$1",[guest.id]);
  await h.db.transaction(tx=>api.capturePatientConfirmation(tx,guest));
  assert.equal(await api.confirmAppointmentEmail(guest.id,h.db,async()=>sends++),"provider_accepted");
  assert.equal(sends,1);
  await prefSave(patientActor,[{key:"email:booking",enabled:true}]);
  assert.equal(await api.confirmAppointmentEmail(booking.id,h.db,async()=>sends++),"disabled","reenabling does not resurrect an opted-out booking");
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','false') where id='c'");
  const blocked=await api.personalNotificationSettings(patientActor,h.db);
  assert.equal(preferenceRow(blocked,"email:booking").state,"On but blocked");
  assert(preferenceRow(blocked,"email:booking").reasons.some(r=>/gate is off/.test(r)));
  await h.control.query("update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','true') where id='c'");
  await resetChoices();
});
test("pending channel jobs terminally cancel on opt-out; reenable and recapture cannot replay; claimed work stays untouched",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  await h.control.query("delete from settings where (id like 'mail-outbox:%' or id like 'sms-outbox:%') and data->>'state'='pending'");
  const row=fictionalVisit("pending4","cancelled");await storeVisit(row);
  await h.db.transaction(tx=>api.enqueueEvent(tx,"cancelled",row));
  const pending=await h.control.query("select id,data from settings where (id like $1 or id like $2) and data->>'recipientGroup'='patient'",[`mail-outbox:cancelled:${row.id}:%`,`sms-outbox:cancelled:${row.id}:%`]);
  assert.equal(pending.rows.length,2);
  await h.control.query("insert into settings(id,data) values('mail-outbox:already-sending',$1)",[{...pending.rows.find(r=>r.id.startsWith("mail")).data,state:"sending"}]);
  await prefSave(patientActor,[{key:"email:cancelled",enabled:false},{key:"sms:cancelled",enabled:false}]);
  for(const job of pending.rows)assert.equal((await h.control.query("select data->>'state' state from settings where id=$1",[job.id])).rows[0].state,"disabled");
  assert.equal((await h.control.query("select data->>'state' state from settings where id='mail-outbox:already-sending'")).rows[0].state,"sending");
  await prefSave(patientActor,[{key:"email:cancelled",enabled:true},{key:"sms:cancelled",enabled:true}]);
  await h.db.transaction(tx=>api.enqueueEvent(tx,"cancelled",row));
  const contact=(await h.control.query("select email,mobile from users where id='pu'")).rows[0];
  let sends=0;await api.processNotifications(h.db,async(to)=>{if(to===contact.email)sends++;});
  await api.processSmsNotifications(h.db,async(_env,to)=>{if(to===api.notificationPhone(contact.mobile))sends++;return "provider_accepted";});
  assert.equal(sends,0);
  // Even restoring a cancelled job to pending cannot bypass the persistent epoch.
  const job=pending.rows.find(r=>r.id.startsWith("sms"));
  await h.control.query("update settings set data=$2 where id=$1",[job.id,job.data]);
  await api.processSmsNotifications(h.db,async(_env,to)=>{if(to===api.notificationPhone(contact.mobile))sends++;return "provider_accepted";});
  assert.equal(sends,0);
  assert.equal((await h.control.query("select data->>'state' state from settings where id=$1",[job.id])).rows[0].state,"disabled");
  await resetChoices();
});
test("scope policy batches are atomic, owner-only and narrow; preserve drafts and opt-outs",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  const ca=await api.managedNotificationSettings(ownerActor,"c",h.db);
  assert.equal(ca.canActivate,true);assert(ca.items.every(r=>!r.required&&r.recipient!=="superAdmin"));
  assert(ca.items.some(r=>r.channel==="sms"&&r.canActivate&&!r.canEdit));
  await assert.rejects(api.managedNotificationSettings(patientActor,"c",h.db),{status:403});
  await assert.rejects(api.managedNotificationSettings({...ownerActor,id:"du"},"c",h.db),{status:403});
  await assert.rejects(api.managedNotificationSettings(ownerActor,undefined,h.db),{status:403});
  await assert.rejects(api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:ca.revision,changes:[{channel:"email",event:"onboarding",recipient:"superAdmin",revision:0,enabled:false}]},h.db),{status:403});
  const before=await api.resolvedTemplate("cancelled","c",h.db,"patient","email");
  await api.saveTemplate(sa,{channel:"email",event:"cancelled",recipient:"patient",clinicId:"c",revision:before.local.revision,mode:"draft",content:{...before.content,subject:"Unpublished fictional draft"}});
  const control=await api.managedNotificationSettings(sa,"c",h.db);
  const row=control.items.find(r=>r.channel==="email"&&r.event==="cancelled"&&r.recipient==="patient");
  const change={channel:row.channel,event:row.event,recipient:row.recipient,revision:row.revision,enabled:false};
  const off=await api.saveManagedNotificationSettings(sa,{clinicId:"c",revision:control.revision,notificationsEnabled:false,changes:[change]},h.db);
  assert.equal(off.notificationsEnabled,false);
  const after=await api.resolvedTemplate("cancelled","c",h.db,"patient","email");
  assert.equal(after.local.draft.subject,"Unpublished fictional draft");
  assert.equal(after.content.enabled,false);
  await assert.rejects(api.saveManagedNotificationSettings(sa,{clinicId:"c",revision:control.revision,changes:[]},h.db),{status:409});
  await assert.rejects(api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:off.revision,notificationsEnabled:true,changes:[]},h.db),{status:400});
  const on=await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:off.revision,notificationsEnabled:true,confirmed:true,changes:[]},h.db);
  assert.equal(on.notificationsEnabled,true);
  // A failed row revision rolls back the gate edit as well.
  await assert.rejects(api.saveManagedNotificationSettings(sa,{clinicId:"c",revision:on.revision,notificationsEnabled:false,changes:[change]},h.db),{status:409});
  assert.equal((await api.getSettings(h.db,"c")).notificationsEnabled,true);
});
test("event activation batches roll back earlier rows on a late conflict and persist without changing gate or drafts",async()=>{
  const scope=()=>api.managedNotificationSettings(sa,"c",h.db);
  const initial=await scope();
  const rows=initial.items.filter(r=>r.event==="booking"&&r.channel==="email"&&!r.required);
  assert(rows.length>=2,"use multiple real event-recipient rows");
  const ordered=[...rows].sort((a,b)=>`${a.channel}:${a.event}:${a.recipient}`.localeCompare(`${b.channel}:${b.event}:${b.recipient}`));
  const first=ordered[0], last=ordered.at(-1);
  const before=await api.resolvedTemplate("booking","c",h.db,first.recipient,"email");
  const draftBody=`${before.content.body}\nUnpublished fictional group draft`;
  await api.saveTemplate(sa,{channel:"email",event:"booking",recipient:first.recipient,clinicId:"c",
    revision:before.local.revision,mode:"draft",content:{...before.content,body:draftBody}});
  const baseline=await scope();
  const changes=baseline.items.filter(r=>r.event==="booking"&&r.channel==="email"&&!r.required)
    .map(r=>({channel:r.channel,event:r.event,recipient:r.recipient,revision:r.revision,enabled:!r.enabled}));
  // A late sorted row fails after another row has already been written inside the transaction.
  await assert.rejects(api.saveManagedNotificationSettings(sa,{clinicId:"c",revision:baseline.revision,confirmed:true,
    changes:changes.map(c=>c.recipient===last.recipient?{...c,revision:c.revision+999}:c)},h.db),{status:409});
  const rolledBack=await scope();
  assert.equal(rolledBack.revision,baseline.revision);
  for(const row of baseline.items.filter(r=>r.event==="booking"&&r.channel==="email")){
    assert.deepEqual(rolledBack.items.find(r=>r.event===row.event&&r.channel===row.channel&&r.recipient===row.recipient),row);
  }
  const saved=await api.saveManagedNotificationSettings(sa,{clinicId:"c",revision:baseline.revision,confirmed:true,changes},h.db);
  assert.equal(saved.notificationsEnabled,baseline.notificationsEnabled);
  assert.equal(saved.inherited,baseline.inherited);
  const reloaded=await scope();
  for(const change of changes)assert.equal(reloaded.items.find(r=>r.channel===change.channel&&r.event===change.event&&r.recipient===change.recipient).enabled,change.enabled);
  assert.equal((await api.resolvedTemplate("booking","c",h.db,first.recipient,"email")).local.draft.body,draftBody);
});
test("canonical sections match System Default and two clinics without disclosing security content",async()=>{
  await h.control.query(`insert into clinics(id,admin_id,data) values('catalog-clinic','ca','{"name":"Fictional second clinic"}') on conflict do nothing`);
  const catalogs=await Promise.all([undefined,"c","catalog-clinic"].map(id=>api.managedNotificationSettings(sa,id,h.db)));
  const expected=api.templateEvents;
  for(const catalog of catalogs)assert.deepEqual(catalog.events.map(e=>e.id),expected);
  const before=catalogs.map(c=>[...new Set(c.items.map(r=>r.event))]);
  const omitted=expected.filter(e=>!before[1].includes(e));
  assert.deepEqual(omitted,expected.filter(api.requiredEvent));
  assert.deepEqual(before[1],before[2]);
  for(const id of ["c","catalog-clinic"]){
    const view=await api.managedNotificationSettings(ownerActor,id,h.db);
    assert.deepEqual(view.events.map(e=>e.id),expected);
    assert(view.events.filter(e=>!e.clinicApplicable).every(e=>e.explanation&&!JSON.stringify(e).includes("setup_link")));
    assert(view.items.every(r=>!r.required&&r.recipient!=="superAdmin"));
    assert(view.items.filter(r=>r.channel==="sms").every(r=>r.canActivate&&!r.canEdit));
  }
  console.info("Canonical event diagnosis:",JSON.stringify({before,after:catalogs.map(c=>c.events.map(e=>e.id)),additionalOmissions:[]}));
});
test("owned-clinic Email and SMS opt-outs survive fresh connections, preserve wording and never change other scopes",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  const before=await api.managedNotificationSettings(ownerActor,"c",h.db);
  const originalPlatform=await api.managedNotificationSettings(sa,undefined,h.db);
  const originalOther=await api.managedNotificationSettings(sa,"catalog-clinic",h.db);
  const targets=before.items.filter(r=>r.event==="cancelled"&&r.recipient==="patient");
  assert.equal(targets.length,2);
  const wording=await Promise.all(targets.map(r=>api.resolvedTemplate(r.event,"c",h.db,r.recipient,r.channel)));
  const changes=targets.map(r=>({channel:r.channel,event:r.event,recipient:r.recipient,revision:r.revision,enabled:false}));
  const off=await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:before.revision,confirmed:true,changes},h.db);
  assert.equal(off.notificationsEnabled,before.notificationsEnabled);
  const freshClient=await h.connect();
  try{
    const fresh=await api.managedNotificationSettings(ownerActor,"c",drizzle(freshClient));
    for(const target of targets)assert.equal(fresh.items.find(r=>r.channel===target.channel&&r.event===target.event&&r.recipient===target.recipient).enabled,false);
  }finally{await freshClient.end();}
  for(let i=0;i<targets.length;i++){
    const r=targets[i],after=await api.resolvedTemplate(r.event,"c",h.db,r.recipient,r.channel);
    assert.deepEqual({...after.content,enabled:true},{...wording[i].content,enabled:true});
    assert.deepEqual(after.local.draft,wording[i].local.draft);
  }
  assert.deepEqual((await api.managedNotificationSettings(sa,undefined,h.db)).items,originalPlatform.items);
  assert.deepEqual((await api.managedNotificationSettings(sa,"catalog-clinic",h.db)).items,originalOther.items);
  await assert.rejects(api.saveManagedNotificationSettings(ownerActor,{revision:off.revision,changes:[]},h.db),{status:403});
  await assert.rejects(api.saveManagedNotificationSettings({...ownerActor,id:"du"},{clinicId:"c",revision:off.revision,changes:[]},h.db),{status:403});
  for(const forbidden of [
    {channel:"email",event:"onboarding",recipient:"superAdmin"},
    {channel:"email",event:"clinic_registration_otp",recipient:"clinicAdmin"},
  ])await assert.rejects(api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:off.revision,confirmed:true,changes:[{...forbidden,revision:0,enabled:false}]},h.db));
  await assert.rejects(api.templateCatalog(ownerActor,"c","patient","sms",h.db),{status:403});
  await assert.rejects(api.templateCatalog(ownerActor,undefined,"patient","email",h.db),{status:403});
  const sms=await api.resolvedTemplate("cancelled","c",h.db,"patient","sms");
  await assert.rejects(api.saveTemplate(ownerActor,{clinicId:"c",channel:"sms",event:"cancelled",recipient:"patient",revision:sms.local.revision,mode:"draft",content:sms.content},h.db),{status:403});
  // Re-enabling the gate must not reset individual saved opt-outs.
  const gateOff=await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:off.revision,notificationsEnabled:false,changes:[]},h.db);
  const gateOn=await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:gateOff.revision,notificationsEnabled:true,confirmed:true,changes:[]},h.db);
  assert(gateOn.items.filter(r=>r.event==="cancelled"&&r.recipient==="patient").every(r=>!r.enabled));
  await h.control.query("update clinics set admin_id='du' where id='catalog-clinic'");
  await assert.rejects(api.saveManagedNotificationSettings(ownerActor,{clinicId:"catalog-clinic",revision:originalOther.revision,changes:[],notificationsEnabled:false},h.db),{status:403});
  await h.control.query("update clinics set admin_id='ca' where id='catalog-clinic'");
});
test("Clinic Admin gate terminally cancels both channels, never replays old work, and HTTP opt-outs survive server restart",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  await h.control.query("create table if not exists auth_rate_limits(key text primary key,attempts int not null default 0,expires_at timestamptz not null)");
  const visit=fictionalVisit("clinic-gate-restart","cancelled");await storeVisit(visit);
  await h.db.transaction(tx=>api.enqueueEvent(tx,"cancelled",visit));
  const jobs=await h.control.query("select id,data from settings where (id like $1 or id like $2) and data->>'recipientGroup'='patient'",[
    `mail-outbox:cancelled:${visit.id}:%`,`sms-outbox:cancelled:${visit.id}:%`,
  ]);
  assert.equal(jobs.rows.length,2);
  let baseline=await api.managedNotificationSettings(ownerActor,"c",h.db);
  baseline=await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:baseline.revision,notificationsEnabled:false,changes:[]},h.db);
  for(const job of jobs.rows)assert.equal((await h.control.query("select data->>'state' state from settings where id=$1",[job.id])).rows[0].state,"disabled");
  await api.saveManagedNotificationSettings(ownerActor,{clinicId:"c",revision:baseline.revision,notificationsEnabled:true,confirmed:true,changes:[]},h.db);
  await h.db.transaction(tx=>api.enqueueEvent(tx,"cancelled",visit));
  for(const job of jobs.rows)assert.equal((await h.control.query("select data->>'state' state from settings where id=$1",[job.id])).rows[0].state,"disabled");
  assert.equal((await api.resolvedTemplate("patient_login_otp",undefined,h.db,"patient","sms")).content.enabled,true);
  const start=async()=>{
    const server=api.app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
    return {server,origin:`http://127.0.0.1:${server.address().port}`};
  };
  let running=await start();
  const request=(path,body)=>fetch(`${running.origin}${path}`,{
    method:body?"PUT":"GET",headers:{"x-user":"ca","content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),
  });
  try{
    let response=await request("/management/notification-settings?clinicId=c");
    assert.equal(response.status,200);const view=await response.json();
    assert.equal(view.events.length,api.templateEvents.length);
    const row=view.items.find(r=>r.channel==="sms"&&r.event==="cancelled"&&r.recipient==="patient");
    response=await request("/management/notification-settings",{clinicId:"c",revision:view.revision,confirmed:true,
      changes:[{channel:row.channel,event:row.event,recipient:row.recipient,revision:row.revision,enabled:false}]});
    assert.equal(response.status,200);
    await new Promise(r=>running.server.close(r));running=await start();
    const restarted=await (await request("/management/notification-settings?clinicId=c")).json();
    assert.equal(restarted.items.find(r=>r.channel===row.channel&&r.event===row.event&&r.recipient===row.recipient).enabled,false);
    assert.equal((await request("/management/notification-settings",{revision:restarted.revision,changes:[]})).status,403);
    assert.equal((await request("/management/notification-settings",{clinicId:"c",revision:restarted.revision,changes:[
      {channel:"email",event:"onboarding",recipient:"superAdmin",revision:0,enabled:false},
    ]})).status,403);
    assert.equal((await request("/management/notification-settings",{clinicId:"c",revision:restarted.revision,changes:[
      {channel:"sms",event:"patient_login_otp",recipient:"patient",revision:0,enabled:false},
    ]})).status,403);
    assert.equal((await request("/management/templates?clinicId=c&channel=sms&recipient=patient")).status,403);
  }finally{await new Promise(r=>running.server.close(r));}
});
test("in-app choices hide feed and unread candidates without deleting history or changing read markers",async()=>{
  await resetChoices();
  await h.control.query("create table if not exists notification_reads(user_id text,notification_id text,primary key(user_id,notification_id))");
  const row=fictionalVisit("inbox5");await storeVisit(row);
  await h.control.query("insert into appointment_history(id,appointment_id,from_status,to_status) values('pref-booking-history',$1,null,'booked'),('pref-queue-history',$1,'booked','waiting')",[row.id]);
  const initial=await api.listNotificationsFor(patientActor);
  assert(initial.some(n=>n.id==="h:pref-booking-history"));assert(initial.some(n=>n.id==="h:pref-queue-history"));
  await h.control.query("insert into notification_reads values('pu','h:pref-booking-history')");
  await prefSave(patientActor,[{key:"inApp:appointments",enabled:false}]);
  const hidden=await api.listNotificationsFor(patientActor);
  assert(!hidden.some(n=>n.kind==="appointments"));assert(hidden.some(n=>n.kind==="queue"));
  await prefSave(patientActor,[{key:"inApp:appointments",enabled:null}]);
  const shown=await api.listNotificationsFor(patientActor);
  assert.equal(shown.find(n=>n.id==="h:pref-booking-history").read,true);
  assert.equal(shown.find(n=>n.id==="h:pref-queue-history").read,false);
  assert.equal((await h.control.query("select count(*)::int n from appointment_history where id like 'pref-%'")).rows[0].n,2);
  await resetChoices();
});
async function observedBarrier(blocker, contender, work){
  await blocker.query("begin");await blocker.query("select pg_advisory_xact_lock(hashtext('notification-preference-barrier'))");
  const waiting=work();
  let observed=false;
  for(let i=0;i<100;i++){
    const result=await blocker.query("select wait_event_type from pg_stat_activity where pid=$1",[contender.processID]);
    if(result.rows[0]?.wait_event_type==="Lock"){observed=true;break;}
    await new Promise(r=>setTimeout(r,10));
  }
  assert(observed,"independent PostgreSQL backend must actually wait for the preference barrier");
  return {waiting,release:()=>blocker.query("commit")};
}
test("multi-connection PostgreSQL opt-out serializes capture and dispatch and cannot be undone by reenable",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  await h.control.query("delete from settings where (id like 'mail-outbox:%' or id like 'sms-outbox:%') and data->>'state'='pending'");
  const blocker=await h.connect(),captureClient=await h.connect(),writerClient=await h.connect();
  assert.notEqual(blocker.processID,captureClient.processID);assert.notEqual(captureClient.processID,writerClient.processID);
  const captureDb=drizzle(captureClient),writerDb=drizzle(writerClient);
  const row=fictionalVisit("race6","cancelled");await storeVisit(row);
  const barrier=await observedBarrier(blocker,captureClient,()=>context.run(captureDb,()=>captureDb.transaction(tx=>api.enqueueEvent(tx,"cancelled",row))));
  await barrier.release();await barrier.waiting;
  const pending=(await h.control.query("select data from settings where id like $1 and data->>'recipientGroup'='patient'",[`sms-outbox:cancelled:${row.id}:%`])).rows;
  assert.equal(pending.length,1);
  // Hold opt-out open after it has taken the same barrier. The dispatch backend
  // must wait, then see the committed disable instead of claiming stale work.
  let releaseWriter,writerReady;
  const ready=new Promise(r=>writerReady=r),release=new Promise(r=>releaseWriter=r);
  const writing=context.run(writerDb,()=>writerDb.transaction(async tx=>{
    await api.lockNotificationPreferences(tx);
    await api.savePersonalNotificationSettings(patientActor,{revision:0,choices:[{key:"sms:cancelled",enabled:false}]},tx);
    writerReady();await release;
  }));
  await ready;
  let sends=0;
  const contact=(await h.control.query("select mobile from users where id='pu'")).rows[0];
  const dispatching=context.run(captureDb,()=>api.processSmsNotifications(captureDb,async(_env,to)=>{if(to===api.notificationPhone(contact.mobile))sends++;return "provider_accepted";}));
  let waited=false;
  for(let i=0;i<100;i++){
    const result=await blocker.query("select wait_event_type from pg_stat_activity where pid=$1",[captureClient.processID]);
    if(result.rows[0]?.wait_event_type==="Lock"){waited=true;break;}
    await new Promise(r=>setTimeout(r,10));
  }
  assert(waited,"dispatch waited on the open opt-out transaction");
  releaseWriter();await writing;await dispatching;assert.equal(sends,0);
  await prefSave(patientActor,[{key:"sms:cancelled",enabled:true}]);
  await api.processSmsNotifications(h.db,async(_env,to)=>{if(to===api.notificationPhone(contact.mobile))sends++;return "provider_accepted";});
  assert.equal(sends,0);
  await resetChoices();
});
test("opt-out commits before a blocked capture; the skipped occurrence is never captured after reenable",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  const writerClient=await h.connect(),captureClient=await h.connect(),observer=await h.connect();
  const writerDb=drizzle(writerClient),captureDb=drizzle(captureClient);
  const row=fictionalVisit("before7","cancelled");await storeVisit(row);
  let readyWriter,releaseWriter;
  const ready=new Promise(r=>readyWriter=r),release=new Promise(r=>releaseWriter=r);
  const writing=context.run(writerDb,()=>writerDb.transaction(async tx=>{
    await api.savePersonalNotificationSettings(patientActor,{revision:0,choices:[{key:"sms:cancelled",enabled:false}]},tx);
    readyWriter();await release;
  }));
  await ready;
  const capturing=context.run(captureDb,()=>captureDb.transaction(tx=>api.enqueueSmsEvent(tx,"cancelled",row)));
  let waited=false;
  for(let i=0;i<100;i++){
    const result=await observer.query("select wait_event_type from pg_stat_activity where pid=$1",[captureClient.processID]);
    if(result.rows[0]?.wait_event_type==="Lock"){waited=true;break;}
    await new Promise(r=>setTimeout(r,10));
  }
  releaseWriter();await writing;await capturing;
  assert(waited,"capture actually waited for the opt-out transaction");
  const query="select count(*)::int n from settings where id like $1 and data->>'recipientGroup'='patient'";
  assert.equal((await h.control.query(query,[`sms-outbox:cancelled:${row.id}:%`])).rows[0].n,0);
  await prefSave(patientActor,[{key:"sms:cancelled",enabled:true}]);
  await h.db.transaction(tx=>api.enqueueSmsEvent(tx,"cancelled",row));
  assert.equal((await h.control.query(query,[`sms-outbox:cancelled:${row.id}:%`])).rows[0].n,0);
  await resetChoices();
});
test("a captured pending patient confirmation stays cancelled after personal disable and reenable",async()=>{
  await resetChoices();await publishPreferenceTemplates();
  const row=fictionalVisit("pending-confirmation8");await storeVisit(row);
  await h.db.transaction(tx=>api.capturePatientConfirmation(tx,row));
  assert.equal((await h.control.query("select data->>'status' status from settings where id=$1",[api.historyId(`patient-booking:${row.id}`)])).rows[0].status,"pending");
  await prefSave(patientActor,[{key:"email:booking",enabled:false}]);
  assert.equal((await h.control.query("select data->>'status' status from settings where id=$1",[api.historyId(`patient-booking:${row.id}`)])).rows[0].status,"disabled");
  await prefSave(patientActor,[{key:"email:booking",enabled:true}]);
  let sends=0;assert.equal(await api.confirmAppointmentEmail(row.id,h.db,async()=>sends++),"disabled");assert.equal(sends,0);
  await resetChoices();
});
test("personal HTTP owner is authentication-derived; extra identity targets are rejected and other users remain unchanged",async()=>{
  await resetChoices();
  await h.control.query("create table if not exists auth_rate_limits(key text primary key,attempts int not null default 0,expires_at timestamptz not null)");
  const server=api.app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const response=await fetch(`${origin}/me/notification-settings`,{headers:{"x-user":"pu"}});
    assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
    const data=await response.json();assert.equal(data.revision,0);assert.equal(data.canManage,false);
    const targeted=await fetch(`${origin}/me/notification-settings`,{method:"PUT",headers:{"x-user":"pu","content-type":"application/json"},body:JSON.stringify({revision:0,userId:"ca",choices:[{key:"email:booking",enabled:false}]})});
    assert.equal(targeted.status,400);
    const saved=await fetch(`${origin}/me/notification-settings`,{method:"PUT",headers:{"x-user":"pu","content-type":"application/json"},body:JSON.stringify({revision:0,choices:[{key:"email:booking",enabled:false},{key:"sms:booking",enabled:true}]})});
    assert.equal(saved.status,200);assert.equal((await api.personalPreferences("ca",h.db)).revision,0);
    assert.equal((await api.personalPreferences("pu",h.db)).choices["email:booking"],false);
    const managed=await fetch(`${origin}/management/notification-settings?clinicId=c`,{headers:{"x-user":"pu"}});
    assert.equal(managed.status,403);
  }finally{await new Promise(r=>server.close(r));await resetChoices();}
});
test("missing encryption never falls back to plaintext and still records explicit incomplete dispatch metadata",async()=>{
  const old=process.env.INTEGRATIONS_ENCRYPTION_KEY;
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  try{
    await api.recordNotification(h.db,"no-encryption",{channel:"email",event:"provider_test",recipientGroup:"explicit",source:"test"},"sending",{recipient:"never-plaintext@example.invalid",message:"private rendered fixture"});
    const item=await api.getNotificationLog(sa,api.historyId("no-encryption"),h.db);
    assert(item.detailsUnavailable);assert.equal(item.recipient,null);assert.equal(item.message,null);assert(item.dispatchAt);
    const raw=(await h.control.query("select data from settings where id=$1",[item.id])).rows[0].data;
    assert(!JSON.stringify(raw).includes("never-plaintext"));assert(!JSON.stringify(raw).includes("private rendered"));
  }finally{process.env.INTEGRATIONS_ENCRYPTION_KEY=old;}
});
test("every platform security target persists on/off/on, preserves drafts and suppresses direct dispatch without operational gates",async()=>{
  const targets=(await api.managedNotificationSettings(sa,undefined,h.db)).items.filter(r=>r.required);
  assert(targets.length>15);
  const historyBefore=(await h.control.query("select count(*)::int n from settings where id like 'notification-history:%'")).rows[0].n;
  let sends=0;
  const emailSend=async()=>{sends++;};
  const smsSend=async()=>{sends++;return "provider_accepted";};
  const values={otp:"456789",expiry_minutes:"10",setup_link:"https://example.invalid/set-password?token=fictional-only",recipient_name:"Fixture",role_name:"staff"};
  const send=async row=>row.event==="patient_login_otp"
    ? api.sendPatientLoginSms("+919876543213",values.otp,600,h.db,smsSend)
    : row.channel==="email"
      ? api.securityEmail(row.event,row.recipient,"fixture@example.invalid",values,emailSend,h.db)
      : api.securitySms(row.event,row.recipient,"+919876543213",values,smsSend,h.db);
  for(const target of targets) {
    let current=await api.resolvedTemplate(target.event,undefined,h.db,target.recipient,target.channel);
    // Explicit fictional publication; never approve defaults via an activation edit.
    const content={...current.content,enabled:false,...(target.channel==="sms"?{senderId:"DIGIQ",dltEntityId:"FIXTURE_ENTITY",dltTemplateId:"FIXTURE_TEMPLATE"}:{})};
    await api.saveTemplate(sa,{channel:target.channel,event:target.event,recipient:target.recipient,
      revision:current.local.revision,mode:"publish",content},h.db);
    current=await api.resolvedTemplate(target.event,undefined,h.db,target.recipient,target.channel);
    await api.saveTemplate(sa,{channel:target.channel,event:target.event,recipient:target.recipient,
      revision:current.local.revision,mode:"draft",content:{...content,body:content.body+"\nFictional unpublished draft"}},h.db);
    let policy=await api.managedNotificationSettings(sa,undefined,h.db);
    let row=policy.items.find(r=>r.channel===target.channel&&r.event===target.event&&r.recipient===target.recipient);
    assert(row.canActivate);
    const change=enabled=>({channel:row.channel,event:row.event,recipient:row.recipient,revision:row.revision,enabled});
    const stale=policy;
    policy=await api.saveManagedNotificationSettings(sa,{revision:policy.revision,confirmed:true,changes:[change(true)]},h.db);
    assert.equal(policy.notificationsEnabled,stale.notificationsEnabled);
    await assert.rejects(api.saveManagedNotificationSettings(sa,{revision:stale.revision,changes:[]},h.db),{status:409});
    assert.equal((await api.resolvedTemplate(target.event,undefined,h.db,target.recipient,target.channel)).local.draft.body,content.body+"\nFictional unpublished draft");
    const before=sends;
    await send(row);assert.equal(sends,before+1);
    row=policy.items.find(r=>r.channel===target.channel&&r.event===target.event&&r.recipient===target.recipient);
    policy=await api.saveManagedNotificationSettings(sa,{revision:policy.revision,changes:[change(false)]},h.db);
    row=policy.items.find(r=>r.channel===target.channel&&r.event===target.event&&r.recipient===target.recipient);
    assert.equal(row.enabled,false);
    if(row.event==="patient_login_otp")await assert.rejects(send(row),{code:"SECURITY_DELIVERY_DISABLED"});
    else assert.equal((await send(row)).status,"disabled");
    assert.equal(sends,before+1);
    await assert.rejects(api.changeActivation({id:"ca",role:"clinicAdmin"},{...change(true),clinicId:"c"},h.db),{status:403});
    await assert.rejects(api.changeActivation(sa,{...change(true),clinicId:"c"},h.db),{status:400});
    await api.saveManagedNotificationSettings(sa,{revision:policy.revision,confirmed:true,changes:[change(true)]},h.db);
    assert.equal(sends,before+1,"reactivation never dispatches or replays old actions");
    await send(row);assert.equal(sends,before+2);
  }
  assert.equal((await h.control.query("select count(*)::int n from settings where id like 'notification-history:%'")).rows[0].n,historyBefore);
});
test("activation-only security SMS edits do not approve unpublished default wording",async()=>{
  const event="registration_mobile_otp",recipient="patient",channel="sms";
  const id=api.notificationTemplateKey(event,undefined,recipient,channel);
  const saved=(await h.control.query("select data from settings where id=$1",[id])).rows[0].data;
  try {
    await h.control.query("delete from settings where id=$1",[id]);
    await api.changeActivation(sa,{event,recipient,channel,revision:0,enabled:false},h.db);
    const off=await api.resolvedTemplate(event,undefined,h.db,recipient,channel);
    assert.equal(off.content.enabled,false);assert.equal(off.wordingPublished,false);
    await assert.rejects(api.changeActivation(sa,{event,recipient,channel,revision:off.local.revision,enabled:true},h.db),{status:400});
    const view=await api.managedNotificationSettings(sa,undefined,h.db);
    assert(view.items.find(r=>r.event===event&&r.recipient===recipient).blockedReasons.some(r=>/approved security SMS wording/.test(r)));
  } finally {
    await h.control.query("update settings set data=$2::jsonb where id=$1",[id,JSON.stringify(saved)]);
  }
});
test("resetting every security target preserves off delivery independently of wording approval and drafts",async()=>{
  const targets=(await api.managedNotificationSettings(sa,undefined,h.db)).items.filter(r=>r.required);
  const values={otp:"456789",expiry_minutes:"10",setup_link:"https://example.invalid/fictional",recipient_name:"Fixture",role_name:"staff"};
  for(const row of targets) {
    const target={channel:row.channel,event:row.event,recipient:row.recipient};
    await api.changeActivation(sa,{...target,revision:row.revision,enabled:false},h.db);
    let current=await api.resolvedTemplate(row.event,undefined,h.db,row.recipient,row.channel);
    await api.saveTemplate(sa,{...target,revision:current.local.revision,mode:"reset"},h.db);
    current=await api.resolvedTemplate(row.event,undefined,h.db,row.recipient,row.channel);
    assert.equal(current.content.enabled,false,`${row.event}/${row.channel}/${row.recipient}`);
    assert.equal(current.source,"default");assert.equal(current.wordingPublished,false);
    assert.equal(current.local.draft,undefined);
    if(row.event==="patient_login_otp")
      await assert.rejects(api.sendPatientLoginSms("+919876543213",values.otp,600,h.db,()=>assert.fail("disabled SMS dispatch")),{code:"SECURITY_DELIVERY_DISABLED"});
    else if(row.channel==="email")
      assert.equal((await api.securityEmail(row.event,row.recipient,"fixture@example.invalid",values,()=>assert.fail("disabled email dispatch"),h.db)).status,"disabled");
    else
      assert.equal((await api.securitySms(row.event,row.recipient,"+919876543213",values,()=>assert.fail("disabled SMS dispatch"),h.db)).status,"disabled");
    // Saving a new draft must also retain the independently saved off state.
    await api.saveTemplate(sa,{...target,revision:current.local.revision,mode:"draft",content:{...current.content,body:current.content.body+"\nFictional draft"}},h.db);
    current=await api.resolvedTemplate(row.event,undefined,h.db,row.recipient,row.channel);
    assert.equal(current.content.enabled,false);
    if(row.channel==="email") {
      await api.changeActivation(sa,{...target,revision:current.local.revision,enabled:true},h.db);
      assert.equal((await api.securityEmail(row.event,row.recipient,"fixture@example.invalid",values,async()=>{},h.db)).status,"provider_accepted");
    } else if(row.event!=="patient_login_otp") {
      await assert.rejects(api.changeActivation(sa,{...target,revision:current.local.revision,enabled:true},h.db),{status:400});
    }
  }
});
