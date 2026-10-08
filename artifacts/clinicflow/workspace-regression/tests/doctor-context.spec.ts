import { expect, test, type Page } from "@playwright/test";

// Real components with deterministic HTTP persistence/failures; never writes to a live clinic.
async function fixture(page:Page, opts:{multiple?:boolean;missing?:boolean;empty?:boolean;role?:string;outside?:boolean}={}) {
  const clinic={id:"c1",name:"Context Clinic",adminId:"owner",timezone:"Asia/Kolkata",dateFormat:"DD/MM/YYYY",timeFormat:"12h",status:"active"};
  const branches=["b1","b2"].map((id,i)=>({id,clinicId:opts.outside&&i===1?"c2":"c1",name:`Location ${i+1}`,timezone:"Asia/Kolkata",status:"active",openingHours:[{dayOfWeek:1,startTime:"08:00",endTime:"18:00"}]}));
  const doctor:any={id:"d1",userId:"du1",fullName:"Context Doctor",email:"doctor@example.invalid",mobile:"",status:"active",clinicIds:opts.outside?["c1","c2"]:["c1"],branchIds:opts.missing?[]:opts.multiple?["b1","b2"]:["b1"],clinicNames:[clinic.name],branchNames:["Location 1"],registrationNumber:"REG1",experienceYears:5};
  const session=(id:string,branchId:string,startTime="09:00",endTime="12:00")=>({id,doctorId:"d1",clinicId:"c1",branchId,dayOfWeek:1,isOpen:true,startTime,endTime,timezone:"Asia/Kolkata",status:"active",tokenPrefix:"A",maxTokens:12,consultationMinutes:20,queueMode:"mixed"});
  const state={doctor,schedules:opts.empty?[]:[session("s1","b1"),session("s2","b2")],exceptions:[] as any[],writes:[] as {path:string;body:any}[],failLoad:false,failSession:"",holdSave:false};
  const listing=(items:any[])=>({items,total:items.length,page:1,pageSize:100});
  await page.route("**/api/**",async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
    let json:any=listing([]),status=200;
    if(method!=="GET"){state.writes.push({path,body:request.postDataJSON()});if(state.holdSave)await new Promise(r=>setTimeout(r,1500));}
    if(path==="/api/auth/csrf")json={csrfToken:"fixture"};
    else if(path==="/api/me")json={user:{id:"fixture-admin",role:opts.role||"superAdmin",fullName:"Fixture Admin"},permissions:{},needsOnboarding:false};
    else if(path==="/api/settings")json=clinic;
    else if(path==="/api/clinics/c1")json=clinic;
    else if(path==="/api/clinics")json=listing([clinic]);
    else if(path.startsWith("/api/branches/"))json=branches.find(b=>b.id===path.split("/").pop());
    else if(path==="/api/branches")json=listing(branches);
    else if(path==="/api/staff-assignment-options")json={clinics:[clinic],branches,doctors:[state.doctor],pagination:{clinics:{total:1},branches:{total:2},doctors:{total:1}}};
    else if(path==="/api/doctors"&&method==="GET")json=listing([state.doctor]);
    else if(path==="/api/doctors"&&method==="POST"){Object.assign(state.doctor,request.postDataJSON(),{id:"new-doctor",userId:"new-user"});json=state.doctor;}
    else if(path.startsWith("/api/doctors/")){if(method==="PATCH")Object.assign(state.doctor,request.postDataJSON());json=state.doctor;}
    else if(path==="/api/schedules"&&method==="GET"){
      if(state.failLoad){status=503;json={error:"Schedule load failed"};}
      else json=listing(state.schedules.filter(s=>s.branchId===url.searchParams.get("branchId")));
    }else if(path==="/api/schedules"&&method==="POST"){const body=request.postDataJSON();const row={...body,id:`created-${state.schedules.length}`,status:"active"};state.schedules.push(row);json=row;}
    else if(path.startsWith("/api/schedules/")){
      const id=path.split("/").pop();if(id===state.failSession){status=409;json={error:"This session was not saved"};}
      else {const row=state.schedules.find(s=>s.id===id)!;Object.assign(row,request.postDataJSON());json=row;}
    }else if(path==="/api/availability-exceptions"&&method==="GET")json=listing(state.exceptions);
    else if(path==="/api/availability-exceptions"&&method==="POST"){json={...request.postDataJSON(),id:"e1"};state.exceptions.push(json);}
    else if(path.startsWith("/api/availability-exceptions/")){json=state.exceptions.find(e=>e.id===path.split("/").pop());Object.assign(json,request.postDataJSON());}
    await route.fulfill({status,json});
  });
  return state;
}
const open=async(page:Page)=>{await page.goto("/?mode=staff&tab=doctors");await page.getByTestId("button-manage-schedule-d1").click();await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();};
const timeControl=(page:Page,id:string)=>page.getByTestId(id.replace("input-week-end-","input-endTime-").replace("input-week-start-","input-startTime-"));
const time=async(page:Page,id:string,value:string)=>{await timeControl(page,id).fill(value);await timeControl(page,id).press("Tab");};

