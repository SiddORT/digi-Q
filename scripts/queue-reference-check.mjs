// Browser-only, intercepted fictional records. Never submits writes or contacts a live queue.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const output="screenshots/queue-reference";
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const results=[];
const operationalDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const items=[
 {id:"fiction-1",reference:"FX-001",patientName:"Alex Fiction",patientId:"patient-1",token:1,tokenNumber:"FX-01",queueRank:1,status:"inConsultation",doctorId:"doctor-1",branchId:"branch-1",clinicId:"clinic-1",date:operationalDate,startTime:"00:00",sessionId:"session-1",allowedActions:[]},
 {id:"fiction-2",reference:"FX-002",patientName:"Morgan Fiction",patientId:"patient-2",token:2,tokenNumber:"FX-02",queueRank:2,status:"waiting",doctorId:"doctor-1",branchId:"branch-1",clinicId:"clinic-1",date:operationalDate,startTime:"00:00",sessionId:"session-1",allowedActions:[]},
 {id:"fiction-3",reference:"FX-003",patientName:"Jamie Fiction",patientId:"patient-3",token:3,tokenNumber:"FX-03",queueRank:3,status:"completed",doctorId:"doctor-1",branchId:"branch-1",clinicId:"clinic-1",date:operationalDate,startTime:"00:00",sessionId:"session-1",allowedActions:[]}
];
const clinic={id:"clinic-1",name:"Fictional Reference Clinic",timezone:"Asia/Kolkata",status:"active"};
const branch={id:"branch-1",clinicId:clinic.id,clinicName:clinic.name,name:"Fictional North Branch",timezone:"Asia/Kolkata",status:"active"};
const doctor={id:"doctor-1",fullName:"Dr. Example",clinicIds:[clinic.id],branchIds:[branch.id],status:"active"};
const list=data=>({items:data,total:data.length,page:1,pageSize:20});
const contexts=[{sessionId:"session-1",doctorId:doctor.id,branchId:branch.id,clinicId:clinic.id,date:operationalDate,startTime:"00:00",endTime:"23:59",timezone:"Asia/Kolkata",snapshotOnly:false},{sessionId:"session-2",doctorId:doctor.id,branchId:branch.id,clinicId:clinic.id,date:operationalDate,startTime:"12:00",endTime:"13:00",timezone:"Asia/Kolkata",snapshotOnly:true}];
try {
 for(const role of ["clinicAdmin","superAdmin","receptionist","doctor","patient"]) {
  const context=await browser.newContext({viewport:{width:1024,height:683},timezoneId:"Asia/Kolkata"});
   const page=await context.newPage();const errors=[];const writes=[];
   let historicalLink=false,lateBranchLoaded=false;const requestedDates=[];
  page.on("pageerror",error=>errors.push(error.message));
  await context.route("**/api/**",async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname.replace(/^\/api/,"");
   const json=(data,status=200)=>route.fulfill({json:data,status});
   if(request.method()!=="GET"){writes.push(`${request.method()} ${path}`);return json({error:"Fixture writes disabled"},403);}
   if(path==="/auth/status")return json({authenticated:true,role,staffPasswordVerified:true,requiresStaffPassword:false});
   if(path==="/auth/csrf")return json({csrfToken:"fixture-only"});
   if(path==="/me")return json({user:{id:`fx-${role}`,fullName:"Fixture Staff",email:"staff@example.invalid",role,status:"active",clinicIds:[clinic.id],branchIds:[branch.id]},doctorId:role==="doctor"?doctor.id:undefined,patientId:role==="patient"?"patient-1":undefined,needsOnboarding:false});
   if(path==="/settings")return json({timezone:"Asia/Kolkata",dateFormat:"DD/MM/YYYY",timeFormat:"12h"});
   if(path==="/clinics")return json(list([clinic]));
   if(path==="/branches")return json(list([branch]));
    if(path==="/branches/branch-1"||path==="/public/branches"){
     if(historicalLink)await new Promise(resolve=>setTimeout(resolve,600));
     const response=await json(path.startsWith("/public/")?list([branch]):branch);
     if(historicalLink)lateBranchLoaded=true;
     return response;
    }
    if(path.startsWith("/appointments/fiction-"))return json({...items.find(item=>path.endsWith(item.id)),...(historicalLink?{date:"2025-01-17"}:{})});
   if(path==="/doctors")return json(list([doctor]));
   if(path==="/session-contexts")return json(contexts);
   if(path==="/queue") {
     if(historicalLink)requestedDates.push(url.searchParams.get("date"));
    const group=url.searchParams.get("statusGroup"),status=url.searchParams.get("status"),search=url.searchParams.get("search")?.toLowerCase();
    let entries=items.filter(row=>!search||`${row.patientName} ${row.reference} ${row.tokenNumber}`.toLowerCase().includes(search));
    const counts={all:entries.length,active:entries.filter(row=>["waiting","inConsultation"].includes(row.status)).length,waiting:entries.filter(row=>row.status==="waiting").length,completed:entries.filter(row=>row.status==="completed").length,absent:0,cancelled:0};
    if(status)entries=entries.filter(row=>row.status===status);
    else if(group&&group!=="all")entries=entries.filter(row=>group==="active"?["waiting","inConsultation"].includes(row.status):row.status===group);
    return json({doctorId:doctor.id,branchId:branch.id,date:operationalDate,timezone:"Asia/Kolkata",updatedAt:new Date().toISOString(),pollIntervalSeconds:30,sessionId:url.searchParams.get("sessionId"),startTime:url.searchParams.get("startTime"),queueVersion:"fixture-v1",currentToken:"FX-01",nextToken:"FX-02",inConsultation:1,waiting:1,completed:1,total:items.length,presence:{status:"available"},expectedDurationMinutes:20,entries,entriesTotal:entries.length,statusCounts:counts});
   }
   if(path==="/guest-requests")return json(list([]));
   if(path.includes("duration"))return json({minutes:20});
   if(path==="/appointments")return json(list(role==="patient"?[items[0]]:items));
   return json(list([]));
  });
  for(const width of role==="clinicAdmin"?[1024,1440,768,390]:[1024]) {
   await page.setViewportSize({width,height:width===1024?683:850});
   await page.goto(`${origin}/${role==="clinicAdmin"||role==="superAdmin"?"admin":role}/queue`,{waitUntil:"domcontentloaded"});
   await page.waitForTimeout(1200);
   const metrics=await page.evaluate(()=>{
    const box=selector=>{const element=document.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
    const scroll=document.querySelector(".sq-table .table-scroll"),table=scroll?.querySelector("table");
    return {heading:box(".sq-page-header"),actions:box(".sq-header-actions"),scope:box(".sq-session-scope"),sessions:box(".sq-session-scroll"),metrics:box(".sq-summary"),presence:box(".sq-presence"),filters:box(".sq-list-controls"),table:box(".sq-table"),token:box(".sq-table th.col-token"),status:box(".sq-table th.col-status"),tableScroll:scroll?{client:scroll.clientWidth,scroll:scroll.scrollWidth,table:table?.getBoundingClientRect().width,min:table&&getComputedStyle(table).minWidth,layout:table&&getComputedStyle(table).tableLayout,columns:[...table.querySelectorAll("th")].map(el=>[el.className,Math.round(el.getBoundingClientRect().width)])}:null,overflow:document.documentElement.scrollWidth-innerWidth,body:document.querySelector(".session-queue")?.innerText.slice(0,800)};
   });
   const file=`${output}/${role}-${width}.png`;await page.screenshot({path:file,fullPage:true});
   results.push({role,width,metrics,errors:[...errors],writes:[...writes],file});
   console.log(role,width,JSON.stringify({overflow:metrics.overflow,metrics:metrics.metrics,table:metrics.table,errors}));
   if(metrics.overflow>1||errors.length||writes.length)throw Error(`Queue fixture failed for ${role} at ${width}`);
   if(role==="doctor"&&await page.getByTestId("button-queue-quick-switch").count())throw Error("Doctor can switch to another doctor");
   if(role==="patient"&&await page.getByTestId("button-validate-qr").count())throw Error("Patient received staff actions");
   if(["clinicAdmin","receptionist"].includes(role)&&!await page.getByTestId("button-queue-quick-switch").count())throw Error("Authorized staff lost doctor Quick Switch");
   if(role==="clinicAdmin"&&width===1024){
    if(metrics.actions.y>metrics.heading.y+30||metrics.tableScroll.scroll>metrics.tableScroll.client+1)throw Error("Desktop header or table is not compact");
    const consultation=page.getByRole("button",{name:/^In Consultation/});
    await consultation.click();
    await page.locator('[data-testid="appointment-fiction-1"]').waitFor();
    if(await page.locator('[data-testid="appointment-fiction-2"]').count())throw Error("Exact consultation filter includes waiting");
    await page.getByRole("button",{name:/^All 3/}).click();
    const search=page.getByRole("combobox",{name:"Search This Session"});
    await search.fill("Morgan");
    await page.waitForTimeout(450);
    await page.locator('[data-testid="appointment-fiction-2"]').waitFor();
    if(await page.locator('[data-testid="appointment-fiction-1"]').count())throw Error("Search did not filter the queue");
    await search.fill("");
    await page.waitForTimeout(450);
    await page.getByRole("button",{name:"Sort Queue Listing: Queue position",exact:true}).click();
    await page.getByRole("option",{name:"Token descending",exact:true}).click();
    await page.getByRole("button",{name:"Sort Queue Listing: Token descending",exact:true}).waitFor();
    await page.getByTestId("button-clear-queue-filters").click();
    const date=page.getByTestId("input-queue-date"),savedDate=await date.inputValue();
    await date.fill("invalid");
    await date.blur();
    await page.getByTestId("text-queue-date-invalid").waitFor();
    await date.fill(savedDate);
    await date.blur();
    await page.locator(".sq-summary").waitFor();
    await page.getByRole("button",{name:/Saved appointment session/}).click();
    if(await page.getByRole("link",{name:"Register Walk-In"}).count())throw Error("Historical session permits new booking");
    await page.getByRole("button",{name:/Currently running/}).click();
    if(!await page.getByRole("link",{name:"Register Walk-In"}).count())throw Error("Current session lost booking entry point");
    await context.setOffline(true);
    await page.waitForTimeout(100);
    if(!await page.getByRole("button",{name:"On Break",exact:true}).isDisabled())throw Error("Offline presence mutation is enabled");
    await context.setOffline(false);
   }
  }
  if(["clinicAdmin","patient"].includes(role)){
   historicalLink=true;
   await page.goto(`${origin}/${role==="clinicAdmin"?"admin":"patient"}/queue?appointment=fiction-1`);
   await page.waitForTimeout(1800);
   if(!lateBranchLoaded||!requestedDates.includes("2025-01-17")||requestedDates.at(-1)!=="2025-01-17")throw Error(`Late branch timezone overwrote historical appointment date for ${role}: ${requestedDates}`);
   results.push({role,scenario:"historical appointment with delayed branch timezone",date:requestedDates.at(-1),lateBranchLoaded});
  }
  await context.close();
 }
} finally {await writeFile(`${output}/results.json`,JSON.stringify({operationalDate,results},null,2));await browser.close();}
