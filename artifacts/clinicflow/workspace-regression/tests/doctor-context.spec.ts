import { expect, test, type Page } from "@playwright/test";

// Real components with deterministic HTTP persistence/failures; never writes to a live clinic.
async function fixture(page:Page, opts:{multiple?:boolean;missing?:boolean;empty?:boolean;role?:string;outside?:boolean;long?:boolean;timeFormat?:string;stale?:boolean}={}) {
  const clinic={id:"c1",name:opts.long?"Context Clinic Group With An Exceptionally Long Name":"Context Clinic",adminId:"owner",timezone:"Asia/Kolkata",dateFormat:"DD/MM/YYYY",timeFormat:opts.timeFormat||"12h",status:"active"};
  const clinic2={id:"c2",name:"Other Clinic Group",adminId:"owner",timezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h",status:"active"};
  const branches=["b1","b2"].map((id,i)=>({id,clinicId:opts.outside&&i===1?"c2":"c1",name:opts.long?`Location ${i+1} With An Exceptionally Long Facility Name`:`Location ${i+1}`,timezone:"Asia/Kolkata",status:"active",openingHours:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,startTime:"08:00",endTime:"18:00"}))}));
  const doctor:any={id:"d1",userId:"du1",fullName:opts.long?"Dr. Context Doctor With An Exceptionally Long Professional Name":"Context Doctor",email:"doctor@example.invalid",mobile:"",status:"active",clinicIds:opts.outside?["c1","c2"]:["c1"],branchIds:opts.missing?[]:opts.multiple?["b1","b2"]:["b1"],clinicNames:[clinic.name],branchNames:["Location 1"],registrationNumber:"REG1",experienceYears:5};
  const session=(id:string,branchId:string,startTime="09:00",endTime="12:00")=>({id,doctorId:"d1",clinicId:"c1",branchId,dayOfWeek:1,isOpen:true,startTime,endTime,timezone:"Asia/Kolkata",status:"active",tokenPrefix:"A",maxTokens:12,consultationMinutes:20,queueMode:"mixed"});
  const state={doctor,schedules:opts.empty?[]:[session("s1","b1"),session("s2","b2")],exceptions:[] as any[],writes:[] as {path:string;method:string;body:any}[],consoleLogs:[] as string[],failLoad:false,failSession:"",holdSave:false,failReloadAfterWrite:false};
  const listing=(items:any[])=>({items,total:items.length,page:1,pageSize:100});
  await page.route("**/api/**",async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    let json:any=listing([]),status=200;
    if(method!=="GET"){state.writes.push({path,method,body:request.postDataJSON()});if(state.holdSave)await new Promise(r=>setTimeout(r,1500));}
    if(path==="/api/auth/csrf")json={csrfToken:"fixture"};
    else if(path==="/api/me")json={user:{id:"fixture-admin",role:opts.role||"superAdmin",fullName:"Fixture Admin"},permissions:{},needsOnboarding:false};
    else if(path==="/api/settings")json=clinic;
    else if(path==="/api/clinics/c1")json=clinic;
    else if(path==="/api/clinics/c2")json=clinic2;
    else if(path==="/api/clinics")json=listing(opts.outside?[clinic,clinic2]:[clinic]);
    else if(path.startsWith("/api/branches/"))json=branches.find(b=>b.id===path.split("/").pop());
    else if(path==="/api/branches")json=listing(branches);
    else if(path==="/api/staff-assignment-options")json={clinics:opts.outside?[clinic,clinic2]:[clinic],branches,doctors:[state.doctor],pagination:{clinics:{total:opts.outside?2:1},branches:{total:2},doctors:{total:1}}};
    else if(path==="/api/doctors"&&method==="GET")json=listing([opts.stale?{...state.doctor,branchIds:["b2"]}:state.doctor]);
    else if(path==="/api/doctors"&&method==="POST"){Object.assign(state.doctor,request.postDataJSON(),{id:"new-doctor",userId:"new-user"});json=state.doctor;}
    else if(path.startsWith("/api/doctors/")){if(method==="PATCH")Object.assign(state.doctor,request.postDataJSON());json=state.doctor;}
    else if(path==="/api/schedules"&&method==="GET"){
      if(state.failLoad||(state.failReloadAfterWrite&&state.writes.length)){status=503;json={error:"Schedule load failed"};}
      else json=listing(state.schedules.filter(s=>s.branchId===url.searchParams.get("branchId")));
    }else if(path==="/api/schedules"&&method==="POST"){const body=request.postDataJSON();const row={...body,id:`created-${state.schedules.length}`,status:"active"};state.schedules.push(row);json=row;}
    else if(path.startsWith("/api/schedules/")){
      const id=path.split("/").pop();if(id===state.failSession){status=409;json={error:"This session was not saved"};}
      else {const row=state.schedules.find(s=>s.id===id)!;if(method==="DELETE")row.status="inactive";else Object.assign(row,request.postDataJSON());json=row;}
    }else if(path==="/api/availability-exceptions"&&method==="GET")json=listing(state.exceptions);
    else if(path==="/api/availability-exceptions"&&method==="POST"){json={...request.postDataJSON(),id:"e1"};state.exceptions.push(json);}
    else if(path.startsWith("/api/availability-exceptions/")){json=state.exceptions.find(e=>e.id===path.split("/").pop());Object.assign(json,request.postDataJSON());}
    await route.fulfill({status,json});
  });
  return state;
}

