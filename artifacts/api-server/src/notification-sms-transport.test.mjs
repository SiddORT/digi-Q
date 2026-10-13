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
           if(state.scenario==="timeout")return;
           const res=new EventEmitter();res.statusCode=state.scenario==="redirect"?302:(state.status??200);
           callback(res);res.emit("data",Buffer.from(state.scenario==="large"?"x".repeat(17000):(state.response??'{"ok":"yes"}')));res.emit("end");
        });
      };return req;
    }`
  }));
 }}]});
const api=await import(path);
const map={encoding:"json",authMode:"header",authField:"X-API-Key",fields:{recipient:"to",message:"message",senderId:"sender",dltEntityId:"entity",dltTemplateId:"template"},staticFields:{},acceptedStatuses:[200],responseField:"ok",responseValue:"yes",dltRequired:false};
const env={NOTIFICATION_SMS_URL:"https://rebinding.example.invalid/send",NOTIFICATION_SMS_KEY:"synthetic-key",NOTIFICATION_SMS_MAPPING:JSON.stringify(map)};
after(async()=>{await rm(path,{force:true});delete globalThis.fakeSmsNetwork;});
test("optional notification switch is backwards compatible and independent of provider readiness",()=>{
 assert.equal(api.notificationSmsEnabled(env),true);
 assert.equal(api.notificationSmsEnabled({...env,NOTIFICATION_SMS_ENABLED:"false"}),false);
 assert.equal(api.notificationSmsEnabled({...env,NOTIFICATION_SMS_ENABLED:"invalid"}),false);
 assert.equal(api.notificationSmsReadiness({...env,NOTIFICATION_SMS_ENABLED:"false"}).ready,true);
 assert.throws(()=>api.notificationSmsConfig({...env,NOTIFICATION_SMS_ENABLED:"invalid"}));
});
const kitEnv={
 NOTIFICATION_SMS_PROVIDER:"keepInTouch",NOTIFICATION_SMS_KEY:"fictional-body-key",
 NOTIFICATION_SMS_BEARER_TOKEN:"fictional-distinct-bearer",NOTIFICATION_SMS_CLIENT_ID:"fictional-client",
 NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:"digits",
};
test("Keep in Touch exact fixed POST contract, independent credentials and event metadata",async()=>{
 const state=globalThis.fakeSmsNetwork;state.addresses=[{address:"8.8.8.8",family:4}];state.scenario="accepted";
 state.response='{"success":true,"message":"a human message is not the contract"}';
 assert.equal(await api.sendNotificationSms(kitEnv,"+919876543210","Fictional message",{dltTemplateId:"event-booking",dltEntityId:"NOT_SENT"}),"provider_accepted");
 assert.equal(state.url,"https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS");
 assert.equal(state.options.method,"POST");assert.equal(state.options.agent,false);
 assert.equal(state.options.headers.Authorization,"Bearer fictional-distinct-bearer");
 assert.equal(state.options.headers["Content-Type"],"application/json");
 assert.deepEqual(JSON.parse(state.body),{countryCode:"91",mobile:"9876543210",senderId:"DIGIQ",message:"Fictional message",apiKey:"fictional-body-key",clientId:"fictional-client",templateId:"event-booking"});
 assert.equal(state.options.headers["Content-Length"],Buffer.byteLength(state.body));
 assert.equal(state.pinned.address,"8.8.8.8");
 const cfg=api.notificationSmsConfig(kitEnv);
 assert.equal(api.smsMetadataReady(cfg,{dltTemplateId:"event"}),true);
 assert.equal(api.smsMetadataReady(cfg,{}),false);
 assert.equal(JSON.parse(api.smsPayload(cfg,"+919876543210","Fixture",{senderId:"OVERRIDE",dltTemplateId:"reminder"}).body).templateId,"reminder");
 delete state.response;
});
test("Keep in Touch splits valid international recipients without dropping national leading zeros; format is explicit",()=>{
 for(const [to,code,mobile] of [["+919876543210","91","9876543210"],["+442079460018","44","2079460018"],["+39066982","39","066982"],["+12025550123","1","2025550123"]]){
  for(const format of ["digits","plus"]){
   const cfg=api.notificationSmsConfig({...kitEnv,NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:format});
   const payload=JSON.parse(api.smsPayload(cfg,to,"Fixture",{dltTemplateId:"event"}).body);
   assert.equal(payload.countryCode,(format==="plus"?"+":"")+code);assert.equal(payload.mobile,mobile);
  }
 }
 for(const to of ["9876543210","+910000000000","+999123456789","+390"," +919876543210","+919876543210ext1"]){
  assert.throws(()=>api.smsPayload(api.notificationSmsConfig(kitEnv),to,"Fixture",{dltTemplateId:"event"}));
 }
 assert.throws(()=>api.smsPayload(api.notificationSmsConfig(kitEnv),"+919876543210","Fixture",{}));
});
test("Keep in Touch readiness requires independent protected fields, no unused entity or generic mapping, and never echoes values",()=>{
 assert.equal(api.notificationSmsReadiness(kitEnv).ready,true);
  for(const name of Object.keys(kitEnv).filter(name => name !== "NOTIFICATION_SMS_SENDER_ID")){
  const missing={...kitEnv,[name]:""};
  assert.equal(api.notificationSmsReadiness(missing).ready,false,name);
 }
 for(const format of ["auto","+91","91","plus-or-digits"]){
  assert.equal(api.notificationSmsReadiness({...kitEnv,NOTIFICATION_SMS_COUNTRY_CODE_FORMAT:format}).ready,false);
 }
 const readiness=api.notificationSmsReadiness(kitEnv);
 for(const key of ["NOTIFICATION_SMS_KEY","NOTIFICATION_SMS_BEARER_TOKEN","NOTIFICATION_SMS_CLIENT_ID","NOTIFICATION_SMS_SENDER_ID"]){
  assert.equal(JSON.stringify(readiness).includes(kitEnv[key]),false);
  const missing=api.notificationSmsReadiness({...kitEnv,[key]:""});
   assert.equal(missing.keys.find(k=>k.key===key).status,key === "NOTIFICATION_SMS_SENDER_ID" ? "default" : "missing");
  const other = key === "NOTIFICATION_SMS_KEY" ? "NOTIFICATION_SMS_BEARER_TOKEN" : "NOTIFICATION_SMS_KEY";
  assert.equal(missing.keys.find(k=>k.key===other)?.status,"configured");
 }
 for(const staticFields of [{apiKey:"private"},{route:kitEnv.NOTIFICATION_SMS_KEY},{route:kitEnv.NOTIFICATION_SMS_BEARER_TOKEN}]){
  assert.throws(()=>api.notificationSmsConfig({...kitEnv,NOTIFICATION_SMS_MAPPING:JSON.stringify({...map,staticFields})}));
 }
 assert.throws(()=>api.notificationSmsConfig({...env,NOTIFICATION_SMS_BEARER_TOKEN:kitEnv.NOTIFICATION_SMS_BEARER_TOKEN,
  NOTIFICATION_SMS_MAPPING:JSON.stringify({...map,staticFields:{route:kitEnv.NOTIFICATION_SMS_BEARER_TOKEN}})}));
 assert.equal(api.notificationSmsReadiness({...kitEnv,NOTIFICATION_SMS_ENTITY_ID:"invalid\nunused"}).ready,true);
});
test("Keep in Touch requires bearer, API key and client, but neither sender nor entity",()=>{
 const optional={...kitEnv,NOTIFICATION_SMS_SENDER_ID:"",NOTIFICATION_SMS_ENTITY_ID:""};
 assert.equal(api.notificationSmsReadiness(optional).ready,true);
 const cfg=api.notificationSmsConfig(optional);
 assert.equal(api.smsMetadataReady(cfg,{dltTemplateId:"booking"}),true);
 const payload=api.smsPayload(cfg,"+919876543210","Fictional message",{dltTemplateId:"booking"});
 assert.equal(payload.headers.Authorization,"Bearer fictional-distinct-bearer");
 const body=JSON.parse(payload.body);
 assert.equal(body.apiKey,kitEnv.NOTIFICATION_SMS_KEY);assert.equal(body.clientId,kitEnv.NOTIFICATION_SMS_CLIENT_ID);
 assert.equal(Object.hasOwn(body,"senderId"),false);assert.equal(Object.hasOwn(body,"entityId"),false);
 assert.equal(api.notificationSmsReadiness({...optional,NOTIFICATION_SMS_BEARER_TOKEN:""}).ready,false);
 assert.equal(api.notificationSmsReadiness({...optional,NOTIFICATION_SMS_CLIENT_ID:""}).ready,false);
 assert.equal(api.notificationSmsReadiness({...optional,NOTIFICATION_SMS_KEY:""}).ready,false);
 assert.equal(api.smsMetadataReady(cfg,{senderId:"invalid sender",dltTemplateId:"booking"}),false);
});
test("Custom API bearer uses its separate token and preserves legacy API-key fallback",()=>{
 const bearerEnv={...env,NOTIFICATION_SMS_MAPPING:JSON.stringify({...map,authMode:"bearer"})};
 assert.equal(api.smsPayload(api.notificationSmsConfig({...bearerEnv,NOTIFICATION_SMS_BEARER_TOKEN:"fictional-bearer"}),"+919876543210","Fixture",{}).headers.Authorization,"Bearer fictional-bearer");
 assert.equal(api.smsPayload(api.notificationSmsConfig(bearerEnv),"+919876543210","Fixture",{}).headers.Authorization,`Bearer ${env.NOTIFICATION_SMS_KEY}`);
 assert.throws(()=>api.notificationSmsConfig({...bearerEnv,NOTIFICATION_SMS_BEARER_TOKEN:"invalid token"}));
});
test("Keep in Touch accepts only boolean true on HTTP 200; false is rejected and all ambiguous outcomes remain unknown",async()=>{
 const state=globalThis.fakeSmsNetwork;state.scenario="accepted";
 const cfg=api.notificationSmsConfig(kitEnv);
 for(const [body,outcome] of [['{"success":true}',"provider_accepted"],['{"success":false}',"provider_rejected"],
  ['{"success":"true"}',"delivery_unknown"],['{"success":"false"}',"delivery_unknown"],['{"success":1}',"delivery_unknown"],
  ['{"success":null}',"delivery_unknown"],['{"message":"SMS sent successfully"}',"delivery_unknown"],['[]',"delivery_unknown"],
  ['{"success":{}}',"delivery_unknown"],["broken private diagnostic","delivery_unknown"]]){
  assert.equal(api.classifySmsResponse(cfg.mapping,200,body,"keepInTouch"),outcome);
  state.response=body;
  assert.equal(await api.sendNotificationSms(kitEnv,"+919876543210","Fixture",{dltTemplateId:"event"}),outcome);
 }
 for(const [status,outcome] of [[202,"delivery_unknown"],[204,"delivery_unknown"],[302,"provider_rejected"],[401,"provider_rejected"],[500,"delivery_unknown"]]){
  state.status=status;state.response='{"success":true,"message":"private"}';
  assert.equal(await api.sendNotificationSms(kitEnv,"+919876543210","Fixture",{dltTemplateId:"event"}),outcome);
 }
 delete state.response;delete state.status;
 for(const [scenario,outcome] of [["before","pre_dispatch_failed"],["after","delivery_unknown"],["timeout","delivery_unknown"]]){
  state.scenario=scenario;
  assert.equal(await api.sendNotificationSms(kitEnv,"+919876543210","Fixture",{dltTemplateId:"event"}),outcome);
 }
 state.scenario="accepted";
});
test("provider Client ID and DLT defaults enter the request, with explicit template metadata taking precedence",()=>{
 const config=api.notificationSmsConfig({...env,NOTIFICATION_SMS_CLIENT_ID:"private-client",NOTIFICATION_SMS_SENDER_ID:"DIGIQ",NOTIFICATION_SMS_ENTITY_ID:"entity-default"});
 const defaults=JSON.parse(api.smsPayload(config,"+15555550123","Fixture message",{dltTemplateId:"template"}).body);
 assert.equal(defaults.client_id,"private-client");assert.equal(defaults.sender,"DIGIQ");assert.equal(defaults.entity,"entity-default");
 const override=JSON.parse(api.smsPayload(config,"+15555550123","Fixture message",{senderId:"OVERRIDE",dltEntityId:"override-entity"}).body);
 assert.equal(override.sender,"OVERRIDE");assert.equal(override.entity,"override-entity");
 const custom=api.notificationSmsConfig({...env,NOTIFICATION_SMS_CLIENT_ID:"private-client",NOTIFICATION_SMS_MAPPING:JSON.stringify({...map,fields:{...map.fields,clientId:"client"}})});
 assert.equal(JSON.parse(api.smsPayload(custom,"+15555550123","Fixture message",{}).body).client,"private-client");
 assert.throws(()=>api.notificationSmsConfig({...env,NOTIFICATION_SMS_CLIENT_ID:"private-client",NOTIFICATION_SMS_MAPPING:JSON.stringify({...map,staticFields:{client_id:"collision"}})}));
});
test("status URL is validated and only safe URLs and presence statuses are returned",()=>{
 const config={...env,NOTIFICATION_SMS_STATUS_URL:"https://receipts.example.invalid/check",NOTIFICATION_SMS_CLIENT_ID:"private-client",NOTIFICATION_SMS_ENTITY_ID:"private-entity"};
 const readiness=api.notificationSmsReadiness(config);
 assert.equal(readiness.statusApiUrl,config.NOTIFICATION_SMS_STATUS_URL);
 assert.equal(readiness.apiUrl,env.NOTIFICATION_SMS_URL);
 for(const value of ["private-client","private-entity",env.NOTIFICATION_SMS_KEY])assert.equal(JSON.stringify(readiness).includes(value),false);
 const unsafe=api.notificationSmsReadiness({...env,NOTIFICATION_SMS_URL:"https://user:password@provider.example.invalid/",NOTIFICATION_SMS_STATUS_URL:"http://127.0.0.1/status"});
 assert.equal(unsafe.apiUrl,"");assert.equal(unsafe.statusApiUrl,"");assert.equal(unsafe.ready,false);
});
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
