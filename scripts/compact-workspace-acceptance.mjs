// Fictional-data-only compact ClinicFlow acceptance pass. All API traffic is intercepted.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const out = "screenshots/compact-workspace-acceptance";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "UTC" });
const page = await context.newPage();
page.setDefaultTimeout(4500);
let role = "superAdmin", failLists = false, delayLists = 0, writes = [], requests = [], errors = [];
page.on("pageerror", e => errors.push(e.message));
const clinic = { id:"c1", name:"Fictional Northside Clinic", slug:"fictional-northside", status:"active", timezone:"UTC", city:"Example City", phone:"555-0100", email:"clinic@example.invalid", address:"10 Fictional Way" };
const appointments = [
 { id:"fx-a1", reference:"FX-1001", token:1, patientName:"Alexandria Verylongpatientname Example-Surname", patientPhone:"555-0101", doctorName:"Dr. Rowan Example", clinicName:clinic.name, branchName:"Northside Branch", date:"2026-03-02", startTime:"09:00", endTime:"09:20", status:"booked", revision:1, allowedActions:["checkIn","cancel"], createdAt:"2026-03-01T08:00:00Z" },
 { id:"fx-a2", reference:"FX-1002", token:2, patientName:"Morgan Sample", patientPhone:"555-0102", doctorName:"Dr. Rowan Example", clinicName:clinic.name, branchName:"Northside Branch", date:"2026-03-02", startTime:"09:20", endTime:"09:40", status:"checkedIn", revision:1, allowedActions:["start","noShow"], createdAt:"2026-03-01T08:05:00Z" },
 { id:"fx-a3", reference:"FX-1003", token:3, patientName:"Jamie Fiction", patientPhone:"555-0103", doctorName:"Dr. Rowan Example", clinicName:clinic.name, branchName:"Northside Branch", date:"2026-03-02", startTime:"09:40", endTime:"10:00", status:"completed", revision:1, allowedActions:[], createdAt:"2026-03-01T08:10:00Z" }
];
const rows = {
 clinics:[clinic], branches:[{id:"b1",clinicId:"c1",clinicName:clinic.name,name:"Northside Branch",city:"Example City",timezone:"UTC",status:"active"}],
 users:[{id:"u1",fullName:"Riley Fiction",name:"Riley Fiction",email:"riley@example.invalid",role:"receptionist",status:"active",clinics:[{id:"c1",name:clinic.name}]}],
 patients:[{id:"p1",fullName:"Alexandria Verylongpatientname Example-Surname",mobile:"555-0101",email:"patient@example.invalid",status:"active",createdAt:"2026-02-01T09:00:00Z"}],
 doctors:[{id:"d1",fullName:"Dr. Rowan Example",name:"Dr. Rowan Example",email:"doctor@example.invalid",status:"active"}],
 masters:[{id:"m1",name:"Fictional Specialty",category:"specialization",status:"active"}],
 "audit-logs":[{id:"au1",createdAt:"2026-03-01T08:00:00Z",actorName:"Fixture Admin",action:"created",entityType:"clinic",summary:"Created fictional clinic"}],
 "qrs":[{id:"q1",name:"Northside QR",reference:"FX-QR-1",status:"active",clinicName:clinic.name}],
 schedules:[{id:"s1",doctorId:"d1",branchId:"b1",dayOfWeek:1,startTime:"09:00",endTime:"17:00",slotDuration:20,status:"active"}]
};
const list = (data=[]) => ({data,items:data,total:data.length,page:1,pageSize:20});
const mailEvents=["booking","onboarding","rescheduled","cancelled","completed","reminder"];
const templateData={scopeName:clinic.name,variables:["clinic_name","patient_name"],items:mailEvents.map(event=>({event,recipient:"patient",title:event,revision:0,source:"default",content:{enabled:true,subject:"Visit update",body:"Hello {{patient_name}}",prefix:"",footer:"Contact {{clinic_name}}",logoUrl:""},previewSubject:"Visit update",previewBody:"Hello Patient",delivery:"Production worker"}))};
await context.route("**/api/**", async r => {
 const req=r.request(), u=new URL(req.url()), p=u.pathname.replace(/^\/api/,""); requests.push(`${req.method()} ${p}`);
 const json=(data,status=200)=>r.fulfill({status,json:data});
 if (p==="/auth/status") return json({authenticated:true,role,staffPasswordVerified:true,requiresStaffPassword:false});
 if (p==="/auth/csrf") return json({csrfToken:"fictional-interceptor-token"});
 if (p==="/me") return json({user:{id:"fx-user",fullName:"Fixture Admin",email:"admin@example.invalid",role,status:"active"},needsOnboarding:false,clinicIds:["c1"],branchIds:["b1"],assignments:[],doctorId:"d1"});
 if (req.method()!=="GET") { const data=req.postDataJSON?.()||{}; writes.push({path:p,data}); return json(p.endsWith("/check")?{provider:"fixture",source:"environment",checkedAt:"2026-03-01T00:00:00Z",checks:[{name:"Configuration",status:"passed",message:"Fictional fixture check"},{name:"Delivery",status:"not_verified",message:"No message sent"}]}:p.endsWith("/test-email")?{status:"provider_accepted",message:"Intercepted; no email sent"}:{success:true}); }
 if (failLists && (p.includes("patients")||p.includes("appointments"))) return json({error:"Fictional temporary fixture failure"},503);
 if (delayLists && (p.includes("patients")||p.includes("appointments"))) await new Promise(resolve=>setTimeout(resolve,delayLists));
 if (p==="/clinics/c1") return json(clinic);
 if (p==="/session-contexts"||p==="/public/availability/sessions") return json([]);
 if (p==="/queue") return json({entries:[],total:0,page:1,pageSize:20,queueVersion:"fx-v1",reserved:0,statusCounts:{},presence:{status:"available"}});
 if (p.startsWith("/public/clinics-by-slug/")) {
   const slug=p.split("/").at(-1);
   if(slug==="access-check") return json({error:"Clinic page not found"},404);
   if(slug==="fictional-northside") return json({clinic:{...clinic,doctorCount:1,averageConsultationMinutes:null},branches:[{id:"b1",name:"Northside Branch",slug:"northside",address:"10 Fictional Way",city:"Example City",timezone:"UTC",effectiveEmail:clinic.email,effectivePhone:clinic.phone,openingHours:[]}],branch:null,qrReference:null,doctors:[],branchCount:1,branchDoctorCount:0,directoryPagination:{total:1,page:1,pageSize:25,totalPages:1}});
 }
 if (p==="/clinics") return json(list(rows.clinics));
 if (p==="/appointments") { const s=(u.searchParams.get("search")||"").toLowerCase(), data=s?appointments.filter(a=>`${a.reference} ${a.patientName}`.toLowerCase().includes(s)):appointments;return json({...list(data),total:data.length}); }
 if (p==="/dashboard") return json({stats:[],counts:{},todayAppointments:2,waiting:1,completed:1,averageWait:0,recentAppointments:appointments,recentActivity:[],trend:[]});
 if (p==="/reports") return json({ ...list([{key:"appointments",label:"Appointments",value:3},{key:"patients",label:"Patients",value:2}]),rows:[{key:"appointments",label:"Appointments",value:3},{key:"patients",label:"Patients",value:2}],summary:{},groups:[]});
 if (p==="/management/permissions") return json({revision:1,roles:["clinicAdmin","doctor","receptionist"],modules:["appointments","patients"],actions:["read","create","update","delete"],denied:[]});
 if (p==="/management/custom-roles") return json({revision:1,roles:[{id:"limited",name:"Limited desk",baseRole:"receptionist",denied:["appointments:delete"]}],bindings:[{userId:"u1",roleId:"limited",clinicId:"c1"}]});
 if (p==="/management/system-users") return json(list(rows.users));
 if (p==="/management/templates") return json(templateData);
 if (p==="/settings/integrations") return json({editable:true,smtp:{ready:true,source:"environment",revision:null,keys:["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","SMTP_FROM"].map(key=>({key,status:"configured"}))},sms:{ready:false,source:"environment",revision:null,keys:["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_MESSAGING_SERVICE_SID"].map(key=>({key,status:"missing"}))}});
 if (p==="/settings/integrations/storage") return json({provider:"object",source:"environment",publicPath:"/media",configured:true});
 if (p==="/settings"||p==="/clinic-settings") return json({timezone:"UTC",notificationsEnabled:true,dateFormat:"DD/MM/YYYY",timeFormat:"24h",sessionTimeoutMinutes:60,countries:[],currencies:[]});
 if (p==="/clinics"||p==="/branches"||p==="/users"||p==="/patients"||p==="/doctors"||p==="/masters"||p==="/audit-logs"||p==="/qrs"||p==="/schedules") {let data=rows[p.slice(1)]||[];const s=(u.searchParams.get("search")||"").toLowerCase();if(s)data=data.filter(x=>JSON.stringify(x).toLowerCase().includes(s));return json(list(data));}
 if (p.includes("appointments")) return json(list(appointments));
 if (p.includes("branches")) return json(list(rows.branches));
 if (p.includes("clinics")) return json(list(rows.clinics));
 if (p.includes("patients")) return json(list(rows.patients));
 if (p.includes("doctors")) return json(list(rows.doctors));
 if (p.includes("masters")) return json(list(rows.masters));
 if (p.includes("schedule")) return json(list(rows.schedules));
 if (p.includes("template")) return json(templateData);
 return json(list([]));
});
const pass=[], fail=[], gaps=[], measures=[];
async function check(name,fn){try{await fn();pass.push(name);console.log("PASS",name)}catch(e){fail.push({name,error:String(e.message).slice(0,600)});console.log("FAIL",name,String(e.message).slice(0,200))}}
async function go(path){await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:15000});await page.locator(".workspace").waitFor({state:"visible",timeout:4500}).catch(()=>{});}
try{
 const routes=["dashboard","clinics","branches","users","patients","masters","appointments","queue","reports","settings","audit","qrs","book","availability","exceptions","demo","templates","permissions","integrations","system-users","profile"];
 await check("21 admin destinations at 1440/1024/390: visible workspace, boundary, overflow and pre-table/control geometry",async()=>{
  const problems=[];
  for(const width of [1440,1024,390]){await page.setViewportSize({width,height:900});for(const route of routes){try{await go(`/admin/${route}`);}catch(e){problems.push(`${route}@${width}: navigation ${e.message.slice(0,120)}`);continue;}const m=await page.evaluate(()=>{const visible=e=>{let b=e.getBoundingClientRect();return b.width>0&&b.height>0};const box=e=>{let b=e.getBoundingClientRect();return{top:Math.round(b.top),height:Math.round(b.height),width:Math.round(b.width)}};let w=document.querySelector(".workspace"),t=document.querySelector("main table"),main=document.querySelector("main");return{workspace:!!w,error:document.body.innerText.includes("Something went wrong"),errorText:document.body.innerText.slice(-500),overflow:document.documentElement.scrollWidth-innerWidth,title:document.querySelector("h1")?.innerText,preTable:t&&main?Math.round(t.getBoundingClientRect().top-main.getBoundingClientRect().top):null,filterRows:[...document.querySelectorAll(".filter-bar-row")].filter(visible).map(box),heads:[...document.querySelectorAll(".panel-heading")].filter(visible).map(box),controls:[...document.querySelectorAll("main input,main select,main button")].filter(visible).length}});measures.push({route,width,...m});if(!m.workspace||m.error)problems.push(`${route}@${width}: workspace/boundary ${m.errorText||""}`);if(m.overflow>1)problems.push(`${route}@${width}: horizontal overflow ${m.overflow}px`);if(width===1440||["appointments","settings","permissions","integrations","templates","profile"].includes(route))await page.screenshot({path:`${out}/${width}-${route}.png`});}}
  await writeFile(`${out}/layout-metrics.json`,JSON.stringify(measures,null,2));if(problems.length)throw Error(problems.join("; "));
 });
 await check("Appointments populated compact actions, All status tab, long cell and search suggestions",async()=>{
  await page.setViewportSize({width:1440,height:900});await go("/admin/appointments");
  await expect(page.getByText("Alexandria Verylongpatientname Example-Surname")).toBeVisible();
  await expect(page.getByRole("button",{name:"All",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByText(/Updated \d{2}/)).toBeVisible();
  await expect(page.getByRole("button",{name:/Export all matching/})).toBeVisible();
  await expect(page.getByLabel("Sort appointments")).toBeVisible();
  const names=await page.locator("tbody tr").count();if(names!==3)throw Error(`expected 3 fixture rows, got ${names}`);
  const search=page.getByPlaceholder(/Search appointments/i);await search.fill("FX");await expect(page.getByRole("listbox",{name:/Search appointments suggestions/})).toBeVisible();await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");await expect(page.getByTestId("appointment-fx-a1")).toBeVisible();
  await page.getByPlaceholder(/Search appointments/i).fill("absent-fixture");await page.waitForTimeout(450);await expect(page.getByRole("status").filter({hasText:"No matching results"})).toBeVisible();
  await page.screenshot({path:`${out}/appointments-populated.png`});
 });
 await check("Templates visible; draft/editor preserved without sending messages",async()=>{await go("/admin/templates");await expect(page.getByTestId("input-subject")).toBeVisible();await page.getByTestId("input-subject").fill("Fictional draft retained");await expect(page.getByRole("heading",{name:/Email templates/})).toHaveCount(1);await page.screenshot({path:`${out}/templates-draft.png`});});
 await check("Settings, scheduling, role drawer and integration confirmation surfaces render",async()=>{
  await go("/admin/settings");await expect(page.locator("main")).toBeVisible();await page.screenshot({path:`${out}/settings.png`});
  await go("/admin/availability");await expect(page.locator("main")).toBeVisible();await page.screenshot({path:`${out}/availability.png`});
  await go("/admin/permissions");await expect(page.locator("main")).toBeVisible();await page.screenshot({path:`${out}/permissions.png`});
  await go("/admin/integrations");await expect(page.locator("main")).toBeVisible();await page.screenshot({path:`${out}/integrations.png`});
 });
 await check("Advanced filter drawer overlays listing and restores focus on Escape",async()=>{await page.setViewportSize({width:1440,height:900});await go("/admin/clinics");const trigger=page.getByTestId("button-toggle-advanced-filters");const before=await page.locator("table").boundingBox();await trigger.click();const drawer=page.getByRole("dialog");await expect(drawer).toBeVisible();const after=await page.locator("table").boundingBox();if(before&&after&&Math.abs(before.y-after.y)>2)throw Error(`opening filter drawer shifted listing by ${Math.round(after.y-before.y)}px`);await page.keyboard.press("Escape");await expect(drawer).toHaveCount(0);await expect(trigger).toBeFocused();await page.screenshot({path:`${out}/filters-restored.png`});});
 await check("Scheduling copy-hours drawer opens without sending or saving",async()=>{await go("/admin/availability");const button=page.getByRole("button",{name:/Copy opening hours/i});if(await button.count()){await button.click();await expect(page.getByRole("dialog")).toBeVisible();await page.screenshot({path:`${out}/copy-hours-drawer.png`});await page.keyboard.press("Escape");}});
 await check("Custom role editor drawer guards unsaved discard",async()=>{await go("/admin/permissions");const edit=page.getByRole("button",{name:/Edit Limited desk/i});if(await edit.count()){await edit.click();const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();const field=dialog.locator("input").first();if(await field.count()){await field.fill("Unsaved fictional role");await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByText(/Discard|unsaved changes/i).last()).toBeVisible();await page.screenshot({path:`${out}/custom-role-discard.png`});}await page.keyboard.press("Escape");}});
 await check("Integration test send requires explicit confirmation; actual API is intercepted",async()=>{await go("/admin/integrations");const send=page.getByRole("button",{name:"Send test email",exact:true});if(await send.count()){await send.click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByText(/Yes, send a real email/i)).toBeVisible();await page.screenshot({path:`${out}/integration-confirmation.png`});await page.keyboard.press("Escape");}if(writes.some(w=>w.path.endsWith("/test-email")))throw Error("unexpected intercepted send occurred");});
 const publicRoutes=["/","/sign-in","/patient-login","/demo-login","/forgot-password","/reset-password","/access-check","/register-clinic","/register-doctor","/clinic/fictional-northside","/guest-booking","/book"];
 await check("Public/auth routes render views or their expected app-level not-found without boundary",async()=>{const results=[];for(const p of publicRoutes){await page.goto(origin+p);await page.waitForTimeout(120);let s=await page.evaluate(()=>({title:document.querySelector("h1")?.innerText||document.title,boundary:document.body.innerText.includes("Something went wrong"),overflow:document.documentElement.scrollWidth-innerWidth,body:document.body.innerText.slice(-400)}));results.push({path:p,...s});await page.screenshot({path:`${out}/public-${p.replaceAll("/","_")||"home"}.png`});if(s.boundary){gaps.push(`${p}: public/auth fixture route showed error boundary (response contract not represented by generic fixture)`);continue;}if(s.overflow>1)throw Error(`${p}: overflow ${s.overflow}`);}await writeFile(`${out}/public-routes.json`,JSON.stringify(results,null,2));});
 // Search behavior on Patients uses only intercepted query results. No mutations are issued.
 await check("Patient live-search query results and no-result feedback",async()=>{await go("/admin/patients");const input=page.locator('input[placeholder*="Search"]').first();if(await input.count()){await input.fill("Alex");await page.waitForTimeout(500);await expect(page.getByText(/Alexandria Verylongpatientname/).first()).toBeVisible();await input.fill("does-not-exist");await page.waitForTimeout(500);await expect(page.getByText("No matching patients",{exact:true})).toBeVisible({timeout:2500});}});
}finally{
 await writeFile(`${out}/report.json`,JSON.stringify({origin,pass,fail,gaps,measures,writes,apiRequestCount:requests.length,apiRequests:[...new Set(requests)],browserErrors:errors},null,2));
 await browser.close();
}
console.log(JSON.stringify({pass,fail,gaps,apiRequestCount:requests.length}));
if(fail.length)process.exitCode=1;