const dialog=(page:Page)=>page.getByRole("dialog",{name:"Edit Doctor Schedule"});
const openSchedule=async(page:Page)=>{await page.goto("/?mode=staff&tab=doctors");await page.getByTestId("button-manage-schedule-d1").click();await expect(dialog(page)).toBeVisible();await expect(page.getByTestId("compact-day-editor")).toBeVisible();await expect(page.getByTestId("text-week-summary")).toBeVisible();};

test("Manage schedule opens the focused dialog with fixed scope, locked indicators and Mon-Sun tabs",async({page})=>{
  await fixture(page);await openSchedule(page);
  await expect(page.getByTestId("indicator-timezone")).toContainText("Asia/Kolkata");
  await expect(page.getByTestId("indicator-time-format")).toContainText("12-hour");
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
  await expect(page.getByRole("tab")).toHaveCount(7);
  await expect(dialog(page).getByLabel("Date of birth")).toHaveCount(0);
  await page.getByRole("tab",{name:"Mon"}).focus();await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await page.getByRole("tab",{name:"Tue"}).focus();await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"Wed"})).toBeFocused();
  await expect(page.getByRole("tab",{name:"Wed"})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab",{name:"Tue"})).toBeFocused();
  await page.keyboard.press("End");await expect(page.getByRole("tab",{name:"Sun"})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("Home");await expect(page.getByRole("tab",{name:"Mon"})).toHaveAttribute("aria-selected","true");
});

test("ordinary Edit Doctor has no embedded schedule",async({page})=>{
  await fixture(page);await page.goto("/?mode=staff&tab=doctors");await page.getByTestId("button-edit-staff-d1").click();
  await expect(page.getByTestId("doctor-schedule-context")).toHaveCount(0);
});

test("control row order, drafts survive tab switches, legacy duration preserved and labelled",async({page})=>{
  const state=await fixture(page);state.schedules[0].consultationMinutes=15;await openSchedule(page);
  await expect(page.getByTestId("toggle-working-day")).toBeVisible();
  const box=async(t:string)=>(await page.getByTestId(t).boundingBox())!;
  const a=await box("toggle-working-day"),b=await box("select-copy-from"),c=await box("button-add-time-slot");
  expect(a.x).toBeLessThan(b.x);expect(b.x).toBeLessThan(c.x);expect(Math.abs(b.y-c.y)).toBeLessThan(40);
  await expect(page.getByText("15 min (legacy)").first()).toBeVisible();
  await page.getByTestId("button-add-time-slot").click();
  await expect(page.getByLabel("Slot 2 start time")).toBeVisible();
  await page.getByRole("tab",{name:"Tue"}).click();await page.getByRole("tab",{name:"Mon"}).click();
  await expect(page.getByLabel("Slot 2 start time")).toBeVisible();
});