test("sole saved location: compact sections, separate saves, draft preservation, save/reopen and contextual details",async({page})=>{
  const state=await fixture(page);await open(page);
  await expect(page.locator(".doctor-editor [role=tablist]")).toHaveCount(0);
  await expect(page.getByLabel("Registration Number")).toBeVisible();
  await expect(page.locator(".doctor-context-value").filter({hasText:"Location 1"})).toBeVisible();
  await time(page,"input-week-end-1-0","11:00 AM");
  await page.getByLabel("Full Name",{exact:false}).fill("Updated Context Doctor");
  await page.getByTestId("button-save-staff").click();
  await expect(page.getByText("Doctor details and assignments saved.",{exact:false})).toBeVisible();
  await expect(timeControl(page,"input-week-end-1-0")).toHaveValue(/11:00/);
  expect(state.schedules[0].endTime).toBe("12:00");
  await page.getByTestId("button-save-week").click();
  await expect(page.getByTestId("status-week-save")).toContainText("Saved");
  expect(state.schedules[0].endTime).toBe("11:00");
  await page.getByTestId("button-dialog-close").click();
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(timeControl(page,"input-week-end-1-0")).toHaveValue(/11:00/);
  await page.getByTestId("button-session-details-1-0").click();
  const child=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Session Details",exact:true})});
  await child.getByRole("textbox",{name:"Max Tokens",exact:true}).fill("18");
  await child.getByTestId("button-save").click();
  await expect(child).toHaveCount(0);expect(state.schedules[0].maxTokens).toBe(18);
  await page.getByRole("button",{name:"Add Date Exception",exact:true}).click();
  const exception=page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Add Date Exception",exact:true})});
  await exception.getByRole("textbox",{name:/^Date/}).fill("09/10/2026");await exception.getByRole("textbox",{name:/^Date/}).press("Tab");
  await exception.getByTestId("input-reason").fill("Context closure");
  await exception.getByTestId("button-save").click();
  await expect(exception).toHaveCount(0);expect(state.exceptions[0].doctorId).toBe("d1");expect(state.exceptions[0].branchId).toBe("b1");
  await page.getByRole("button",{name:"Edit Date Exception",exact:true}).click();
  await page.getByTestId("input-reason").fill("Updated closure");await page.getByTestId("button-save").click();
  await expect.poll(()=>state.exceptions[0].reason).toBe("Updated closure");
});

