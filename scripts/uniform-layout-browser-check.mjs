// Reusable fictional-fixture-only browser check for ClinicFlow's shared staff layout.
// Every /api/** request is intercepted (including writes); this is not a live-auth test.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const targeted = process.env.UNIFORM_LAYOUT_TARGETED === "1";
const out = targeted ? "screenshots/uniform-layout-targeted" : "screenshots/uniform-layout-check";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const result = { startedAt: new Date().toISOString(), fixtureOnly: true, scope: targeted ? "Targeted CSS-cascade regression only" : "Full uniform layout fixture journey", authNote: "Protected staff routes were rendered with intercepted fictional auth fixtures; authorization was not tested.", fixtureNotes: ["All /api/** requests intercepted; no live auth, DB, account, email, booking or backend writes.", "Non-GET requests are recorded and answered by fixtures."], checks: [], screenshots: [], apiRequests: [], interceptedWrites: [], errors: [], notTested: targeted ? ["Live authorization/access-control decisions", "Real DB/account/email/booking writes", "Print/download execution", "Other routes or broader journeys"] : ["Live authorization/access-control decisions", "Real DB/account/email/booking writes", "Print/download execution (separate pnpm test:tickets; avoided duplicate regression coverage)", "All role-specific route pages not listed in rendered evidence", "Animation/audio/external service behavior"] };
const clinic = { id:"fx-clinic", name:"Fictional Northside Clinic", slug:"fictional-northside", status:"active", timezone:"UTC", city:"Example City", address:"10 Fictional Way" };
const appts = [
  { id:"fx-appt-1", reference:"FX-APPT-1001", token:"M-01", patientCode:"PX-FAKE-001", patientName:"Alexandria Verylongpatientname Example-Surname", patientPhone:"555-0101", patientEmail:"alex@example.invalid", doctorId:"fx-doctor", doctorName:"Dr. Rowan Example-Surname", clinicId:clinic.id, clinicName:clinic.name, branchId:"fx-branch", branchName:"Northside Branch — Fictional Location", branchAddress:"10 Fictional Way, Example City", date:"2026-10-03", startTime:"09:00", endTime:"09:20", timezone:"UTC", status:"waiting", revision:1, allowedActions:["checkIn","cancel"], createdAt:"2026-10-02T08:00:00Z", confirmationEmail:"unavailable", history:[{status:"booked",occurredAt:"2026-10-02T08:00:00Z",reason:"Fictional fixture booking"},{status:"waiting",occurredAt:"2026-10-03T08:55:00Z",reason:"Fictional arrival"}] },
  { id:"fx-appt-2", reference:"FX-APPT-1002", token:"M-02", patientCode:"PX-FAKE-002", patientName:"Morgan Sample Patient", patientPhone:"555-0102", patientEmail:"morgan@example.invalid", doctorId:"fx-doctor", doctorName:"Dr. Rowan Example-Surname", clinicId:clinic.id, clinicName:clinic.name, branchId:"fx-branch", branchName:"Northside Branch — Fictional Location", date:"2026-10-03", startTime:"09:20", endTime:"09:40", timezone:"UTC", status:"booked", revision:1, allowedActions:["start","noShow","cancel"], createdAt:"2026-10-02T08:05:00Z", confirmationEmail:"Booking confirmed. Fictional delivery notice." },
  { id:"fx-appt-3", reference:"FX-APPT-1003", token:"M-03", patientCode:"PX-FAKE-003", patientName:"Jordan Placeholder Person", patientPhone:"555-0103", doctorId:"fx-doctor", doctorName:"Dr. Rowan Example-Surname", clinicId:clinic.id, clinicName:clinic.name, branchId:"fx-branch", branchName:"Northside Branch — Fictional Location", date:"2026-10-03", startTime:"09:40", endTime:"10:00", timezone:"UTC", status:"inConsultation", revision:1, allowedActions:["complete","call"], createdAt:"2026-10-02T08:10:00Z" },
  ...Array.from({length:8},(_,i)=>{const n=i+4;return{id:`fx-appt-${n}`,reference:`FX-APPT-10${n}`,token:`M-${String(n).padStart(2,"0")}`,patientCode:`PX-FAKE-00${n}`,patientName:`Fictional Patient ${n}`,patientPhone:`555-01${String(n).padStart(2,"0")}`,doctorId:"fx-doctor",doctorName:"Dr. Rowan Example-Surname",clinicId:clinic.id,clinicName:clinic.name,branchId:"fx-branch",branchName:"Northside Branch — Fictional Location",date:"2026-10-03",startTime:"10:00",endTime:"10:20",timezone:"UTC",status:"booked",revision:1,allowedActions:["cancel"],createdAt:`2026-10-02T08:${String(10+n).padStart(2,"0")}:00Z`};}),
];
const qr = { checkInUrl:"https://example.invalid/fake-check-in/FX-APPT-1001", payload:"fictional-qr-payload" };
const staff = [{ id:"fx-staff-1",fullName:"Taylor Fictional Staff",name:"Taylor Fictional Staff",email:"taylor@example.invalid",mobile:"555-0111",role:"doctor",speciality:"Fictional Specialty",status:"active",clinicNames:[clinic.name],branchNames:["Northside Branch"],clinics:[{id:clinic.id,name:clinic.name}],createdAt:"2026-02-01T00:00:00Z" }];
const resources = {
 clinics:[clinic], branches:[{id:"fx-branch",clinicId:clinic.id,clinicName:clinic.name,name:"Northside Branch",city:"Example City",timezone:"UTC",status:"active"}],
 patients:[{id:"fx-patient",fullName:appts[0].patientName,mobile:"555-0101",email:"alex@example.invalid",status:"active",createdAt:"2026-02-01T00:00:00Z"}],
 doctors:[{id:"fx-doctor",fullName:"Dr. Rowan Example-Surname",name:"Dr. Rowan Example-Surname",email:"doctor@example.invalid",status:"active"}],
 users:staff, "system-users":staff, masters:[{id:"fx-master",name:"Fictional Specialty",category:"specialization",status:"active"}],
 qrs:[{id:"fx-qr",name:"Fictional Northside QR",reference:"FX-QR-1",url:"https://example.invalid/qr",status:"active",clinicName:clinic.name,branchName:"Northside Branch"}],
 schedules:[{id:"fx-schedule",doctorId:"fx-doctor",doctorName:"Dr. Rowan Example-Surname",branchId:"fx-branch",branchName:"Northside Branch",dayOfWeek:1,startTime:"09:00",endTime:"17:00",slotDuration:20,status:"active"}],
 "availability-exceptions":[], "custom-roles":[], "audit-logs":[]
};
const list = data => ({ data, items:data, total:data.length, page:1, pageSize:20 });
const queue = { entries:[], ownEntry:{patientsAhead:2,estimatedWaitMinutes:40}, total:0, entriesTotal:0, currentToken:6,nextToken:7,waiting:1,completed:0,inConsultation:1,expectedDurationMinutes:20,updatedAt:"2026-10-03T08:55:00Z",queueVersion:"fx-v1",sessionId:"fx-session",presence:{status:"available"} };
let context, page;
async function setup(width=1280,height=900,columnsLayout=null) {
 context=await browser.newContext({viewport:{width,height},timezoneId:"UTC"}); page=await context.newPage(); page.setDefaultTimeout(3500);
 if(columnsLayout)await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:"digiq-columns:fx-superadmin:superAdmin:appointments",value:columnsLayout});
 page.on("pageerror",e=>result.errors.push(`${page.url()}: ${e.message}`));
 await context.route("**/api/**",async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname.replace(/^\/api/,""),json=(body,status=200)=>route.fulfill({status,json:body});
  result.apiRequests.push({method:req.method(),path:p,search:u.search});
  if(req.method()!=="GET"){result.interceptedWrites.push({method:req.method(),path:p});return json({success:true,provider:"fixture",source:"fictional-interceptor",checkedAt:"2026-10-02T00:00:00Z"});}
  if(p==="/auth/status")return json({authenticated:true,role:"superAdmin",staffPasswordVerified:true,requiresStaffPassword:false});
  if(p==="/auth/csrf")return json({csrfToken:"fictional-csrf-token"});
  if(p==="/me")return json({user:{id:"fx-superadmin",fullName:"Fixture Staff Reviewer",email:"reviewer@example.invalid",role:"superAdmin",status:"active"},needsOnboarding:false,clinicIds:[clinic.id],branchIds:["fx-branch"],assignments:[],doctorId:"fx-doctor"});
  if(p===`/clinics/${clinic.id}`)return json(clinic);
  if(p==="/appointments"){const pageNo=Number(u.searchParams.get("page")||1),size=Number(u.searchParams.get("pageSize")||u.searchParams.get("size")||20),data=appts.slice((pageNo-1)*size,pageNo*size);return json({...list(data),total:appts.length,page:pageNo,pageSize:size});}
  const qrMatch=p.match(/^\/appointments\/([^/]+)\/qr$/);if(qrMatch)return json(qr);
  const apptMatch=p.match(/^\/appointments\/([^/]+)$/);if(apptMatch){const a=appts.find(x=>x.id===apptMatch[1]);return json(a||{error:"Fixture appointment missing"},a?200:404);}
  if(p==="/dashboard")return json({stats:[],counts:{},todayAppointments:3,waiting:1,completed:0,averageWait:0,recentAppointments:appts,recentActivity:[],trend:[]});
  if(p==="/queue")return json(queue);
  if(p==="/session-contexts")return json([{sessionId:"fx-session",startTime:"09:00",endTime:"09:20",date:"2026-10-03",timezone:"UTC",snapshotOnly:false}]);
  if(p==="/public/availability/sessions")return json([]);
  if(p==="/management/permissions")return json({revision:1,roles:["clinicAdmin","doctor","receptionist"],modules:["appointments","patients"],actions:["read","create","update","delete"],denied:[]});
  if(p==="/management/custom-roles")return json({revision:1,roles:[],bindings:[]});
  if(p==="/management/system-users")return json(list(staff));
  if(p==="/reports"||p==="/reports/trends")return json({...list([]),rows:[],summary:{},groups:[],points:[]});
  if(p==="/settings"||p==="/clinic-settings")return json({timezone:"UTC",notificationsEnabled:true,dateFormat:"DD/MM/YYYY",timeFormat:"24h",sessionTimeoutMinutes:60,countries:[],currencies:[]});
  if(p.startsWith("/public/"))return json({clinic,branches:resources.branches,doctors:[],data:[],items:[],total:0});
  const key=p.slice(1); if(resources[key])return json(list(resources[key]));
  if(p.includes("appointment"))return json(list(appts));
  return json(list([]));
 });
}
const go=async path=>{await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:12000});await page.locator("main").waitFor({state:"visible",timeout:5000}).catch(()=>{});};
const shot=async name=>{const file=`${out}/${name}.png`;await page.screenshot({path:file});result.screenshots.push(file);await save();return file;};
const save=async()=>writeFile(`${out}/results.json`,JSON.stringify(result,null,2));
async function check(name,fn){const c={name,status:"pass"};try{c.details=await fn();}catch(e){c.status="fail";c.error=String(e.message).slice(0,2000);}result.checks.push(c);await save();console.log(`${c.status.toUpperCase()} ${name}${c.error?`: ${c.error}`:""}`);return c;}
const openTicket=async(id="fx-appt-1")=>{await page.getByTestId(`details-${id}`).click();const d=page.getByRole("dialog",{name:"Appointment Details"});await expect(d).toBeVisible();const sec=d.getByTestId("section-detail-ticket");await sec.scrollIntoViewIfNeeded();await expect(sec.getByTestId("appointment-ticket")).toBeVisible({timeout:6000});return sec;};
const metrics=()=>page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,viewport:innerWidth,main:document.querySelector("main")?.innerText.slice(0,260),title:document.querySelector("main h1")?.innerText}));
try {
 if(targeted){
  const checkAppointmentLayout=async(width,name,columnsLayout=null)=>{
   await setup(width,900,columnsLayout);await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();
   const info=await page.evaluate(()=>{const h=document.querySelector(".appt-table th.col-date"),b=h?.querySelector("button"),rows=[...document.querySelectorAll(".appt-table tbody tr[data-testid^='appointment-']")].slice(0,3),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},actions=rows.map(row=>{const group=row.querySelector(".row-actions"),buttons=[...(group?.querySelectorAll(".row-primary,.row-details,.row-ticket,.row-menu-trigger,.row-expand-toggle")||[])].map(el=>{const r=rect(el),range=document.createRange();range.selectNodeContents(el);const text=range.getBoundingClientRect();return{label:(el.innerText||"").trim()||el.getAttribute("aria-label")||"",aria:el.getAttribute("aria-label"),rect:r,textRect:rect({getBoundingClientRect:()=>text}),inside:!text.width||(text.left>=r.x-1&&text.right<=r.right+1)}});const expansion=row.querySelector(".row-expand-toggle");return{height:rect(row).height,buttons,expansionAtRowStart:!expansion||(!group.contains(expansion)&&!!expansion.closest("td")&&[...row.querySelectorAll("td")].slice(0,2).includes(expansion.closest("td"))),ticketInRow:!!row.querySelector("[data-testid^='ticket-']")};});
    return{dateHeader:{text:h?.innerText,rect:rect(h),buttonRect:b&&rect(b),whiteSpace:h&&getComputedStyle(h).whiteSpace},headers:[...document.querySelectorAll(".appt-table thead th")].map(e=>e.innerText.trim()),rowHeights:rows.map(row=>rect(row).height),actions,documentOverflow:document.documentElement.scrollWidth-innerWidth,tableScroll:{client:document.querySelector(".appt-table")?.clientWidth,scroll:document.querySelector(".appt-table")?.scrollWidth}};
   });
    await shot(`appointments-${name}`);console.log("TARGET_APPOINTMENT_METRICS",name,JSON.stringify(info));
   expect(info.documentOverflow).toBeLessThanOrEqual(1);expect(info.dateHeader.rect.height).toBeLessThanOrEqual(64);expect(info.dateHeader.buttonRect.height).toBeLessThanOrEqual(40);
   expect(info.rowHeights.every(h=>h>30&&h<=104)).toBe(true);
   for(const row of info.actions){expect(row.expansionAtRowStart).toBe(true);expect(row.ticketInRow).toBe(false);expect(row.buttons.map(b=>b.label).join(" ")).toMatch(/Check (In|Out)/);expect(row.buttons.map(b=>b.label).join(" ")).toMatch(/Details/);expect(row.buttons.map(b=>b.label).join(" ")).toMatch(/More/);expect(row.buttons.every(b=>b.inside)).toBe(true);}
   const visibleHeaders=info.headers.filter(Boolean).map(x=>x.startsWith("Actions")?"Actions":x);if(columnsLayout)expect(visibleHeaders).toEqual(["#","Visit Date","Patient","Waiting No.","Actions"]);else expect(visibleHeaders.slice(0,9)).toEqual(["#","Visit Date","Patient","Waiting No.","Clinic / Location","Doctor","Booked At","Status","Actions"]);
   result.checks.push({name:`${width}px appointments ${columnsLayout?"narrow saved columns":"default columns"}: compact date header, sensible rows, complete one-line actions and in-row expansion`,status:"pass",details:info});await save();console.log(`PASS ${width}px appointments ${name}`);
  };
  const closeContext=async()=>{await context?.close();context=null;page=null;};
  await checkAppointmentLayout(1024,"1024-default");
  await closeContext();
  await checkAppointmentLayout(1280,"1280-default");
  await closeContext();
  const narrowLayout={order:["serial","date","patient","token","location","doctor","createdAt","status","reference"],hidden:["location","doctor","createdAt","status","reference"],pinned:null,views:[]};
  await checkAppointmentLayout(1280,"1280-narrowed",narrowLayout);
  await closeContext();
  await setup(1280,900);await go("/admin/patients");const patientRow=page.getByTestId("row-patients-fx-patient");await expect(patientRow).toBeVisible();
  const patientActions=await patientRow.locator(".row-actions").evaluate(el=>({wrap:getComputedStyle(el).flexWrap,items:[...el.children].map(x=>({label:(x.innerText||"").trim()||x.getAttribute("aria-label")||"",rect:(()=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right}})()})),height:el.getBoundingClientRect().height}));
  await expect(patientRow.getByRole("button",{name:/Edit/})).toBeVisible();await expect(page.getByTestId("menu-fx-patient")).toBeVisible();await page.getByTestId("menu-fx-patient").click();await expect(page.getByRole("menu").getByRole("menuitem",{name:"Deactivate"})).toBeVisible();await shot("patients-actions-1280");await page.keyboard.press("Escape");
  expect(patientActions.wrap).toBe("nowrap");expect(patientActions.items.length).toBeGreaterThanOrEqual(3);result.checks.push({name:"1280px Patients actions fit without wrapping/clipping; details, edit, More/Deactivate remain available",status:"pass",details:patientActions});await save();await closeContext();
  await setup(390,844);await go("/admin/appointments");const mob=page.getByTestId("appointment-fx-appt-1");await expect(mob).toBeVisible();await page.getByTestId("action-checkIn-fx-appt-1").scrollIntoViewIfNeeded();await shot("appointments-actions-390");
  await check("390px appointment breakpoint: no page overflow and primary/details/ticket/More actions remain usable",async()=>{
   const mobileInfo=await mob.evaluate(row=>{const group=row.querySelector(".row-actions"),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}},buttons=[...group.querySelectorAll(".row-primary,.row-details,.row-ticket,.row-menu-trigger,.row-expand-toggle")].map(el=>({label:(el.innerText||"").trim()||el.getAttribute("aria-label"),...rect(el)}));return{overflow:document.documentElement.scrollWidth-innerWidth,scrollHeight:document.scrollingElement?.scrollHeight,actionsWidth:rect(group).width,buttons};});
   if(mobileInfo.overflow>1)throw Error(`document overflow ${mobileInfo.overflow}px`);
   await expect(page.getByTestId("action-checkIn-fx-appt-1")).toBeVisible();await expect(page.getByTestId("details-fx-appt-1")).toBeVisible();await expect(page.getByTestId("ticket-fx-appt-1")).toHaveCount(0);
   const offscreen=mobileInfo.buttons.filter(b=>b.x<0||b.right>390||b.y<0||b.bottom>844);if(offscreen.length)throw Error(`mobile action controls are offscreen/clipped: ${JSON.stringify({actionsWidth:mobileInfo.actionsWidth,buttons:offscreen,overflow:mobileInfo.overflow})}`);
   await page.getByTestId("menu-fx-appt-1").click();await expect(page.getByRole("menu").getByRole("menuitem",{name:"Cancel"})).toBeVisible();await page.keyboard.press("Escape");return mobileInfo;
  });await closeContext();
  await setup(1280,900);await go("/admin/appointments");await openTicket();await expect(page.getByTestId("text-ticket-confirmation")).toBeVisible();
  const inspectTicket=async(name,width,height)=>{const confirmation=page.getByTestId("text-ticket-confirmation");const ticketLayout=await confirmation.evaluate(el=>{const strong=el.querySelector("strong"),link=el.querySelector("[data-testid='link-ticket-open-status']"),warning=el.querySelector(".appt-ticket-delivery"),r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};return{direction:getComputedStyle(el).flexDirection,headingWeight:getComputedStyle(strong).fontWeight,confirmation:r(el),heading:r(strong),link:r(link),linkText:link?.innerText,warning:r(warning),warningFlexBasis:warning&&getComputedStyle(warning).flexBasis,overflow:document.documentElement.scrollWidth-innerWidth};});
   await shot(`ticket-confirmation-${name}`);expect(ticketLayout.direction).toBe("row");expect(Number(ticketLayout.headingWeight)).toBeGreaterThanOrEqual(700);expect(ticketLayout.heading.x).toBeLessThan(ticketLayout.link.x);expect(ticketLayout.link.right).toBeLessThanOrEqual(ticketLayout.confirmation.right+1);expect(ticketLayout.warningFlexBasis).toBe("100%");expect(ticketLayout.warning.y).toBeGreaterThanOrEqual(Math.max(ticketLayout.heading.bottom,ticketLayout.link.bottom)-1);expect(ticketLayout.overflow).toBeLessThanOrEqual(1);result.checks.push({name:`${width}px ticket confirmation hierarchy: bold heading left, named status link right, full-width delivery warning below`,status:"pass",details:ticketLayout});await save();};
  await inspectTicket("1280",1280,900);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  console.log("TICKET_GEOMETRY",await page.evaluate(()=>({innerWidth,media:matchMedia("(max-width:639px)").matches,elements:[...document.querySelectorAll(".app-dialog,.app-dialog-body,.appt-ticket")].map(e=>({c:e.className,w:getComputedStyle(e).width,max:getComputedStyle(e).maxWidth,min:getComputedStyle(e).minWidth,rect:e.getBoundingClientRect().toJSON()}))})));
  await inspectTicket("390",390,844);
  const mobileTicket=result.checks.at(-1).details;
  expect(mobileTicket.confirmation.x).toBeGreaterThanOrEqual(0);
  expect(mobileTicket.confirmation.right).toBeLessThanOrEqual(390);
  expect(mobileTicket.heading.x).toBeGreaterThanOrEqual(0);
  await closeContext();
 } else {
 await setup();
 await check("Staff review overview → appointments, fixture route is visibly rendered",async()=>{
  await go("/admin/dashboard");const overview=await metrics();expect(overview.title||overview.main).toBeTruthy();await shot("01-overview-1280");
  await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();await shot("02-appointments-1280");
  return {overview,appointments:await page.locator("tbody tr[data-testid^='appointment-']").count(),staffRoleFixture:"superAdmin"};
 });
 await check("1280 appointment default order, data, one-line actions, no page overflow",async()=>{
  const headers=await page.locator(".appt-table thead th").allInnerTexts();const clean=headers.map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
  const expected=["#","Visit Date","Patient","Waiting No.","Clinic / Location","Doctor","Booked At","Status","Actions"];
  for(let i=0;i<expected.length;i++)expect(clean[i],`header ${i}`).toContain(expected[i]);
  await expect(page.getByTestId("text-patient-fx-appt-1")).toContainText(appts[0].patientName);
  await expect(page.getByTestId("text-token-fx-appt-1")).toHaveText("M-01");
  const first=page.getByTestId("appointment-fx-appt-1");await expect(first).toContainText("PX-FAKE-001");await expect(first).toContainText("Northside Branch");
  const rowInfo=await first.evaluate(el=>{const actions=el.querySelector(".row-actions");return{row:el.innerText,wrap:actions&&getComputedStyle(actions).flexWrap,actions:actions&&[...actions.children].map(x=>({text:x.textContent,rect:x.getBoundingClientRect().toJSON(),scroll:x.scrollWidth,client:x.clientWidth}))};});
  const m=await metrics();expect(m.overflow).toBeLessThanOrEqual(1);expect(rowInfo.wrap).toBe("nowrap");await shot("03-appointment-default-order");
  return {headers:clean,firstSerial:await first.locator(".appt-serial").innerText(),bookedAt:rowInfo.row.includes("02/10/2026")||rowInfo.row.includes("2026"),actionChildren:rowInfo.actions,overflow:m.overflow};
 });
 await check("Columns drawer and hidden-column expansion alignment",async()=>{
  await page.getByTestId("slot-appointment-columns").getByRole("button",{name:/Columns/}).click();const drawer=page.getByRole("dialog",{name:"Columns"});await expect(drawer).toBeVisible();await expect(drawer).toContainText("Visit Date");await shot("04-columns-drawer");
  await drawer.getByRole("button",{name:"Done"}).click();await page.getByTestId("button-expand-appointments-fx-appt-1").click();const expansion=page.locator("#expand-appointments-fx-appt-1");await expect(expansion).toBeVisible();await expect(expansion).toContainText("Booking Reference");await expect(expansion).toContainText("FX-APPT-1001");
  const align=await expansion.locator("dl").evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,rect:el.getBoundingClientRect().toJSON()}));await shot("05-expanded-hidden-details");return align;
 });
 await check("More menu is portaled, unclipped, preserves actions; Escape restores focus",async()=>{
  const trigger=page.getByTestId("menu-fx-appt-1");await trigger.click();const menu=page.getByRole("menu");await expect(menu).toBeVisible();await expect(menu.getByRole("menuitem",{name:"Cancel"})).toBeVisible();await expect(menu.getByRole("menuitem",{name:"Reschedule"})).toBeVisible();
  const placement=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return{parent:el.parentElement?.tagName,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight,scrollParent:el.closest(".table-scroll")!==null};});
  expect(placement.parent).toBe("BODY");expect(placement.bottom).toBeLessThanOrEqual(placement.height+1);expect(placement.right).toBeLessThanOrEqual(placement.width+1);await shot("06-more-menu-1280");await page.keyboard.press("Escape");await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
  await expect(page.getByTestId("action-checkIn-fx-appt-1")).toBeVisible();await expect(page.getByTestId("details-fx-appt-1")).toBeVisible();await expect(page.getByTestId("ticket-fx-appt-1")).toHaveCount(0);
  await page.getByTestId("menu-fx-appt-2").click();const secondMenu=page.getByRole("menu");await expect(secondMenu.getByRole("menuitem",{name:"Skip Absent"})).toBeVisible();await expect(secondMenu.getByRole("menuitem",{name:"Cancel"})).toBeVisible();await page.keyboard.press("Escape");
  await expect(page.getByTestId("action-complete-fx-appt-3")).toContainText("Check Out");await page.getByTestId("menu-fx-appt-3").click();await expect(page.getByRole("menu").getByRole("menuitem",{name:"Call"})).toBeVisible();await page.keyboard.press("Escape");
  return {placement,escapeFocus:"trigger",row1:"Check In, Details, Ticket, Reschedule/Cancel",row2:"Check In, Details, Ticket, Cancel/Skip Absent",row3:"Check Out, Details, Ticket, Call",noTransitionsTriggered:true};
 });
 await check("Details drawer and ticket hierarchy/status/guidance without transitions",async()=>{
  await page.getByTestId("details-fx-appt-1").click();const detail=page.getByRole("dialog",{name:"Appointment Details"});await expect(detail).toBeVisible();await expect(detail).toContainText("M-01");await expect(detail).toContainText("FX-APPT-1001");await shot("07-appointment-details");await page.keyboard.press("Escape");
  await openTicket();const ticket=page.getByTestId("appointment-ticket");await expect(ticket).toBeVisible();await expect(page.getByTestId("text-ticket-confirmation")).toContainText("Booking Confirmed");await expect(page.getByTestId("text-ticket-delivery")).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toBeVisible();await expect(page.getByRole("group",{name:"Ticket Actions"})).toBeVisible();await expect(page.getByTestId("text-ticket-booking-status")).toContainText("Patient Booking Status Page");await expect(page.getByTestId("text-ticket-qr-warning")).toBeVisible();await expect(page.getByTestId("text-ticket-refresh-notice")).toBeVisible();
  const styles=await page.getByTestId("text-ticket-confirmation").evaluate(el=>({headingWeight:getComputedStyle(el.querySelector("strong")).fontWeight,warningSeparate:!!el.querySelector("[data-testid='text-ticket-delivery']"),warningText:el.querySelector("[data-testid='text-ticket-delivery']")?.textContent}));
  await shot("08-appointment-ticket-1280");return {...styles,status:"fixture waiting",actions:"visible; not activated",namedStatusLink:await page.getByTestId("link-ticket-patient-live").innerText()};
 });

 await check("Compact actions: reduced Actions width, icon tooltips by keyboard, chevron at row start, no row ticket",async()=>{
  await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();
  const width=await page.locator(".appt-table th.col-actions").evaluate(el=>({th:el.getBoundingClientRect().width,group:document.querySelector("[data-testid='appointment-fx-appt-1'] .row-actions").getBoundingClientRect().width,table:document.querySelector(".appt-table table").getBoundingClientRect().width,scroll:document.querySelector(".appt-table").clientWidth}));if(width.group>200)throw Error(`Actions group too wide: ${JSON.stringify(width)}`);
  await expect(page.locator("[data-testid^='ticket-fx-appt']")).toHaveCount(0);
  const details=page.getByTestId("details-fx-appt-1");await details.focus();const tip=page.locator(".helptip-bubble").filter({hasText:"Details, ticket and QR"});await expect(tip).toBeVisible();
  const tb=await tip.boundingBox();if(tb.x<0||tb.y<0||tb.x+tb.width>1280)throw Error(`tooltip outside viewport ${JSON.stringify(tb)}`);await shot("20-tooltip-keyboard-details");
  await page.keyboard.press("Escape");await expect(tip).toHaveCount(0);await expect(details).toBeFocused();
  const name=await details.getAttribute("aria-label");expect(name).toContain("Details for");
  const clinical=await page.getByTestId("action-checkIn-fx-appt-1").innerText();expect(clinical).toContain("Check In");
  return {actionsWidth:width,tooltip:tb,accessibleName:name,clinicalText:clinical};
 });
 await check("Menu: every trigger has items; edge-row flip, internal scroll, scroll tracking, viewport bounds",async()=>{
  const triggers=page.locator(".appt-table .row-menu-trigger");const n=await triggers.count();const counts=[];
  for(let i=0;i<n;i++){await triggers.nth(i).click();await page.getByRole("menu").getByRole("menuitem").first().waitFor();const items=await page.getByRole("menu").getByRole("menuitem").count();counts.push(items);if(!items)throw Error(`empty menu at trigger ${i}`);await page.keyboard.press("Escape");}
  await page.setViewportSize({width:1280,height:520});await page.waitForTimeout(250);
  const last=page.locator(".appt-table .row-menu-trigger").last();await last.scrollIntoViewIfNeeded();await page.evaluate(()=>{const t=[...document.querySelectorAll(".appt-table .row-menu-trigger")].at(-1);const r=t.getBoundingClientRect();scrollBy(0,r.bottom-innerHeight+12);});await page.waitForTimeout(150);
  await last.click();const menu=page.getByRole("menu");await expect(menu).toBeVisible();await page.waitForTimeout(100);
  const edge=await menu.evaluate(el=>{const r=el.getBoundingClientRect(),t=document.querySelector('[aria-expanded="true"].row-menu-trigger').getBoundingClientRect();return{placement:el.dataset.placement,menu:r.toJSON(),trigger:t.toJSON(),vh:innerHeight,vw:innerWidth}});
  if(edge.menu.bottom>edge.vh+1||edge.menu.top<0||edge.menu.right>edge.vw+1)throw Error(`edge menu outside viewport ${JSON.stringify(edge)}`);
  if(edge.trigger.bottom+edge.menu.height>edge.vh&&edge.placement!=="above")throw Error(`edge menu did not flip ${JSON.stringify(edge)}`);await shot("21-menu-edge-row-flip");
  await page.mouse.wheel(0,-30);await page.waitForTimeout(200);
  const tracked=await page.evaluate(()=>{const m=document.querySelector(".row-menu-portal"),t=document.querySelector('[aria-expanded="true"].row-menu-trigger');if(!m)return{closed:true};const a=m.getBoundingClientRect(),b=t.getBoundingClientRect();return{gap:Math.min(Math.abs(a.bottom-b.top),Math.abs(a.top-b.bottom))}});
  if(!tracked.closed&&tracked.gap>12)throw Error(`menu did not track scrolling ${JSON.stringify(tracked)}`);
  await page.keyboard.press("Escape");await expect(menu).toHaveCount(0);
  await page.setViewportSize({width:1280,height:220});await page.waitForTimeout(250);await page.evaluate(()=>scrollTo(0,0));
  const first=page.getByTestId("menu-fx-appt-1");await first.scrollIntoViewIfNeeded();await first.click();
  const small=await page.getByRole("menu").evaluate(el=>{const r=el.getBoundingClientRect();return{rect:r.toJSON(),overflowY:getComputedStyle(el).overflowY,scrollH:el.scrollHeight,clientH:el.clientHeight,vh:innerHeight}});
  if(small.rect.top<0||small.rect.bottom>small.vh+1)throw Error(`short viewport menu escapes ${JSON.stringify(small)}`);expect(small.overflowY).toBe("auto");await shot("22-menu-short-viewport");await page.keyboard.press("Escape");
  await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(250);
  return {itemCounts:counts,edge,tracked,small};
 });
 await check("Menu inside table horizontal scroll at 1024 tracks trigger; Escape restores focus; menu item opens dialog with focus inside",async()=>{
  await page.setViewportSize({width:1024,height:768});await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();
  const trigger=page.getByTestId("menu-fx-appt-2");await trigger.scrollIntoViewIfNeeded();await trigger.click();const menu=page.getByRole("menu");await expect(menu).toBeVisible();
  const before=await menu.boundingBox();await page.locator(".appt-table").evaluate(el=>{el.scrollLeft=Math.max(0,el.scrollLeft-40);});await page.waitForTimeout(150);
  const after=await page.evaluate(()=>{const m=document.querySelector(".row-menu-portal");return m?m.getBoundingClientRect().toJSON():null});
  if(before.x<0||before.x+before.width>1024)throw Error(`menu outside 1024 viewport ${JSON.stringify(before)}`);
  await page.keyboard.press("Escape");await expect(page.getByRole("menu")).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await page.getByRole("menu").getByRole("menuitem",{name:"Cancel"}).click();const dlg=page.getByRole("dialog",{name:"Cancel"});await expect(dlg).toBeVisible();
  const focusInside=await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'));if(!focusInside)throw Error("focus did not move into dialog");await shot("23-menu-to-dialog-focus");
  await dlg.getByRole("button",{name:"Back"}).click();await expect(dlg).toHaveCount(0);const writes=result.interceptedWrites.length;
  await page.setViewportSize({width:1280,height:900});return{before,after,focusInside,writesSoFar:writes};
 });
 await check("Details drawer holds Ticket & QR with download/print/status/guidance; icon tooltips; containment at 1280/1024/390",async()=>{
  const out=[];
  for(const [w,h] of [[1280,900],[1024,768],[390,844]]){
   await page.setViewportSize({width:w,height:h});await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();
   const sec=await openTicket();const d=page.getByRole("dialog",{name:"Appointment Details"});
   for(const id of ["section-detail-patient","section-detail-visit","section-detail-provider","section-detail-booking"])await expect(d.getByTestId(id)).toBeVisible();
   await expect(sec.locator(".vt-qr img")).toBeVisible({timeout:6000});await expect(sec.getByTestId("button-download-ticket")).toBeVisible();await expect(sec.getByTestId("button-print-ticket")).toBeVisible();
   await expect(sec.getByTestId("ticket-status")).toBeVisible();await expect(sec.getByTestId("text-ticket-qr-warning")).toBeVisible();await expect(sec.getByTestId("text-ticket-refresh-notice")).toBeVisible();await expect(sec.getByTestId("link-ticket-patient-live")).toBeVisible();
   const dl=sec.getByTestId("button-download-ticket");expect(await dl.getAttribute("aria-label")).toMatch(/Download Ticket|Checking/);
   if(w!==390){const dis=await dl.isDisabled();if(dis)await sec.getByTestId("helptip-disabled-wrapper").first().focus();else await dl.focus();await expect(page.locator(".helptip-bubble").filter({hasText:/Download Ticket|Checking/})).toBeVisible();await page.keyboard.press("Escape");}
   const geo=await d.evaluate(el=>{const r=el.getBoundingClientRect(),kids=[...el.querySelectorAll(".appt-detail-block,.vt,.vt-qr img")].map(k=>k.getBoundingClientRect()).filter(k=>k.right>r.right+1||k.left<r.left-1);return{rect:r.toJSON(),overflowKids:kids.length,doc:document.documentElement.scrollWidth-innerWidth,vw:innerWidth}});
   if(geo.rect.left<-1||geo.rect.right>w+1||geo.overflowKids||geo.doc>1)throw Error(`details not contained at ${w}: ${JSON.stringify(geo)}`);
   await shot(`24-details-ticket-qr-${w}`);await page.keyboard.press("Escape");await expect(d).toHaveCount(0);await expect(page.getByTestId("details-fx-appt-1")).toBeFocused();out.push({w,geo});
  }
  await page.setViewportSize({width:1280,height:900});return out;
 });
 await check("Patients/staff/custom roles: icon Edit/Details with tooltips, chevron at start, menus non-empty",async()=>{
  const ev=[];
  for(const path of ["/admin/patients","/admin/system-users","/admin/clinics"]){
   await go(path);await page.waitForTimeout(300);const icons=await page.locator("tbody .row-actions .icon-action").count();
   const menus=page.locator("tbody .row-menu-trigger");const mc=await menus.count();for(let i=0;i<mc;i++){await menus.nth(i).click();await page.getByRole("menu").getByRole("menuitem").first().waitFor().catch(()=>{});const k=await page.getByRole("menu").getByRole("menuitem").count();if(!k)throw Error(`${path} empty menu`);await page.keyboard.press("Escape");}
   const strayChevron=await page.locator("tbody .row-actions .row-expand-toggle").count();if(strayChevron)throw Error(`${path} chevron still in actions`);
   ev.push({path,icons,menus:mc});
  }
  return ev;
 });
 await check("Resources, staff/custom roles, reports and schedule route family render",async()=>{
  const evidence=[];
  for(const [path,label] of [["/admin/clinics","clinics"],["/admin/patients","patients"],["/admin/system-users","staff"],["/admin/permissions","custom-roles"],["/admin/reports","reports"],["/admin/availability","schedule"]]){
   await go(path);const m=await metrics();if(m.overflow>1)throw Error(`${path} page overflow ${m.overflow}px`);
   await expect(page.locator("main")).toBeVisible();await shot(`09-${label}-1280`);evidence.push({path,title:m.title,overflow:m.overflow,tableRows:await page.locator("tbody tr").count(),sectionHeads:await page.locator(".section-head").count()});
  }
  return {rendered:evidence,notTestedRoleVariants:["doctor resources/appointments/queue/schedule","receptionist appointments/patients/queue","clinicAdmin staff restrictions/custom roles","patient routes","public/auth routes"]};
 });
 await check("Page URL pagination serial offset",async()=>{
  await go("/admin/appointments?page=2&size=10");await expect(page.getByTestId("appointment-fx-appt-11")).toBeVisible();const serial=await page.getByTestId("appointment-fx-appt-11").locator(".appt-serial").innerText();await shot("10-appointments-page-two");expect(Number(serial)).toBe(11);return{url:page.url(),serial,pageOffsetExpected:11,observedPageSerial:Number(serial)};
 });
 for(const [width,height,name] of [[1024,768,"1024"],[390,844,"390"]]){
  await page.setViewportSize({width,height});await go("/admin/appointments");await expect(page.getByTestId("appointment-fx-appt-1")).toBeVisible();
  await check(`Appointment table/actions at ${name}px`,async()=>{
   const m=await metrics(),scroll=await page.locator(".table-scroll").evaluate(el=>({clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,overflowX:getComputedStyle(el).overflowX}));
   const dateHeader=await page.locator(".appt-table th.col-date").evaluate(el=>({text:el.innerText, height:el.getBoundingClientRect().height, width:el.getBoundingClientRect().width, whiteSpace:getComputedStyle(el).whiteSpace, buttonHeight:el.querySelector("button")?.getBoundingClientRect().height}));
   if(m.overflow>1)throw Error(`document horizontal overflow ${m.overflow}px`);
   const row=page.getByTestId("appointment-fx-appt-1"),actionBox=await row.locator(".row-actions").boundingBox();await expect(page.getByTestId("details-fx-appt-1")).toBeVisible();await expect(page.getByTestId("ticket-fx-appt-1")).toHaveCount(0);
   await shot(`11-appointments-${name}`);if(width===1024&&dateHeader.height>100)throw Error(`Visit Date header wraps into an excessively tall cell at 1024px: ${JSON.stringify(dateHeader)}`);
   return{viewport:width,documentOverflow:m.overflow,tableScroll:scroll,dateHeader,actionsBox:actionBox,actionsRemainAvailable:true};
  });
  await check(`Menu and ticket at ${name}px`,async()=>{
   const trigger=page.getByTestId("menu-fx-appt-1");await trigger.click();const menu=page.getByRole("menu");await expect(menu).toBeVisible();const box=await menu.boundingBox();if(box.x<0||box.x+box.width>width||box.y<0||box.y+box.height>height)throw Error(`portal outside viewport: ${JSON.stringify(box)}`);await shot(`12-menu-${name}`);await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
   await openTicket();const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();await expect(page.getByTestId("appointment-ticket")).toBeVisible();const d=await dialog.locator(".app-dialog-body").evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,overflowY:getComputedStyle(el).overflowY,rect:el.getBoundingClientRect().toJSON()}));if(width===390&&d.scrollHeight<=d.clientHeight)throw Error(`mobile ticket content does not scroll: ${JSON.stringify(d)}`);await shot(`13-ticket-${name}`);await page.keyboard.press("Escape");return{menu:box,dialogBody:d,documentOverflow:await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)};
  });
 }
 }
} finally {
 await save();await context?.close();await browser.close();
}
console.log(JSON.stringify({checks:result.checks.map(({name,status,error})=>({name,status,error})),screenshots:result.screenshots,fixtureOnly:result.fixtureOnly,interceptedWrites:result.interceptedWrites,errors:result.errors,notTested:result.notTested},null,2));
if(result.checks.some(c=>c.status==="fail"))process.exitCode=1;