test("copy from excludes current day, confirms replacement and cancel changes nothing",async({page})=>{
  await fixture(page);await openSchedule(page);
  await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("select-copy-from").click();
  await expect(page.getByRole("option",{name:"Tuesday"})).toHaveCount(0);
  await page.getByRole("option",{name:"Monday"}).click();
  await page.getByTestId("button-copy-from-apply").click();
  await page.getByRole("dialog",{name:/Copy Monday/}).getByRole("button",{name:"Cancel"}).click();
  await expect(page.getByTestId("text-day-off")).toBeVisible();
});

test("invalid draft can be saved to jump to the offending slot; no write occurs",async({page})=>{
  const state=await fixture(page);await openSchedule(page);
  const ui:string[]=[];
  await page.getByRole("tab",{name:"Tue"}).click();
  ui.push(`after-tab:${await page.getByRole("tab",{selected:true}).textContent()}`);
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await page.getByTestId("toggle-working-day").check();
  ui.push(`after-check:${await page.getByRole("tab",{selected:true}).textContent()}`);
  await test.info().attach("validation-ui-state",{body:ui.join("\n"),contentType:"text/plain"});
  // The selected day must remain stable; never reselect to mask a focus/context reset.
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await page.getByTestId("button-add-time-slot").click();
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await page.getByRole("tab",{name:"Mon"}).click();
  await page.getByTestId("button-save-week").click();
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByLabel("Slot 1 start time")).toBeFocused();
  expect(state.writes.filter(w=>w.path.startsWith("/api/schedules"))).toHaveLength(0);
});

test("partial save keeps created record in baseline; reload failure and retry cannot duplicate the create",async({page})=>{
  const state=await fixture(page);await openSchedule(page);
  // Monday s1 duration change will be refused; Tuesday create succeeds.
  await page.getByRole("button",{name:/Consultation Duration for slot 1/}).click();await page.getByRole("option",{name:"30 min"}).click();
  await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("toggle-working-day").check();
  await page.getByTestId("button-add-time-slot").click();
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();
  await page.getByLabel("Slot 1 start time").fill("9:00 AM");await page.getByLabel("Slot 1 start time").press("Tab");
  await page.getByLabel("Slot 1 end time").fill("11:00 AM");await page.getByLabel("Slot 1 end time").press("Tab");
  await page.getByRole("button",{name:/Consultation Duration for slot 1/}).click();await page.getByRole("option",{name:"30 min"}).click();
  state.failReloadAfterWrite=true;state.failSession="s1";
  await page.getByTestId("button-save-week").click();
  await expect(page.getByRole("dialog",{name:"Change Consultation Duration?"})).toBeVisible();
  await page.getByRole("dialog",{name:"Change Consultation Duration?"}).getByRole("button",{name:"Save Schedule"}).click();
  await expect(page.getByRole("dialog",{name:"Doctor Hours Beyond Clinic Hours"})).toHaveCount(0);
  const creates=()=>state.writes.filter(w=>w.path==="/api/schedules"&&!!w.body).length;
  await expect.poll(creates).toBe(1);
  await expect(page.getByTestId("text-reload-warning")).toBeVisible();
  state.failSession="";
  await page.getByTestId("button-save-week").click();
  await expect(page.getByRole("dialog",{name:"Change Consultation Duration?"})).toBeVisible();
  await page.getByRole("dialog",{name:"Change Consultation Duration?"}).getByRole("button",{name:"Save Schedule"}).click();
  await expect(dialog(page)).toBeHidden();
  expect(creates()).toBe(1);
});

test("Delete Schedule is confirmed and deactivates, never hard-deletes history",async({page})=>{
  const state=await fixture(page);await openSchedule(page);
  await expect(page.getByTestId("button-delete-schedule")).toBeEnabled();
  await page.getByTestId("button-delete-schedule").click();
  await expect(page.getByRole("dialog",{name:"Delete Schedule?"})).toBeVisible();
  await page.getByRole("dialog",{name:"Delete Schedule?"}).getByRole("button",{name:"Delete Schedule"}).click();
  await expect.poll(()=>state.schedules.find(s=>s.id==="s1")?.status).toBe("inactive");
  expect(state.writes.filter(w=>w.path==="/api/schedules/s1").length).toBeGreaterThan(0);
  expect(state.writes.some(w=>w.path==="/api/schedules/s1"&&w.method==="DELETE")).toBe(true);
});

