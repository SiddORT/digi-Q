// Disposable PostgreSQL and injected transports only. Never reads workspace credentials.
import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { queueFixtureSql } from "./test-support/queue-fixtures.mjs";

const bundle = resolve(import.meta.dirname, `.appointment-activation-${process.pid}.mjs`);
const events = ["booking", "rescheduled", "cancelled", "completed", "reminder"];
const groups = ["patient", "clinicAdmin", "doctor"];
const actor = { id: "sa", role: "superAdmin" };
const mapping = { encoding: "json", authMode: "header", authField: "X-Key",
  fields: { recipient: "to", message: "text", senderId: "sender", dltEntityId: "entity", dltTemplateId: "template" },
  staticFields: {}, acceptedStatuses: [200], dltRequired: true };
const fixtureEnv = { NODE_ENV: "test", INTEGRATIONS_ENCRYPTION_KEY: "ab".repeat(32),
  SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_USER: "fixture", SMTP_PASSWORD: "fixture-password",
  SMTP_FROM: "fixture@example.invalid", SMTP_NOTIFICATIONS_ENABLED: "false",
  NOTIFICATION_SMS_PROVIDER: "generic", NOTIFICATION_SMS_URL: "https://sms.example.invalid/send",
  NOTIFICATION_SMS_KEY: "fixture-key", NOTIFICATION_SMS_BEARER_TOKEN: "fixture-bearer",
  NOTIFICATION_SMS_SENDER_ID: "DIGIQ", NOTIFICATION_SMS_ENTITY_ID: "fictional-entity",
  NOTIFICATION_SMS_MAPPING: JSON.stringify(mapping), NOTIFICATION_SMS_ENABLED: "false" };
