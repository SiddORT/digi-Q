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
const tables = ["appointments", "patients", "appointmentHistory", "doctors", "clinics", "branches", "masters", "schedules", "availabilityExceptions", "assignments", "users", "qrs", "auditLogs", "settings", "otpChallenges", "staffSessionProofs"];
const fixture = `
export const state = { rows: {}, config: {}, actor: null, clerk: {} };
export const reset = () => {
  state.rows = {};
  state.config = { bookingHorizonDays: 30, cancellationCutoffMinutes: 0 };
  state.clerk = {
    users: [],
    invitations: [],
     sessions: new Map(),
    getUserList: async ({userId} = {}) => ({data:state.clerk.users.filter(u => !userId || userId.includes(u.id))}),
     getSession: async id => {
       const session = state.clerk.sessions.get(id);
       if (!session) throw Object.assign(new Error("Session not found"), {status:404});
       return session;
     },
    getUser: async id => state.clerk.users.find(user => user.id === id) || {id,passwordEnabled:false},
    getInvitationList: async ({query,status} = {}) => ({
      data: state.clerk.invitations.filter(invitation =>
        (!query || invitation.emailAddress === query) && (!status || invitation.status === status)),
    }),
    revokeInvitation: async id => {
      const invitation=state.clerk.invitations.find(item => item.id === id);
      if (!invitation || invitation.status !== "pending") throw new Error("Invitation is not pending");
      invitation.status="revoked";
      return invitation;
    },
    createInvitation: async input => {
      const invitation={id:"inv-"+crypto.randomUUID(),status:"pending",...input};
      state.clerk.invitations.push(invitation);
      return invitation;
    },
  };
};
export const all = async table => state.rows[table.name] || [];
export const flatten = row => row;
export const one = async (table, id) => { const row = (await all(table)).find(r => r.id === id); if (!row) throw Object.assign(new Error("Not found"), {status:404}); return {...row}; };
export const uid = () => crypto.randomUUID();
export const put = async (table, value) => {
  if (table.name === "clinics" && state.config.failClinicInsert) throw new Error("forced clinic insert failure");
  const row = {status:table.name === "appointments" ? "booked" : "active", createdAt:new Date().toISOString(), ...value.data, ...value}; delete row.data;
  (state.rows[table.name] ||= []).push(row);
  if (table.name === "clinics") (state.rows.assignments ||= []).push({id:crypto.randomUUID(),userId:row.adminId,clinicId:row.id,branchId:null});
  return {...row};
};
export const change = async (table,id,value) => { const row = (await all(table)).find(r=>r.id===id); Object.assign(row,value.data,value); delete row.data; return {...row}; };
export const audit = async () => {};
export const getSettings = async () => state.config;
export const filtered = (rows,q) => rows.filter(r => Object.entries(q).every(([k,v]) => !v || !["doctorId","branchId","clinicId","date","patientId","status"].includes(k) || r[k] === v));
export const paginate = (rows,q={}) => {const page=q.page||1,pageSize=q.pageSize||20;return {items:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize};};
`;
await build({
  stdin: { contents: `
    export * from "./lib/appointments";
    export * from "./lib/queue-order";
    export * from "./lib/availability";
    export * from "./lib/auth";
    export * from "./lib/appointment-qr";
    export * from "./lib/http";
    export * from "./routes/appointments";
    export * from "./routes/queue";
    export * from "./routes/resources";
    export * from "./routes/public";
    export * from "./routes/reporting";
    export { ListSchedulesQueryParams, ListAvailabilityExceptionsQueryParams, ListQrsQueryParams, ListUsersQueryParams, ListPatientsQueryParams, ListAuditLogsQueryParams, ListPublicClinicsQueryParams, ListPublicBranchesQueryParams, ListPublicDoctorsQueryParams, GetStaffAssignmentOptionsQueryParams } from "@workspace/api-zod";
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
      // Legacy lifecycle tests use a repository double. list-query.test.mjs separately
      // executes the real query compiler against PostgreSQL with large isolated fixtures.
      b.onResolve({ filter: /\/list-query$/ }, () => ({path:"list-query",namespace:"fixture"}));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, a => {
        if (a.path === "list-query") return {resolveDir:join(root,"lib"),contents:`
          import {state,all,filtered,paginate} from "audit-fixture";
          import {scoped,projectAssignmentScope} from "./auth";
          import {enrich} from "./entities";
          export const sourceSql=()=>({});
          export const filterSql=()=>({});
          export const metricSql={};
          export const assignmentCatalogPredicate=(kind,manager)=>({strings:[kind==="clinics"?(manager?"r.admin_id":""):"exists(select 1 from clinics"],values:manager?[manager]:[]});
          export const pageParams=q=>({page:q.page||1,pageSize:q.pageSize||20});
          const values=s=>s?.values?.flatMap(v=>v?.values?values(v):[v])||[];
          const textOf=s=>(s?.strings||[]).join("")+(s?.values||[]).filter(v=>v?.strings).map(textOf).join("");
          export async function queryPage(user,kind,q={},extra) {
            let rows=await Promise.all((state.rows[kind==="audit-logs"?"auditLogs":kind]||[]).map(r=>enrich(kind,r)));
            rows=await scoped(user,kind,rows);
            rows=await Promise.all(rows.map(r=>projectAssignmentScope(user,kind,r)));
            const text=textOf(extra), args=values(extra);
            if(text.includes("r.admin_id")) rows=rows.filter(r=>r.adminId===args[0]);
            if(text.includes("exists(select 1 from clinics")) rows=rows.filter(r=>state.rows.clinics.some(c=>c.id===r.clinicId&&(!args.length||c.adminId===args[0])));
            if(text.includes("r.id=")) rows=rows.filter(r=>r.id===args[args.length-1]);
            rows=filtered(rows,q);
            if(q.selectedIds) rows=rows.filter(r=>q.selectedIds.split(",").includes(r.id));
            const result=paginate(rows,q); return {...result,totalPages:Math.ceil(result.total/result.pageSize)};
          }
          export async function queryMetrics(user,q) {
            const rows=(await queryPage(user,"appointments",{...q,pageSize:100})).items;
            return {appointments:rows.length,waiting:rows.filter(r=>r.status==="waiting").length,activeQueues:0,currentToken:null};
          }
        `};
        if (a.path === "audit-fixture") return {contents:fixture};
        if (a.path === "@clerk/express") return {contents:`
          import {state} from "audit-fixture";
          export const clerkClient = {
            users:{
              getUserList:value=>state.clerk.getUserList(value),
              getUser:value=>state.clerk.getUser(value),
            },
             sessions:{getSession:id=>state.clerk.getSession(id)},
            invitations:{
              getInvitationList:value=>state.clerk.getInvitationList(value),
              createInvitation:value=>state.clerk.createInvitation(value),
              revokeInvitation:value=>state.clerk.revokeInvitation(value),
            },
          };
          export const getAuth = () => ({});
        `};
        if (a.path === "drizzle-orm") return {contents:"export const eq = (field,value) => ({field,value}); export const gt = (field,value) => ({field,value,operator:'gt'}); export const and = (...conditions) => ({conditions}); export const sql = (strings,...values) => ({strings,values}); sql.raw=text=>({strings:[text],values:[]}); sql.join=(values)=>({strings:[],values});"};
        return {contents: `
          import {state,all} from "audit-fixture";
          ${tables.map(t => `export const ${t} = {name:"${t}",id:"id",status:"status",clinicId:"clinicId",branchId:"branchId",doctorId:"doctorId",publicReference:"publicReference"};`).join("\n")}
           const locks = new Map();
           async function acquire(key) {
             const previous = locks.get(key) || Promise.resolve();
             let release;
             const held = new Promise(resolve => { release = resolve; });
             const queued = previous.then(() => held);
             locks.set(key, queued);
             await previous;
             return () => { release(); if (locks.get(key) === queued) locks.delete(key); };
           }
            const select = () => ({from:table=>({where:condition=>({then:(resolve,reject)=>all(table).then(rows=>rows.filter(r=>r[condition.field]===condition.value)).then(resolve,reject),for:async()=> (await all(table)).filter(r=>r[condition.field]===condition.value),limit:async n=>(await all(table)).slice(0,n)})})});
           const remove = table => ({where:async condition => {
             const rows = state.rows[table.name] || [];
             state.rows[table.name] = rows.filter(row=>row[condition.field]!==condition.value);
           }});
           const insert = table => ({values:value => {
             const row={...value};
             (state.rows[table.name] ||= []).push(row);
              return {onConflictDoNothing:async()=>row,onConflictDoUpdate:async({set})=>{
                const original=state.rows[table.name].find(r=>r.id===row.id&&r!==row);
                if(original){Object.assign(original,set);state.rows[table.name]=state.rows[table.name].filter(r=>r!==row);}
              },returning:async()=>[row]};
           }});
           export const db = {
             execute:async statement=>{
               const text=statement?.strings?.join("")||"";
               if(text.includes("count(*) filter")) {
                 const rows=state.rows.appointments||[],current=rows.find(r=>["called","inConsultation"].includes(r.status));
                 return {rows:[{total:rows.length,waiting:rows.filter(r=>r.status==="waiting").length,inConsultation:rows.filter(r=>r.status==="inConsultation").length,completed:rows.filter(r=>r.status==="completed").length,noShow:rows.filter(r=>r.status==="noShow").length,ahead:0,current,nextToken:rows.find(r=>r.status==="waiting")?.token}]};
               }
               if(text.includes("from clinics")) return {rows:state.rows.clinics||[]};
               if(text.includes("from branches")) return {rows:state.rows.branches||[]};
               if(text.includes("from users")) {
                 const values=s=>s?.values?.flatMap(v=>v?.values?values(v):[v])||[];
                 const ids=values(statement);
                 return {rows:(state.rows.users||[]).filter(u=>ids.includes(u.id)&&u.role==="clinicAdmin"&&u.status==="active")};
               }
               return {rows:[]};
             },
             select,
             delete:remove,
             insert,
             transaction:async fn => {
                const snapshot=structuredClone(state.rows);
               const releases = [];
               const tx = {
                 select,
                 delete:remove,
                 insert,
                 execute:async statement => {
                   const key = statement?.values?.find(value => typeof value === "string" && /^(staff-invitation|doctors|clinics|users):/.test(value));
                   if (key) releases.push(await acquire(key));
                 },
               };
                try { return await fn(tx); }
                catch (error) { state.rows=snapshot; throw error; }
                finally { for (const release of releases.reverse()) release(); }
             },
           };
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
    clinics:[{id:"c",adminId:"admin",status:"active",name:"Clinic"}],
    branches:[{id:"b",clinicId:"c",status:"active",timezone:"UTC"}],
    doctors:[{id:"d",userId:"du",ownerAdminId:"admin",status:"active"}],
    users:[{id:"du",role:"doctor",fullName:"Doctor",status:"active",invitationStatus:"notRequired"},{id:"admin",role:"clinicAdmin",fullName:"Admin",status:"active",invitationStatus:"notRequired"}],
    assignments:[{userId:"du",clinicId:"c",branchId:"b"}],
    patients:[{id:"p",clinicId:"c",branchId:"b",fullName:"Patient",mobile:"+15555550123",status:"active",mobileVerified:true}],
    schedules:[{id:"s",doctorId:"d",branchId:"b",dayOfWeek:new Date(now.date+"T12:00:00Z").getUTCDay(),status:"active",isOpen:true,startTime:"00:00",endTime:"23:59",queueOpenTime:"00:00",timezone:"UTC",maxTokens:10,tokenPrefix:"A"}],
  };
  return {patientId:"p",doctorId:"d",clinicId:"c",branchId:"b",date:now.date,source:"online",requestId:crypto.randomUUID()};
}
async function route(router, method, path, body = {}, query = {}, params = {}) {
  const layer = router.stack.find(l => l.route?.path === path && l.route.methods[method]);
  let result;
  const res = {status(){return this;},json(value){result=value;return this;}};
  await layer.route.stack[0].handle({
    body,query,params,
    get(name) {
      if (name.toLowerCase() === "origin") return "https://clinicflow.example";
      if (["host","x-forwarded-host"].includes(name.toLowerCase())) return "clinicflow.example";
    },
  },res);
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
  await api.transition(staff,second.id,{action:"noShow",reason:"Temporarily absent"});
  assert.equal((await api.transition(staff,second.id,{action:"requeue",reason:"Returned to reception",position:1,expectedRevision:api.state.rows.appointments.find(a=>a.id===second.id).revision,expectedQueueVersion:api.queueVersion(api.state.rows.appointments)})).status,"waiting");
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
  api.state.rows.clinics.push({id:"other-clinic",adminId:"admin",status:"active",name:"Other Clinic"});
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
test("doctor management catalog follows managing admin without broadening operational scope", async () => {
  seed();
  api.state.actor={id:"du",role:"doctor",doctorId:"d",managingAdminId:"admin",clinicIds:["c"],branchIds:["b"]};
  api.state.rows.clinics.push(
    {id:"catalog-clinic",adminId:"admin",status:"active",name:"Catalog Clinic"},
    {id:"foreign-clinic",adminId:"admin2",status:"active",name:"Foreign Clinic"},
  );
  api.state.rows.branches.push(
    {id:"catalog-branch",clinicId:"catalog-clinic",status:"active",name:"Catalog Branch"},
    {id:"foreign-branch",clinicId:"foreign-clinic",status:"active",name:"Foreign Branch"},
  );
  api.state.rows.users.push(
    {id:"admin2",role:"clinicAdmin",fullName:"Other Admin",status:"active",invitationStatus:"notRequired"},
    {id:"managed-rec",role:"receptionist",fullName:"Managed",status:"active",managingAdminId:"admin",clinicIds:["catalog-clinic"],branchIds:["catalog-branch"],invitationStatus:"failed"},
  );
  const before=api.state.rows.assignments.length;
  const options=await route(api.resourcesRouter,"get","/staff-assignment-options",{}, {targetRole:"receptionist"});
  assert.deepEqual(options.clinics.map(c=>c.id).sort(),["c","catalog-clinic"]);
  assert.deepEqual(options.branches.map(b=>b.id).sort(),["b","catalog-branch"]);
  assert.deepEqual(options.managingAdmins,[{id:"admin",fullName:"Admin"}]);
  assert.equal(api.state.rows.assignments.length,before);
  assert.equal(await api.canRead(api.state.actor,"clinics",api.state.rows.clinics[1]),false);
  assert.equal(await api.canRead(api.state.actor,"users",api.state.rows.users.find(u=>u.id==="managed-rec")),true);
  await assert.rejects(route(api.resourcesRouter,"get","/staff-assignment-options",{}, {targetRole:"receptionist",managingAdminId:"admin2"}),/outside this assignment catalog/);
});
test("assignment catalogs reject foreign owner overrides for both Clinic Admin and Doctor", async () => {
  seed();
  api.state.rows.users.push({id:"rec",role:"receptionist",fullName:"Managed",status:"active",managingAdminId:"admin"});
  for(const actor of [
    {id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:[]},
    {id:"du",role:"doctor",doctorId:"d",managingAdminId:"admin",clinicIds:["c"],branchIds:["b"]},
  ]) {
    api.state.actor=actor;
    for(const context of [{},{userId:"rec"}]) {
      await assert.rejects(route(api.resourcesRouter,"get","/staff-assignment-options",{},{
        targetRole:"receptionist",managingAdminId:"foreign",...context,
      }),error=>error.status===403&&/outside this assignment catalog/.test(error.message));
      const allowed=await route(api.resourcesRouter,"get","/staff-assignment-options",{},{
        targetRole:"receptionist",managingAdminId:"admin",...context,
      });
      assert.deepEqual(allowed.clinics.map(c=>c.id),["c"]);
    }
  }
  api.state.actor={id:"du",role:"doctor",doctorId:"d",managingAdminId:null,clinicIds:["c"],branchIds:["b"]};
  await assert.rejects(route(api.resourcesRouter,"get","/staff-assignment-options",{},{
    targetRole:"receptionist",managingAdminId:"foreign",
  }),error=>error.status===403);
  await assert.rejects(route(api.resourcesRouter,"get","/staff-assignment-options",{},{
    targetRole:"receptionist",
  }),error=>error.status===403);
});
test("assignment managingAdmins is bounded by the clinic page, not the entire ownership catalog", async () => {
  seed();
  api.state.actor={id:"super",role:"superAdmin",clinicIds:[],branchIds:[]};
  api.state.rows.clinics=Array.from({length:120},(_,i)=>({id:"clinic-"+i,adminId:"manager-"+i,status:"active",name:"Clinic "+i}));
  api.state.rows.users=Array.from({length:120},(_,i)=>({id:"manager-"+i,role:"clinicAdmin",status:"active",fullName:"Manager "+i}));
  api.state.rows.branches=[];
  for(const pageSize of [10,20,50,100]) {
    const result=await route(api.resourcesRouter,"get","/staff-assignment-options",{}, {targetRole:"receptionist",page:1,pageSize});
    assert.equal(result.pagination.clinics.total,120);
    assert.equal(result.clinics.length,pageSize);
    assert.equal(result.managingAdmins.length,pageSize);
    assert.ok(result.managingAdmins.every(a=>result.clinics.some(c=>c.adminId===a.id)));
  }
  const second=await route(api.resourcesRouter,"get","/staff-assignment-options",{}, {targetRole:"receptionist",page:2,pageSize:100});
  assert.equal(second.managingAdmins.length,20);
});
test("actual staff assignment lookup sends selectedIds with edited identity for inactive hydration", async () => {
  const lookup=await readFile(resolve(root,"../../clinicflow/src/components/ResourceLookup.tsx"),"utf8");
  const users=await readFile(resolve(root,"../../clinicflow/src/Users.tsx"),"utf8");
  assert.match(lookup,/getStaffAssignmentOptions\(\{\s*\.\.\.params,[^}]*selectedIds:\s*selected\.join\(","\)/);
  assert.match(lookup,/selected\.length > 0/);
  assert.match(users,/doctorId:\s*tab === "doctors" \? initial\.id/);
  assert.match(users,/userId:\s*tab === "receptionists" \? initial\.id/);
});
test("assignment validation derives one owner for both staff roles, including Super Admin", async () => {
  seed();
  api.state.rows.users.push({id:"admin2",role:"clinicAdmin",fullName:"Other Admin",status:"active"});
  api.state.rows.clinics.push({id:"c2",adminId:"admin2",status:"active",name:"Other"});
  api.state.rows.branches.push({id:"b2",clinicId:"c2",status:"active",name:"Other Branch"});
  const superAdmin={id:"sa",role:"superAdmin",clinicIds:[],branchIds:[]};
  assert.equal(await api.validateAssignments(superAdmin,["c"],[],"doctor"),"admin");
  assert.equal(await api.validateAssignments(superAdmin,["c"],["b"],"receptionist"),"admin");
  await assert.rejects(api.validateAssignments(superAdmin,["c","c2"],["b","b2"],"receptionist"),/same Clinic Admin/);
  await assert.rejects(api.validateAssignments(superAdmin,["c"],[],"receptionist"),/at least one valid branch/);
  await assert.rejects(api.validateAssignments(superAdmin,["c"],["b"],"receptionist","admin2"),/implicitly transfer/);
});
test("dashboard rejects revoked explicit scope and excludes unrelated doctors", async () => {
  seed();
  api.state.actor={id:"revoked",role:"receptionist",clinicIds:[],branchIds:[]};
  await assert.rejects(route(api.reportingRouter,"get","/dashboard",{}, {clinicId:"c",branchId:"b",date:"2030-01-07"}),/outside your scope/);
  api.state.actor=staff;
  api.state.rows.clinics.push({id:"other-clinic",adminId:"admin",status:"active",name:"Other Clinic"});
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
test("doctor self demographic edits preserve ownership and assignments", async () => {
  seed();
  api.state.actor={id:"du",role:"doctor",doctorId:"d",managingAdminId:"admin",clinicIds:["c"],branchIds:["b"]};
  Object.assign(api.state.rows.users.find(user=>user.id==="du"),{email:"doctor@example.com",mobile:"+15555550100"});
  const assignments=structuredClone(api.state.rows.assignments);
  const updated=await route(api.resourcesRouter,"patch","/doctors/:id",{
    fullName:"Doctor Updated",email:"doctor.updated@example.com",mobile:"+15555550101",
  },{}, {id:"d"});
  assert.equal(updated.fullName,"Doctor Updated");
  assert.equal(updated.ownerAdminId,"admin");
  assert.deepEqual(api.state.rows.assignments,assignments);
  await assert.rejects(route(api.resourcesRouter,"patch","/doctors/:id",{
    fullName:"Doctor Updated",email:"doctor.updated@example.com",clinicIds:["c"],branchIds:["b"],
  },{}, {id:"d"}),error=>error.status===403);
});
test("serialized competing doctor ownership claims reject the stale edit", async () => {
  seed();
  api.state.actor={id:"sa",role:"superAdmin",clinicIds:[],branchIds:[]};
  Object.assign(api.state.rows.users.find(user=>user.id==="du"),{email:"doctor@example.com"});
  api.state.rows.users.push(
    {id:"admin2",role:"clinicAdmin",fullName:"Admin 2",email:"admin2@example.com",status:"active",invitationStatus:"notRequired"},
    {id:"admin3",role:"clinicAdmin",fullName:"Admin 3",email:"admin3@example.com",status:"active",invitationStatus:"notRequired"},
  );
  api.state.rows.clinics.push(
    {id:"c2",adminId:"admin2",status:"active",name:"Clinic 2"},
    {id:"c3",adminId:"admin3",status:"active",name:"Clinic 3"},
  );
  const transfer = (ownerAdminId,clinicId) => route(api.resourcesRouter,"patch","/doctors/:id",{
    fullName:"Doctor",email:"doctor@example.com",ownerAdminId,clinicIds:[clinicId],branchIds:[],
  },{}, {id:"d"});
  const outcomes=await Promise.allSettled([transfer("admin2","c2"),transfer("admin3","c3")]);
  assert.equal(outcomes.filter(result=>result.status==="fulfilled").length,1);
  const rejected=outcomes.find(result=>result.status==="rejected");
  assert.equal(rejected.reason.status,409);
  assert.match(rejected.reason.message,/ownership changed/);
});
test("ownership migration keeps commit-time guards for assignments and concurrent transfers", async () => {
  const migration=await readFile(resolve(root,"../../../lib/db/drizzle/0005_ancient_ultron.sql"),"utf8");
  for (const trigger of ["assignment_owner_guard","receptionist_manager_guard","doctor_manager_guard","clinic_owner_guard"]) {
    assert.match(migration,new RegExp(`CREATE CONSTRAINT TRIGGER ${trigger}[\\s\\S]*?DEFERRABLE INITIALLY DEFERRED`));
  }
  assert.match(migration,/HAVING count\(DISTINCT c\.admin_id\) = 1/);
  const repair=await readFile(resolve(root,"../../../lib/db/drizzle/0006_safe_staff_manager_guard.sql"),"utf8");
  assert.match(repair,/IF TG_TABLE_NAME = 'doctors' THEN[\s\S]*NEW\.user_id/);
  assert.match(repair,/ELSIF TG_TABLE_NAME = 'users' THEN[\s\S]*NEW\.id/);
  assert.doesNotMatch(repair,/CASE[\s\S]*NEW\.user_id/);
});
test("invitation delivery is attempted after profile commit", async () => {
  const source=await readFile(resolve(root,"routes/resources.ts"),"utf8");
  const committed=source.indexOf("const saved = await db.transaction");
  const delivered=source.indexOf("await deliverInvitation",committed);
  assert.ok(committed>=0 && delivered>committed);
});
test("concurrent invitation retries serialize per user and remain sent", async () => {
  seed();
  api.state.rows.users.push({id:"invitee",role:"receptionist",fullName:"Invitee",email:"invitee@example.com",status:"active",invitationStatus:"failed"});
  let active=0, maximum=0, calls=0;
  api.state.clerk.createInvitation=async input => {
    calls++; active++; maximum=Math.max(maximum,active);
    assert.equal(input.ignoreExisting,false);
    assert.equal(input.redirectUrl,"https://clinicflow.example/set-password");
    assert.equal(input.expiresInDays,7);
    await new Promise(resolve=>setTimeout(resolve,10));
    active--;
    const invitation={id:"inv-"+calls,emailAddress:input.emailAddress,status:"pending"};
    api.state.clerk.invitations.push(invitation);
    return invitation;
  };
  await Promise.all([
    api.deliverInvitation("invitee","https://clinicflow.example/set-password"),
    api.deliverInvitation("invitee","https://clinicflow.example/set-password"),
  ]);
  assert.equal(calls,2);
  assert.equal(maximum,1);
  assert.equal(api.state.clerk.invitations.filter(invitation=>invitation.status==="pending").length,1);
  assert.equal(api.state.clerk.invitations.filter(invitation=>invitation.status==="revoked").length,1);
  assert.equal(api.state.rows.users.find(user=>user.id==="invitee").invitationStatus,"sent");
});
test("invitation outcomes are idempotent and identity conflicts remain 409", async () => {
  seed();
  let target={id:"invitee",role:"doctor",fullName:"Invitee",email:"invitee@example.com",status:"active",invitationStatus:"sent"};
  api.state.rows.users.push(target,{id:"other-profile",role:"patient",email:"other@example.com",clerkId:"clerk-existing",status:"active"});
  api.state.clerk.getUserList=async()=>({data:[{
    id:"clerk-existing",
    emailAddresses:[{emailAddress:"INVITEE@example.com",verification:{status:"verified"}}],
  }]});
  await assert.rejects(api.deliverInvitation("invitee","https://clinicflow.example/set-password"),error=>error.status===409 && /already has a profile/.test(error.message));
  target=api.state.rows.users.find(user=>user.id==="invitee");
  assert.equal(target.invitationStatus,"sent");

  api.state.rows.users=api.state.rows.users.filter(user=>user.id!=="other-profile");
  target.clerkId=undefined;
  api.state.clerk.getUserList=async()=>({data:[{
    id:"unverified-identity",
    emailAddresses:[{emailAddress:"invitee@example.com",verification:{status:"unverified"}}],
  }]});
  let invitations=0;
  api.state.clerk.createInvitation=async input => {
    invitations++;
    assert.equal(input.ignoreExisting,false);
    assert.equal(input.redirectUrl,"https://clinicflow.example/set-password");
    return {id:"existing-invitation"};
  };
  await api.deliverInvitation("invitee","https://clinicflow.example/set-password");
  assert.equal(invitations,1);
  assert.equal(target.clerkId,undefined);
  assert.equal(target.invitationStatus,"sent");

  api.state.clerk.getUserList=async()=>({data:[{
    id:"verified-identity",
    emailAddresses:[{emailAddress:"invitee@example.com",verification:{status:"verified"}}],
  }]});
  await api.deliverInvitation("invitee","https://clinicflow.example/set-password");
  assert.equal(invitations,1);
  assert.equal(target.clerkId,"verified-identity");
  assert.equal(target.invitationStatus,"notRequired");

  target.clerkId=undefined;
  api.state.clerk.getUserList=async()=>({data:[]});
  api.state.clerk.createInvitation=async()=>{ throw new Error("provider unavailable"); };
  await api.deliverInvitation("invitee","https://clinicflow.example/set-password");
  assert.equal(target.invitationStatus,"failed");
});
test("staff resource reports Clerk password state without guessing on provider failure", async () => {
  seed();
  api.state.actor={id:"super",role:"superAdmin",clinicIds:[],branchIds:[]};
  Object.assign(api.state.rows.users.find(user=>user.id==="du"),{clerkId:"clerk-password",email:"doctor@example.com"});
  Object.assign(api.state.rows.users.find(user=>user.id==="admin"),{clerkId:"clerk-passwordless",email:"admin@example.com"});
  api.state.clerk.users=[
    {id:"clerk-password",passwordEnabled:true},
    {id:"clerk-passwordless",passwordEnabled:false},
  ];
  let result=await route(api.resourcesRouter,"get","/users");
  assert.equal(result.items.find(user=>user.id==="du").passwordEnabled,true);
  assert.equal(result.items.find(user=>user.id==="admin").passwordEnabled,false);

  api.state.clerk.getUserList=async()=>{ throw new Error("provider unavailable"); };
  result=await route(api.resourcesRouter,"get","/users");
  assert.equal(result.items.find(user=>user.id==="du").passwordEnabled,null);
});
test("generated query schemas retain the actual frontend lookup and listing parameters", () => {
  const read=(schema,query)=>api.query(schema,{query});
  assert.equal(read(api.ListSchedulesQueryParams,{search:"Doctor",sort:"-createdAt",dayOfWeek:"0"}).dayOfWeek,0);
  assert.equal(read(api.ListSchedulesQueryParams,{weekday:"6"}).weekday,6);
  assert.equal(read(api.ListAvailabilityExceptionsQueryParams,{search:"Doctor",sort:"-createdAt",date:"2030-01-05"}).date,"2030-01-05");
  assert.equal(read(api.ListQrsQueryParams,{search:"QR",sort:"name"}).search,"QR");
  assert.equal(read(api.ListUsersQueryParams,{role:"doctor",linkedOnly:"true"}).linkedOnly,true);
  assert.equal(read(api.ListUsersQueryParams,{role:"doctor",linkedOnly:"false"}).linkedOnly,false);
  for(const schema of [api.ListPatientsQueryParams,api.ListAuditLogsQueryParams]) assert.equal(read(schema,{from:"2030-01-01",to:"2030-01-05"}).from,"2030-01-01");
  for(const schema of [api.ListPublicClinicsQueryParams,api.ListPublicBranchesQueryParams,api.ListPublicDoctorsQueryParams]) assert.equal(read(schema,{selectedIds:"a,b"}).selectedIds,"a,b");
  assert.equal(read(api.ListPublicBranchesQueryParams,{doctorId:"d",search:"Branch"}).doctorId,"d");
  assert.equal(read(api.GetStaffAssignmentOptionsQueryParams,{targetRole:"receptionist",managingAdminId:"admin"}).managingAdminId,"admin");
});
test("Super Admin onboarding atomically persists the new Clinic Admin's first clinic scope", async () => {
  seed();
  api.state.actor={id:"super",role:"superAdmin",clinicIds:[],branchIds:[]};
  const result=await route(api.resourcesRouter,"post","/clinic-admin-onboarding",{
    admin:{fullName:"New Admin",email:"NEW.ADMIN@example.com",mobile:"+15555550999"},
    clinic:{name:"New Clinic",address:"1 Main Street",timezone:"UTC"}
  });
  assert.equal(result.admin.role,"clinicAdmin");
  assert.equal(result.admin.status,"active");
  assert.equal(result.admin.email,"new.admin@example.com");
  assert.equal(result.admin.invitationStatus,"sent");
  assert.equal(result.clinic.adminId,result.admin.id);
  assert.equal(result.clinic.status,"active");
  assert.deepEqual(result.admin.clinicIds,[result.clinic.id]);
  assert.equal(api.state.rows.assignments.some(a => a.userId === result.admin.id && a.clinicId === result.clinic.id && a.branchId === null),true);
  assert.equal(api.state.rows.clinics.length,2);
  assert.equal(api.state.rows.clinics[0].id,"c");
});
test("clinic admin onboarding denies non-Super Admins and duplicate profiles without side effects", async () => {
  seed();
  const body={admin:{fullName:"Denied",email:"denied@example.com"},clinic:{name:"Denied Clinic",address:"Address"}};
  api.state.actor={id:"ca",role:"clinicAdmin",clinicIds:["c"],branchIds:[]};
  await assert.rejects(route(api.resourcesRouter,"post","/clinic-admin-onboarding",body),/Permission denied/);
  assert.equal(api.state.clerk.invitations.length,0);
  api.state.actor={id:"super",role:"superAdmin",clinicIds:[],branchIds:[]};
  api.state.rows.users.push({id:"existing",fullName:"Existing",email:"denied@example.com",role:"patient",status:"active"});
  await assert.rejects(route(api.resourcesRouter,"post","/clinic-admin-onboarding",body),/already belongs/);
  assert.equal(api.state.clerk.invitations.length,0);
  await assert.rejects(route(api.resourcesRouter,"post","/users",{fullName:"Staged",email:"staged@example.com",role:"clinicAdmin"}),/clinic admin onboarding/i);
  assert.equal(api.state.clerk.invitations.length,0);
});
test("clinic admin onboarding rolls database changes back before durable invitation delivery", async () => {
  seed();
  api.state.actor={id:"super",role:"superAdmin",clinicIds:[],branchIds:[]};
  api.state.config.failClinicInsert=true;
  const usersBefore=api.state.rows.users.length, clinicsBefore=api.state.rows.clinics.length;
  await assert.rejects(route(api.resourcesRouter,"post","/clinic-admin-onboarding",{
    admin:{fullName:"Rollback Admin",email:"rollback@example.com"},
    clinic:{name:"Rollback Clinic",address:"Address"}
  }),/forced clinic insert failure/);
  assert.equal(api.state.rows.users.length,usersBefore);
  assert.equal(api.state.rows.clinics.length,clinicsBefore);
  assert.equal(api.state.clerk.invitations.length,0);
});
test("schedule overlap compares real instants across timezones and closed exceptions", () => {
  const india={isOpen:true,startTime:"09:00",endTime:"10:00",timezone:"Asia/Kolkata"};
  const london={isOpen:true,startTime:"03:30",endTime:"04:30",timezone:"Europe/London"};
  assert.equal(api.sessionsOverlap(india,"2030-01-07",london,"2030-01-07"),true);
  assert.equal(api.sessionsOverlap(india,"2030-01-07",{...london,startTime:"05:00",endTime:"06:00"},"2030-01-07"),false);
  assert.equal(api.sessionsOverlap(india,"2030-01-07",{...london,isClosed:true},"2030-01-07"),false);
});
test("staff proof follows Clerk session expiry across access-token refreshes", async () => {
  api.reset();
  const now = Date.now();
  const originalJwtExpiry = now - 60_000;
  const clerkSessionExpiry = now + 30 * 60_000;
  api.state.clerk.sessions.set("sess-staff", {
    id:"sess-staff", userId:"clerk-staff", status:"active", expireAt:clerkSessionExpiry,
  });
  assert.ok(originalJwtExpiry < now, "the original access-token JWT is already expired");
  const expiresAt = await api.authoritativeStaffSessionExpiry("sess-staff","clerk-staff",now);
  assert.equal(expiresAt.getTime(),clerkSessionExpiry);
});
test("staff proof rejects a Clerk session belonging to another user", async () => {
  api.reset();
  const now = Date.now();
  api.state.clerk.sessions.set("sess-staff", {
    id:"sess-staff", userId:"different-clerk-user", status:"active", expireAt:now + 30 * 60_000,
  });
  await assert.rejects(
    () => api.authoritativeStaffSessionExpiry("sess-staff","clerk-staff",now),
    error => error.status === 401 && error.code === "SESSION_INVALID",
  );
});