test("mobile keeps start, end, duration and remove visible",async({page})=>{
  await page.setViewportSize({width:390,height:800});await fixture(page);await openSchedule(page);
  await expect(page.getByRole("button",{name:/Consultation Duration for slot 1/})).toBeVisible();
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();
  await expect(page.getByRole("button",{name:"Remove slot 1"})).toBeVisible();
});

test("doctor role opens own availability in shared context and can deactivate own sessions",async({page})=>{
  const state=await fixture(page,{role:"doctor"});
  await page.goto("/doctor/availability?fixtureRole=doctor");
  await expect(page.getByTestId("doctor-schedule-context")).toBeVisible();
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
  await expect(page.getByTestId("button-delete-schedule")).toBeVisible();
  await page.getByTestId("toggle-working-day").uncheck();
  await page.getByTestId("button-reset-week").click();
  const discard=page.getByRole("dialog",{name:"Discard schedule draft?"});
  await expect(discard).toBeVisible();await discard.getByRole("button",{name:"Discard Changes"}).click();
  await expect(page.getByTestId("toggle-working-day")).toBeChecked();
  expect(state.writes.filter(w=>w.path.startsWith("/api/schedules"))).toHaveLength(0);
  await page.getByTestId("button-delete-schedule").click();
  await expect(page.getByRole("dialog",{name:"Delete Schedule?"})).toBeVisible();
  await page.getByRole("dialog",{name:"Delete Schedule?"}).getByRole("button",{name:"Delete Schedule"}).click();
  await expect.poll(()=>state.schedules.find(s=>s.id==="s1")?.status).toBe("inactive");
});

test("copies one slot, then confirms entire-day replacement",async({page})=>{
  await fixture(page);await openSchedule(page);await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("select-copy-from").click();await page.getByRole("option",{name:"Monday"}).click();
  await page.getByTestId("copy-from-panel").getByLabel("Copy").click();
  await page.getByRole("option",{name:"One time slot"}).click();
  await page.getByLabel("Source slot").click();await page.getByRole("option",{name:/9:00 AM – 12:00 PM/}).click();
  await page.getByTestId("button-copy-from-apply").click();
  const add=page.getByRole("dialog",{name:"Add Copied Slot?"});
  await expect(add).toBeVisible();await add.getByRole("button",{name:"Add Slot"}).click();
  const selectedAfterOneSlotCopy=await page.getByRole("tab",{selected:true}).textContent();
  await test.info().attach("one-slot-copy-selected-day",{body:selectedAfterOneSlotCopy||"",contentType:"text/plain"});
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByLabel("Slot 1 start time")).toHaveValue("9:00 AM");
  await page.getByTestId("button-add-time-slot").click();await expect(page.getByLabel("Slot 2 start time")).toBeVisible();
  await page.getByTestId("select-copy-from").click();await page.getByRole("option",{name:"Monday"}).click();
  await page.getByTestId("copy-from-panel").getByLabel("Copy").click();
  await page.getByRole("option",{name:"Entire day"}).click();await page.getByTestId("button-copy-from-apply").click();
  const replace=page.getByRole("dialog",{name:/Copy Monday to Tuesday/});
  await expect(replace).toBeVisible();await replace.getByRole("button",{name:"Copy Day"}).click();
  await expect(page.getByRole("tab",{name:"Tue"})).toHaveAttribute("aria-selected","true");
  await expect(page.getByLabel("Slot 1 start time")).toHaveValue("9:00 AM");
  await expect(page.getByLabel("Slot 2 start time")).toHaveCount(0);
});

test("working-day off/on retains its unsaved slot draft",async({page})=>{
  await fixture(page);await openSchedule(page);await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("toggle-working-day").check();
  await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("button-add-time-slot").click();
  await page.getByLabel("Slot 1 start time").fill("1:00 PM");
  await page.getByLabel("Slot 1 end time").fill("2:00 PM");
  await page.getByRole("tab",{name:"Tue"}).click();
  await page.getByTestId("toggle-working-day").uncheck();
  await page.getByRole("tab",{name:"Tue"}).click();
  await expect(page.getByTestId("text-day-off")).toBeVisible();
  await page.getByTestId("toggle-working-day").check();
  await page.getByRole("tab",{name:"Tue"}).click();
  await expect(page.getByLabel("Slot 1 start time")).toHaveValue("1:00 PM");
  await expect(page.getByLabel("Slot 1 end time")).toHaveValue("2:00 PM");
});

