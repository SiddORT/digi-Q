import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
let h;
const admin={id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:["b","b2"]};
const doctor={id:"du",role:"doctor",doctorId:"d",clinicIds:["c"],branchIds:["b"]};
const superAdmin={id:"admin",role:"superAdmin",clinicIds:[],branchIds:[]};
before(async()=>{
  h=await createQueueHarness();
  await h.control.query("create unique index test_schedule_active_start on schedules(doctor_id,branch_id,day_of_week,(data->>'startTime')) where status='active'");
});
after(async()=>{if(h)await h.close();});
beforeEach(async()=>{
  await h.seed();
  const row=await h.api.one(h.t.schedules,"d1");
  for(const s of await h.api.all(h.t.schedules)) if(s.doctorId==="d" && s.id!=="d1") await h.api.change(h.t.schedules,s.id,{status:"inactive"});
  const branch=await h.api.one(h.t.branches,"b");
  await h.api.change(h.t.branches,"b",{data:{...branch,openingHours:[{dayOfWeek:row.dayOfWeek,startTime:"09:00",endTime:"12:00"},{dayOfWeek:row.dayOfWeek,startTime:"14:00",endTime:"17:00"},{dayOfWeek:(row.dayOfWeek+1)%7,startTime:"09:00",endTime:"12:00"}],linkedSchedule:{enabled:true,doctorId:"d",maxTokens:20,consultationMinutes:20,tokenPrefix:"A",queueMode:"mixed"}}});
  await h.api.change(h.t.schedules,"d1",{data:{...row,startTime:"09:00",endTime:"12:00",linkedBranchId:"b",timezone:"UTC",queueMode:"mixed"}});
  await h.api.put(h.t.schedules,{id:"interval2",doctorId:"d",branchId:"b",clinicId:"c",dayOfWeek:row.dayOfWeek,data:{...row,startTime:"14:00",endTime:"17:00",linkedBranchId:"b",timezone:"UTC",queueMode:"mixed"}});
});
const context=(actor=admin,tx)=>h.route(h.api.resourcesRouter,"get","/schedules/day-context",actor,{}, {},{doctorId:"d",branchId:"b"},tx);
const save=(body,actor=admin,tx)=>h.route(h.api.resourcesRouter,"post","/schedules/day-overrides",actor,body,{}, {},tx);
async function owner(){
  await h.api.change(h.t.doctors,"d",{userId:"admin",data:{branchIds:["b"],clinicIds:["c"]}});
  await h.api.put(h.t.assignments,{id:"owner",userId:"admin",clinicId:"c",branchId:"b"});
}
async function draft(patch={}) {
  const c=await context(), row=c.items.find(r=>r.id==="d1");
  return {doctorId:"d",branchId:"b",dayOfWeek:row.dayOfWeek,isOpen:true,confirmed:true,requestId:crypto.randomUUID(),expectedSnapshot:c.days[row.dayOfWeek].snapshot,sessions:c.items.filter(r=>r.dayOfWeek===row.dayOfWeek).map(r=>({key:r.id,id:r.id,session:r})),...patch};
}
for(const [role,actor] of [["superadmin",superAdmin],["clinic admin",admin],["doctor",doctor]]) test(`${role}: confirmed complete day replaces both inherited intervals and persists`,async()=>{
  const body=await draft();
  body.sessions[0].session.endTime="11:00";
  const result=await save(body,actor);
  assert.equal(result.days[body.dayOfWeek].custom,true);
  assert.equal(result.days[body.dayOfWeek].following,false);
  assert.equal(result.items.find(r=>r.id==="d1").endTime,"11:00");
  assert.ok(result.items.filter(r=>r.dayOfWeek===body.dayOfWeek).every(r=>!r.linkedBranchId));
  assert.equal((await context()).days[body.dayOfWeek].snapshot,result.days[body.dayOfWeek].snapshot);
  const audits=(await h.api.all(h.t.auditLogs)).filter(a=>a.action==="customizeScheduleDay");
  assert.equal(audits.length,1);assert.equal(audits[0].actorId,actor.id);
  assert.equal(JSON.parse(audits[0].summary).prior.length,2);
});
test("unconfirmed, receptionist, foreign doctor and foreign scope cannot customize",async()=>{
  const body=await draft(), original=await context();
  for(const [actor,input] of [[admin,{...body,confirmed:false}],[{...admin,role:"receptionist"},body],[{...doctor,doctorId:"other"},body],[{...admin,clinicIds:[],branchIds:[]},body]]){
    await assert.rejects(save(input,actor),e=>[400,403].includes(e.status)||e.name==="ZodError");
  }
  assert.deepEqual(await context(),original);
});
test("custom day off survives clinic synchronization; other days still follow; unlink/relink retains overrides",async()=>{
  // Make the seeded doctor the actual clinic-owner profile for the link synchronizer.
  await owner();
  const body=await draft({isOpen:false,sessions:[]});
  await save(body);
  assert.equal((await context()).items.length,0);
  const branch=await h.api.one(h.t.branches,"b");
  const hours=branch.openingHours.map(hour=>({...hour,endTime:hour.endTime==="12:00"?"13:00":hour.endTime}));
  await h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",openingHours:hours}]},tx));
  const after=await context();
  assert.equal(after.items.filter(r=>r.dayOfWeek===body.dayOfWeek).length,0);
  assert.equal(after.items.length,1);
  assert.equal(after.items[0].linkedBranchId,"b");
  const current=await h.api.one(h.t.branches,"b");
  await h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",linkedSchedule:{...current.linkedSchedule,enabled:false}}]},tx));
  // Existing whole-location enablement still rejects overlapping custom sessions.
  await assert.rejects(h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",linkedSchedule:current.linkedSchedule}]},tx)),e=>e.status===409);
  for(const row of (await context()).items) await h.api.change(h.t.schedules,row.id,{status:"inactive"});
  await h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",linkedSchedule:current.linkedSchedule}]},tx));
  assert.equal((await context()).items.filter(r=>r.dayOfWeek===body.dayOfWeek).length,0);
});
test("custom hours survive clinic synchronization without duplicate inherited intervals",async()=>{
  await owner();
  const body=await draft();body.sessions[0].session.endTime="11:30";await save(body);
  const branch=await h.api.one(h.t.branches,"b");
  await h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",openingHours:branch.openingHours.map(h=>({...h,startTime:h.startTime==="09:00"?"08:00":h.startTime}))}]},tx));
  const rows=(await context()).items.filter(r=>r.dayOfWeek===body.dayOfWeek);
  assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==="d1").endTime,"11:30");
});
test("stale day, link and clinic-hours baselines reject atomically",async()=>{
  for(const kind of ["session","link","hours"]){
    const body=await draft();
    if(kind==="session"){const s=await h.api.one(h.t.schedules,"interval2");await h.api.change(h.t.schedules,s.id,{data:{...s,maxTokens:s.maxTokens+1}});}
    else {const b=await h.api.one(h.t.branches,"b");await h.api.change(h.t.branches,b.id,{data:{...b,...(kind==="link"?{linkedSchedule:{...b.linkedSchedule,maxTokens:25}}:{openingHours:b.openingHours.slice(0,1)})}});}
    await assert.rejects(save(body),e=>e.status===409&&/changed/.test(e.message));
    assert.equal((await context()).days[body.dayOfWeek].custom,false);
  }
});
test("same save identifier replays original write response and does not duplicate sessions or audit",async()=>{
  const body=await draft();body.sessions=body.sessions.slice(0,1);body.sessions[0].session.endTime="11:00";
  const first=await save(body), second=await save(body);
  assert.deepEqual(first,second);
  assert.equal((await context()).items.length,1);
  assert.equal((await h.api.all(h.t.auditLogs)).filter(a=>a.action==="customizeScheduleDay").length,1);
  await assert.rejects(save({...body,isOpen:false,sessions:[]}),e=>e.status===409);
});
test("booking history and dated exceptions block timing/removal and keep every session unchanged",async()=>{
  const body=await draft({isOpen:false,sessions:[]});
  await h.api.put(h.t.appointments,{id:"history",patientId:"p1",doctorId:"d",clinicId:"c",branchId:"b",date:h.today,tokenNumber:1,actorId:"admin",status:"completed",data:{sessionId:"interval2",startTime:"14:00"}});
  await assert.rejects(save(body),e=>e.status===409&&/booking history/.test(e.message));
  assert.equal((await context()).items.length,2);
  assert.equal((await h.api.one(h.t.appointments,"history")).status,"completed");
  const settings=await draft();settings.sessions[1].session.consultationMinutes=30;await save(settings);
  assert.ok((await h.api.one(h.t.appointments,"history")).expectedDurationMinutes);
});
test("invalid hidden settings and cross-location overlaps roll back all day writes",async()=>{
  for(const patch of [{maxTokens:0},{breakStart:"08:00",breakEnd:"09:00"},{queueCloseTime:"23:00"}]){
    const body=await draft();Object.assign(body.sessions[1].session,patch);
    await assert.rejects(save(body),e=>[400,409].includes(e.status)||e.name==="ZodError");
    assert.ok((await context()).items.every(r=>r.linkedBranchId==="b"));
  }
  const body=await draft();body.sessions[1].session.startTime="10:00";
  await assert.rejects(save(body),e=>e.status===409&&/overlap/.test(e.message));
  assert.equal((await context()).items.length,2);
});
test("cross-location timezone overlap and dated exceptions remain authoritative",async()=>{
  const body=await draft();
  await h.api.put(h.t.assignments,{id:"other-location",userId:"du",clinicId:"c",branchId:"b2"});
  await h.api.put(h.t.schedules,{id:"other-location",doctorId:"d",clinicId:"c",branchId:"b2",dayOfWeek:body.dayOfWeek,data:{...body.sessions[0].session,branchId:"b2",timezone:"Etc/UTC",startTime:"10:00",endTime:"11:00"}});
  await assert.rejects(save(body),e=>e.status===409&&/overlap/.test(e.message));
  assert.ok((await context()).items.every(r=>r.linkedBranchId==="b"));
  await h.api.change(h.t.schedules,"other-location",{status:"inactive"});
  // A date exception scoped to a removed interval cannot silently lose its session.
  const date=new Date(`${h.today}T12:00:00Z`);while(date.getUTCDay()!==body.dayOfWeek)date.setUTCDate(date.getUTCDate()+1);
  await h.api.put(h.t.availabilityExceptions,{id:"dated",doctorId:"d",branchId:"b",date:date.toISOString().slice(0,10),data:{sessionId:"interval2",isClosed:true}});
  await assert.rejects(save({...body,isOpen:false,sessions:[]}),e=>e.status===409&&/date exceptions/.test(e.message));
  assert.equal((await context()).items.length,2);
});
test("swapping inherited starts preserves both identities under the active-start uniqueness constraint",async()=>{
  const body=await draft();
  Object.assign(body.sessions[0].session,{startTime:"14:00",endTime:"17:00"});
  Object.assign(body.sessions[1].session,{startTime:"09:00",endTime:"12:00"});
  const saved=await save(body);
  assert.equal(saved.items.find(s=>s.id==="d1").startTime,"14:00");
  assert.equal(saved.items.find(s=>s.id==="interval2").startTime,"09:00");
});
test("legacy linked locations with no overrides synchronize all days as before",async()=>{
  await owner();
  const branch=await h.api.one(h.t.branches,"b");
  await h.db.transaction(tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",openingHours:branch.openingHours.map(h=>({...h,endTime:h.endTime==="12:00"?"13:00":h.endTime}))}]},tx));
  const saved=await context();
  assert.equal(saved.items.length,3);
  assert.ok(saved.items.every(s=>s.linkedBranchId==="b"));
  assert.ok(saved.days.every(d=>!d.custom&&d.following));
});
test("real concurrent confirmed writes wait on doctor locks and only one stale proposal wins",async()=>{
  const a=await draft(),b={...await draft(),isOpen:false,sessions:[]};let observed=false;
  const results=await h.race([tx=>save(a,admin,tx),tx=>save(b,superAdmin,tx)],{onContention:()=>{observed=true;}});
  assert.ok(observed);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.find(r=>r.status==="rejected").reason.status,409);
});
test("stale generic location forms cannot restore an earlier custom-day decision",async()=>{
  const initial=await draft();await save(initial);
  const b=await h.api.one(h.t.branches,"b");
  await h.api.change(h.t.branches,"b",{data:{...b,linkedSchedule:{...b.linkedSchedule,enabled:false}}});
  const off=await draft({isOpen:false,sessions:[]});
  let observed=false;
  const results=await h.race([
    tx=>save(off,admin,tx),
    tx=>h.route(h.api.resourcesRouter,"patch","/branches/:id",admin,{clinicId:"c",name:"Contact edit",address:"",timezone:"UTC"},{id:"b"},{},tx),
  ],{doctorIds:[],lockKeys:["branch-hours:b"],orderedWaiters:true,onContention:()=>{observed=true;}});
  assert.ok(observed);
  assert.ok(results.every(r=>r.status==="fulfilled"),JSON.stringify(results.map(r=>r.reason?.message)));
  const branch=await h.api.one(h.t.branches,"b");
  assert.equal(branch.scheduleDayOverrides.d[off.dayOfWeek].isOpen,false);
  assert.equal(branch.name,"Contact edit");
  assert.equal((await context()).items.length,0);
});
test("clinic synchronization waiting behind a confirmed day off preserves it and updates other weekdays",async()=>{
  await owner();
  const off=await draft({isOpen:false,sessions:[]}), branch=await h.api.one(h.t.branches,"b");
  const hours=branch.openingHours.map(hour=>({...hour,endTime:hour.endTime==="12:00"?"13:00":hour.endTime}));
  let observed=false;
  const results=await h.race([
    tx=>save(off,admin,tx),
    tx=>h.api.saveClinicSetup(admin,"c",{branches:[{id:"b",openingHours:hours}]},tx),
  ],{orderedWaiters:true,onContention:()=>{observed=true;}});
  assert.ok(observed);
  assert.ok(results.every(r=>r.status==="fulfilled"),JSON.stringify(results.map(r=>r.reason?.message)));
  const saved=await context();
  assert.equal(saved.days[off.dayOfWeek].custom,true);
  assert.equal(saved.items.filter(r=>r.dayOfWeek===off.dayOfWeek).length,0);
  assert.equal(saved.items.length,1);
  assert.equal(saved.items[0].endTime,"13:00");
  assert.equal(saved.items[0].linkedBranchId,"b");
});