test("multiple locations protect draft on context change and Escape, preserving profile work",async({page})=>{
  await fixture(page,{multiple:true});await page.goto("/?mode=staff&tab=doctors");await page.getByTestId("button-manage-schedule-d1").click();
  await page.getByRole("button",{name:/Saved assigned location/}).click();await page.getByRole("option",{name:"Location 1",exact:true}).click();
  await time(page,"input-week-end-1-0","11:00 AM");
  await page.getByRole("button",{name:/Saved assigned location/}).click();await page.getByRole("option",{name:"Location 2",exact:true}).click();
  await page.getByRole("dialog").filter({has:page.getByRole("heading",{name:"Discard schedule draft?",exact:true})}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(timeControl(page,"input-week-end-1-0")).toHaveValue(/11:00/);
  await page.keyboard.press("Escape");await expect(page.getByTestId("discard-confirm")).toBeVisible();
  await page.getByTestId("button-keep-editing").click();
  await page.getByTestId("button-reset-week").click();
  await page.getByRole("button",{name:/Saved assigned location/}).click();await page.getByRole("option",{name:"Location 2",exact:true}).click();
  await expect(timeControl(page,"input-week-end-1-0")).toHaveValue(/12:00/);
});

test("missing assignments show setup, failed loads retry without inventing sessions",async({page})=>{
  const state=await fixture(page,{missing:true});await page.goto("/?mode=staff&tab=doctors");
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(page.getByRole("button",{name:"Set up assignments"})).toBeVisible();
  await expect(page.getByTestId("panel-weekly-editor")).toHaveCount(0);
  await page.getByTestId("button-dialog-close").click();
  state.doctor.branchIds=["b1"];state.failLoad=true;
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(page.getByTestId("doctor-schedule-context").getByRole("button",{name:"Retry",exact:true})).toBeVisible();
  state.failLoad=false;await page.getByTestId("doctor-schedule-context").getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();
});

test("first schedule requires explicit capacity and duration; creation stays in the same editor",async({page})=>{
  const state=await fixture(page,{empty:true});
  Object.assign(state.doctor,{experienceYears:undefined,registrationNumber:undefined});
  await page.goto("/?mode=staff&tab=doctors");await page.getByTestId("button-add-staff").click();
  await page.getByLabel("Full Name",{exact:false}).fill("New Context Doctor");await page.getByTestId("input-user-email").fill("new@example.invalid");
  await page.getByRole("button",{name:/Clinic Groups/}).click();await page.getByRole("option",{name:"Context Clinic",exact:true}).click();await page.keyboard.press("Escape");
  await page.getByRole("button",{name:/Locations/}).click();await page.getByRole("option",{name:"Location 1",exact:true}).click();await page.keyboard.press("Escape");
  await page.getByTestId("checkbox-confirm-inherited").check();await page.getByTestId("button-save-staff").click();
  await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();await expect(page.getByTestId("select-add-staff-role")).toHaveCount(0);
  await page.getByTestId("switch-day-1").check();
  await time(page,"input-week-start-1-0","9:00 AM");await time(page,"input-week-end-1-0","12:00 PM");
  await expect(page.getByTestId("button-save-week")).toBeDisabled();
  await page.getByTestId("input-default-token-prefix").fill("NEW");await page.getByTestId("input-default-max-tokens").fill("10");
  await page.getByRole("button",{name:/Expected Consultation Duration/}).click();await page.getByRole("option",{name:"20 minutes",exact:true}).click();
  await page.getByTestId("button-save-week").click();await expect(page.getByTestId("status-week-save")).toContainText("Saved");
  expect(state.schedules[0].doctorId).toBe("new-doctor");expect(state.schedules[0].branchId).toBe("b1");
  await expect(page.locator(".doctor-editor")).toHaveAttribute("data-details-dirty","false");
  await expect(page.locator(".doctor-editor")).toHaveAttribute("data-schedule-dirty","false");
  await page.getByTestId("button-dialog-close").click();
  await expect(page.getByTestId("panel-weekly-editor")).toHaveCount(0);
  await page.getByTestId("button-manage-schedule-new-doctor").click();
  await expect(timeControl(page,"input-week-start-1-0")).toHaveValue(/9:00/);
});

test("partial saves retain failed session draft; retry does not repeat successful creates",async({page})=>{
  const state=await fixture(page);state.schedules.splice(1,0,{...state.schedules[0],id:"s3",startTime:"14:00",endTime:"16:00"});
  state.failSession="s3";await open(page);
  await time(page,"input-week-end-1-0","11:00 AM");await time(page,"input-week-end-1-1","5:00 PM");
  await page.getByTestId("button-save-week").click();await expect(page.getByTestId("status-week-save")).toContainText("Partly saved");
  expect(state.schedules[0].endTime).toBe("11:00");expect(state.schedules[1].endTime).toBe("16:00");
  await expect(timeControl(page,"input-week-end-1-1")).toHaveValue(/5:00/);
  state.failSession="";await page.getByTestId("button-save-week").click();await expect(page.getByTestId("status-week-save")).toContainText("Saved");
  expect(state.schedules[1].endTime).toBe("17:00");
});

test("in-flight save blocks dismissal; unsaved assignments cannot write schedules",async({page})=>{
  const state=await fixture(page);await open(page);
  await page.getByRole("button",{name:/Locations/}).click();await page.getByRole("option",{name:"Location 2",exact:true}).click();await page.keyboard.press("Escape");
  await expect(page.getByText("Assignments have unsaved changes.",{exact:false})).toBeVisible();
  await expect(timeControl(page,"input-week-end-1-0")).toBeDisabled();
  expect(state.writes).toHaveLength(0);
  state.holdSave=true;await page.getByTestId("button-save-staff").click();
  await expect(page.getByTestId("button-dialog-close")).toBeDisabled();await page.keyboard.press("Escape");
  await expect(page.getByTestId("doctor-schedule-context")).toBeVisible();
});

test("doctor role retains staff permissions; clinic admins can use the shared contextual editor",async({page})=>{
  await fixture(page,{role:"clinicAdmin"});await page.goto("/?mode=staff&tab=doctors&fixtureRole=clinicAdmin");await page.getByTestId("button-manage-schedule-d1").click();
  await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();
  await page.getByTestId("button-dialog-close").click();
  await page.goto("/?mode=staff&fixtureRole=doctor");
  await expect(page.getByTestId("button-manage-schedule-d1")).toHaveCount(0);
});

test("scoped doctor assignment labels stay readable and external saved mappings cannot be cleared",async({page})=>{
  const state=await fixture(page,{multiple:true,outside:true});
  await page.goto("/?mode=staff&tab=doctors&fixedClinicId=c1");
  await page.getByTestId("button-manage-schedule-d1").click();
  await expect(page.locator(".doctor-context-value").filter({hasText:"Location 2"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Remove Location 2",exact:true})).toHaveCount(0);
  await page.getByLabel("Full Name",{exact:false}).fill("Scoped Updated Doctor");
  await page.getByTestId("button-save-staff").click();
  await expect(page.getByText("Doctor details and assignments saved.",{exact:false})).toBeVisible();
  expect([...state.doctor.branchIds].sort()).toEqual(["b1","b2"]);expect([...state.doctor.clinicIds].sort()).toEqual(["c1","c2"]);
});