test("successful save closes and reopening shows the persisted session setting",async({page})=>{
  const state=await fixture(page);await openSchedule(page);
  await page.getByTestId("toggle-working-day").uncheck();
  await expect(page.getByTestId("button-save-week")).toBeEnabled();
  await page.getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Deactivate Removed Sessions?"});
  await expect(confirm).toBeVisible();await confirm.getByRole("button",{name:"Deactivate and Save"}).click();
  await expect(dialog(page)).toBeHidden();
  expect(state.schedules[0].status).toBe("inactive");
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("text-day-off")).toBeVisible();
});

test("busy save prevents duplicate submit and closing until write settles",async({page})=>{
  const state=await fixture(page);await openSchedule(page);
  await page.getByTestId("toggle-working-day").uncheck();
  await expect(page.getByTestId("button-save-week")).toBeEnabled();state.holdSave=true;
  await page.getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Deactivate Removed Sessions?"});
  await expect(confirm).toBeVisible();await confirm.getByRole("button",{name:"Deactivate and Save"}).click();
  await expect.poll(()=>state.writes.filter(w=>w.path==="/api/schedules/s1").length).toBe(1);
  await expect(page.getByTestId("button-save-week")).toBeDisabled();
  await expect(page.getByRole("button",{name:"Close (saving in progress)"})).toBeDisabled();
  await page.waitForResponse(r=>r.url().includes("/api/schedules/s1")&&r.request().method()==="DELETE");
  await expect(dialog(page)).toBeHidden();
  expect(state.writes.filter(w=>w.path==="/api/schedules/s1").length).toBe(1);
});

test("Escape, backdrop and Cancel all use the shared discard guard",async({page})=>{
  await fixture(page);await openSchedule(page);
  await page.getByLabel("Slot 1 start time").fill("10:00 AM");await page.getByLabel("Slot 1 start time").press("Tab");
  await expect(page.getByTestId("button-save-week")).toBeEnabled();
  await expect(page.getByTestId("button-delete-schedule")).toBeDisabled();
  await page.getByTestId("button-dialog-close").click();
  await expect(page.getByRole("alertdialog",{name:"Discard unsaved changes?"})).toBeVisible();
  await page.getByTestId("button-keep-editing").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog",{name:"Discard unsaved changes?"})).toBeVisible();
  await page.getByTestId("button-keep-editing").click();
  await page.mouse.click(8,8);
  await expect(page.getByRole("alertdialog",{name:"Discard unsaved changes?"})).toBeVisible();
  await page.getByTestId("button-keep-editing").click();
  await page.getByTestId("button-reset-week").click();
  await expect(page.getByRole("alertdialog",{name:"Discard unsaved changes?"})).toBeVisible();
  await page.getByTestId("button-discard-changes").click();
  await expect(dialog(page)).toBeHidden();
});

test("fresh doctor assignment and fixed clinic-group entry scope locations",async({page})=>{
  await fixture(page,{multiple:true,outside:true,stale:true});
  await page.goto("/?mode=staff&tab=doctors&fixedClinicId=c1");
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
  await expect(page.getByTestId("select-schedule-group")).toHaveCount(0);
  await page.getByRole("button",{name:"Close"}).click();await expect(dialog(page)).toBeHidden();
  await page.goto("/admin/availability?fixtureRole=superAdmin&doctorId=d1");
  await expect(page.getByTestId("doctor-schedule-context")).toBeVisible();
  await page.getByRole("button",{name:"Clinic Group"}).click();
  await page.getByRole("option",{name:"Context Clinic"}).click();
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
  expect(new URL(page.url()).searchParams.has("branchId")).toBe(false);
  await page.goto("/admin/availability?fixtureRole=clinicAdmin&doctorId=d1");
  await expect(page.getByTestId("doctor-schedule-context")).toBeVisible();
  await page.getByRole("button",{name:"Clinic Group"}).click();
  await page.getByRole("option",{name:"Context Clinic"}).click();
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
});

