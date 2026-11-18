import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";
import { ownerSetup, OWNER_PASSWORD } from "./test-support/owner-booking-harness.mjs";

let h;
const mobile = "+919876543210";
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.data)); return r.data; };
const query = async (text, args = []) => (await h.pg.query(text, args)).rows;
const call = (actor, path, body, cookie) => h.call(actor, "POST", path, body, cookie ? {cookie} : {});
const otp = () => h.sms.messages.at(-1)?.text.match(/\b\d{6}\b/)?.[0];
const cookie = response => response.headers.getSetCookie().find(v => v.startsWith("digiq_owner_mobile="))?.split(";")[0];
async function template(event, recipient, options = {}) {
  const content = { enabled: true, subject: "Digi-Q", body: event.endsWith("_otp")
    ? "Digi-Q code {{otp}} expires in {{expiry_minutes}} minutes."
    : "Digi-Q {{recipient_name}} welcome to {{clinic_name}}.",
    prefix: "", footer: "", logoUrl: "", senderId: "TESTDQ", dltEntityId: "", dltTemplateId: "fictional-only", ...options };
  const suffix = recipient === "clinicAdmin" && event === "onboarding" || recipient === "patient" && ["registration_mobile_otp","patient_login_otp"].includes(event) || recipient === "receptionist" && event === "staff_mobile_otp" ? "" : `:${recipient}`;
  await h.pg.query("insert into settings(id,data) values($1,$2) on conflict(id) do update set data=excluded.data",
    [`sms-template:platform:${event}${suffix}`, {revision:1, publishedRevision:1, published:content}]);
}
async function begin(flow = "public", number = mobile, actor = flow === "admin" ? "sa" : null, binding) {
  const response = await call(actor, "/auth/owner-mobile/start", {flow, mobile:number}, binding);
  ok(response);
  return {flow, mobile:number, actor, binding:binding || cookie(response), id:response.data.challengeId, code:otp(), status:response.data.sms.status};
}
const confirm = (p, code = p.code, actor = p.actor) => call(actor, "/auth/owner-mobile/verify", {flow:p.flow, challengeId:p.id, code}, p.binding);
async function proof(flow = "public", number = mobile) { const p = await begin(flow, number); ok(await confirm(p)); return p; }
const adminBody = (p, tag = randomUUID()) => ({...ownerSetup(`proof-${tag}`, false), mobileProofId:p.id,
  admin:{fullName:"Fictional Mobile Owner", email:`${tag}@test.invalid`, mobile:p.mobile, password:OWNER_PASSWORD, confirmPassword:OWNER_PASSWORD}});
