// Bounded, fictional-data-only browser checks for the information-density pass.
// All /api traffic is intercepted; no backend state or external messages are touched.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
if(!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const out="screenshots/information-density-check"; await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const result={checks:[],screenshots:[],fixtureNotes:[],apiWrites:[],errors:[]};
const clinic={id:"fx-clinic",name:"Fictional Northside Clinic",slug:"fictional-northside",status:"active",timezone:"UTC",city:"Example City",address:"10 Fictional Way"};
const appointments=[
 {id:"fx-a1",reference:"FX-1001",token:1,patientName:"Alexandria Verylongpatientname Example-Surname",patientPhone:"555-0101",doctorName:"Dr. Rowan Example",clinicName:clinic.name,branchName:"Northside Branch",date:"2026-03-02",startTime:"09:00",endTime:"09:20",status:"booked",revision:1,allowedActions:["checkIn","cancel"],createdAt:"2026-03-01T08:00:00Z"},
 {id:"fx-a2",reference:"FX-1002",token:2,patientName:"Morgan Sample",patientPhone:"555-0102",doctorName:"Dr. Rowan Example",clinicName:clinic.name,branchName:"Northside Branch",date:"2026-03-02",startTime:"09:20",endTime:"09:40",status:"checkedIn",revision:1,allowedActions:["start","noShow"],createdAt:"2026-03-01T08:05:00Z"}
];
const users=[{id:"fx-user-2",fullName:"Taylor Fictional Staff",name:"Taylor Fictional Staff",email:"taylor@example.invalid",mobile:"555-0111",role:"doctor",speciality:"Fictional Specialty",status:"active",clinicNames:["Northside Group","Westside Group"],branchNames:["Northside Branch","Westside Branch"],clinics:[{id:"fx-clinic",name:"Northside Group"},{id:"fx-clinic-2",name:"Westside Group"}],createdAt:"2026-02-01T00:00:00Z"}];
const queueFixture={entries:[{...appointments[0],tokenNumber:7,token:7,status:"waiting",patientsAhead:2,estimatedWaitMinutes:40}],total:1,entriesTotal:1,currentToken:6,nextToken:7,waiting:1,completed:0,inConsultation:0,expectedDurationMinutes:20,updatedAt:new Date().toISOString(),queueVersion:"fx-v1",sessionId:"fx-session",startTime:"09:00",presence:{status:"available"}};
const rows={clinics:[clinic],branches:[{id:"fx-b1",clinicId:clinic.id,clinicName:clinic.name,name:"Northside Branch",city:"Example City",timezone:"UTC",status:"active"}],users,patients:[{id:"fx-p1",fullName:appointments[0].patientName,mobile:"555-0101",email:"patient@example.invalid",status:"active",createdAt:"2026-02-01T00:00:00Z"}],doctors:[{id:"fx-d1",fullName:"Dr. Rowan Example",name:"Dr. Rowan Example",email:"doctor@example.invalid",status:"active"}],masters:[{id:"fx-m1",name:"Fictional Specialty",category:"specialization",status:"active"}],"audit-logs":[{id:"fx-au1",createdAt:"2026-03-01T08:00:00Z",actorName:"Fixture Admin",actorRole:"superAdmin",action:"created",entityType:"clinic",summary:"Created fictional clinic",payload:{fixture:"only",field:"safe"}}],qrs:[{id:"fx-q1",name:"Northside QR",reference:"FX-QR-1",url:"https://example.invalid/qr",status:"active",clinicName:clinic.name,branchName:"Northside Branch"}],schedules:[{id:"fx-s1",doctorId:"fx-d1",doctorName:"Dr. Rowan Example",branchId:"fx-b1",branchName:"Northside Branch",dayOfWeek:1,startTime:"09:00",endTime:"17:00",slotDuration:20,status:"active"}]};
const list=data=>({data,items:data,total:data.length,page:1,pageSize:20});
const events=["booking","onboarding","rescheduled","cancelled","completed","reminder"];
const templates={scopeName:clinic.name,variables:["clinic_name","patient_name"],items:events.map(event=>({event,recipient:"patient",title:event,revision:0,source:"default",content:{enabled:true,subject:"Visit update",body:"Hello {{patient_name}}",prefix:"",footer:"Contact {{clinic_name}}",logoUrl:""},previewSubject:"Visit update",previewBody:"Hello Patient",delivery:"Production worker"}))};
async function setup(role="superAdmin",width=1440){
 const context=await browser.newContext({viewport:{width,height:940},timezoneId:"UTC"}),page=await context.newPage();page.setDefaultTimeout(3000);page.on("pageerror",e=>result.errors.push(`${role}: ${e.message}`));
 await context.route("**/api/**",async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname.replace(/^\/api/,""),json=(x,s=200)=>r.fulfill({status:s,json:x});
  if(req.method()!=="GET"){result.apiWrites.push({role,path:p});return json({success:true,provider:"fixture",source:"environment",checkedAt:"2026-03-01T00:00:00Z",checks:[{name:"Configuration",status:"passed",message:"Fictional fixture"}]});}
  if(p==="/auth/status")return json({authenticated:role!=="anonymous",role:role==="anonymous"?null:role,staffPasswordVerified:true,requiresStaffPassword:false});
  if(p==="/auth/csrf")return json({csrfToken:"fictional-interceptor-token"});
  if(p==="/me")return json({user:{id:`fx-${role}`,fullName:"Fixture User",email:"user@example.invalid",role,status:"active"},needsOnboarding:false,clinicIds:[clinic.id],branchIds:["fx-b1"],assignments:[],doctorId:"fx-d1"});
  if(p===`/clinics/${clinic.id}`)return json(clinic);
  if(p==="/appointments"){const q=(u.searchParams.get("search")||"").toLowerCase(),data=q?appointments.filter(a=>`${a.reference} ${a.patientName}`.toLowerCase().includes(q)):appointments;return json({...list(data),total:data.length});}
  if(p.startsWith("/appointments/")){const a=appointments.find(x=>x.id===p.split("/").at(-1));return json(a||{error:"Fixture appointment not found"},a?200:404);}
  if(p==="/dashboard")return json({stats:[],counts:{},todayAppointments:2,waiting:1,completed:1,averageWait:0,recentAppointments:appointments,recentActivity:[],trend:[]});
  if(p==="/queue")return json(queueFixture);
  if(p==="/session-contexts")return json([{sessionId:"fx-session",startTime:"09:00",endTime:"09:20",date:"2026-10-03",timezone:"UTC",snapshotOnly:false}]);
  if(p==="/public/availability/sessions")return json([]);
  if(p==="/management/templates")return json(templates);
  if(p==="/settings/integrations")return json({editable:true,smtp:{ready:true,source:"environment",revision:null,keys:[]},sms:{ready:false,source:"environment",revision:null,keys:[]}});
  if(p==="/settings/integrations/storage")return json({provider:"object",source:"environment",publicPath:"/media",configured:true});
  if(p==="/settings"||p==="/clinic-settings")return json({timezone:"UTC",notificationsEnabled:true,dateFormat:"DD/MM/YYYY",timeFormat:"24h",sessionTimeoutMinutes:60,countries:[],currencies:[]});
  if(p==="/management/permissions")return json({revision:1,roles:["clinicAdmin","doctor","receptionist"],modules:["appointments","patients"],actions:["read","create","update","delete"],denied:[]});
  if(p==="/management/custom-roles")return json({revision:1,roles:[],bindings:[]});
  if(p==="/management/system-users")return json(list(users));
  if(p==="/public/clinics-by-slug/fictional-northside")return json({clinic,branches:rows.branches,branch:null,doctors:[],branchCount:1,branchDoctorCount:0,directoryPagination:{total:0,page:1,pageSize:25,totalPages:0}});
  const key=p.slice(1);if(rows[key])return json(list(rows[key]));
  if(p==="/reports")return json({...list([]),rows:[],summary:{},groups:[]});
  if(p.includes("appointment"))return json(list(appointments));
  if(p.includes("template"))return json(templates);
  return json(list([]));
 });
 return {context,page};
}
async function check(name,fn){if(process.env.DENSITY_ONLY&&!new RegExp(process.env.DENSITY_ONLY,"i").test(name)){console.log("SKIP",name);return{name,status:"skipped"};}const c={name,status:"pass"};try{c.details=await fn();}catch(e){c.status="fail";c.error=String(e.message).slice(0,700);}result.checks.push(c);await writeFile(`${out}/results.json`,JSON.stringify(result,null,2));console.log(c.status.toUpperCase(),name,c.error||"");return c;}
async function go(page,path){await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:10000});await page.locator("main").waitFor({state:"visible",timeout:3000}).catch(()=>{});}
async function snap(page,name){const path=`${out}/${name}.png`;await page.screenshot({path});result.screenshots.push(path);await writeFile(`${out}/results.json`,JSON.stringify(result,null,2));return path;}
try{
 let {context,page}=await setup("superAdmin",1440);
 await check("Admin appointments: populated default rows, compact controls, token retained without reference/status noise, date content and row height",async()=>{
  await go(page,"/admin/appointments");await expect(page.getByText(appointments[0].patientName)).toBeVisible();await expect(page.getByTestId("appointment-fx-a1")).toBeVisible();
  const m=await page.evaluate(()=>{const main=document.querySelector("main"),table=main?.querySelector("table"),tr=table?.querySelector("tbody tr"),box=e=>e&&{top:Math.round(e.getBoundingClientRect().top),height:Math.round(e.getBoundingClientRect().height)};return{title:document.querySelector("h1")?.innerText,body:main?.innerText,overflow:document.documentElement.scrollWidth-innerWidth,tableTop:table&&main?Math.round(table.getBoundingClientRect().top-main.getBoundingClientRect().top):null,row:box(tr),controls:[...document.querySelectorAll(".filter-bar-row")].filter(e=>e.getBoundingClientRect().height>0).map(box)}}); 
  const first=m.body.slice(m.body.indexOf(appointments[0].patientName),m.body.indexOf(appointments[1].patientName));if(/FX-1001|Awaiting consultation/i.test(first))throw Error(`unexpected reference/status in first row: ${first}`);
  if(m.overflow>1)throw Error(`horizontal overflow ${m.overflow}px`);await snap(page,"appointments-1440");
  await page.getByTestId("details-fx-a1").click();const detail=page.getByRole("dialog");await expect(detail).toBeVisible();await expect(detail).toContainText(appointments[0].patientName);await expect(detail).toContainText("FX-1001");await snap(page,"appointment-details");await page.keyboard.press("Escape");return m;
 });
 await context.close();
 ({context,page}=await setup("superAdmin",1024));
 await check("Appointments 1024px measure pre-table layout and row height",async()=>{await go(page,"/admin/appointments");const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,preTable:(()=>{const a=document.querySelector("main"),t=a?.querySelector("table");return a&&t?Math.round(t.getBoundingClientRect().top-a.getBoundingClientRect().top):null})(),row:document.querySelector("tbody tr")?.getBoundingClientRect().height,filterRows:[...document.querySelectorAll(".filter-bar-row")].filter(e=>e.getBoundingClientRect().height>0).length,tableScroll:(()=>{const e=document.querySelector(".table-scroll");return e?{clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,overflowX:getComputedStyle(e).overflowX}:null})()}));if(m.overflow>1)throw Error(`overflow ${m.overflow}px`);await snap(page,"appointments-1024");return m;});
 await check("Appointments mobile width has no horizontal page overflow",async()=>{await page.setViewportSize({width:390,height:844});await go(page,"/admin/appointments");const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,rows:document.querySelectorAll("tbody tr").length}));if(m.overflow>1)throw Error(`overflow ${m.overflow}px`);await snap(page,"appointments-mobile");return m;});
 await check("Appointment live search selection and no-result state",async()=>{await page.setViewportSize({width:1440,height:940});const input=page.getByPlaceholder(/Search appointments/i);await input.fill("FX");await expect(page.getByRole("listbox").first()).toBeVisible();await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");await expect(page.getByTestId("appointment-fx-a1")).toBeVisible();return{selected:await input.inputValue()};});
 await context.close();
 const publicCases=[["clinicAdmin","/admin/users"],["doctor","/doctor/appointments"],["receptionist","/receptionist/appointments"],["patient","/patient/appointments"]];
 for(const [role,path] of publicCases){const {context:c,page:p}=await setup(role,1280);await check(`${role} relevant screen ${path}`,async()=>{await go(p,path);const info=await p.evaluate(()=>({url:location.pathname,title:document.querySelector("h1")?.innerText,main:!!document.querySelector("main"),text:document.body.innerText.slice(0,700),overflow:document.documentElement.scrollWidth-innerWidth}));if(!info.main||info.url!==path)throw Error(`role route redirected/not rendered: ${JSON.stringify(info)}`);if(info.overflow>1)throw Error(`overflow ${info.overflow}px`);if(role==="receptionist")await snap(p,"receptionist-appointments");return info;});await c.close();}
 const {context:qc,page:qp}=await setup("superAdmin",1440);
 await check("Queue token row and expected-duration drawer: single drawer, clean Escape, dirty Keep editing then Discard",async()=>{
  await go(qp,"/admin/queue?clinic=fx-clinic&branch=fx-b1&doctor=fx-d1&date=2026-10-03&sessionId=fx-session");
  await expect(qp.getByTestId("button-queue-duration")).toBeVisible({timeout:5000});
  const tokenRow=qp.getByTestId("appointment-fx-a1");await expect(tokenRow).toBeVisible();await expect(tokenRow.getByText("7",{exact:true})).toBeVisible();
  await qp.getByTestId("button-queue-duration").click();
  const title=qp.getByRole("heading",{name:"Doctor duration · this clinic"});await expect(title).toBeVisible();
  await snap(qp,"queue-duration-drawer");
  await qp.keyboard.press("Escape");await expect(title).toHaveCount(0);
  await qp.getByTestId("button-queue-duration").click();
  await qp.getByTestId("select-duration-minutes").click();
  await expect(qp.getByRole("option",{name:"30 minutes"})).toBeVisible();
  await qp.getByRole("option",{name:"30 minutes"}).click();
  await qp.getByTestId("button-dialog-close").click();await expect(qp.getByTestId("discard-confirm")).toBeVisible();
  await qp.getByTestId("button-keep-editing").click();await expect(title).toBeVisible();
  await expect(qp.getByTestId("select-duration-minutes")).toContainText("30 minutes");
  await qp.getByTestId("button-dialog-close").click();await expect(qp.getByTestId("discard-confirm")).toBeVisible();
  await qp.getByTestId("button-discard-changes").click();await expect(title).toHaveCount(0);
  return{queueToken:"7",singleDrawer:true,cleanClose:true,dirtyGuard:"Keep editing retained 30 minutes; Discard closed drawer"};
 });await qc.close();
 const {context:ac,page:ap}=await setup("superAdmin",1280);
 await check("Staff assignment count opens drawer with human clinic names",async()=>{
  await go(ap,"/admin/system-users");const trigger=ap.getByTestId("button-system-assignments-fx-user-2");await expect(trigger).toBeVisible();
  await expect(trigger).toContainText(/2 clinics/i);await trigger.click();const dialog=ap.getByRole("dialog");await expect(dialog).toBeVisible();await expect(dialog).toContainText("Northside Group");await expect(dialog).toContainText("Westside Group");return await dialog.innerText();
 });await ac.close();
 const {context:rc,page:rp}=await setup("superAdmin",1280);
 await check("Shared patient resource hides identifiers in row and retains full contact in edit details",async()=>{
  await go(rp,"/admin/patients");const row=rp.getByTestId("row-patients-fx-p1");await expect(row).toBeVisible();const rowText=await row.innerText();if(/fx-p1/.test(rowText))throw Error(`row exposes technical identifier: ${rowText}`);
  await rp.getByRole("button",{name:/Edit Alexandria Verylongpatientname/}).click();const dialog=rp.getByRole("dialog");await expect(dialog).toBeVisible();const values=await dialog.locator("input").evaluateAll(es=>es.map(e=>({name:e.name,type:e.type,value:e.value})));if(!values.some(x=>x.value==="patient@example.invalid"))throw Error(`editor did not restore email in form input: ${JSON.stringify(values)}`);await snap(rp,"patient-details-editor");return{row:rowText,contactInputs:values.filter(x=>x.value)};
 });await rc.close();
 const {context:pc,page:pp}=await setup("clinicAdmin",1280);
 await check("Clinic Admin profile uses legal /admin/profile route, not the inaccessible super-admin shortcut",async()=>{await go(pp,"/admin/profile");const x=await pp.evaluate(()=>({url:location.pathname,title:document.querySelector("main h1")?.innerText||document.querySelector("main h2")?.innerText,main:!!document.querySelector("main")}));if(x.url!=="/admin/profile"||!x.main)throw Error(`unexpected profile route: ${JSON.stringify(x)}`);return x;});await pc.close();
 const {context:pubc,page:pubp}=await setup("anonymous",1280);
 await check("Public/auth spotcheck: landing, staff sign-in and recovery render without a boundary",async()=>{const views=[];for(const route of ["/","/sign-in","/forgot-password"]){await go(pubp,route);const x=await pubp.evaluate(()=>({url:location.pathname,title:document.querySelector("h1")?.innerText||document.querySelector("h2")?.innerText,boundary:document.body.innerText.includes("Something went wrong"),overflow:document.documentElement.scrollWidth-innerWidth}));if(x.boundary||x.overflow>1)throw Error(`${route}: ${JSON.stringify(x)}`);views.push(x);}await snap(pubp,"public-sign-in");return views;});await pubc.close();
 const {context:c,page:p}=await setup();
 await check("Audit payload details drawer, QR details, server-rendering drawer and diagnostics surface",async()=>{
  const observations={};
  await go(p,"/admin/audit");observations.auditRows=await p.locator("tbody tr").count();const detail=p.getByRole("button",{name:/Details/i}).first();if(await detail.count()){await detail.click();await expect(p.getByRole("dialog")).toBeVisible();observations.payload=await p.getByText(/Technical payload/i).count();await snap(p,"audit-details");await p.keyboard.press("Escape");}
  await go(p,"/admin/qrs");observations.qrRows=await p.locator("tbody tr").count();const qrView=p.getByTestId("button-view-qr-fx-q1");if(await qrView.count()){await qrView.click();const qrDialog=p.getByRole("dialog");await expect(qrDialog).toBeVisible();await expect(qrDialog).toContainText("Northside QR");await expect(qrDialog).toContainText("FX-QR-1");observations.qrDialog=true;await snap(p,"qr-details");await p.keyboard.press("Escape");}else throw Error("QR details action missing for fixture QR.");
  await go(p,"/admin/templates");const render=p.getByTestId("button-server-rendering").first();await render.waitFor({state:"visible",timeout:3000});await render.click();await expect(p.getByRole("dialog")).toBeVisible();observations.templateDrawer=true;await snap(p,"template-rendering");await p.keyboard.press("Escape");
  await go(p,"/admin/integrations");const checkBtn=p.getByTestId("button-check-smtp");if(await checkBtn.count()){await checkBtn.click();const diag=p.getByTestId("list-check-smtp");await expect(diag).toBeVisible({timeout:3000});await expect(diag).toContainText("Fictional fixture");observations.integrationDiagnostics=true;await snap(p,"integration-diagnostics");}else throw Error("SMTP connection-check action unavailable.");
  return observations;
 });await c.close();
}finally{
 await writeFile(`${out}/results.json`,JSON.stringify(result,null,2));await browser.close();
}
console.log(JSON.stringify({checks:result.checks.map(({name,status,error})=>({name,status,error})),screenshots:result.screenshots,fixtureNotes:result.fixtureNotes,apiWrites:result.apiWrites,errors:result.errors},null,2));
if(result.checks.some(c=>c.status==="fail"))process.exitCode=1;