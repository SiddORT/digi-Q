import assert from "node:assert/strict";
import test from "node:test";
import { doctorWorkspaceScope, resolveSessionContext, sessionContextKey } from "./session-scope.ts";

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