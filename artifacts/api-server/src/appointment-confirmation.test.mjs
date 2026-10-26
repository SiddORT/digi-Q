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
  // These lifecycle barriers are exercised with real PostgreSQL by the
  // notification integration suite; this unit fixture only models SMTP claims.
  b.onResolve({filter:/\/staff-dispatch-barrier$/},()=>({path:"staff-barrier",namespace:"staff-fixture"}));
  b.onLoad({filter:/.*/,namespace:"staff-fixture"},()=>({contents:"export const withStaffDispatch=async(ids,operation,work)=>work();"}));
  b.onResolve({filter:/\/notification-staff-subjects$/},()=>({path:"subjects",namespace:"subject-fixture"}));
  b.onLoad({filter:/.*/,namespace:"subject-fixture"},()=>({contents:"export const notificationStaffSubjects=async()=>[];"}));
  b.onResolve({filter:/\/notification-outbox$/},()=>({path:"outbox",namespace:"outbox-fixture"}));
  b.onLoad({filter:/.*/,namespace:"outbox-fixture"},()=>({contents:"export const enqueueEvent=async()=>{};"}));
  b.onResolve({filter:/\/notification-history$/},()=>({path:"history",namespace:"history-fixture"}));
  b.onLoad({filter:/.*/,namespace:"history-fixture"},()=>({contents:"export const historyId=k=>k; export const recordNotification=async()=>{}; export const recordDecision=async()=>{}; export const notificationEntry=()=>({}); export const templateSnapshot=()=>({});"}));
  b.onResolve({filter:/\/integration-vault$/},()=>({path:"vault",namespace:"vault-fixture"}));
  b.onLoad({filter:/.*/,namespace:"vault-fixture"},()=>({contents:'export const resolvedIntegration=async()=>({env:{SMTP_HOST:"smtp.example.invalid",SMTP_PORT:"587",SMTP_USER:"fixture-user",SMTP_PASSWORD:"fixture-pass",SMTP_FROM:"sender@example.invalid"}});'}));
  b.onResolve({filter:/^fixture$|^@workspace\/db$|^drizzle-orm$|\/store$|\/auth-email$|\/notification-template-store$|^\.\/appointments$/},a=>({path:a.path,namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},a=>{
   if(a.path==="fixture")return {contents:`
    export const state={rows:{},enabled:true,failClaim:false,failOutcome:false};
    let tail=Promise.resolve();
    export const conn={
     transaction:async fn=>{let release;const before=tail;tail=new Promise(r=>release=r);await before;try{return await fn(conn)}finally{release()}},
     execute:async()=>{},
      select:()=>({from:()=>({where:async()=>[]})}),
     update:()=>({set:values=>({where:async condition=>{
       const outcome=JSON.parse(values.data.values[1]).confirmationEmail;
       if(state.failClaim&&outcome==="not_attempted"||state.failOutcome&&outcome!=="not_attempted")throw Error("storage unavailable");
       state.rows.appointments.find(r=>r.id===condition.id).confirmationEmail=outcome;
     }})})
    };`};
    if(a.path==="@workspace/db")return {contents:'export {conn as db} from "fixture"; export const appointments={id:"id",data:"data"},settings={id:"id"},patients="patients",clinics="clinics",users="users";'};
   if(a.path==="drizzle-orm")return {contents:'export const sql=(strings,...values)=>({strings,values});export const eq=(_,id)=>({id});'};
   if(a.path.endsWith("/notification-template-store"))return {contents:'import {state} from "fixture"; export const resolvedTemplate=async()=>state.template||({source:"default",content:{enabled:true,subject:"Booking confirmation",body:"{{appointment_details}}",prefix:"",footer:"",logoUrl:""}});'};
   if(a.path.endsWith("/auth-email"))return {contents:'export const sendAuthEmail=()=>{throw Error("Real SMTP forbidden in tests")};'};
   if(a.path==="./appointments")return {contents:'export const lockQueue=async()=>{};'};
   return {contents:'import {state} from "fixture"; export const one=async(table,id)=>state.rows[typeof table==="string"?table:"appointments"].find(r=>r.id===id);export const getSettings=async()=>({notificationsEnabled:state.enabled});'};
  });
 }}],
});
const {state,conn,confirmAppointmentEmail,confirmationText,initialConfirmationEmail,defaultConfirmationEmail}=await import(join(dir,"test.mjs"));
function seed(){
 state.enabled=true;state.failClaim=false;state.failOutcome=false;
 state.rows={appointments:[{id:"a",patientId:"p",patientName:"Example Patient",clinicId:"c",status:"waiting",date:"2030-01-07",startTime:"14:05",endTime:"15:05",timezone:"Asia/Kolkata",clinicName:"Clinic",branchName:"Location",doctorName:"Doctor",reference:"REF",token:"A-01",notes:"private clinical notes"}],
  patients:[{id:"p",email:"patient@example.invalid",status:"active"}],clinics:[{id:"c",dateFormat:"DD/MM/YYYY",timeFormat:"24h"}],users:[]};
}
test("enabled confirmation uses parent display settings and excludes clinical notes",async()=>{
 seed();const calls=[];
 assert.equal(await confirmAppointmentEmail("a",conn,async(...args)=>calls.push(args)),"provider_accepted");
 assert.equal(calls.length,1);assert.match(calls[0][2],/07\/01\/2030/);assert.match(calls[0][2],/14:05–15:05 \(Asia\/Kolkata\)/);
 assert.doesNotMatch(calls[0][2],/private clinical notes/);
 assert.match(confirmationText(state.rows.appointments[0],{dateFormat:"MM/DD/YYYY",timeFormat:"12h"}),/01\/07\/2030[\s\S]*2:05 PM/);
});
test("default bypass uses shared structured HTML without changing subject or wrapped plain text",()=>{
 seed();
 const row=state.rows.appointments[0],clinic=state.rows.clinics[0],message=defaultConfirmationEmail(row,clinic);
 assert.equal(message.subject,"DigiQ Doctors — Appointment confirmation");
 assert.equal(message.text,`DigiQ Doctors\n\n${message.subject}\n\n${confirmationText(row,clinic)}\n\nThis is an automated message from DigiQ Doctors. Please do not reply to this email.`);
 for(const value of [row.reference,row.doctorName,row.branchName,row.token,row.timezone,"07/01/2030"])assert.ok(message.html.includes(value));
 assert.match(message.html,/>Doctor<\/td><td[^>]*>Doctor<\/td>/);
 assert.doesNotMatch(message.html,/private clinical notes/);
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
test("default automatic patient email never dispatches in development",async()=>{
 seed();
 const previous=process.env.NODE_ENV;process.env.NODE_ENV="development";
 try{assert.equal(await confirmAppointmentEmail("a",conn),"not_attempted");}
 finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
 assert.equal(state.rows.appointments[0].confirmationEmail,"not_attempted");
});
test("custom published wording cannot remove committed ticket fields or clinic contact",async()=>{
 seed();
 state.rows.clinics[0].email="contact@example.invalid";
 state.template={source:"platform",content:{enabled:true,subject:"Your visit",body:"Custom greeting only.",prefix:"",footer:"",logoUrl:""}};
 let text="";
 try {
  assert.equal(await confirmAppointmentEmail("a",conn,async(_to,_subject,body)=>{text=body;}),"provider_accepted");
  const row=state.rows.appointments[0];
  for(const value of [row.reference,row.token,row.clinicName,row.branchName,row.doctorName,row.timezone,"contact@example.invalid"])assert(text.includes(value));
  assert(text.includes("Custom greeting only."));
  assert(!text.includes("token="));
 } finally {delete state.template;}
});