before(async () => {
  Object.assign(process.env, { NODE_ENV:"test", SESSION_SECRET:"fictional-owner-proof-secret-over-32-bytes",
    CLINICFLOW_PUBLIC_ORIGIN:"https://fictional.test.invalid", SMTP_HOST:"mail.test.invalid", SMTP_PORT:"587",
    SMTP_USER:"fictional", SMTP_PASSWORD:"fictional", SMTP_FROM:"fictional@test.invalid", SMTP_REQUIRE_TLS:"true",
    NOTIFICATION_SMS_PROVIDER:"keepInTouch", NOTIFICATION_SMS_KEY:"fictional", NOTIFICATION_SMS_BEARER_TOKEN:"fictional",
    NOTIFICATION_SMS_CLIENT_ID:"fictional", NOTIFICATION_SMS_SENDER_ID:"TESTDQ", NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus", NOTIFICATION_SMS_ENABLED:"true" });
  h = await createFeatureHarness({administration:true, simulatedMail:true, staffAccounts:true, registration:true, notificationSettings:true, postgres:true});
  await seedFeatureFixtures(h.pg);
  await template("registration_mobile_otp","clinicAdmin");
  await template("staff_mobile_otp","superAdmin");
  await template("onboarding","clinicAdmin");
  await template("onboarding","superAdmin");
});
beforeEach(async () => { await h.pg.query("delete from auth_rate_limits"); h.sms.outcome="provider_accepted"; });
after(async () => { await h?.close(); });

test("account API rejects India short, long, trunk-prefixed and landline numbers and non-India landlines", async () => {
  const count = h.sms.messages.length;
  for (const number of ["+91987654321","+9198765432101","+9109876543210","+915876543210","+912212345678","+441212345678","9876543210"]) {
    assert.equal((await call(null,"/auth/owner-mobile/start",{flow:"public",mobile:number})).status,400,number);
  }
  assert.equal(h.sms.messages.length,count);
  const p = await proof("public","+447911123456");
  assert.equal(p.status,"provider_accepted");
});

test("public mobile proof never authenticates; email remains required and exact proof is saved before clinic capture", async () => {
  const p = await begin();
  assert.equal((await query("select id from users where email='mobile-public@test.invalid'")).length,0);
  assert.equal((await confirm({...p,binding:"digiq_owner_mobile="+"x".repeat(43)})).status,400);
  ok(await confirm(p));
  assert.equal((await confirm(p)).status,400);
  const body={email:"mobile-public@test.invalid", fullName:"Fictional Public Owner", password:OWNER_PASSWORD, mobile, mobileProofId:p.id};
  assert.equal((await call(null,"/auth/register/start",{...body,mobile:"+919876543211"},p.binding)).status,400);
  assert.equal((await call(null,"/auth/register/start",{...body,mobileProofId:"missing"},p.binding)).status,400);
  const start=await call(null,"/auth/register/start",body,p.binding);
  ok(start);
  assert.equal((await query("select id from users where email=$1",[body.email])).length,0);
  const code=h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0];
  const verified=await call(null,"/auth/register/verify",{challengeId:start.data.challengeId,code});
  ok(verified);
  const account=(await query("select * from users where email=$1",[body.email]))[0];
  assert.equal(account.mobile,mobile);
  assert.equal(account.data.staffMobileProof.contact,mobile);
  assert.ok(account.email_verified_at);
  const setup={...ownerSetup("mobile-public",false),fullName:body.fullName,password:OWNER_PASSWORD};
  ok(await call(account.id,"/clinic-registration",setup),201);
  const rows=await query("select data from settings where id like 'sms-outbox:onboarding:%' and data->>'recipientUserId'=$1",[account.id]);
  assert.equal(rows.length,1,"proof was eligible during capture");
  await h.pg.query("delete from auth_rate_limits");
  assert.equal((await call(null,"/auth/register/start",body,p.binding)).status,409);
  assert.equal((await call(null,"/auth/register/verify",{challengeId:start.data.challengeId,code})).status,400);
});

test("disabled, unpublished, rejected and unknown SMS outcomes cannot verify or start registration", async () => {
  const mails=h.mail.messages.length;
  for(const state of ["disabled","unpublished","missing","provider_rejected","delivery_unknown"]) {
    await h.pg.query("delete from auth_rate_limits");
    await template("registration_mobile_otp","clinicAdmin",{enabled:state!=="disabled"});
    if(state==="unpublished") await h.pg.query("update settings set data=data-'published' where id='sms-template:platform:registration_mobile_otp:clinicAdmin'");
    if(state==="missing") await h.pg.query("delete from settings where id='sms-template:platform:registration_mobile_otp:clinicAdmin'");
    h.sms.outcome=["provider_rejected","delivery_unknown"].includes(state)?state:"provider_accepted";
    const p=await begin();
    assert.notEqual(p.status,"provider_accepted",state);
    assert.equal((await confirm(p,"123456")).status,400);
    assert.equal((await call(null,"/auth/register/start",{fullName:"Fictional Blocked",email:"blocked-mobile@test.invalid",password:OWNER_PASSWORD,mobile,mobileProofId:p.id},p.binding)).status,400);
  }
  assert.equal(h.mail.messages.length,mails);
  assert.equal((await query("select id from users where email='blocked-mobile@test.invalid'")).length,0);
  await template("registration_mobile_otp","clinicAdmin");
});

test("wrong guesses, expiry, resend and racing requests cannot reuse codes", async () => {
  const p=await begin();
  for(let i=0;i<5;i++) assert.equal((await confirm(p,p.code==="123456"?"654321":"123456")).status,400);
  assert.equal((await confirm(p)).status,400);
  await h.pg.query("delete from auth_rate_limits");
  const q=await begin();
  await h.pg.query("update auth_challenges set expires_at=now()-interval '1 second' where id=$1",[q.id]);
  assert.equal((await confirm(q)).status,400);
  await h.pg.query("delete from auth_rate_limits");
  const a=await begin();
  await h.pg.query("delete from auth_rate_limits");
  const b=await begin("public",mobile,null,a.binding);
  assert.equal((await confirm(a)).status,400);
  ok(await confirm(b));
  await h.pg.query("delete from auth_rate_limits");
  const sent=h.sms.messages.length;
  const results=await Promise.all([1,2].map(()=>call("sa","/auth/owner-mobile/start",{flow:"admin",mobile})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,429]);
  assert.equal(h.sms.messages.length,sent+1);
});

test("number changes retire only the bound attempt and concurrent code confirmation has one winner",async()=>{
  const p=await begin();
  ok(await call(null,"/auth/owner-mobile/invalidate",{flow:"public",challengeId:p.id},"digiq_owner_mobile="+"x".repeat(43)));
  const results=await Promise.all([confirm(p),confirm(p)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  ok(await call(null,"/auth/owner-mobile/invalidate",{flow:"public",challengeId:p.id},p.binding));
  assert.equal((await call(null,"/auth/register/start",{fullName:"Fictional Changed",email:"changed-mobile@test.invalid",password:OWNER_PASSWORD,mobile,mobileProofId:p.id},p.binding)).status,400);
  await h.pg.query("delete from auth_rate_limits");
  const pending=await begin();
  ok(await call(null,"/auth/owner-mobile/invalidate",{flow:"public",challengeId:pending.id},pending.binding));
  assert.equal((await confirm(pending)).status,400);
});

test("correcting required email retains exact phone proof in the same cookie-bound intent, never an existing identity",async()=>{
  const p=await proof();
  const payload={fullName:"Fictional Correction",email:"first-mobile-email@test.invalid",password:OWNER_PASSWORD,mobile,mobileProofId:p.id};
  const first=ok(await call(null,"/auth/register/start",payload,p.binding));
  const firstCode=h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0];
  const phoneCount=h.sms.messages.length;
  const binding=`${p.binding}; digiq_registration=${first.challengeId}`;
  const mailCount=h.mail.messages.length;
  assert.equal(ok(await call(null,"/auth/register/start",payload,binding)).challengeId,first.challengeId);
  assert.equal(h.mail.messages.length,mailCount,"repeating the same pending email does not dispatch again");
  const second=ok(await call(null,"/auth/register/start",{...payload,email:"corrected-mobile-email@test.invalid"},binding));
  const latestCode=h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0];
  assert.equal(h.sms.messages.length,phoneCount,"do not ask the owner to prove the same unchanged mobile again");
  assert.equal((await call(null,"/auth/register/verify",{challengeId:first.challengeId,code:firstCode})).status,400);
  ok(await call(null,"/auth/register/verify",{challengeId:second.challengeId,code:latestCode}));
  assert.equal((await query("select id from users where email=$1",[payload.email])).length,0);
  assert.equal((await query("select id from users where email='corrected-mobile-email@test.invalid'")).length,1);
  await h.pg.query("delete from auth_rate_limits");
  assert.equal((await call(null,"/auth/register/start",{...payload,email:"another-mobile-email@test.invalid"},`${p.binding}; digiq_registration=${second.challengeId}`)).status,400);
});

test("admin proof is actor-bound, rolls back on invalid setup, and completion receipts prevent duplicate accounts or messages", async () => {
  const p=await proof("admin");
  const body=adminBody(p);
  await h.pg.query("insert into users(id,email,full_name,role) values('other-super','other-super@test.invalid','Fictional Other','superAdmin')");
  assert.equal((await call("other-super","/clinic-admin-onboarding",body)).status,400);
  assert.equal((await call("sa","/clinic-admin-onboarding",{...body,branches:[]})).status,400);
  assert.equal((await query("select data from auth_challenges where id=$1",[p.id]))[0].data.used,undefined);
  assert.equal((await query("select id from users where email=$1",[body.admin.email])).length,0);
  const saved=ok(await call("sa","/clinic-admin-onboarding",body),201);
  const account=(await query("select * from users where id=$1",[saved.admin.id]))[0];
  assert.equal(account.data.staffMobileProof.contact,mobile);
  assert.equal(account.email_verified_at,null,"phone cannot attest email");
  const captured=(await query("select count(*)::int as n from settings where id like 'sms-outbox:onboarding:%'"))[0].n;
  const replay=ok(await call("sa","/clinic-admin-onboarding",{...body,mobileProofId:undefined}),201);
  assert.equal(replay.clinic.id,saved.clinic.id);
  assert.equal((await query("select count(*)::int as n from settings where id like 'sms-outbox:onboarding:%'"))[0].n,captured);
  assert.equal((await call("sa","/clinic-admin-onboarding",{...body,requestId:randomUUID(),admin:{...body.admin,email:"reuse@test.invalid"}})).status,400);
  const missing=await query("select data from settings where id like 'notification-history:%' and data->>'event'='onboarding' and data->>'recipientGroup'='superAdmin'");
  assert.ok(missing.some(r=>/mobile is missing/.test(r.data.reason)));
});

test("Super Admin profile keeps access while absent, validates mobile, and invalidates challenges when changed", async () => {
  ok(await h.call("sa","GET","/me"));
  assert.equal((await h.call("sa","PATCH","/me",{mobile:"+9109876543210"})).status,400);
  ok(await h.call("sa","PATCH","/me",{mobile}));
  let requested=ok(await call("sa","/staff-verification/request",{channel:"sms"}));
  const originalCode=otp();
  ok(await h.call("sa","PATCH","/me",{mobile:"+447911123456"}));
  assert.equal((await call("sa","/staff-verification/confirm",{channel:"sms",challengeId:requested.challengeId,code:originalCode})).status,400);
  await h.pg.query("update auth_challenges set created_at=now()-interval '61 seconds' where user_id='sa' and purpose='staff-contact:sms'");
  requested=ok(await call("sa","/staff-verification/request",{channel:"sms"}));
  ok(await call("sa","/staff-verification/confirm",{channel:"sms",challengeId:requested.challengeId,code:otp()}));
  assert.equal(ok(await h.call("sa","GET","/staff-verification")).mobileVerified,true);
  ok(await h.call("sa","PATCH","/me",{mobile:""}));
  assert.equal(ok(await h.call("sa","GET","/staff-verification")).mobileVerified,false);
});

test("onboarding readiness separates configuration from contacts; dispatch rechecks proof and never replays skipped events", async () => {
  const p=await proof("admin");
  const saved=ok(await call("sa","/clinic-admin-onboarding",adminBody(p)),201);
  const controls=ok(await h.call("sa","GET","/management/event-controls"));
  const row=controls.items.find(r=>r.channel==="sms"&&r.event==="onboarding"&&r.recipient==="superAdmin");
  assert.equal(row.recipientReady,false);
  assert.ok(row.recipientBlockedReasons.length);
  await h.pg.query("update users set data=data-'staffMobileProof' where id=$1",[saved.admin.id]);
  let sends=0;
  await h.dispatchSmsOutbox(async()=>{sends++;return "provider_accepted";});
  const target=(await query("select data from settings where id like 'sms-outbox:onboarding:%' and data->>'recipientUserId'=$1",[saved.admin.id]))[0];
  assert.equal(target.data.state,"no_recipient");
  assert.match(target.data.preparationReason,/unverified/);
  await h.pg.query("update users set data=data||$2::jsonb where id=$1",[saved.admin.id,JSON.stringify({staffMobileProof:{contact:mobile,verifiedAt:new Date().toISOString()}})]);
  const sent=sends;
  await h.dispatchSmsOutbox(async()=>{sends++;return "provider_accepted";});
  assert.equal(sends,sent,"restoring proof does not replay the skipped occurrence");
});

test("future rejection history keeps only a safe provider category and dispatches an occurrence at most once",async()=>{
  const p=await proof("admin");
  const saved=ok(await call("sa","/clinic-admin-onboarding",adminBody(p)),201);
  let dispatches=0;
  await h.dispatchSmsOutbox(async(_env,_phone,_text,_content,http,diagnostic)=>{
    dispatches++;http(200);diagnostic({code:"dlt_validation_failed",message:"DO-NOT-STORE "+mobile+" secret 123456"});
    return "provider_rejected";
  });
  const row=(await query("select data from settings where id like 'sms-outbox:onboarding:%' and data->>'recipientUserId'=$1",[saved.admin.id]))[0].data;
  assert.equal(row.state,"provider_rejected");
  assert.equal(row.providerDiagnosticCode,"dlt_validation_failed");
  assert.match(row.preparationReason,/DLT/);
  assert.doesNotMatch(row.preparationReason,/DO-NOT-STORE|123456|\+919/);
  const history=(await query("select data from settings where id like 'notification-history:%' and data->>'event'='onboarding' and data->>'reason' like '%DLT%'"));
  assert.ok(history.length);
  const count=dispatches;
  await h.dispatchSmsOutbox(async()=>{dispatches++;return "provider_accepted";});
  assert.equal(dispatches,count);
});

test("existing administrator controls drive exact owner SMS wording and ID for both flows, without changing other rows",async()=>{
  const event="registration_mobile_otp",recipient="clinicAdmin",channel="sms";
  const key="sms-template:platform:registration_mobile_otp:clinicAdmin";
  const controls=async()=>ok(await h.call("sa","GET","/management/event-controls")).items;
  const row=async()=>(await controls()).find(r=>r.event===event&&r.recipient===recipient&&r.channel===channel);
  const save=async(mode,content,status=200)=>{
    const current=await row();
    return ok(await h.call("sa","PUT","/management/templates",{event,recipient,channel,mode,revision:current.revision,content}),status);
  };
  const toggle=async(enabled,status=200)=>ok(await h.call("sa","PUT","/management/event-controls",
    {event,recipient,channel,enabled,confirmed:true,revision:(await row()).revision}),status);
  const content={enabled:false,subject:"Fictional registration",body:"  FICTIONAL owner registration: {{otp}}; valid {{expiry_minutes}} minutes.  ",
    prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:"fictional-owner-a"};
  await template(event,"patient",{body:"Fictional patient phone {{otp}} expires {{expiry_minutes}}."});
  await h.pg.query("insert into settings(id,data) values($1,$2) on conflict(id) do update set data=excluded.data",
    ["sms-template:platform:patient_login_otp",{revision:1,publishedRevision:1,published:{...content,enabled:true,body:"Fictional patient login {{otp}}.",dltTemplateId:"fictional-login"}}]);
  const otherRows=await query("select id,data from settings where id like 'sms-template:%' and id<>$1 order by id",[key]);
  const sent=h.sms.messages.length;
  await h.pg.query("delete from settings where id=$1",[key]);
  try {
    assert.equal((await row()).ready,false);
    await toggle(true,400);
    await save("draft",content);
    for(const flow of ["public","admin"]) {
      await h.pg.query("delete from auth_rate_limits");
      const p=await begin(flow);
      assert.equal(p.status,"unavailable","an enabled default with a draft is not published");
      assert.equal((await confirm(p,"123456")).status,400);
    }
    await toggle(false);
    await toggle(true,400);
    assert.equal(h.sms.messages.length,sent,"drafts and toggles never dispatch");
    for(const flow of ["public","admin"]) {
      await h.pg.query("delete from auth_rate_limits");
      const p=await begin(flow);
      assert.equal(p.status,"disabled");
      assert.equal((await confirm(p,"123456")).status,400);
    }
    assert.equal(h.sms.messages.length,sent);
    await save("publish",{...content,enabled:true,dltTemplateId:""},400);
    await save("publish",{...content,body:"DLT literal {#var#}",enabled:true},400);
    await save("publish",{...content,body:"Code {{otp}}",enabled:true},400);
    await save("publish",{...content,body:"Code {{otp}} expires {{expiry_minutes}} for {{patient_name}}",enabled:true},400);
    await save("publish",content);
    assert.equal((await row()).ready,false,"published but disabled is blocked");
    await h.pg.query("delete from auth_rate_limits");
    assert.equal((await begin("admin")).status,"disabled");
    await toggle(true);
    assert.equal((await row()).ready,true);
    assert.equal(h.sms.messages.length,sent,"publication and activation never send");
    let next=content;
    for(const flow of ["public","admin"]) {
      await h.pg.query("delete from auth_rate_limits");
      const p=await begin(flow);
      const message=h.sms.messages.at(-1);
      assert.equal(p.status,"provider_accepted");
      assert.equal(message.text,next.body.replace("{{otp}}",p.code).replace("{{expiry_minutes}}","10"));
      assert.equal(message.content.dltTemplateId,next.dltTemplateId);
      const beforeVerification=flow==="public"
        ? await call(null,"/auth/register/start",{fullName:"Fictional Config Owner",email:`config-${flow}@test.invalid`,password:OWNER_PASSWORD,mobile,mobileProofId:p.id},p.binding)
        : await call("sa","/clinic-admin-onboarding",adminBody(p,`config-${flow}`));
      assert.equal(beforeVerification.status,400,"no details may advance without proof");
      assert.equal((await confirm(p,p.code==="123456"?"654321":"123456")).status,400);
      ok(await confirm(p));
      if(flow==="public") {
        ok(await call(null,"/auth/register/start",{fullName:"Fictional Config Owner",email:`config-${flow}@test.invalid`,password:OWNER_PASSWORD,mobile,mobileProofId:p.id},p.binding));
      } else {
        assert.equal((await call("sa","/clinic-admin-onboarding",{...adminBody(p,`config-${flow}`),admin:{...adminBody(p,`config-${flow}`).admin,mobile:"+919876543211"}})).status,400);
        ok(await call("sa","/clinic-admin-onboarding",adminBody(p,`config-${flow}`)),201);
      }
      // A later draft is not active; publication replaces only subsequent explicit requests.
      next={...content,enabled:true,body:"FICTIONAL updated owner code {{otp}} expires in {{expiry_minutes}} minutes.",dltTemplateId:"fictional-owner-b"};
      const count=h.sms.messages.length;
      await save("draft",next);
      assert.equal((await row()).ready,true,"valid published wording remains ready with a draft");
      if(flow==="public") {
        await h.pg.query("delete from auth_rate_limits");
        const old=await begin("public");
        assert.equal(h.sms.messages.at(-1).content.dltTemplateId,content.dltTemplateId,"draft never replaces publication");
        ok(await confirm(old));
      }
      await save("publish",next);
      assert.equal(h.sms.messages.length,count+(flow==="public"?1:0));
    }
    assert.deepEqual(await query("select id,data from settings where id like 'sms-template:%' and id<>$1 order by id",[key]),otherRows,
      "patient registration, patient login and staff templates are unchanged");
  } finally { await template(event,recipient); }
});

test("incompatible saved registration content is blocked by readiness and dispatch without fallback or rewriting",async()=>{
  const key="sms-template:platform:registration_mobile_otp:clinicAdmin";
  const body="Fictional stale code {{otp}} for {{patient_name}}.";
  await template("registration_mobile_otp","clinicAdmin",{body});
  const count=h.sms.messages.length;
  try {
    const controls=ok(await h.call("sa","GET","/management/event-controls"));
    const row=controls.items.find(r=>r.event==="registration_mobile_otp"&&r.channel==="sms"&&r.recipient==="clinicAdmin");
    assert.equal(row.ready,false);
    assert.match(row.blockedReasons.join(" "),/Edit and publish compatible registration SMS wording/);
    for(const flow of ["public","admin"]) {
      await h.pg.query("delete from auth_rate_limits");
      const p=await begin(flow);
      assert.equal(p.status,"unavailable");
      assert.equal((await confirm(p,"123456")).status,400);
    }
    assert.equal(h.sms.messages.length,count);
    assert.equal((await query("select data from settings where id=$1",[key]))[0].data.published.body,body);
  } finally { await template("registration_mobile_otp","clinicAdmin"); }
});

test("invalid registration DLT identifiers cannot publish or send",async()=>{
  const current=ok(await h.call("sa","GET","/management/templates?channel=sms&recipient=clinicAdmin")).items.find(r=>r.event==="registration_mobile_otp");
  const content={...current.content,dltTemplateId:"invalid template id!"};
  const count=h.sms.messages.length;
  const response=await h.call("sa","PUT","/management/templates",{channel:"sms",event:"registration_mobile_otp",recipient:"clinicAdmin",
    mode:"publish",revision:current.revision,content});
  assert.equal(response.status,400);
  assert.equal(h.sms.messages.length,count);
});

test("exact registration approvals route once per action and cannot authorize login or authenticated contact proof",async()=>{
  const pairs=[
    ["clinicAdmin","1777179491541503439","Dear Clinic, Your Digi-Q clinic registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team"],
    ["patient","1777179491551752035","Dear Clinic, Your Digi-Q patient registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team"],
  ];
  const loginBody="Dear User, your Digi-Q login OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.";
  for(const [recipient,dltTemplateId,body] of pairs) await template("registration_mobile_otp",recipient,{dltTemplateId,body});
  // Separate existing approvals, never borrow a registration ID for these purposes.
  await template("patient_login_otp","patient",{body:loginBody,dltTemplateId:"1777179188450254576"});
  await template("staff_mobile_otp","superAdmin",{body:"Fictional staff proof {{otp}} expires in {{expiry_minutes}} minutes.",dltTemplateId:"fictional-staff-only"});
  const templateSnapshot=await query("select id,data from settings where id like '%-template:%' order by id");
  const expectMessage=(start,pair,minutes)=>{
    assert.equal(h.sms.messages.length,start+1,"one action produces exactly one intercepted SMS");
    const msg=h.sms.messages.at(-1),code=otp();
    assert.equal(msg.text,pair[2].replace("{{otp}}",code).replace("{{expiry_minutes}}",minutes));
    assert.equal(msg.content.dltTemplateId,pair[1]);
    return code;
  };
  for(const flow of ["public","admin"]) {
    await h.pg.query("delete from auth_rate_limits");
    const start=h.sms.messages.length;
    const p=await begin(flow);
    expectMessage(start,pairs[0],"10");
    const challenge=(await query("select * from auth_challenges where id=$1",[p.id]))[0];
    assert.equal(challenge.purpose,"owner-mobile");
    assert.ok(Math.abs(new Date(challenge.expires_at)-new Date(challenge.created_at)-600000)<2000);
    assert.equal((await call("sa","/staff-verification/confirm",{channel:"sms",challengeId:p.id,code:p.code})).status,400);
    assert.equal((await call(null,"/auth/patient/verify",{channel:"sms",challengeId:p.id,code:p.code})).status,400);
    ok(await confirm(p));
  }
  await h.pg.query("delete from auth_rate_limits");
  const phone="+447911123456",start=h.sms.messages.length;
  const patient=ok(await call(null,"/auth/patient/start",{email:"exact-optional@test.invalid",mobile:phone}));
  const patientCode=expectMessage(start,pairs[1],"10");
  const child=(await query("select c.* from auth_challenges c join auth_challenges p on p.data->>'mobileChallengeId'=c.id where p.id=$1",[patient.challengeId]))[0];
  assert.equal(child.purpose,"registration-mobile");
  const parent=(await query("select * from auth_challenges where id=$1",[patient.challengeId]))[0];
  assert.ok(Math.abs(new Date(child.expires_at)-new Date(parent.expires_at))<1000);
  assert.equal((await call(null,"/auth/patient/verify",{channel:"sms",challengeId:child.id,code:patientCode})).status,400);
  ok(await call(null,"/auth/registration/mobile/verify",{challengeId:patient.challengeId,code:patientCode}));
  const emailCode=h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0];
  ok(await call(null,"/auth/patient/verify",{challengeId:patient.challengeId,code:emailCode}));
  await h.pg.query("delete from auth_rate_limits");
  const loginStart=h.sms.messages.length;
  const login=ok(await call(null,"/auth/patient/start",{channel:"sms",mobile:phone}));
  const loginCode=expectMessage(loginStart,["patient","1777179188450254576",loginBody],"10");
  assert.equal((await call(null,"/auth/registration/mobile/verify",{challengeId:login.challengeId,code:loginCode})).status,400);
  ok(await call(null,"/auth/patient/verify",{channel:"sms",challengeId:login.challengeId,code:loginCode}));
  assert.equal((await call(null,"/auth/patient/verify",{channel:"sms",challengeId:login.challengeId,code:loginCode})).status,400);
  // Optional registration remains usable with no phone and no SMS at all.
  await h.pg.query("delete from auth_rate_limits");
  const noPhone=h.sms.messages.length;
  const emailOnly=ok(await call(null,"/auth/patient/start",{email:"exact-email-only@test.invalid"}));
  assert.equal(emailOnly.channels.sms.status,"not_requested");
  assert.equal(h.sms.messages.length,noPhone);
  ok(await call(null,"/auth/patient/verify",{challengeId:emailOnly.challengeId,code:h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0]}));
  // Existing-account profile proof retains its own five-minute lifetime and approved identity.
  await h.pg.query("update users set mobile=$1,data=data-'staffMobileProof' where id='sa'",[mobile]);
  await h.pg.query("delete from auth_challenges where user_id='sa' and purpose='staff-contact:sms'");
  const staffStart=h.sms.messages.length;
  const staff=ok(await call("sa","/staff-verification/request",{channel:"sms"}));
  const staffCode=expectMessage(staffStart,["superAdmin","fictional-staff-only","Fictional staff proof {{otp}} expires in {{expiry_minutes}} minutes."],"5");
  const staffRow=(await query("select * from auth_challenges where id=$1",[staff.challengeId]))[0];
  assert.equal(staffRow.purpose,"staff-contact:sms");
  assert.ok(Math.abs(new Date(staffRow.expires_at)-new Date(staffRow.created_at)-300000)<2000);
  assert.equal((await call("adm","/staff-verification/confirm",{channel:"sms",challengeId:staff.challengeId,code:staffCode})).status,400);
  ok(await call("sa","/staff-verification/confirm",{channel:"sms",challengeId:staff.challengeId,code:staffCode}));
  assert.deepEqual(await query("select id,data from settings where id like '%-template:%' order by id"),templateSnapshot);
  // Losing registration publication blocks that proof only: email-only completion
  // remains optional and the existing approved SMS-login pair stays usable.
  await h.pg.query("delete from settings where id='sms-template:platform:registration_mobile_otp'");
  await h.pg.query("delete from auth_rate_limits");
  const blockedStart=h.sms.messages.length;
  const blocked=ok(await call(null,"/auth/patient/start",{email:"exact-blocked-optional@test.invalid",mobile:"+447911123457"}));
  assert.equal(blocked.channels.sms.status,"unavailable");
  assert.equal(h.sms.messages.length,blockedStart);
  assert.equal((await call(null,"/auth/registration/mobile/verify",{challengeId:blocked.challengeId,code:"123456"})).status,400);
  ok(await call(null,"/auth/patient/verify",{challengeId:blocked.challengeId,code:h.mail.messages.at(-1).text.match(/\b\d{6}\b/)[0]}));
  assert.equal((await query("select mobile from users where email='exact-blocked-optional@test.invalid'"))[0].mobile,null);
  await h.pg.query("delete from auth_rate_limits");
  const preservedLogin=h.sms.messages.length;
  ok(await call(null,"/auth/patient/start",{channel:"sms",mobile:phone}));
  expectMessage(preservedLogin,["patient","1777179188450254576",loginBody],"10");
  // Registration approval cannot fill the missing signed-in staff publication.
  await h.pg.query("delete from settings where id='sms-template:platform:staff_mobile_otp:superAdmin'");
  await h.pg.query("update users set data=data-'staffMobileProof' where id='sa'");
  await h.pg.query("delete from auth_challenges where user_id='sa' and purpose='staff-contact:sms'");
  const missingStaff=h.sms.messages.length;
  assert.equal((await call("sa","/staff-verification/request",{channel:"sms"})).status,503);
  assert.equal(h.sms.messages.length,missingStaff);
  assert.equal(ok(await h.call("sa","GET","/staff-verification")).mobileVerified,false);
});
