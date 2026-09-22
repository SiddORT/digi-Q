// Isolated service/route regressions: no HTTP listener, Clerk calls, or database writes.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "clinicflow-audit-"));
const root = resolve(import.meta.dirname);
process.env.SESSION_SECRET = "unit-test-only-appointment-qr-secret";
mock.timers.enable({apis:["Date"],now:Date.UTC(2030,0,7,12)});
const tables = ["appointments", "patients", "appointmentHistory", "doctors", "clinics", "branches", "masters", "schedules", "availabilityExceptions", "assignments", "users", "qrs", "auditLogs", "settings", "otpChallenges"];
const fixture = `
export const state = { rows: {}, config: {}, actor: null };
export const reset = () => { state.rows = {}; state.config = { bookingHorizonDays: 30, cancellationCutoffMinutes: 0 }; };
export const all = async table => state.rows[table.name] || [];
export const flatten = row => row;
export const one = async (table, id) => { const row = (await all(table)).find(r => r.id === id); if (!row) throw Object.assign(new Error("Not found"), {status:404}); return {...row}; };
export const uid = () => crypto.randomUUID();
export const put = async (table, value) => { const row = {status:table.name === "appointments" ? "booked" : "active", createdAt:new Date().toISOString(), ...value.data, ...value}; delete row.data; (state.rows[table.name] ||= []).push(row); return {...row}; };
export const change = async (table,id,value) => { const row = (await all(table)).find(r=>r.id===id); Object.assign(row,value.data,value); delete row.data; return {...row}; };
export const audit = async () => {};
export const getSettings = async () => state.config;
export const filtered = (rows,q) => rows.filter(r => Object.entries(q).every(([k,v]) => !v || !["doctorId","branchId","clinicId","date","patientId","status"].includes(k) || r[k] === v));
export const paginate = rows => ({items:rows,total:rows.length,page:1,pageSize:20});
`;
await build({
  stdin: { contents: `
    export * from "./lib/appointments";
    export * from "./lib/availability";
    export * from "./lib/auth";
    export * from "./lib/appointment-qr";
    export * from "./lib/http";
    export * from "./routes/appointments";
    export * from "./routes/queue";
    export * from "./routes/resources";
    export * from "./routes/public";
    export * from "./routes/reporting";
    export { state, reset } from "audit-fixture";
  `, resolveDir: root },
  outfile: join(directory, "suite.mjs"), bundle: true, platform: "node", format: "esm",
  packages: "external",
  plugins: [{
    name: "isolated-persistence",
    setup(b) {
      b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({path:resolve(root,"../../../lib/api-zod/src/index.ts")}));
      b.onResolve({ filter: /^(audit-fixture|@workspace\/db|@clerk\/express|drizzle-orm)$/ }, a => ({path:a.path,namespace:"fixture"}));
      b.onResolve({ filter: /\/store$/ }, () => ({path:"audit-fixture",namespace:"fixture"}));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => {
        if (a.path === "audit-fixture") return {contents:fixture};
        if (a.path === "@clerk/express") return {contents:"export const clerkClient = {}; export const getAuth = () => ({});"};
        if (a.path === "drizzle-orm") return {contents:"export const eq = (field,value) => ({field,value}); export const sql = () => ({});"};
        return {contents: `
          import {state,all} from "audit-fixture";
          ${tables.map(t => `export const ${t} = {name:"${t}",id:"id",status:"status",clinicId:"clinicId",branchId:"branchId",doctorId:"doctorId",publicReference:"publicReference"};`).join("\n")}
          export const db = {execute:async()=>{},transaction:async fn=>fn(db),select:()=>({from:table=>({where:condition=>({for:async()=> (await all(table)).filter(r=>r[condition.field]===condition.value)})})})};
        `};
      });
      b.onLoad({ filter: /lib\/auth\.ts$/ }, async a => ({
        contents: (await readFile(a.path,"utf8")).replace(/export async function requireUser\(req: Request\) \{[\s\S]*?\n\}/, 'export async function requireUser(req: Request) { return (await import("audit-fixture")).state.actor; }'),
        loader:"ts",
      }));
    },
  }],
});
// Resolve external runtime packages from the API workspace, not the temporary directory.
// Move the bundle next to this test for module resolution; always remove it afterwards.
const localBundle = join(root, ".backend-flow-test.mjs");
const { copyFile } = await import("node:fs/promises");
await copyFile(join(directory,"suite.mjs"),localBundle);
const api = await import(localBundle);
const { after } = await import("node:test");
after(async () => { await rm(localBundle,{force:true}); await rm(directory,{recursive:true,force:true}); });

