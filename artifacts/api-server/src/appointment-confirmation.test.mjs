import { test, after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir=await mkdtemp(join(tmpdir(),"appointment-mail-"));
after(()=>rm(dir,{recursive:true,force:true}));
await build({
 stdin:{contents:'export * from "./lib/appointment-confirmation"; export * from "fixture";',resolveDir:import.meta.dirname},
 outfile:join(dir,"test.mjs"),bundle:true,platform:"node",format:"esm",
 plugins:[{name:"isolated-mail",setup(b){
  b.onResolve({filter:/^fixture$|^@workspace\/db$|^drizzle-orm$|\/store$|\/auth-email$|\/notification-template-store$|^\.\/appointments$/},a=>({path:a.path,namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},a=>{
   if(a.path==="fixture")return {contents:`
    export const state={rows:{},enabled:true,failClaim:false,failOutcome:false};
    let tail=Promise.resolve();
    export const conn={
     transaction:async fn=>{let release;const before=tail;tail=new Promise(r=>release=r);await before;try{return await fn(conn)}finally{release()}},
     execute:async()=>{},
     update:()=>({set:values=>({where:async condition=>{
       const outcome=JSON.parse(values.data.values[1]).confirmationEmail;
       if(state.failClaim&&outcome==="not_attempted"||state.failOutcome&&outcome!=="not_attempted")throw Error("storage unavailable");
       state.rows.appointments.find(r=>r.id===condition.id).confirmationEmail=outcome;
     }})})
    };`};
   if(a.path==="@workspace/db")return {contents:'export {conn as db} from "fixture"; export const appointments={id:"id",data:"data"},patients="patients",clinics="clinics",users="users";'};
   if(a.path==="drizzle-orm")return {contents:'export const sql=(strings,...values)=>({strings,values});export const eq=(_,id)=>({id});'};
   if(a.path.endsWith("/notification-template-store"))return {contents:'export const resolvedTemplate=async()=>({source:"default"});'};
   if(a.path.endsWith("/auth-email"))return {contents:'export const sendAuthEmail=()=>{throw Error("Real SMTP forbidden in tests")};'};
   if(a.path==="./appointments")return {contents:'export const lockQueue=async()=>{};'};
   return {contents:'import {state} from "fixture"; export const one=async(table,id)=>state.rows[typeof table==="string"?table:"appointments"].find(r=>r.id===id);export const getSettings=async()=>({notificationsEnabled:state.enabled});'};
  });
 }}],
});
const {state,conn,confirmAppointmentEmail,confirmationText,initialConfirmationEmail}=await import(join(dir,"test.mjs"));
function seed(){
 state.enabled=true;state.failClaim=false;state.failOutcome=false;
 state.rows={appointments:[{id:"a",patientId:"p",clinicId:"c",status:"waiting",date:"2030-01-07",startTime:"14:05",endTime:"15:05",timezone:"Asia/Kolkata",clinicName:"Clinic",branchName:"Location",doctorName:"Doctor",reference:"REF",token:"A-01",notes:"private clinical notes"}],
 patients:[{id:"p",email:"patient@example.invalid"}],clinics:[{id:"c",dateFormat:"DD/MM/YYYY",timeFormat:"24h"}],users:[]};
}
test("enabled confirmation uses parent display settings and excludes clinical notes",async()=>{
 seed();const calls=[];
 assert.equal(await confirmAppointmentEmail("a",conn,async(...args)=>calls.push(args)),"provider_accepted");
 assert.equal(calls.length,1);assert.match(calls[0][2],/07\/01\/2030/);assert.match(calls[0][2],/14:05–15:05 \(Asia\/Kolkata\)/);
 assert.doesNotMatch(calls[0][2],/private clinical notes/);
 assert.match(confirmationText(state.rows.appointments[0],{dateFormat:"MM/DD/YYYY",timeFormat:"12h"}),/01\/07\/2030[\s\S]*2:05 PM/);
});
test("initial booking outcome captures known skips without claiming eligible SMTP work",async()=>{
 seed();
 assert.equal(await initialConfirmationEmail(state.rows.patients[0],false,conn),"disabled");
 assert.equal(await initialConfirmationEmail(state.rows.patients[0],true,conn),undefined);
 delete state.rows.patients[0].email;
 assert.equal(await initialConfirmationEmail(state.rows.patients[0],true,conn),"no_recipient");
});
test("disabled and missing-recipient confirmations never dispatch",async()=>{
 for(const mode of ["disabled","no_recipient"]){seed();if(mode==="disabled")state.enabled=false;else delete state.rows.patients[0].email;
 assert.equal(await confirmAppointmentEmail("a",conn,async()=>assert.fail("must not dispatch")),mode);}
});
test("SMTP failure cannot undo booking and retries cannot send again",async()=>{
 seed();let calls=0;const sender=async()=>{calls++;throw Error("fake SMTP rejection");};
 assert.equal(await confirmAppointmentEmail("a",conn,sender),"unavailable");
 assert.equal(state.rows.appointments[0].status,"waiting");
 assert.equal(await confirmAppointmentEmail("a",conn,sender),"unavailable");assert.equal(calls,1);
});
test("concurrent retries claim once and preserve unknown outcome after dispatch storage failure",async()=>{
 seed();let calls=0;const sender=async()=>{calls++;};
 await Promise.all([confirmAppointmentEmail("a",conn,sender),confirmAppointmentEmail("a",conn,sender)]);
 assert.equal(calls,1);
 seed();state.failOutcome=true;calls=0;
 assert.equal(await confirmAppointmentEmail("a",conn,sender),"not_attempted");
 assert.equal(await confirmAppointmentEmail("a",conn,sender),"not_attempted");assert.equal(calls,1);
});
test("notification claim storage failure is non-blocking and cannot dispatch",async()=>{
 seed();state.failClaim=true;
 assert.equal(await confirmAppointmentEmail("a",conn,async()=>assert.fail("must not dispatch")),"unavailable");
 assert.equal(state.rows.appointments[0].status,"waiting");
});
test("retry of a legacy terminal booking never sends a fresh confirmation",async()=>{
 seed();state.rows.appointments[0].status="cancelled";
 assert.equal(await confirmAppointmentEmail("a",conn,async()=>assert.fail("must not dispatch")),"not_attempted");
});