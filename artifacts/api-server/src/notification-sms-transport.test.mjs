import {test,after} from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {rm} from "node:fs/promises";
import {resolve} from "node:path";
const path=resolve(import.meta.dirname,`.sms-transport-${process.pid}.mjs`);
globalThis.fakeSmsNetwork={addresses:[{address:"8.8.8.8",family:4}],scenario:"accepted",calls:0};
await build({entryPoints:[resolve(import.meta.dirname,"lib/notification-sms-transport.ts")],outfile:path,bundle:true,platform:"node",format:"esm",packages:"external",
 plugins:[{name:"fake-network",setup(b){
  b.onResolve({filter:/^node:(https|dns\/promises)$/},args=>({path:args.path,namespace:"fake-network"}));
  b.onLoad({filter:/.*/,namespace:"fake-network"},args=>({contents:args.path.includes("dns")?
   `export const lookup=async()=>globalThis.fakeSmsNetwork.addresses;`:
   `import {EventEmitter} from "node:events";
    export function request(url,options,callback){
      const state=globalThis.fakeSmsNetwork;state.calls++;state.options=options;state.url=String(url);
      const req=new EventEmitter();req.destroy=()=>{queueMicrotask(()=>req.emit("error",Error("Private provider diagnostic")));};
      req.end=body=>{
        state.body=body;
        options.lookup("rebinding.example.invalid",{},(err,address,family)=>{state.pinned={err,address,family};});
        queueMicrotask(()=>{
          if(state.scenario==="before"){req.emit("error",Error("Secret before dispatch"));return;}
          const socket=new EventEmitter();req.emit("socket",socket);socket.emit("secureConnect");
          if(state.scenario==="after"){req.emit("error",Error("Secret after dispatch"));return;}
          const res=new EventEmitter();res.statusCode=state.scenario==="redirect"?302:200;
          callback(res);res.emit("data",Buffer.from(state.scenario==="large"?"x".repeat(17000):'{"ok":"yes"}'));res.emit("end");
        });
      };return req;
    }`
  }));
 }}]});
const api=await import(path);
const map={encoding:"json",authMode:"header",authField:"X-API-Key",fields:{recipient:"to",message:"message",senderId:"sender",dltEntityId:"entity",dltTemplateId:"template"},staticFields:{},acceptedStatuses:[200],responseField:"ok",responseValue:"yes",dltRequired:false};
const env={NOTIFICATION_SMS_URL:"https://rebinding.example.invalid/send",NOTIFICATION_SMS_KEY:"synthetic-key",NOTIFICATION_SMS_MAPPING:JSON.stringify(map)};
after(async()=>{await rm(path,{force:true});delete globalThis.fakeSmsNetwork;});
test("DNS validation rejects every private or reserved answer before making a request",async()=>{
 for(const address of ["127.0.0.1","169.254.169.254","::1","::ffff:8.8.8.8","2001:db8::1"]){
  globalThis.fakeSmsNetwork.addresses=[{address:"8.8.8.8",family:4},{address,family:address.includes(":")?6:4}];
  const before=globalThis.fakeSmsNetwork.calls;
  assert.equal(await api.sendNotificationSms(env,"+919876543210","Fixture",{}),"pre_dispatch_failed");
  assert.equal(globalThis.fakeSmsNetwork.calls,before);
 }
});
test("public DNS is pinned at the TLS request boundary, redirects are not followed and payload is bounded",async()=>{
 const state=globalThis.fakeSmsNetwork;state.addresses=[{address:"8.8.8.8",family:4}];state.scenario="accepted";
 assert.equal(await api.sendNotificationSms(env,"+919876543210","Fixture",{}),"provider_accepted");
 assert.equal(state.pinned.address,"8.8.8.8");assert.equal(state.options.agent,false);
 assert.equal(JSON.parse(state.body).to,"+919876543210");assert.equal(state.options.headers["X-API-Key"],"synthetic-key");
 state.scenario="redirect";const before=state.calls;
 assert.equal(await api.sendNotificationSms(env,"+919876543210","Fixture",{}),"provider_rejected");assert.equal(state.calls,before+1);
 state.scenario="large";assert.equal(await api.sendNotificationSms(env,"+919876543210","Fixture",{}),"delivery_unknown");
});
test("failures distinguish before/after dispatch and never leak raw diagnostics",async()=>{
 for(const [scenario,expected] of [["before","pre_dispatch_failed"],["after","delivery_unknown"]]){
  globalThis.fakeSmsNetwork.scenario=scenario;
  const result=await api.sendNotificationSms(env,"+919876543210","Fixture",{});
  assert.equal(result,expected);assert(!result.includes("Secret"));
 }
});