const staff = { id:"staff",role:"receptionist",clinicIds:["c"],branchIds:["b"] };
function seed() {
  api.reset(); api.state.actor = staff;
  const now = api.localNow("UTC");
  api.state.rows = {
    clinics:[{id:"c",status:"active",name:"Clinic"}],
    branches:[{id:"b",clinicId:"c",status:"active",timezone:"UTC"}],
    doctors:[{id:"d",userId:"du",status:"active"}],
    users:[{id:"du",role:"doctor",fullName:"Doctor",status:"active"}],
    assignments:[{userId:"du",clinicId:"c",branchId:"b"}],
    patients:[{id:"p",clinicId:"c",branchId:"b",fullName:"Patient",mobile:"+15555550123",status:"active",mobileVerified:true}],
    schedules:[{id:"s",doctorId:"d",branchId:"b",dayOfWeek:new Date(now.date+"T12:00:00Z").getUTCDay(),status:"active",isOpen:true,startTime:"00:00",endTime:"23:59",queueOpenTime:"00:00",timezone:"UTC",maxTokens:10,tokenPrefix:"A"}],
  };
  return {patientId:"p",doctorId:"d",clinicId:"c",branchId:"b",date:now.date,source:"online",requestId:crypto.randomUUID()};
}
async function route(router, method, path, body = {}, query = {}) {
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
  let result;
  const res = {status(){return this;},json(value){result=value;return this;}};
  await layer.route.stack[0].handle({body,query,params:{}},res);
  return result;
}
const book = body => route(api.appointmentsRouter,"post","/appointments",body);

