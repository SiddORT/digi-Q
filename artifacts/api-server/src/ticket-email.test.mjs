import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const dir = resolve("artifacts/api-server/.local/ticket-email-tests");
await mkdir(dir, { recursive: true });
const file = resolve(dir, "email.cjs");
const mocks = {
  "@workspace/db": `const d=globalThis.mailFixture;export const db=d.db;export const appointments="appointments",patients="patients",users="users",settings="settings",clinics="clinics";`,
  "./auth": `export const roles=(u,rs)=>{if(!rs.includes(u.role))throw Error("Denied role")};export const canRead=async()=>globalThis.mailFixture.allowed;`,
  "./http": `export const assert=(v,s,m)=>{if(!v)throw Error(m)};`,
  "./store": `export const one=async(t,id)=>globalThis.mailFixture.records[t];export const getSettings=async()=>({notificationsEnabled:globalThis.mailFixture.enabled});export const audit=async()=>{};`,
  "./appointments": `export const appointmentViewWithBranch=async r=>r;`,
  "./appointment-confirmation": `export const confirmationText=r=>"Session 09:00-10:00\\nReference "+r.reference;`,
  "./appointment-qr": `export const getAppointmentQr=async()=>({checkInUrl:"/check-in?payload=fictional"});`,
  "./integration-config": `export const validEmailAddress=x=>x.includes("@");export const smtpConfig=()=>({});`,
  "./integration-vault": `export const resolvedIntegration=async()=>({env:{}});`,
  "./auth-email": `export const sendAuthEmail=async(...args)=>{const f=globalThis.mailFixture;f.calls++;f.attachment=args[5][0].content;if(f.fail)throw Error("unknown SMTP outcome")};`,
  "./native-auth": `export const consumeRateLimit=async()=>{};`,
  "./logger": `export const logger={error:()=>{}};`,
};
await build({ entryPoints: [resolve("artifacts/api-server/src/lib/ticket-email.ts")], outfile: file, bundle: true, platform: "node", format: "cjs", packages: "external",
  define: { "process.env.NODE_ENV": '"production"', "process.env.CLINICFLOW_PUBLIC_ORIGIN": '"https://example.test"' },
  plugins: [{ name: "isolated-email", setup(b) {
    b.onResolve({ filter: /.*/ }, a => mocks[a.path] ? {path:a.path,namespace:"fake"} : undefined);
    b.onLoad({filter:/.*/,namespace:"fake"}, a=>({contents:mocks[a.path]}));
  }}] });
let stored;
globalThis.mailFixture = {
  allowed:true, enabled:true, calls:0, fail:false,
  records:{
    appointments:{id:"a",clinicId:"c",patientId:"p",patientName:"Fictional Patient",token:"A-01",reference:"TEST-ONLY",status:"waiting"},
    patients:{email:"fictional@example.test"}, clinics:{},
  },
  db:{
    transaction:async fn=>fn(globalThis.mailFixture.db),
    execute:async()=>{},
    select:()=>({from:()=>({where:async()=>stored?[stored]:[]})}),
    insert:()=>({values:async value=>{stored=value}}),
    update:()=>({set:value=>({where:async()=>{stored={...stored,...value}}})}),
  },
};
const {ticketEmailPreview,emailTicket}=createRequire(import.meta.url)(file);
after(async()=>{delete globalThis.mailFixture;await rm(dir,{recursive:true,force:true})});
test("ticket email denies roles/scope and explains disabled/missing recipients",async()=>{
  const f=globalThis.mailFixture;
  await assert.rejects(ticketEmailPreview({role:"patient"},"a"),/role/);
  f.allowed=false;await assert.rejects(ticketEmailPreview({role:"doctor"},"a"),/scope/);f.allowed=true;
  f.enabled=false;assert.equal((await ticketEmailPreview({role:"doctor"},"a")).eligible,false);f.enabled=true;
  f.records.patients.email="";assert.match((await ticketEmailPreview({role:"doctor"},"a")).reason,/No valid/);
  f.records.patients.email="fictional@example.test";
});
test("recipient changes fail closed; accepted request has real PDF and is idempotent",async()=>{
  const f=globalThis.mailFixture,u={id:"u",role:"doctor"};
  await assert.rejects(emailTicket(u,"a","request","changed@example.test"),/Recipient changed/);
  assert.equal(f.calls,0);
  assert.equal((await emailTicket(u,"a","request","fictional@example.test")).state,"provider_accepted");
  assert.equal(f.attachment.subarray(0,5).toString(),"%PDF-");
  await emailTicket(u,"a","request","fictional@example.test");
  assert.equal(f.calls,1);
});
test("uncertain delivery never redispatches the same durable claim",async()=>{
  const f=globalThis.mailFixture;stored=undefined;f.calls=0;f.fail=true;
  const u={id:"u",role:"doctor"};
  assert.equal((await emailTicket(u,"a","unknown","fictional@example.test")).state,"unknown");
  assert.equal((await emailTicket(u,"a","unknown","fictional@example.test")).state,"unknown");
  assert.equal(f.calls,1);
});