test("24-hour preferences and saved date exceptions remain intact",async({page})=>{
  const state=await fixture(page,{timeFormat:"24h"});
  state.exceptions.push({id:"e1",doctorId:"d1",branchId:"b1",date:"2026-07-13",isClosed:true,isExtra:false,reason:"Holiday"});
  await openSchedule(page);
  await expect(page.getByTestId("indicator-time-format")).toContainText("24-hour");
  await expect(page.getByLabel("Slot 1 start time")).toHaveValue("09:00");
  await page.getByRole("button",{name:/Consultation Duration for slot 1/}).click();
  await page.getByRole("option",{name:"30 min"}).click();await page.getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Change Consultation Duration?"});
  await expect(confirm).toBeVisible();await confirm.getByRole("button",{name:"Save Schedule"}).click();
  await expect.poll(()=>state.schedules[0].consultationMinutes).toBe(30);
  expect(state.exceptions).toHaveLength(1);
  expect(state.writes.some(w=>w.path.startsWith("/api/availability-exceptions"))).toBe(false);
});

test("doctor schedule screenshot and controls fit 1440x900",async({page},testInfo)=>{
  await page.setViewportSize({width:1440,height:900});await fixture(page,{long:true});await openSchedule(page);
  await expect(page.getByTestId("schedule-header").getByText(/Exceptionally Long Professional Name/)).toBeVisible();
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();await expect(page.getByLabel("Slot 1 end time")).toBeVisible();
  await expect(page.getByRole("button",{name:/Consultation Duration for slot 1/})).toBeVisible();await expect(page.getByRole("button",{name:"Remove slot 1"})).toBeVisible();
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,footer:document.querySelector(".cde-footer")?.getBoundingClientRect().toJSON()}));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);expect(metrics.footer!.bottom).toBeLessThanOrEqual(900);
  await page.screenshot({path:testInfo.outputPath("schedule-desktop-1440x900.png")});
});

test("doctor schedule screenshot and controls fit 1024x768",async({page},testInfo)=>{
  await page.setViewportSize({width:1024,height:768});await fixture(page,{long:true});await openSchedule(page);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,footer:document.querySelector(".cde-footer")?.getBoundingClientRect().toJSON()}));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);expect(metrics.footer!.bottom).toBeLessThanOrEqual(768);
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();await expect(page.getByLabel("Slot 1 end time")).toBeVisible();
  await expect(page.getByRole("button",{name:/Consultation Duration for slot 1/})).toBeVisible();await expect(page.getByRole("button",{name:"Remove slot 1"})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("schedule-laptop-tablet-1024x768.png")});
});

test("doctor schedule screenshot and controls fit 390x844 with unclipped duration menu",async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await fixture(page,{long:true});await openSchedule(page);
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,footer:document.querySelector(".cde-footer")?.getBoundingClientRect().toJSON()}));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);expect(metrics.footer!.bottom).toBeLessThanOrEqual(844);
  await expect(page.getByLabel("Slot 1 start time")).toBeVisible();await expect(page.getByLabel("Slot 1 end time")).toBeVisible();
  await expect(page.getByRole("button",{name:"Remove slot 1"})).toBeVisible();
  await page.getByRole("button",{name:/Consultation Duration for slot 1/}).click();
  const option=page.getByRole("option",{name:"30 min"});await expect(option).toBeVisible();
  const rect=await option.boundingBox();expect(rect!.x).toBeGreaterThanOrEqual(0);expect(rect!.x+rect!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");await page.screenshot({path:testInfo.outputPath("schedule-phone-390x844.png")});
});

test("Clinic Admin uses the focused editor within its fixed clinic group",async({page})=>{
  await fixture(page,{role:"clinicAdmin",multiple:true,outside:true});
  await page.goto("/?mode=staff&tab=doctors&fixtureRole=clinicAdmin&fixedClinicId=c1");
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("text-fixed-group")).toHaveText("Context Clinic");
  await expect(page.getByTestId("text-fixed-location")).toHaveText("Location 1");
  await expect(page.getByTestId("select-schedule-group")).toHaveCount(0);
  await expect(page.getByTestId("button-delete-schedule")).toBeEnabled();
  await expect(page.getByRole("tab",{name:"Mon"})).toHaveAttribute("aria-selected","true");
});
