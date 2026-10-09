import { test, expect, type Page } from "@playwright/test";
// Rendered real components; deterministic HTTP fixtures, NOT real persistence or identity evidence.
async function fixture(page:Page,role="superAdmin",opts:{empty?:boolean;multiple?:boolean;fail?:boolean;timezone?:string;bare?:boolean}={}){
 const today="2026-10-09",next="2026-10-10";
 const clinic={id:"c1",name:"Fictional Booking Clinic",adminId:"clinicAdmin",status:"active",timezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};
 const branch={id:"b1",clinicId:"c1",name:"Fictional Booking Location",timezone:opts.timezone||"UTC",status:"active",openingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,startTime:"08:00",endTime:"20:00"}))};
 const doctor={id:"d1",userId:"doctor",fullName:"Fictional Booking Doctor",clinicIds:["c1"],branchIds:["b1"],status:"active"};
 const session={doctorId:"d1",branchId:"b1",date:today,sessionId:"s1",available:true,remainingTokens:8,maxTokens:8,startTime:"09:00",endTime:"12:00",timezone:branch.timezone,queueMode:"mixed"};
 const state={fail:!!opts.fail,empty:!!opts.empty,multiple:!!opts.multiple,hold:false,noResults:false,writes:[] as any[],reads:[] as string[],branchReads:0,mode:"mixed",full:false,range:"09:00",emailOutcome:"no_recipient",appointment:null as any};
 const list=(items:any[])=>({items,total:items.length,page:1,pageSize:20});
 await page.route("**/api/**",async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,m=req.method();
   let json:any=list([]),status=200;
   if(m!=="GET")state.writes.push({path:p,body:req.postDataJSON()});
   if(p==="/api/auth/status")json={signedIn:true};
   else if(p==="/api/me")json={userId:role,user:{id:role,role,fullName:"Fictional Booker",clinicIds:["c1"],branchIds:["b1"]},doctorId:role==="doctor"?"d1":null,patientId:role==="patient"?"p1":null,needsOnboarding:false};
   else if(p==="/api/auth/csrf")json={csrfToken:"fixture"};
   else if(p==="/api/settings")json={timezone:"UTC",bookingHorizonDays:30,cancellationCutoffMinutes:30,requireMobileVerification:false};
   else if(p==="/api/public/availability/context")json={timezone:branch.timezone,today,lastBookableDate:"2026-10-20"};
   else if(p==="/api/booking/schedule-access")json={allowed:["superAdmin","clinicAdmin","doctor","receptionist"].includes(role)};
   else if(p==="/api/public/availability/sessions"){
     const date=url.searchParams.get("date")!;state.reads.push(date);
     if(state.hold)await new Promise(r=>setTimeout(r,750));
     if(state.fail){status=503;json={error:"Fixture availability lookup failed"};}
     else json=state.noResults?[]:date===next?[{...session,date}]:state.empty?[]:state.multiple?[{...session,startTime:state.range,remainingTokens:state.full?0:8,queueMode:state.mode},{...session,sessionId:"s2",startTime:"14:00",endTime:"17:00",queueMode:state.mode}]:[{...session,startTime:state.range,remainingTokens:state.full?0:8,queueMode:state.mode}];
   }else if(p.endsWith("/clinics/c1"))json=clinic;
   else if(p.endsWith("/branches/b1")){state.branchReads++;json=branch;}
   else if(p.endsWith("/doctors/d1"))json=doctor;
   else if(p.endsWith("/patients/p1"))json={id:"p1",fullName:"Fictional Patient",clinicId:"c1",branchId:"b1",status:"active"};
   else if(p.endsWith("/clinics"))json=list([clinic]);
   else if(p.endsWith("/branches"))json=list([branch]);
   else if(p.endsWith("/doctors"))json=list([doctor]);
   else if(p.endsWith("/patients"))json=list([{id:"p1",fullName:"Fictional Patient"}]);
   else if(p==="/api/staff-assignment-options")json={clinics:[clinic],branches:[branch],doctors:[doctor],pagination:{clinics:{total:1},branches:{total:1},doctors:{total:1}}};
   else if(p==="/api/appointments"&&m==="POST"){
     status=201;state.appointment={id:"unified-appointment",...req.postDataJSON(),patientName:"Fictional Patient",doctorName:doctor.fullName,clinicName:clinic.name,branchName:branch.name,startTime:state.range,endTime:"12:00",timezone:"UTC",token:"D-1",reference:"FICTIONAL-TICKET",status:"waiting",revision:0,confirmationEmail:state.emailOutcome,createdAt:"2026-10-09T07:00:00Z",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};json=state.appointment;
   }
   else if(p==="/api/appointments/unified-appointment/reschedule"){
     state.appointment={...state.appointment,...req.postDataJSON(),startTime:"09:00",endTime:"12:00",token:"D-2",revision:1};json=state.appointment;
   }
   else if(p==="/api/appointments/unified-appointment")json=state.appointment;
   else if(p==="/api/appointments/unified-appointment/qr")json={checkInUrl:"/check-in/FICTIONAL-TICKET"};
   else if(p==="/api/appointments")json=list(state.appointment?[state.appointment]:[]);
   else if(p==="/api/public/guest-requests"){status=201;json={id:"g1",status:"approved",fullName:"Fictional Guest",clinicName:clinic.name,branchName:branch.name,doctorName:doctor.fullName,date:next,startTime:"09:00",endTime:"12:00",timezone:"UTC",token:"D-1",reference:"FICTIONAL-TICKET",checkInUrl:"/check-in/FICTIONAL-TICKET",appointmentStatus:"booked",revision:1,confirmationEmail:state.emailOutcome};}
   await route.fulfill({status,json});
 });
 await page.goto(`/?mode=booking&fixtureRole=${role}${opts.bare?"":"&clinic=c1&branch=b1&doctor=d1"}&date=${today}`);
 await expect(page.getByTestId("booking-discovery")).toBeVisible();
 return state;
}
for(const role of ["superAdmin","clinicAdmin","doctor","receptionist","patient","guest"]){
 test(`${role}: truthful empty date, explicit bounded search and review preserve fixed context`,async({page})=>{
   const state=await fixture(page,role,{empty:true});
   await expect(page.getByTestId("booking-availability-status")).toContainText("Other weekdays or dates may have sessions");
   await expect(page.getByTestId("button-next-booking-date")).toBeEnabled();
   await page.getByTestId("button-next-booking-date").click();
   await expect(page.getByTestId("button-use-next-date")).toContainText("2026-10-10");
   await expect(page.getByTestId(role==="guest"?"input-guest-date":"input-booking-date")).toHaveValue("2026-10-09");
   await page.getByTestId("button-use-next-date").click();
   await expect(page.getByTestId(role==="guest"?"input-guest-date":"input-booking-date")).toHaveValue("2026-10-10");
   await expect(page.getByTestId("booking-availability-status")).toContainText("8 places remaining");
   await expect(page.getByTestId(role==="guest"?"button-guest-continue-visit":"button-booking-continue-visit")).toBeEnabled();
   assertNoWrite(state.writes);
   if(["patient","guest"].includes(role))await expect(page.getByTestId("button-booking-manage-schedule")).toHaveCount(0);
 });
}
function assertNoWrite(writes:any[]){expect(writes.filter(w=>["/api/appointments","/api/public/guest-requests"].includes(w.path))).toHaveLength(0);}
test("failed lookup is not empty schedule; refresh recovers without navigation",async({page})=>{
 const s=await fixture(page,"patient",{fail:true});
 await expect(page.getByTestId("booking-availability-status")).toContainText("Could not check");
 await expect(page.getByTestId("button-booking-continue-visit")).toBeDisabled();
 s.fail=false;
 await page.getByTestId("button-refresh-booking-availability").click();
 await expect(page.getByTestId("booking-availability-status")).toContainText("8 places remaining");
});
test("multiple sessions require selection; walk-ins remain today-only and have no future action",async({page})=>{
 await fixture(page,"receptionist",{multiple:true});
 await expect(page.getByTestId("booking-availability-status")).toContainText("Select a consulting session");
 await page.getByRole("button",{name:/^Session/}).click();
 await page.getByRole("option").filter({hasText:"09:00–12:00"}).click();
 await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
 await page.getByTestId("radio-booking-source-walkIn").check();
 await expect(page.getByTestId("input-booking-date")).toBeDisabled();
 await expect(page.getByTestId("button-next-booking-date")).toHaveCount(0);
 await expect(page.getByTestId("booking-discovery")).toContainText("Walk-ins are today-only");
});
test("changing date cancels a pending search without overwriting the deliberate date",async({page})=>{
 const s=await fixture(page,"patient",{empty:true});
 s.hold=true;
 await page.getByTestId("button-next-booking-date").click();
 await page.getByTestId("input-booking-date").fill("2026-10-12");
 await page.getByTestId("input-booking-date").blur();
 await page.waitForTimeout(900);
 await expect(page.getByTestId("input-booking-date")).toHaveValue("2026-10-12");
 await expect(page.getByTestId("button-use-next-date")).toHaveCount(0);
});
test("guest optional contact flow confirms only at review and immediately displays ticket",async({page})=>{
 const s=await fixture(page,"guest");
 await page.getByTestId("button-guest-continue-visit").click();
 await page.getByTestId("input-guest-name").fill("Fictional Guest");
 await page.getByTestId("input-guest-permission").check();
 await page.getByTestId("button-guest-continue-patient").click();
 assertNoWrite(s.writes);
 await page.getByTestId("button-submit-guest").click();
 await expect(page.getByTestId("guest-ticket")).toBeVisible();
 expect(s.writes.filter(w=>w.path==="/api/public/guest-requests")).toHaveLength(1);
});
test("no search result states only the searched range and respects the booking horizon",async({page})=>{
 const s=await fixture(page,"patient",{empty:true});s.noResults=true;
 await page.getByTestId("button-next-booking-date").click();
 await expect(page.getByTestId("booking-discovery")).toContainText("This does not rule out later sessions");
 expect(s.reads.filter(d=>d>"2026-10-20")).toHaveLength(0);
 await expect(page.getByTestId("input-booking-date")).toHaveValue("2026-10-09");
});
test("contextual schedule reopen waits for verified locations rather than showing a false empty scope",async({page})=>{
 const s=await fixture(page,"superAdmin");
 for(let i=0;i<2;i++){
   const before=s.branchReads;
   await page.getByTestId("button-booking-manage-schedule").click();
   const dialog=page.getByRole("dialog",{name:"Manage Doctor Schedule"});
   await expect(dialog.getByTestId("text-fixed-location")).toContainText("Fictional Booking Location");
   await expect(dialog.getByTestId("indicator-timezone")).toContainText("UTC");
   await expect(dialog).not.toContainText("No active, authorised locations");
   expect(s.branchReads).toBeGreaterThan(before);
   await dialog.getByTestId("button-dialog-close").click();
   await expect(dialog).toHaveCount(0);
 }
});