test("advance booking remains booked; walk-in follows shared lifecycle and idempotency", async () => {
  const body = seed();
  const advance = await book(body);
  assert.equal(advance.status,"booked");
  await assert.rejects(book({...body,source:"walkIn"}),/Idempotency/);
  const walk = await book({...body,patientId:"p2",source:"walkIn",requestId:"walk"}).catch(e => {
    assert.match(e.message,/Not found/);
    api.state.rows.patients.push({...api.state.rows.patients[0],id:"p2"});
    return book({...body,patientId:"p2",source:"walkIn",requestId:"walk"});
  });
  assert.equal(walk.status,"waiting"); assert.equal(walk.token,"A-02");
  assert.deepEqual(walk.history.map(h=>h.status),["booked","checkedIn","waiting"]);
  assert.ok(walk.checkedInAt && walk.waitingAt);
  assert.equal((await book({...body,patientId:"p2",source:"walkIn",requestId:"walk"})).id,walk.id);
  assert.equal(api.state.rows.appointments.length,2);
});
test("booking rejects invalid scope, inactive context, duplicate, full, past, horizon, OTP and closed queue", async () => {
  let body = seed();
  await assert.rejects(book({...body,clinicId:"other"}),/scope/);
  api.state.rows.assignments = []; await assert.rejects(book(body),/assigned/);
  for (const table of ["doctors","users","clinics","branches","patients"]) {
    body=seed(); api.state.rows[table][0].status="inactive";
    await assert.rejects(book(body),/inactive/);
  }
  body=seed(); await book(body); await assert.rejects(book({...body,requestId:"other"}),/already has/);
  body=seed(); api.state.rows.schedules[0].maxTokens=0; await assert.rejects(book(body),/capacity/);
  body=seed(); await assert.rejects(book({...body,date:"2000-01-01"}),/past/);
  await assert.rejects(book({...body,date:"2099-01-01"}),/horizon/);
  body=seed(); api.state.rows.availabilityExceptions=[{doctorId:"d",branchId:"b",date:body.date,status:"active",isClosed:true}];
  await assert.rejects(book(body),/Closed/);
  body=seed(); api.state.config.requireMobileVerification=true; api.state.rows.patients[0].mobileVerified=false;
  await assert.rejects(book({...body,source:"phone"}),/verification/);
  body=seed(); api.state.rows.schedules[0].queueCloseTime="00:00";
  assert.equal((await api.availability("d","b",body.date)).reason,"Queue booking has closed");
  await assert.rejects(book(body),/closed/);
  body=seed(); api.state.rows.schedules[0].queueOpenTime="13:00";
  await assert.rejects(book({...body,source:"walkIn"}),/not opened/);
  body=seed(); api.state.rows.schedules[0].breakStart="11:00"; api.state.rows.schedules[0].breakEnd="13:00";
  await assert.rejects(book({...body,source:"walkIn"}),/break/);
  body=seed(); api.state.rows.schedules[0].queueMode="appointmentsOnly";
  await assert.rejects(book({...body,source:"walkIn"}),/appointments only/);
  body=seed(); api.state.rows.schedules[0].queueMode="walkInsOnly";
  await assert.rejects(book({...body,source:"phone"}),/walk-ins only/);
  body=seed();
  api.state.rows.schedules.push({...api.state.rows.schedules[0],dayOfWeek:2});
  await assert.rejects(book({...body,source:"walkIn",date:"2030-01-08"}),/today/);
});
test("queue lifecycle, oldest waiting, active consultation guard and patient privacy", async () => {
  const body=seed(); const first=await book({...body,source:"walkIn"});
  api.state.rows.patients.push({...api.state.rows.patients[0],id:"p2",fullName:"Private person"});
  const second=await book({...body,patientId:"p2",source:"walkIn",requestId:"second"});
  const q={doctorId:"d",branchId:"b",date:body.date};
  const called=await route(api.queueRouter,"post","/queue/call-next",q);
  assert.equal(called.appointment.id,first.id);
  await assert.rejects(route(api.queueRouter,"post","/queue/call-next",q),/already called/);
  api.state.actor={id:"patient",role:"patient",patientId:"p2",clinicIds:[],branchIds:[]};
  const queue=await route(api.queueRouter,"get","/queue",{},q);
  assert.equal(queue.entries,undefined); assert.equal(queue.ownEntry.patientsAhead,1);
  assert.equal(queue.currentToken,first.token);
  await assert.rejects(route(api.queueRouter,"get","/queue",{}, {...q,appointmentId:first.id}),/do not have/);
  assert.equal(await api.canRead(api.state.actor,"appointments",first),false);
  const doctor={role:"doctor",doctorId:"other",clinicIds:["c"],branchIds:["b"]};
  assert.equal(await api.canRead(doctor,"appointments",first),false);
  api.state.actor=doctor;
  await assert.rejects(route(api.queueRouter,"get","/queue",{},q),/Queue outside/);
  const revokedDoctor={id:"du",role:"doctor",doctorId:"d",clinicIds:[],branchIds:[]};
  assert.equal(await api.canRead(revokedDoctor,"appointments",first),false);
  assert.equal(await api.canRead(revokedDoctor,"patients",api.state.rows.patients[0]),false);
  assert.equal(await api.canRead(revokedDoctor,"clinics",{id:"c",ownerId:"du"}),false);
  assert.equal(api.scope({...staff,branchIds:["other"]},"c","b"),false);
  await assert.rejects(api.transition(doctor,first.id,{action:"start"}),/scope/);
  api.state.actor=staff;
  await api.transition(staff,first.id,{action:"start"});
  const completed=await api.transition(staff,first.id,{action:"complete"});
  assert.equal(completed.status,"completed");
  await assert.rejects(api.transition(staff,first.id,{action:"checkIn"}),/Invalid/);
  await api.transition(staff,second.id,{action:"noShow"});
  assert.equal((await api.transition(staff,second.id,{action:"requeue"})).status,"waiting");
  api.state.rows.appointments.find(a=>a.id===second.id).startTime="23:59";
  assert.equal((await api.transition(staff,second.id,{action:"cancel"})).status,"cancelled");
  for (const action of ["checkIn","call","start","complete","requeue"]) await assert.rejects(api.transition(staff,second.id,{action}),/Invalid/);
});
test("QR booking converges on booked and rejects revoked or reassigned references", async () => {
  const body=seed();
  api.state.rows.qrs=[{id:"qr",publicReference:"valid",clinicId:"c",branchId:"b",doctorId:"d",status:"active"}];
  const row=await book({...body,source:"qr",qrReference:"valid"});
  assert.equal(row.status,"booked"); assert.equal(row.token,"A-01");
  api.state.rows.qrs[0].publicReference="new";
  await assert.rejects(api.resolveQr("valid"),/expired or revoked/);
  api.state.rows.patients.push({...api.state.rows.patients[0],id:"p2"});
  await assert.rejects(book({...body,patientId:"p2",requestId:"revoked",source:"qr",qrReference:"valid"}),/expired or revoked/);
  api.state.rows.qrs[0].status="inactive"; await assert.rejects(api.resolveQr("new"),/expired or revoked/);
  api.state.rows.qrs[0].status="active"; api.state.rows.assignments=[];
  await assert.rejects(api.resolveQr("new"),/context/);
});
test("appointment QR signatures reject tampering and check-in is transactionally idempotent", async () => {
  const body=seed();
  const booked=await book(body);
  const payload=api.createAppointmentQrPayload(booked.reference);
  assert.equal(api.readAppointmentQrPayload(payload),booked.reference);
  const pieces=payload.split(".");
  pieces[2]=(pieces[2][0]==="A"?"B":"A")+pieces[2].slice(1);
  const tampered=pieces.join(".");
  assert.throws(()=>api.readAppointmentQrPayload(tampered),/Invalid appointment QR/);

  const resolved=await api.resolveAppointmentQr(staff,payload);
  assert.equal(resolved.eligible,true);
  assert.equal(resolved.alreadyCheckedIn,false);
  const checkedIn=await api.checkInAppointmentQr(staff,payload);
  assert.equal(checkedIn.appointment.status,"waiting");
  assert.equal(checkedIn.appointment.token,booked.token);
  assert.equal(checkedIn.alreadyCheckedIn,false);
  const historyCount=api.state.rows.appointmentHistory.length;
  const repeated=await api.checkInAppointmentQr(staff,payload);
  assert.equal(repeated.alreadyCheckedIn,true);
  assert.equal(repeated.appointment.token,booked.token);
  assert.equal(api.state.rows.appointmentHistory.length,historyCount);

  const outsider={id:"outsider",role:"receptionist",clinicIds:["other"],branchIds:["other"]};
  await assert.rejects(api.resolveAppointmentQr(outsider,payload),/outside your scope/);
});
test("appointment QR check-in rejects terminal states and non-current branch dates", async () => {
  const body=seed();
  const booked=await book(body);
  const payload=api.createAppointmentQrPayload(booked.reference);
  for (const status of ["cancelled","completed","noShow"]) {
    api.state.rows.appointments[0].status=status;
    await assert.rejects(api.resolveAppointmentQr(staff,payload),new RegExp(`Cannot check in a ${status}`));
  }
  api.state.rows.appointments[0].status="booked";
  api.state.rows.appointments[0].date="2030-01-08";
  await assert.rejects(api.resolveAppointmentQr(staff,payload),/appointment date/);
});
test("staff duplicate mobile rejects same accessible clinic without modifying household records", async () => {
  seed();
  await assert.rejects(route(api.resourcesRouter,"post","/patients",{fullName:"Duplicate",mobile:"+15555550123",clinicId:"c",branchId:"b"}),/already exists/);
  assert.equal(api.state.rows.patients.length,1);
  const row=await route(api.resourcesRouter,"post","/patients",{fullName:"New",mobile:"+15555550456",clinicId:"c",branchId:"b"});
  assert.equal(row.mobile,"+15555550456");
  api.state.actor={role:"clinicAdmin",id:"ca",clinicIds:["c"],branchIds:["b"]};
  await assert.rejects(route(api.resourcesRouter,"post","/masters",{category:"specialization",name:"Denied",code:"denied"}),/Permission/);
});
test("QR writes enforce doctor's own context and actual clinic assignment", async () => {
  seed();
  api.state.actor={role:"doctor",id:"du",doctorId:"d",clinicIds:["c"],branchIds:["b"]};
  await assert.rejects(route(api.resourcesRouter,"post","/qrs",{name:"No doctor",clinicId:"c"}),/own doctor/);
  await assert.rejects(route(api.resourcesRouter,"post","/qrs",{name:"Other doctor",clinicId:"c",doctorId:"other"}),/own doctor/);
  api.state.actor=staff; api.state.rows.assignments=[];
  await assert.rejects(route(api.resourcesRouter,"post","/qrs",{name:"Unassigned",clinicId:"c",doctorId:"d"}),/assigned to this clinic/);
});
test("unexpected and database errors never expose internal messages", () => {
  for (const error of [new Error("secret SQL stack"),Object.assign(new Error("sensitive constraint"),{code:"23505"})]) {
    let response;
    api.errors(error,{log:{error(){}}},{status(){return this;},json(value){response=value;}},()=>{});
    assert.doesNotMatch(response.error,/secret|SQL|stack|sensitive/);
  }
});
test("wrapped database integrity errors return a sanitized conflict", () => {
  const nested=Object.assign(new Error("duplicate branch_name_clinic_unique detail"),{code:"23505"});
  const wrapped=Object.assign(new Error("Failed query: insert into branches"),{cause:nested});
  let status,response;
  api.errors(wrapped,{log:{error(){throw new Error("conflicts must not be logged as server failures");}}},{status(value){status=value;return this;},json(value){response=value;}},()=>{});
  assert.equal(status,409);
  assert.deepEqual(response,{error:"Record conflicts with existing data or references",code:"CONFLICT"});
  assert.equal(api.databaseIntegrityCode(wrapped),"23505");
});
test("shared staff responses project assignments to the actor scope", async () => {
  seed();
  api.state.rows.branches[0].name="Branch";
  api.state.rows.clinics.push({id:"other-clinic",status:"active",name:"Other Clinic"});
  api.state.rows.branches.push({id:"other-branch",clinicId:"other-clinic",status:"active",name:"Other Branch"});
  const peer={id:"peer",role:"receptionist",clinicIds:["c","other-clinic"],branchIds:["b","other-branch"]};
  const admin={id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:[]};
  const projected=await api.projectAssignmentScope(admin,"users",peer);
  assert.deepEqual(projected.clinicIds,["c"]);
  assert.deepEqual(projected.branchIds,["b"]);
  assert.deepEqual(projected.clinicNames,["Clinic"]);
  assert.deepEqual(projected.branchNames,["Branch"]);
  const own=await api.projectAssignmentScope({...peer,doctorId:null},"users",peer);
  assert.deepEqual(own.clinicIds,peer.clinicIds);
  assert.deepEqual(own.branchIds,peer.branchIds);
});
test("dashboard rejects revoked explicit scope and excludes unrelated doctors", async () => {
  seed();
  api.state.actor={id:"revoked",role:"receptionist",clinicIds:[],branchIds:[]};
  await assert.rejects(route(api.reportingRouter,"get","/dashboard",{}, {clinicId:"c",branchId:"b",date:"2030-01-07"}),/outside your scope/);
  api.state.actor=staff;
  api.state.rows.clinics.push({id:"other-clinic",status:"active",name:"Other Clinic"});
  api.state.rows.branches.push({id:"other-branch",clinicId:"other-clinic",status:"active",name:"Other Branch"});
  api.state.rows.assignments=[{userId:"du",clinicId:"other-clinic",branchId:"other-branch"}];
  const dashboard=await route(api.reportingRouter,"get","/dashboard",{}, {clinicId:"c",branchId:"b",date:"2030-01-07"});
  assert.equal(dashboard.totalDoctors,0);
});
test("unchanged serialized ownership is not treated as a transfer", () => {
  assert.equal(api.ownershipChangeRequested(undefined,"admin-a"),false);
  assert.equal(api.ownershipChangeRequested("admin-a","admin-a"),false);
  assert.equal(api.ownershipChangeRequested("admin-b","admin-a"),true);
});
test("schedule overlap compares real instants across timezones and closed exceptions", () => {
  const india={isOpen:true,startTime:"09:00",endTime:"10:00",timezone:"Asia/Kolkata"};
  const london={isOpen:true,startTime:"03:30",endTime:"04:30",timezone:"Europe/London"};
  assert.equal(api.sessionsOverlap(india,"2030-01-07",london,"2030-01-07"),true);
  assert.equal(api.sessionsOverlap(india,"2030-01-07",{...london,startTime:"05:00",endTime:"06:00"},"2030-01-07"),false);
  assert.equal(api.sessionsOverlap(india,"2030-01-07",{...london,isClosed:true},"2030-01-07"),false);
});