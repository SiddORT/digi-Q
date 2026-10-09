import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { createHash, randomBytes } from "node:crypto";
import { scheduleSnapshot as clientSnapshot } from "../../clinicflow/src/components/schedule/week-plan.ts";

let h;
before(async()=>{h=await createQueueHarness();});
beforeEach(async()=>{await h.seed();});
after(async()=>{if(h)await h.close();});
const admin={id:"admin",role:"clinicAdmin",clinicIds:["c"],branchIds:["b","b2"]};
const superAdmin={id:"admin",role:"superAdmin",clinicIds:[],branchIds:[]};
const doctor={id:"du",role:"doctor",doctorId:"d",clinicIds:["c"],branchIds:["b"]};
const session=()=>h.api.one(h.t.schedules,"d1");
const input=(row,patch={})=>({...row,queueMode:row.queueMode||"mixed",bufferMinutes:row.bufferMinutes??0,...patch,expectedSnapshot:h.api.scheduleSnapshot(row)});
const update=(actor,body,tx)=>h.route(h.api.resourcesRouter,"patch","/schedules/:id",actor,body,{id:"d1"},{},tx);
const deactivate=(actor,snapshot,tx)=>h.route(h.api.resourcesRouter,"delete","/schedules/:id",actor,{}, {id:"d1"},{expectedSnapshot:snapshot},tx);

