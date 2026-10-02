import assert from "node:assert/strict";
import test from "node:test";
import { doctorWorkspaceScope, resolveSessionContext, sessionContextKey, sessionTimeLabel } from "./session-scope.ts";

test("consulting admin capability never restricts administrative doctor selection",()=>{
 assert.deepEqual(doctorWorkspaceScope({user:{role:"clinicAdmin"},doctorId:"own-doctor"}),{isDoctor:false,doctorId:""});
});
test("doctor workspace is restricted to the authenticated doctor profile",()=>{
 assert.deepEqual(doctorWorkspaceScope({user:{role:"doctor"},doctorId:"own-doctor"}),{isDoctor:true,doctorId:"own-doctor"});
});
test("missing doctor capability does not turn a doctor role into an unrestricted picker",()=>{
 assert.deepEqual(doctorWorkspaceScope({user:{role:"doctor"},doctorId:null}),{isDoctor:true,doctorId:""});
 for(const role of ["superAdmin","receptionist","patient"])assert.equal(doctorWorkspaceScope({user:{role},doctorId:"capability"}).isDoctor,false);
});
test("edited template timings remain distinct and require an exact snapshot selection",()=>{
 const sessions=[{sessionId:"same-template",startTime:"09:00",snapshotOnly:true},{sessionId:"same-template",startTime:"11:00",snapshotOnly:false}];
 assert.notEqual(sessionContextKey(sessions[0]),sessionContextKey(sessions[1]));
 assert.equal(resolveSessionContext(sessions,{sessionId:"same-template"}),undefined);
 assert.equal(resolveSessionContext(sessions,{sessionId:"same-template",startTime:"09:00"}),sessions[0]);
});
test("deleted and legacy template contexts remain selectable by saved start time",()=>{
 const sessions=[{sessionId:null,startTime:"09:00",snapshotOnly:true},{sessionId:"current",startTime:"14:00",snapshotOnly:false}];
 assert.equal(resolveSessionContext(sessions,{startTime:"09:00"}),sessions[0]);
 assert.equal(resolveSessionContext(sessions),undefined);
 assert.equal(resolveSessionContext([sessions[0]]),sessions[0]);
 assert.equal(resolveSessionContext(sessions,{sessionId:"missing"}),undefined);
});
test("unique clinic-local running session is the default, but explicit choices and ambiguity win",()=>{
 const now=new Date("2030-01-07T04:00:00Z");
 const base={date:"2030-01-07",timezone:"Asia/Kolkata"};
 const am={...base,sessionId:"am",startTime:"09:00",endTime:"10:00"};
 const pm={...base,sessionId:"pm",startTime:"14:00",endTime:"16:00"};
 assert.equal(resolveSessionContext([am,pm],undefined,now),am);
 assert.equal(resolveSessionContext([am,pm],{sessionId:"pm"},now),pm);
 assert.equal(resolveSessionContext([am,pm],{sessionId:"missing"},now),undefined);
 assert.equal(resolveSessionContext([am,{...am,sessionId:"overlap"}],undefined,now),undefined);
 assert.equal(sessionTimeLabel(pm,now),"Upcoming session");
 assert.equal(sessionTimeLabel(am,new Date("2030-01-07T04:30:00Z")),"Past session");
 assert.equal(sessionTimeLabel({...am,snapshotOnly:true},now),"Saved appointment session");
});