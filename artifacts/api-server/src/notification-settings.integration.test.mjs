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
const bundle=resolve(import.meta.dirname,`.notification-settings-${process.pid}.mjs`);
const mapping={encoding:"json",authMode:"header",authField:"X-API-Key",fields:{recipient:"to",message:"message",senderId:"sender",dltEntityId:"entity",dltTemplateId:"template"},staticFields:{route:"transactional"},acceptedStatuses:[200,202],responseField:"result.status",responseValue:"accepted",dltRequired:true};
const env={NOTIFICATION_SMS_URL:"https://sms.example.invalid/send",NOTIFICATION_SMS_KEY:"synthetic-notification-key",NOTIFICATION_SMS_MAPPING:JSON.stringify(mapping)};
Object.assign(process.env,env,{NODE_ENV:"test",INTEGRATIONS_ENCRYPTION_KEY:"cd".repeat(32),SMTP_HOST:"smtp.example.invalid",SMTP_PORT:"587",SMTP_USER:"fixture-user",SMTP_PASSWORD:"fixture-pass",SMTP_FROM:"sender@example.invalid"});
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
    import {notificationTemplatesRouter} from "./routes/notification-templates";
    import {integrationsRouter} from "./routes/integrations";
    import express from "express";
    export const app=express();app.use(express.json());
    app.use((req,res,next)=>{req.authUserId=req.headers["x-user"];req.authSessionHash="fixture";next();});
    app.use(notificationTemplatesRouter);app.use(integrationsRouter);
    app.use((err,req,res,next)=>res.status(err.status||400).json({error:"Sanitized",code:err.code}));`,
    resolveDir:import.meta.dirname,loader:"ts"},outfile:bundle,bundle:true,platform:"node",format:"esm",packages:"external",
    plugins:[{name:"isolated",setup(b){
      b.onResolve({filter:/^@workspace\/db$/},()=>({path:"db",namespace:"fixture"}));
      b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:`export * from "${resolve(import.meta.dirname,"../../../lib/db/src/schema/core.ts")}";export const db=globalThis.notificationSettingsDb;`,loader:"ts",resolveDir:import.meta.dirname}));
      b.onResolve({filter:/^@workspace\/api-zod$/},()=>({path:resolve(import.meta.dirname,"../../../lib/api-zod/src/index.ts")}));
      // Authentication is an injected fixture at the router boundary; the real guards still run.
      b.onResolve({filter:/\/auth$/},args=>args.importer.includes("/routes/")?{path:"auth",namespace:"fixture-auth"}:undefined);
      b.onLoad({filter:/.*/,namespace:"fixture-auth"},()=>({contents:`export async function requireUser(req){return {id:req.headers["x-user"],role:req.headers["x-user"]||"patient",clinicIds:["c"]};} export function roles(u,rs){if(!rs.includes(u.role))throw Object.assign(new Error("Forbidden"),{status:403});}`}));
    }}]});
  api=await import(bundle);
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
    else assert.equal(req.headers[authMode==="bearer"?"Authorization":"X-API-Key"],authMode==="bearer"?`Bearer ${env.NOTIFICATION_SMS_KEY}`:env.NOTIFICATION_SMS_KEY);
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
test("SMS defaults off, valid recipients, DLT activation, draft isolation and published policy synchronization",async()=>{
  assert.equal((await api.templateCatalog(sa,undefined,"patient","sms")).items.length,5);
  assert.equal((await api.templateCatalog(sa,undefined,"clinicAdmin","sms")).items.length,6);
  assert((await api.templateCatalog(sa,undefined,"patient","sms")).items.every(i=>!i.content.enabled));
  await assert.rejects(api.templateCatalog({role:"clinicAdmin",id:"ca"},"c","patient","sms"),{status:403});
  await assert.rejects(api.saveTemplate(sa,{channel:"sms",event:"onboarding",recipient:"patient",revision:0,mode:"publish",content:smsContent()}),{status:400});
  await assert.rejects(api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:0,mode:"publish",content:{...smsContent(),enabled:true,senderId:""}}),{status:400});
  await api.saveTemplate(sa,{channel:"sms",event:"booking",recipient:"patient",revision:0,mode:"draft",content:{...smsContent(),enabled:true}});
  assert(!(await api.resolvedTemplate("booking","c",h.db,"patient","sms")).content.enabled);
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
  assert(!(await api.resolvedTemplate("completed",undefined,h.db,"patient","sms")).content.enabled);
  const persisted=await h.control.query("select data from settings where id like 'notification-test:%'");
  assert(!JSON.stringify(persisted.rows).includes("Synthetic"));assert(!JSON.stringify(persisted.rows).includes("+919876543213"));
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
    if(event==="onboarding"&&group!=="clinicAdmin")continue;
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
  const row=await api.one(api.appointments,"eligible-completed",h.db);
  await h.control.query("delete from settings where id like 'sms-outbox:completed:eligible-completed:%'");
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
        ["/management/event-controls","PUT",{}],
      ]){
        const response=await fetch(origin+path,{method,headers:{"x-user":role,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
        assert.equal(response.status,403,`${role} ${method} ${path}`);
      }
    }
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