test("client and server snapshot contracts match, and labels are not authoring state",async()=>{
  const row=await session();
  assert.equal(clientSnapshot(row),h.api.scheduleSnapshot(row));
  assert.equal(clientSnapshot({...row,doctorName:"A new display name"}),clientSnapshot(row));
  assert.notEqual(clientSnapshot({...row,consultationMinutes:30}),clientSnapshot(row));
});
for(const [role,actor] of [["Doctor",doctor],["Clinic Admin",admin],["Super Admin",superAdmin]]){
  test(`${role} saves an authorized duration change and rejects the old snapshot`,async()=>{
    const row=await session();
    const saved=await update(actor,input(row,{consultationMinutes:30}));
    assert.equal(saved.consultationMinutes,30);
    await assert.rejects(update(actor,input(row,{maxTokens:15})),e=>e.status===409&&/another administrator/.test(e.message));
    assert.equal((await session()).maxTokens,row.maxTokens);
  });
}
test("distinct PostgreSQL update contenders wait on real locks and exactly one stale update loses",async()=>{
  const row=await session();let observed=false;
  const results=await h.race([
    tx=>update(admin,input(row,{consultationMinutes:20}),tx),
    tx=>update(superAdmin,input(row,{consultationMinutes:60}),tx),
  ],{onContention:()=>{observed=true;}});
  assert.equal(observed,true);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const loser=results.find(r=>r.status==="rejected");
  assert.equal(loser.reason.status,409);
  assert.match(loser.reason.message,/another administrator/);
  assert.ok([20,60].includes((await session()).consultationMinutes));
});
test("update racing deactivation cannot overwrite the winner's newer state",async()=>{
  const row=await session();
  const results=await h.race([
    tx=>update(admin,input(row,{maxTokens:12}),tx),
    tx=>deactivate(admin,h.api.scheduleSnapshot(row),tx),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.find(r=>r.status==="rejected").reason.status,409);
});
test("doctor cannot edit another doctor; out-of-scope administration is refused",async()=>{
  const other=await h.api.one(h.t.schedules,"d21");
  await assert.rejects(h.route(h.api.resourcesRouter,"patch","/schedules/:id",doctor,input(other),{id:other.id}),e=>e.status===403);
  await assert.rejects(update({...admin,clinicIds:[],branchIds:[]},input(await session())),e=>e.status===403);
});
test("assignment removal and timezone drift reject saved context without writes",async()=>{
  const row=await session();
  await h.control.query("delete from assignments where user_id='du'");
  await assert.rejects(update(admin,input(row,{maxTokens:12})),e=>[403,409].includes(e.status));
  assert.equal((await session()).maxTokens,row.maxTokens);
  await h.seed();
  const original=await session(),branch=await h.api.one(h.t.branches,"b");
  await h.api.change(h.t.branches,"b",{data:{...branch,timezone:"Asia/Kolkata"}});
  await assert.rejects(update(admin,input(original,{maxTokens:12})),e=>e.status===409&&/timezone/.test(e.message));
});
test("same-doctor overlapping create contenders cannot both commit",async()=>{
  await h.api.change(h.t.schedules,"d1",{status:"inactive"});
  const original=await session();
  const body={...input(original),startTime:"09:00",endTime:"12:00",consultationMinutes:20};
  delete body.expectedSnapshot;
  const results=await h.race([
    tx=>h.route(h.api.resourcesRouter,"post","/schedules",admin,body,{}, {},tx),
    tx=>h.route(h.api.resourcesRouter,"post","/schedules",admin,{...body,startTime:"10:00"}, {}, {},tx),
  ]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(results.find(r=>r.status==="rejected").reason.status,409);
});
test("deactivation preserves appointments and linked sessions reject edits and deletion",async()=>{
  const row=await session();
  await h.api.put(h.t.appointments,{id:"history",patientId:"p1",doctorId:"d",clinicId:"c",branchId:"b",date:h.today,tokenNumber:1,actorId:"admin",status:"completed",data:{startTime:row.startTime}});
  await deactivate(admin,h.api.scheduleSnapshot(row));
  assert.equal((await session()).status,"inactive");
  assert.equal((await h.api.one(h.t.appointments,"history")).status,"completed");
  await h.seed();
  const linked=await session();
  await h.api.change(h.t.schedules,linked.id,{data:{...linked,linkedBranchId:"b"}});
  const current=await session();
  await assert.rejects(update(admin,input(current,{consultationMinutes:30})),e=>e.status===409&&/clinic hours/.test(e.message));
  await assert.rejects(deactivate(admin,h.api.scheduleSnapshot(current)),e=>e.status===409&&/clinic hours/.test(e.message));
});
test("duration template changes freeze existing running visit duration",async()=>{
  const row=await session();
  await h.api.put(h.t.appointments,{id:"running",patientId:"p1",doctorId:"d",clinicId:"c",branchId:"b",date:h.today,tokenNumber:1,actorId:"admin",status:"inConsultation",data:{startTime:row.startTime,sessionId:row.id}});
  await update(admin,input(row,{consultationMinutes:60}));
  assert.equal((await h.api.one(h.t.appointments,"running")).expectedDurationMinutes,10);
  assert.equal((await session()).consultationMinutes,60);
});
test("real native-session cookies verify database-mapped roles separately, rejecting anonymous and foreign scope",async()=>{
  await h.api.put(h.t.users,{id:"super",email:"super@example.test",fullName:"Super Admin",role:"superAdmin"});
  const server=h.api.authenticatedScheduleApp().listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{
    const anonymous=await fetch(origin+"/api/schedules/d1");
    assert.equal(anonymous.status,401);
    for(const id of ["du","admin","super"]){
      const token=randomBytes(32).toString("base64url"),tokenHash=createHash("sha256").update(token).digest("hex");
      await h.control.query("insert into auth_sessions(id,token_hash,user_id,expires_at) values($1,$2,$3,$4)",["session-"+id,tokenHash,id,new Date(Date.now()+60000)]);
      const headers={cookie:`digiq_session=${token}`,"content-type":"application/json"};
      const read=await fetch(origin+"/api/schedules/d1",{headers});assert.equal(read.status,200);
      const row=await read.json();
      const save=await fetch(origin+"/api/schedules/d1",{method:"PATCH",headers,body:JSON.stringify(input(row,{consultationMinutes:row.consultationMinutes===30?20:30}))});
      assert.equal(save.status,200,JSON.stringify(await save.json()));
      const stale=await fetch(origin+"/api/schedules/d1",{method:"PATCH",headers,body:JSON.stringify(input(row,{maxTokens:14}))});
      assert.equal(stale.status,409);
      if(id==="du"){
        assert.equal((await fetch(origin+"/api/schedules/d21",{headers})).status,403);
        assert.equal((await fetch(origin+"/api/schedules/d21",{method:"DELETE",headers})).status,403);
      }
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test("ordinary location hours are a warning, explicit closures and dated extra collisions are authoritative",async()=>{
  const row=await session(),branch=await h.api.one(h.t.branches,"b");
  await h.api.change(h.t.branches,"b",{data:{...branch,openingHours:[{dayOfWeek:1,isOpen:true,startTime:"10:00",endTime:"11:00"}]}});
  assert.equal((await update(admin,input(row,{startTime:"09:00",endTime:"12:00"}))).startTime,"09:00");
  const current=await session();
  await h.api.change(h.t.branches,"b",{data:{...branch,openingHours:[]}});
  await assert.rejects(update(admin,input(current,{maxTokens:15})),e=>e.status===409||e.status===400);
  await h.seed();
  const monday=new Date(h.today+"T12:00:00Z");monday.setUTCDate(monday.getUTCDate()+(8-monday.getUTCDay())%7);
  await h.api.put(h.t.availabilityExceptions,{id:"extra",doctorId:"d",clinicId:"c",branchId:"b",date:monday.toISOString().slice(0,10),data:{isExtra:true,isClosed:false,startTime:"10:00",endTime:"11:00",maxTokens:5,consultationMinutes:20}});
  await assert.rejects(update(admin,input(await session(),{startTime:"09:00",endTime:"12:00"})),e=>e.status===409&&/dated extra/.test(e.message));
});
test("a session waiting on the doctor lock rechecks account permission before writing",async()=>{
  const row=await session();
  const results=await h.race([
    tx=>h.route(h.api.resourcesRouter,"patch","/schedules/:id",doctor,input(row,{maxTokens:14}),{id:"d1"},{},tx,true),
  ],{onContention:async()=>{await h.control.query("update users set status='inactive' where id='du'");}});
  assert.equal(results[0].status,"rejected");
  assert.equal(results[0].reason.status,403);
  assert.equal((await session()).maxTokens,row.maxTokens);
});