let h, api;
before(async () => {
  Object.assign(process.env, fixtureEnv);
  h = await createQueueHarness({ empty: true });
  await h.control.query(queueFixtureSql);
  globalThis.appointmentActivationDb = h.db;
  await build({ stdin: { contents: `
    export * from "./lib/appointment-notification-activation";
    export * from "./lib/appointment-template-registration";
    export * from "./lib/approved-appointment-sms";
    export * from "./lib/appointment-notification-cutover";
    export * from "./lib/notification-template-store";
    export * from "./lib/notification-templates";
    export * from "./lib/notification-outbox";
    export * from "./lib/notification-sms-outbox";
    export * from "./lib/appointment-confirmation";
    export * from "./lib/managed-notification-settings";
    export * from "./lib/integration-vault";
    export * from "./lib/notification-preferences";
    export * from "./lib/notification-history";
    export * from "./lib/store";
  `, resolveDir: import.meta.dirname, loader: "ts" }, outfile: bundle, bundle: true,
    platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "isolated-db", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "isolated" }));
      b.onLoad({ filter: /.*/, namespace: "isolated" }, () => ({
        contents: `export * from "${resolve(import.meta.dirname, "../../../lib/db/src/schema/core.ts")}"; export const db=globalThis.appointmentActivationDb;`,
        loader: "ts", resolveDir: import.meta.dirname,
      }));
    } }],
  });
  api = await import(bundle);
});
beforeEach(async () => {
  Object.assign(process.env, fixtureEnv);
  await h.control.query(`truncate settings, integration_credentials, audit_logs, appointments, users, clinics, branches, doctors, assignments, patients;
    insert into users(id,role,email,full_name,mobile) values
      ('sa','superAdmin','sa@example.invalid','Admin',null),
      ('ca','clinicAdmin','owner@example.invalid','Owner','+919876543210'),
      ('du','doctor','doctor@example.invalid','Doctor','+919876543211'),
      ('pu','patient','patient@example.invalid','Patient','+919876543212');
    insert into clinics(id,admin_id,data) values
      ('c','ca','{"name":"Clinic","timezone":"UTC","policies":{"notificationsEnabled":false,"untouched":"keep"}}'),
      ('c2','ca','{"name":"Other clinic","policies":{"notificationsEnabled":true}}');
    insert into branches(id,clinic_id,data) values('b','c','{"name":"Location","timezone":"UTC"}');
    insert into doctors(id,user_id,owner_admin_id,data) values('d','du','ca','{"fullName":"Doctor"}');
    insert into assignments(id,user_id,clinic_id,branch_id) values('d','du','c','b');
    insert into patients(id,user_id,clinic_id,branch_id,mobile,data) values('p','pu','c','b','+919876543212','{"fullName":"Patient","email":"patient@example.invalid"}');
    insert into settings(id,data) values('platform','{"notificationsEnabled":false,"untouched":"keep-platform"}');`);
  for (const channel of ["email", "sms"]) for (const event of events) for (const recipient of groups) {
    const content = channel === "email" ? { ...api.defaultTemplate(event, recipient),
      enabled: false, subject: `Saved ${event}`, body: "Saved {{clinic_name}} {{reference}}", footer: "Keep footer" }
      : { enabled: false, subject: `Saved ${event}`, body: "Saved SMS {{clinic_name}} {{reference}}",
        prefix: "", footer: "", logoUrl: "", senderId: "", dltEntityId: "", dltTemplateId: `fictional-${event}-${recipient}` };
    await setting(api.notificationTemplateKey(event, undefined, recipient, channel), {
      revision: 7, publishedRevision: 6, published: content, draft: { ...content, body: "UNPUBLISHED DRAFT" },
    });
  }
});
after(async () => { await h?.close(); await rm(bundle, { force: true }); delete globalThis.appointmentActivationDb; });
async function setting(id, data) {
  await h.control.query("insert into settings(id,data) values($1,$2) on conflict(id) do update set data=excluded.data", [id, data]);
}
async function activate() { return api.applyAppointmentActivation((await api.appointmentActivationInventory(h.db)).revision, h.db); }
async function stored(id) { return (await h.control.query("select data from settings where id=$1", [id])).rows[0]?.data; }
async function visit(event, suffix = "", extra = {}) {
  const now = Date.now(), session = new Date(now + 61 * 60000);
  const row = { id: `${event}${suffix}`, patientId: "p", clinicId: "c", branchId: "b", doctorId: "d",
    date: event === "reminder" ? session.toISOString().slice(0, 10) : `2031-03-${12 + events.indexOf(event)}`,
    status: event === "cancelled" ? "cancelled" : event === "completed" ? "completed" : "booked",
    revision: 1, startTime: event === "reminder" ? session.toISOString().slice(11, 16) : "09:00",
    endTime: "23:59", timezone: "UTC", reference: `REFERENCE-${event}${suffix}`, token: "Q-1", tokenNumber: 1,
    clinicName: "Clinic", branchName: "Location", patientName: "Patient", doctorName: "Doctor", ...extra };
  await h.control.query(`insert into appointments(id,patient_id,clinic_id,branch_id,doctor_id,date,token_number,status,data)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [row.id, row.patientId, row.clinicId, row.branchId, row.doctorId, row.date, row.tokenNumber, row.status, row]);
  return row;
}

async function registrationFixture() {
  Object.assign(process.env,{NODE_ENV:"development",SMTP_NOTIFICATIONS_ENABLED:"true",
    NOTIFICATION_SMS_ENABLED:"true",NOTIFICATION_SMS_PROVIDER:"keepInTouch",
    NOTIFICATION_SMS_CLIENT_ID:"fictional-client",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"plus"});
  await h.control.query("truncate settings");
  await setting("platform",{notificationsEnabled:false,untouched:"keep-platform"});
  const booking=api.approvedAppointmentSms.find(r=>r.event==="booking"&&r.recipients.includes("patient"));
  const team=api.approvedAppointmentSms.find(r=>r.event==="booking"&&r.recipients.includes("clinicAdmin"));
  const content={enabled:true,subject:"Keep subject",body:"Older wording missing appointment date",
    prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:booking.dltTemplateId};
  await setting(api.notificationTemplateKey("booking",undefined,"patient","sms"),{
    revision:8,publishedRevision:7,published:content,draft:{...content,body:"KEEP UNSAVED DRAFT"},
  });
  await setting(api.notificationTemplateKey("booking",undefined,"clinicAdmin","sms"),{
    revision:2,publishedRevision:2,published:{...content,enabled:false,body:team.body,dltTemplateId:team.dltTemplateId},
  });
}
async function register() {
  return api.registerAppointmentTemplates((await api.appointmentActivationInventory(h.db)).revision,h.db);
}

test("supplied registrations retain exact approved text, IDs and variable ordering for 11 targets", () => {
  const sources=[
    ["1777179180199333856","Dear {#var#}, your appointment with Dr. {#var#} is confirmed for {#var#}. Queue No: {#var#}. Expected time: {#var#}. Please arrive 10 minutes before your expected time. - Digi-Q"],
    ["1777179180212222829","New appointment booked on Digi-Q. Patient: {#var#}. Doctor: Dr. {#var#}. Appointment: {#var#} at {#var#}. - Digi-Q"],
    ["1777179180230206932","Dear {#var#}, your appointment with Dr. {#var#} on {#var#} at {#var#} (Queue No: {#var#}) has been cancelled. Reason: {#var#}. Please contact the clinic if you need assistance. - Digi-Q"],
    ["1777179180247974768","Appointment cancelled on Digi-Q. Patient: {#var#}. Doctor: Dr. {#var#}. Appointment: {#var#} at {#var#}. Queue No: {#var#}. Reason: {#var#}. - Digi-Q"],
    ["1777179180260833424","Dear {#var#}, your appointment with Dr. {#var#} on {#var#} at {#var#} (Queue No: {#var#}) has been completed. Thank you for choosing Digi-Q. - Digi-Q"],
    ["1777179180271292281","Appointment completed on Digi-Q. Patient: {#var#}. Doctor: Dr. {#var#}. Appointment: {#var#} at {#var#}. Queue No: {#var#}. - Digi-Q"],
    ["1777179180284769924","Dear {#var#}, reminder: your appointment with Dr. {#var#} is scheduled for {#var#} at {#var#}. Queue No: {#var#}. Please arrive 10 minutes before your appointment time. - Digi-Q"],
    ["1777179180927080590","Dear {#var#}, your appointment with Dr. {#var#} has been rescheduled to {#var#} at {#var#}. Queue No: {#var#}. Please arrive 10 minutes before your appointment time. - Digi-Q"],
  ];
  assert.equal(api.approvedAppointmentSms.length,8);
  assert.equal(api.approvedAppointmentSms.reduce((n,r)=>n+r.recipients.length,0),11);
  for(const [id,text] of sources) {
    const entry=api.approvedAppointmentSms.find(r=>r.dltTemplateId===id);
    assert.ok(entry);
    assert.equal(entry.body.replace(/\{\{[a-z_]+\}\}/g,"{#var#}"),text);
    assert.equal(api.validEventContent(entry.event,{subject:"Approved SMS",prefix:"",footer:"",body:entry.body}),true);
    assert.match(entry.body,/\{\{appointment_date\}\}/);
    assert.match(entry.body,/\{\{session_start\}\}/);
    assert.equal(entry.recipients.includes("receptionist"),false);
  }
});

test("atomic registration saves 15 Email and 15 SMS rows, keeps four unsupported off and preserves drafts/providers", async () => {
  await registrationFixture();
  const providerBefore=await h.control.query("select * from integration_credentials order by provider");
  const oldDraft=(await stored(api.notificationTemplateKey("booking",undefined,"patient","sms"))).draft;
  const result=await register();
  assert.deepEqual([result.emailCreated,result.smsCreated,result.smsAligned,result.smsDisabled],[15,9,1,4]);
  for(const event of events)for(const recipient of groups) {
    const email=await api.resolvedTemplate(event,undefined,h.db,recipient,"email");
    assert.equal(email.source,"platform");
    assert.deepEqual(email.content,api.defaultTemplate(event,recipient));
    const sms=await api.resolvedTemplate(event,undefined,h.db,recipient,"sms");
    assert.equal(sms.source,"platform");
    const approved=api.approvedAppointmentSms.find(r=>r.event===event&&r.recipients.includes(recipient));
    assert.equal(sms.content.enabled,!!approved);
    if(approved) {
      assert.equal(sms.content.body,approved.body);
      assert.equal(sms.content.dltTemplateId,approved.dltTemplateId);
      assert.ok(sms.activatedAt>=result.cutoff || event==="booking"&&recipient==="clinicAdmin");
    } else assert.equal(sms.content.dltTemplateId,"");
  }
  const patient=await stored(api.notificationTemplateKey("booking",undefined,"patient","sms"));
  assert.deepEqual(patient.draft,oldDraft);
  assert.equal(patient.published.subject,"Keep subject");
  assert.deepEqual((await h.control.query("select * from integration_credentials order by provider")).rows,providerBefore.rows);
  const inventory=await api.appointmentActivationInventory(h.db);
  for(const scope of inventory.scopes) {
    assert.equal(scope.items.filter(r=>r.status==="enabled-ready").length,26);
    assert.equal(scope.items.filter(r=>r.channel==="sms"&&!r.enabled).length,4);
  }
  assert.equal((await api.resolvedTemplate("booking",undefined,h.db,"receptionist","sms")).content.enabled,false);
  assert.equal((await api.resolvedTemplate("onboarding",undefined,h.db,"clinicAdmin","sms")).content.enabled,false);
});

test("registration reruns preserve later edits, opt-outs, branding, existing Email publications and clinic overrides", async () => {
  await registrationFixture();
  const custom={...api.defaultTemplate("completed","doctor"),body:"KEEP EMAIL {{clinic_name}}",
    footer:"Keep branding",logoUrl:"https://example.invalid/logo.png"};
  await setting(api.notificationTemplateKey("completed",undefined,"doctor","email"),{
    revision:9,publishedRevision:8,published:custom,draft:{...custom,body:"KEEP EMAIL DRAFT"},
  });
  const clinicId=api.notificationTemplateKey("completed","c","doctor","email");
  await setting(clinicId,{revision:3,published:custom,draft:{...custom,body:"KEEP CLINIC DRAFT"}});
  assert.equal((await register()).emailCreated,14);
  assert.deepEqual((await stored(api.notificationTemplateKey("completed",undefined,"doctor","email"))).published,custom);
  assert.deepEqual((await stored(clinicId)).published,custom);
  const changedId=api.notificationTemplateKey("completed",undefined,"patient","sms");
  const edited=await stored(changedId);
  await setting(changedId,{...edited,revision:edited.revision+1,published:{...edited.published,enabled:false}});
  await setting("platform",{notificationsEnabled:false});
  const snapshot=(await h.control.query("select * from settings order by id")).rows;
  assert.equal((await register()).alreadyApplied,true);
  assert.deepEqual((await h.control.query("select * from settings order by id")).rows,snapshot);
});

test("registration rejects non-development, stale config and conflicting DLT IDs without partial writes", async () => {
  await registrationFixture();
  process.env.NODE_ENV="production";
  await assert.rejects(register(),{status:403});
  process.env.NODE_ENV="development";
  const old=await api.appointmentActivationInventory(h.db);
  await setting("platform",{notificationsEnabled:false,changed:true});
  await assert.rejects(api.registerAppointmentTemplates(old.revision,h.db),{status:409});
  const id=api.notificationTemplateKey("booking",undefined,"patient","sms");
  const row=await stored(id);
  await setting(id,{...row,published:{...row.published,dltTemplateId:"different-approved-registration"}});
  const snapshot=(await h.control.query("select * from settings order by id")).rows;
  await assert.rejects(register(),{status:409});
  assert.deepEqual((await h.control.query("select * from settings order by id")).rows,snapshot);
  assert.equal(await stored(api.appointmentRegistrationReceipt),undefined);
});

test("audit interruption rolls back all registration writes; retry and fake-only dispatch deliver 26 supported combinations once", async () => {
  await registrationFixture();
  const before=(await h.control.query("select * from settings order by id")).rows;
  await h.control.query("alter table audit_logs add constraint registration_interruption check(action <> 'appointment_template_registration')");
  await assert.rejects(register());
  assert.deepEqual((await h.control.query("select * from settings order by id")).rows,before);
  await h.control.query("alter table audit_logs drop constraint registration_interruption");
  await register();
  // Development capture intentionally does not create real dispatch work.
  // Switch only this disposable fixture to test mode for injected fake sends.
  process.env.NODE_ENV="test";
  const deliveries=[];
  const email=async(to,subject,text)=>{deliveries.push({channel:"email",to,text});};
  const sms=async(_env,to,text,content)=>{deliveries.push({channel:"sms",to,text,id:content.dltTemplateId});return "provider_accepted";};
  for(const event of events) {
    const row=await visit(event,"-registered");
    const start=deliveries.length;
    await api.enqueueEvent(h.db,event,row,event==="rescheduled"?{...row,date:"2031-03-01"}:undefined);
    if(event==="booking")await api.confirmAppointmentEmail(row.id,h.db,email);
    const at=event==="reminder"?Date.now()+60000:Date.now()+10;
    await api.processNotifications(h.db,email,at);
    await api.processSmsNotifications(h.db,sms,at);
    const sent=deliveries.slice(start);
    assert.equal(sent.filter(r=>r.channel==="email").length,3,event);
    const texts=sent.filter(r=>r.channel==="sms");
    assert.equal(texts.length,["reminder","rescheduled"].includes(event)?1:3,event);
    for(const text of texts) {
      assert.ok(api.approvedAppointmentSms.some(r=>r.event===event&&r.dltTemplateId===text.id));
      assert.equal(text.text.includes("{{"),false);
    }
    const count=deliveries.length;
    await api.processNotifications(h.db,email,at+1000);
    await api.processSmsNotifications(h.db,sms,at+1000);
    assert.equal(deliveries.length,count);
  }
  assert.equal(deliveries.length,26);
});

test("prospective defaults enable exactly all 30 appointment combinations without changing security/other defaults", async () => {
  await h.control.query("truncate settings");
  for (const event of events) for (const recipient of groups) for (const channel of ["email", "sms"]) {
    assert.equal((await api.resolvedTemplate(event, undefined, h.db, recipient, channel)).content.enabled, true);
  }
  assert.equal((await api.getSettings(h.db)).notificationsEnabled, true);
  assert.equal(api.defaultTemplate("booking", "receptionist").enabled, false);
  assert.equal(api.defaultTemplate("onboarding", "clinicAdmin").enabled, true);
  assert.equal((await api.resolvedTemplate("patient_login_otp", undefined, h.db, "patient", "sms")).content.enabled, true);
  const security = await api.resolvedTemplate("staff_setup", undefined, h.db, "receptionist", "email");
  assert.equal(security.content.enabled, true);
});

test("atomic existing-scope activation preserves content/drafts/branding/metadata, inheritance, unrelated policies and effective page state", async () => {
  const localKey = api.notificationTemplateKey("booking", "c", "patient", "sms");
  const source = await stored(api.notificationTemplateKey("booking", undefined, "patient", "sms"));
  await setting(localKey, { ...source, revision: 12, published: { ...source.published, body: "Clinic saved {{reference}}" } });
  const nonTarget = api.notificationTemplateKey("booking", undefined, "receptionist", "email");
  await setting(nonTarget, { revision: 2, published: { ...api.defaultTemplate("booking", "receptionist"), enabled: true } });
  // This clinic currently permits onboarding; platform gate off must not make it lose that behavior.
  process.env.SMTP_NOTIFICATIONS_ENABLED = "true";
  const beforeSecurity = await api.resolvedTemplate("patient_login_otp", undefined, h.db, "patient", "sms");
  const originals = (await h.control.query("select id,data from settings where id like '%-template:%'")).rows;
  const result = await activate();
  assert.equal(result.clinicCount, 2);
  const report = await api.appointmentActivationInventory(h.db);
  for (const scope of report.scopes) {
    assert.equal(scope.notificationsEnabled, true);
    assert.equal(scope.items.length, 30);
    assert(scope.items.every(i => i.enabled && i.status === "enabled-ready"));
  }
  for (const original of originals.filter(r => r.id !== nonTarget)) {
    const after = await stored(original.id);
    assert.deepEqual(after.published, { ...original.data.published, enabled: true });
    assert.deepEqual(after.draft, original.data.draft);
  }
  assert.equal((await api.resolvedTemplate("booking", "c", h.db, "doctor", "email")).source, "platform");
  assert.equal((await api.resolvedTemplate("booking", "c", h.db, "receptionist")).content.enabled, false);
  assert.equal((await api.resolvedTemplate("booking", "c2", h.db, "receptionist")).content.enabled, true);
  assert.equal((await api.resolvedTemplate("onboarding", "c2", h.db, "clinicAdmin")).content.enabled, true);
  assert.equal((await api.resolvedTemplate("onboarding", "c", h.db, "clinicAdmin")).content.enabled, false);
  assert.deepEqual((await api.resolvedTemplate("patient_login_otp", undefined, h.db, "patient", "sms")).content, beforeSecurity.content);
  assert.equal((await api.getSettings(h.db, "c")).untouched, "keep");
  assert.equal((await stored("platform")).untouched, "keep-platform");
  // Same projection consumed by GET on every fresh page load; no cached activation result.
  for (let refresh = 0; refresh < 2; refresh++) {
    const page = await api.managedNotificationSettings(actor, "c", h.db);
    assert.equal(page.notificationsEnabled, true);
    assert.equal(page.items.filter(i => groups.includes(i.recipient) && events.includes(i.event)).filter(i => i.enabled && i.ready).length, 30);
  }
  const changed = await api.resolvedTemplate("booking", "c", h.db, "patient", "email");
  await api.changeActivation(actor, { event: "booking", recipient: "patient", channel: "email", clinicId: "c",
    revision: changed.local.revision, enabled: false }, h.db);
  await h.control.query(`update clinics set data=jsonb_set(data,'{policies,notificationsEnabled}','false') where id='c'`);
  assert.equal((await activate()).alreadyApplied, true);
  assert.equal((await api.getSettings(h.db, "c")).notificationsEnabled, false);
  assert.equal((await api.resolvedTemplate("booking", "c", h.db, "patient", "email")).content.enabled, false);
  assert.equal((await h.control.query("select count(*)::int n from audit_logs where action='appointment_notification_activation'")).rows[0].n, 1);
});

test("stale revisions fail before writes; interrupted transaction leaves no activation and a retry succeeds once", async () => {
  const old = await api.appointmentActivationInventory(h.db);
  await h.control.query(`update settings set data=data||'{"newPolicy":true}' where id='platform'`);
  await assert.rejects(api.applyAppointmentActivation(old.revision, h.db), { status: 409 });
  assert.equal(await stored("appointment-notification-activation"), undefined);
  await h.control.query(`alter table audit_logs add constraint activation_interruption check(action <> 'appointment_notification_activation')`);
  await assert.rejects(activate());
  assert.equal(await stored("appointment-notification-activation"), undefined);
  assert.equal((await api.getSettings(h.db, "c")).notificationsEnabled, false);
  assert.equal((await api.resolvedTemplate("booking", undefined, h.db, "patient")).content.enabled, false);
  await h.control.query("alter table audit_logs drop constraint activation_interruption");
  assert.equal((await activate()).alreadyApplied, false);
});

test("all 30 event/channel/recipient dispatches use configured content once and future reminder timing", async () => {
  const result = await activate();
  const deliveries = [];
  const email = async (to, subject, text) => { deliveries.push({ channel: "email", to, text }); };
  const sms = async (_env, to, text) => { deliveries.push({ channel: "sms", to, text }); return "provider_accepted"; };
  for (const event of events) {
    const row = await visit(event);
    await api.enqueueEvent(h.db, event, row);
    if (event === "booking") assert.equal(await api.confirmAppointmentEmail(row.id, h.db, email), "provider_accepted");
    const at = event === "reminder" ? Date.now() + 60000 : Date.now() + 10;
    await api.processNotifications(h.db, email, at);
    await api.processSmsNotifications(h.db, sms, at);
    const sent = deliveries.filter(d => d.text.includes(row.reference));
    assert.equal(sent.length, 6, `${event}: ${JSON.stringify(sent)}`);
    for (const channel of ["email", "sms"]) assert.equal(sent.filter(d => d.channel === channel).length, 3);
    await api.processNotifications(h.db, email, at + 1000);
    await api.processSmsNotifications(h.db, sms, at + 1000);
    assert.equal(deliveries.filter(d => d.text.includes(row.reference)).length, 6);
  }
  assert.equal(deliveries.length, 30);
  const cutoff = Date.UTC(2030, 0, 1, 8, 0, 30);
  for (const timezone of ["UTC", "Asia/Kolkata", "America/New_York"]) {
    const wall = ms => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    for (const [offset, expected] of [[-30000, false], [90000, true]]) {
      const p = wall(cutoff + 3600000 + offset);
      assert.equal(api.appointmentCaptureAfterCutover("reminder", "doctor", cutoff,
        { date: `${p.year}-${p.month}-${p.day}`, startTime: `${p.hour}:${p.minute}`, timezone }), expected);
    }
  }
  assert(result.cutoff);
});

test("gate-only cutover cancels old pending jobs and delayed confirmations without replaying terminal/claimed work", async () => {
  for (const channel of ["email", "sms"]) for (const group of groups) {
    const key = api.notificationTemplateKey("booking", undefined, group, channel);
    const t = await stored(key); await setting(key, { ...t, published: { ...t.published, enabled: true } });
  }
  for (const channel of ["mail", "sms"]) for (const state of ["pending", "sending", "delivery_unknown", "disabled"]) {
    await setting(`${channel}-outbox:booking:old:${state}`, { state, event: "booking", clinicId: "c", recipientGroup: "doctor",
      snapshot: { id: "old", patientId: "p", doctorId: "d" }, createdAt: 1, dueAt: 1, attempts: 0 });
  }
  const old = await visit("booking", "-old");
  await setting(`patient-confirmation-preference:${old.id}`, { enabled: true, userId: "pu", epoch: 0 });
  await api.recordNotification(h.db, `patient-booking:${old.id}`,
    api.notificationEntry({ event: "booking", clinicId: "c", snapshot: old, recipientGroup: "patient" }, "email"), "pending", undefined, [], 1);
  const applied = await activate();
  let sends = 0;
  assert.equal(await api.confirmAppointmentEmail(old.id, h.db, async () => { sends++; }), "disabled");
  for (const channel of ["mail", "sms"]) for (const state of ["pending", "sending", "delivery_unknown", "disabled"]) {
    assert.equal((await stored(`${channel}-outbox:booking:old:${state}`)).state, state === "pending" ? "disabled" : state);
  }
  await api.processNotifications(h.db, async () => { sends++; });
  await api.processSmsNotifications(h.db, async () => { sends++; return "provider_accepted"; });
  assert.equal(sends, 0);
  assert.equal((await api.resolvedTemplate("booking", "c", h.db, "doctor")).activatedAt, applied.cutoff);
});

test("missing metadata/contact, personal opt-outs, assignment checks and independent channels remain enforced", async () => {
  const missing = api.notificationTemplateKey("completed", undefined, "doctor", "sms");
  const t = await stored(missing); await setting(missing, { ...t, published: { ...t.published, dltTemplateId: "" } });
  await api.writePersonalPreferences(h.db, "ca", { revision: 1, choices: { "email:completed": false }, epochs: {} });
  await h.control.query("update users set mobile=null where id='pu'; update patients set mobile=null where id='p'");
  const applied = await activate();
  assert(applied.blockedSms > 0);
  assert.equal((await stored(missing)).published.enabled, false, "guarded activation not applied with missing DLT ID");
  const report = await api.appointmentActivationInventory(h.db);
  assert(report.scopes[0].items.find(i => i.channel === "sms" && i.event === "completed" && i.recipient === "doctor").reasons.some(r => /DLT/.test(r)));
  const row = await visit("completed");
  await api.enqueueEvent(h.db, "completed", row);
  await h.control.query("delete from assignments where user_id='du'");
  const sent = [];
  await api.processNotifications(h.db, async (to) => { sent.push(["email", to]); });
  await api.processSmsNotifications(h.db, async (_env, to) => { sent.push(["sms", to]); return "provider_accepted"; });
  assert.deepEqual(sent, [["email", "patient@example.invalid"], ["sms", "+919876543210"]]);
  const smtp = await api.resolvedIntegration("smtp", h.db);
  // Optional Email off does not gate SMS or required security content.
  await h.control.query("delete from integration_credentials where provider='smtp'");
  process.env.SMTP_NOTIFICATIONS_ENABLED = "false";
  const next = await visit("cancelled", "-independent");
  await api.enqueueEvent(h.db, "cancelled", next);
  assert.equal((await h.control.query("select count(*)::int n from settings where id like $1", [`mail-outbox:cancelled:${next.id}%`])).rows[0].n, 0);
  assert((await h.control.query("select count(*)::int n from settings where id like $1", [`sms-outbox:cancelled:${next.id}%`])).rows[0].n > 0);
  assert.equal((await api.resolvedTemplate("staff_setup", undefined, h.db, "receptionist")).content.enabled, true);
  assert(smtp.env.SMTP_HOST);
});

test("duplicate destinations deduplicate per channel and uncertain dispatch is never retried", async () => {
  await activate();
  await h.control.query("update users set email='patient@example.invalid', mobile='+919876543212' where id in ('ca','du')");
  const row = await visit("booking");
  await api.enqueueEvent(h.db, "booking", row);
  let emails = 0, texts = 0;
  await api.confirmAppointmentEmail(row.id, h.db, async () => { emails++; throw new Error("unknown outcome"); });
  await api.processNotifications(h.db, async () => { emails++; throw new Error("unknown outcome"); });
  await api.processSmsNotifications(h.db, async () => { texts++; return "delivery_unknown"; });
  await api.processNotifications(h.db, async () => { emails++; });
  await api.processSmsNotifications(h.db, async () => { texts++; return "provider_accepted"; });
  await api.confirmAppointmentEmail(row.id, h.db, async () => { emails++; });
  assert.equal(emails, 1); assert.equal(texts, 1);
});