async function selectPatient(page:Page){
 await page.getByRole("button",{name:/^Patient(?:\s|:|$)/}).click();
 await page.getByRole("option",{name:"Fictional Patient",exact:true}).click();
}
for(const role of ["superAdmin","clinicAdmin","doctor","receptionist","patient"]){
 test(`${role}: shared sole context, stored patient, explicit confirmation and issued ticket`,async({page})=>{
   const s=await fixture(page,role,{bare:true});
   await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
   assertNoWrite(s.writes);
   await page.getByTestId("button-booking-continue-visit").click();
   if(role!=="patient")await selectPatient(page);
   await expect(page.getByPlaceholder("Add information for the clinic about this visit (optional)")).toBeVisible();
   await page.getByPlaceholder("Add information for the clinic about this visit (optional)").fill("Fictional visit note");
   await page.getByTestId("button-booking-continue-patient").click();
   await expect(page.getByTestId("booking-summary")).toContainText("Fictional Patient");
   await expect(page.getByTestId("booking-summary")).toContainText("09:00–12:00");
   await page.getByTestId("button-booking-back").filter({visible:true}).click();
   await expect(page.getByPlaceholder("Add information for the clinic about this visit (optional)")).toHaveValue("Fictional visit note");
   await page.getByTestId("button-booking-continue-patient").click();
   assertNoWrite(s.writes);
   await page.getByRole("checkbox",{name:/I consent/}).check();
   await page.getByTestId("button-confirm-booking").click();
   await expect(page.getByTestId("appointment-ticket")).toContainText("FICTIONAL-TICKET");
   await expect(page.getByTestId("text-ticket-delivery")).toContainText("No email recipient");
   expect(s.writes.filter(w=>w.path==="/api/appointments")).toHaveLength(1);
   expect(s.writes.find(w=>w.path==="/api/appointments").body).toMatchObject({clinicId:"c1",branchId:"b1",doctorId:"d1",patientId:"p1",sessionId:"s1",notes:"Fictional visit note"});
   expect(s.writes.filter(w=>w.path==="/api/patients")).toHaveLength(0);
 });
}
test("stale explicit session is rejected and full sessions stay visible but unselectable",async({page})=>{
 const s=await fixture(page,"patient",{multiple:true});
 await page.getByRole("button",{name:/^Session/}).click();
 await page.getByRole("option").filter({hasText:"09:00–12:00"}).click();
 await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
 s.full=true;
 await page.getByTestId("button-refresh-booking-availability").click();
 await expect(page.getByTestId("button-booking-continue-visit")).toBeDisabled();
 await page.getByRole("button",{name:/^Session/}).click();
 await expect(page.getByRole("option").filter({hasText:"09:00–12:00"})).toHaveAttribute("aria-disabled","true");
 await page.getByRole("option").filter({hasText:"14:00–17:00"}).click();
 await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
 assertNoWrite(s.writes);
});
test("guest inline errors are linked; optional contacts remain optional and confirmation is disabled after range changes",async({page})=>{
 const s=await fixture(page,"guest");
 await page.getByTestId("button-guest-continue-visit").click();
 await page.getByTestId("button-guest-continue-patient").click();
 const name=page.getByTestId("input-guest-name");
 await expect(name).toHaveAttribute("aria-invalid","true");
 const errorId=await name.getAttribute("aria-describedby");
 await expect(page.locator(`[id="${errorId}"]`)).toContainText("Enter the patient's name");
 await expect(name).toHaveAttribute("placeholder","Enter the patient's full name");
 await name.fill("Fictional Guest");
 await page.getByTestId("input-guest-permission").check();
 await page.getByTestId("button-guest-continue-patient").click();
 s.range="10:00";
 // Hidden visit controls stay mounted, so refresh without changing the review stage.
 await page.evaluate(()=>document.querySelector<HTMLButtonElement>('[data-testid="button-refresh-booking-availability"]')?.click());
 await expect(page.getByTestId("button-submit-guest")).toBeDisabled();
 await expect(page.getByTestId("stage-confirmation")).toContainText("selected visit changed");
 assertNoWrite(s.writes);
});
test("saved booking reopens and reschedules to the same record without losing reference or notes",async({page})=>{
 const s=await fixture(page,"patient");
 await page.getByTestId("button-booking-continue-visit").click();
 await page.getByTestId("button-booking-continue-patient").click();
 await page.getByRole("checkbox",{name:/I consent/}).check();
 await page.getByTestId("button-confirm-booking").click();
 await expect(page.getByTestId("appointment-ticket")).toBeVisible();
 await page.goto("/?mode=reschedule");
 await expect(page.getByRole("textbox",{name:/Reason/})).toHaveAttribute("placeholder","Explain the change to this visit (optional)");
 await page.getByTestId("input-reschedule-date").fill("2026-10-10");
 await page.getByTestId("input-reschedule-date").blur();
 await page.getByRole("checkbox",{name:/Replace this booking/}).check();
 await expect(page.getByTestId("button-confirm-reschedule")).toBeEnabled();
 await page.getByTestId("button-confirm-reschedule").click();
 await expect(page.getByTestId("text-detail-reference")).toContainText("FICTIONAL-TICKET");
 await page.getByTestId("tab-detail-details").click();
 await expect(page.getByTestId("text-detail-date")).toContainText("2026-10-10");
 expect(s.writes.filter(w=>w.path.endsWith("/reschedule"))).toHaveLength(1);
 expect(s.appointment.reference).toBe("FICTIONAL-TICKET");
});
for(const width of [1366,768,390]){
 test(`booking controls at ${width}px remain accessible without horizontal overflow`,async({page})=>{
   await page.setViewportSize({width,height:900});
   await fixture(page,"guest");
   await page.getByTestId("button-guest-continue-visit").click();
   await expect(page.getByRole("textbox",{name:/Patient's name/})).toBeVisible();
   await expect(page.getByRole("textbox",{name:/Patient's name/})).toHaveAttribute("aria-required","true");
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   await page.screenshot({path:`screenshots/booking-unification/guest-${width}.png`,fullPage:true});
 });
}
