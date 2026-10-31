import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const url="/?mode=schedule-persistence";
const activeDay=new WeakMap<Page,number>();
const editor=(page:Page)=>page.getByTestId(`row-day-${activeDay.get(page)??1}`);
const dayNumbers:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0};
const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const timeField=(page:Page,index:number,end:string)=>editor(page).getByLabel(`${dayNames[activeDay.get(page)??1]} slot ${index} ${end} time`,{exact:true});
const control=(page:Page,id:string)=>editor(page).getByTestId(`${id}-${activeDay.get(page)??1}`);
const rows=async(page:Page)=>(await (await page.request.get("/__schedule-evidence/rows")).json()).filter((r:any)=>r.status==="active");
async function actor(page:Page,id:string,role:string){
  const {token}=await (await page.request.get(`/__schedule-evidence/actor/${id}`)).json();
  await page.context().addCookies([{name:"digiq_session",value:token,domain:"127.0.0.1",path:"/api",httpOnly:true,sameSite:"Lax"}]);
  const me=await page.request.get("/api/me");
  expect(me.status()).toBe(200);expect((await me.json()).user.role).toBe(role);
}
async function tab(page:Page,day:string){activeDay.set(page,dayNumbers[day]);await expect(editor(page)).toBeVisible();}
async function slot(page:Page,start:string,end:string,index=1){
  if(!await control(page,"toggle-working-day").isChecked())await control(page,"toggle-working-day").check();
  else await control(page,"button-add-time-slot").click();
  await timeField(page,index,"start").fill(start);
  await timeField(page,index,"start").blur();
  await timeField(page,index,"end").fill(end);
  await timeField(page,index,"end").blur();
}
async function defaults(page:Page){
  await page.getByTestId("input-default-token-prefix").fill("A");
  await page.getByTestId("input-default-max-tokens").fill("10");
  await control(page,"select-duration").click();
  await page.getByRole("option",{name:"20 minutes",exact:true}).click();
  await page.getByRole("button",{name:"Apply to Week",exact:true}).click();
}
async function save(page:Page){
  await page.getByTestId("button-save-week").click();
  await expect(page.getByTestId("status-week-save")).toContainText(/^Saved \d/);
}
async function add(page:Page){await page.getByTestId("button-add-availability").click();await expect(editor(page)).toBeVisible();}
test.beforeEach(async({page})=>{expect((await page.request.get("/__schedule-evidence/reset")).ok()).toBe(true);});

for(const [id,role] of [["sa","superAdmin"],["adm","clinicAdmin"],["docu","doctor"],["rec","receptionist"]]){
  test(`real SQL Add/edit/reopen exact multi-day week: ${role}`,async({page})=>{
    await actor(page,id,role);await page.goto(url);await add(page);
    await tab(page,"Mon");await slot(page,"09:00","12:00");await defaults(page);
    await slot(page,"14:00","16:00",2);
    await editor(page).locator(".cde-adv summary").first().click();
    await editor(page).getByLabel("Max tokens",{exact:true}).first().fill("14");
    await editor(page).getByLabel("Token prefix",{exact:true}).first().fill("MX");
    await editor(page).getByLabel("Buffer (min)",{exact:true}).first().fill("5");
    for(const [label,value] of [["Break start","10:00"],["Break end","10:20"],["Queue opens","08:30"],["Queue closes","11:30"]]){
      await editor(page).getByLabel(label,{exact:true}).first().fill(value);await editor(page).getByLabel(label,{exact:true}).first().blur();
    }
    await editor(page).getByRole("button",{name:"Queue mode",exact:true}).first().click();
    await page.getByRole("option",{name:"Appointments only",exact:true}).click();
    await control(page,"select-duration").click();
    await page.getByRole("option",{name:"30 minutes",exact:true}).click();
    await page.getByRole("button",{name:"Apply to Week",exact:true}).click();
    await tab(page,"Wed");await slot(page,"09:30","12:30");
    await tab(page,"Fri");await slot(page,"15:00","18:00");
    await save(page);
    const saved=await rows(page);
    expect(saved.map((r:any)=>[r.day_of_week,r.data.startTime,r.data.endTime])).toEqual([[1,"09:00","12:00"],[1,"14:00","16:00"],[3,"09:30","12:30"],[5,"15:00","18:00"]]);
    expect(saved[0].data).toMatchObject({timezone:"Asia/Kolkata",maxTokens:14,tokenPrefix:"MX",consultationMinutes:30,bufferMinutes:5,breakStart:"10:00",breakEnd:"10:20",queueMode:"appointmentsOnly",queueOpenTime:"08:30",queueCloseTime:"11:30"});
    // Fresh page and actual existing-row Edit, not the already-open draft.
    await page.reload();
    await page.getByTestId(`button-edit-${saved[0].id}`).click();
    await tab(page,"Mon");
    await expect(timeField(page,1,"start")).toHaveValue("09:00");
    await editor(page).locator(".cde-adv summary").first().click();
    await expect(editor(page).getByLabel("Max tokens",{exact:true}).first()).toHaveValue("14");
    await tab(page,"Wed");
    await timeField(page,1,"end").fill("13:00");await timeField(page,1,"end").blur();
    await save(page);
    const edited=await rows(page);
    expect(edited).toHaveLength(4);
    expect(edited.filter((r:any)=>r.day_of_week!==3)).toEqual(saved.filter((r:any)=>r.day_of_week!==3));
    expect(edited.find((r:any)=>r.day_of_week===3).data.endTime).toBe("13:00");
    const date=new Date();date.setUTCDate(date.getUTCDate()+((1-date.getUTCDay()+7)%7||7));
    const downstream=await page.request.get(`/api/public/availability/sessions?doctorId=d1&branchId=b1&date=${date.toISOString().slice(0,10)}`);
    expect(downstream.status()).toBe(200);
    const available=await downstream.json();
    expect(JSON.stringify(available)).toContain("09:00");expect(JSON.stringify(available)).toContain("Asia/Kolkata");
    for(const width of [1366,390]){
      await page.setViewportSize({width,height:850});await tab(page,"Mon");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await mkdir("generated-artifacts/schedule-persistence",{recursive:true});
      await page.screenshot({path:`generated-artifacts/schedule-persistence/${role}-${width}.png`});
    }
    const counts=await(await page.request.get("/__schedule-evidence/counts")).json();
    expect(counts.appointments).toBe(0);expect(counts.outbox).toBe(0);
  });
}
test("whole-week validation, copy, cancellation, partial retry, double submit and stale conflict use real SQL",async({page})=>{
  await actor(page,"adm","clinicAdmin");await page.goto(url);await add(page);
  await slot(page,"09:00","12:00");await defaults(page);
  await editor(page).locator(".cde-adv summary").first().click();
  await editor(page).getByLabel("Max tokens",{exact:true}).fill("1001");
  await tab(page,"Wed");await slot(page,"14:00","16:00");
  await page.getByTestId("button-save-week").click();
  await expect(page.getByTestId("row-day-1").getByLabel("Max tokens",{exact:true})).toBeFocused();
  await tab(page,"Mon");
  expect(await rows(page)).toHaveLength(0);
  await editor(page).getByLabel("Max tokens",{exact:true}).fill("12");
  // Copy selected Monday to Friday; still draft-only.
  await tab(page,"Fri");await control(page,"select-copy-from").click();await page.getByRole("option",{name:"Monday",exact:true}).click();
  await control(page,"button-copy-from-apply").click();
  await page.getByRole("button",{name:"Copy Day",exact:true}).click();
  await expect(timeField(page,1,"start")).toHaveValue("09:00");
  expect(await rows(page)).toHaveLength(0);
  // One real server denial after other sessions commit. Not a fabricated success.
  let rejectFriday=true;
  await page.route("**/api/schedules",async route=>{
    if(route.request().method()==="POST"&&route.request().postDataJSON().dayOfWeek===5&&rejectFriday){
      const body=route.request().postDataJSON();
      const response=await route.fetch({postData:{...body,branchId:"b3",clinicId:"c3"}});
      expect(response.status()).toBe(403);await route.fulfill({response});
    }else await route.continue();
  });
  await page.getByTestId("button-save-week").click();
  await expect(page.getByTestId("status-week-save")).toContainText("Partly saved");
  expect(await rows(page)).toHaveLength(2);
  rejectFriday=false;
  await page.getByTestId("button-save-week").dblclick();
  await expect(page.getByTestId("status-week-save")).toContainText("Saved 1 change");
  const complete=await rows(page);expect(complete).toHaveLength(3);
  // The second physical click can land on Cancel after successful saving
  // removes the new-session defaults. The discard guard must keep this safe.
  const discard=page.getByRole("alertdialog");
  if(await discard.isVisible())await discard.getByRole("button",{name:"Keep editing",exact:true}).click();
  // Real concurrent update invalidates only the edited session's frozen snapshot.
  await tab(page,"Mon");
  const first=complete.find((r:any)=>r.day_of_week===1);
  const concurrent=await page.request.patch(`/api/schedules/${first.id}`,{data:{...first.data,maxTokens:15}});
  expect(concurrent.ok()).toBe(true);
  await timeField(page,1,"end").fill("12:30");await timeField(page,1,"end").blur();
  await page.getByTestId("button-save-week").click();
  await expect(page.getByTestId("status-week-save")).toContainText("Partly saved");
  expect((await rows(page)).find((r:any)=>r.id===first.id).data.maxTokens).toBe(15);
  await page.getByRole("dialog",{name:"Add Schedule",exact:true}).getByTestId("button-dialog-close").click();
  await page.getByTestId("button-discard-changes").click();
  expect(await rows(page)).toHaveLength(3);
});
test("receptionist linked weekdays including empty linked days are locked; denied scope and patient/guest writes stay denied",async({page})=>{
  await page.request.get("/__schedule-evidence/linked");await actor(page,"rec","receptionist");await page.goto(url);
  await page.getByTestId("button-edit-linked").click();
  await expect(timeField(page,1,"start")).toBeDisabled();
  await expect(control(page,"button-add-time-slot")).toBeDisabled();
  await tab(page,"Wed");
  await expect(control(page,"toggle-working-day")).toBeDisabled();
  await expect(control(page,"button-add-time-slot")).toHaveCount(0);
  const context=await(await page.request.get("/api/schedules/day-context?doctorId=d1&branchId=b1")).json();
  const denied=await page.request.post("/api/schedules/day-overrides",{data:{doctorId:"d1",branchId:"b1",dayOfWeek:1,confirmed:true,isOpen:false,sessions:[],requestId:crypto.randomUUID(),expectedSnapshot:context.days[1].snapshot}});
  expect(denied.status()).toBe(403);
  const input={doctorId:"d1",clinicId:"c1",branchId:"b1",dayOfWeek:5,isOpen:true,startTime:"09:00",endTime:"12:00",timezone:"Asia/Kolkata",maxTokens:10,consultationMinutes:20,tokenPrefix:"A",queueMode:"mixed"};
  for(const [id,role] of [["doc3u","doctor"],["rec3","receptionist"],["patu","patient"]]){
    await actor(page,id,role);
    expect((await page.request.post("/api/schedules",{data:input})).status()).toBe(403);
    expect((await page.request.get("/api/schedules/day-context?doctorId=d1&branchId=b1")).status()).toBe(403);
  }
  await page.context().clearCookies();
  expect([401,403]).toContain((await page.request.post("/api/schedules",{data:input})).status());
  expect(await rows(page)).toHaveLength(1);
});

test("mixed legacy durations survive unrelated edits; confirmed common choice applies only to the edited context",async({page})=>{
  await actor(page,"adm","clinicAdmin");
  for(const [day,start,end,duration] of [[1,"10:00","13:00",15],[1,"19:00","21:00",30],[2,"11:00","14:00",20]] as const){
    const response=await page.request.post("/api/schedules",{data:{doctorId:"d1",clinicId:"c1",branchId:"b1",dayOfWeek:day,startTime:start,endTime:end,isOpen:true,timezone:"Asia/Kolkata",maxTokens:20,consultationMinutes:duration,tokenPrefix:"A",queueMode:"mixed"}});
    expect(response.status()).toBe(201);
  }
  const original=await rows(page);
  await page.goto(url);
  await page.getByTestId(`button-edit-${original[0].id}`).click();
  const fullWeek=page.getByTestId("compact-day-editor");
  await expect(fullWeek.locator("[data-day-row]")).toHaveCount(7);
  await expect(fullWeek.getByRole("tab")).toHaveCount(0);
  await expect(page.getByTestId("text-duration-mixed")).toContainText("15, 20, 30");
  await tab(page,"Tue");await timeField(page,1,"end").fill("14:30");await timeField(page,1,"end").blur();
  await page.getByTestId("button-save-week").click();
  const extended=page.getByRole("dialog",{name:"Doctor Hours Beyond Clinic Hours"});
  if(await extended.isVisible())await page.getByTestId("button-outside-submit").click();
  await expect(page.getByTestId("status-week-save")).toContainText("Saved 1 change");
  expect((await rows(page)).map((r:any)=>r.data.consultationMinutes)).toEqual([15,30,20]);
  await control(page,"select-duration").click();await page.getByRole("option",{name:"30 minutes",exact:true}).click();
  await page.getByRole("dialog",{name:"Use 30 minutes for the whole week?"}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.getByTestId("text-duration-mixed")).toBeVisible();
  await control(page,"select-duration").click();await page.getByRole("option",{name:"30 minutes",exact:true}).click();
  await page.getByRole("button",{name:"Apply to Week",exact:true}).click();
  await expect(page.getByTestId("text-duration-mixed")).toHaveCount(0);
  expect((await rows(page)).map((r:any)=>r.data.consultationMinutes)).toEqual([15,30,20]);
  await page.getByTestId("button-save-week").click();
  if(await extended.isVisible())await page.getByTestId("button-outside-submit").click();
  await page.getByRole("dialog",{name:"Change Consultation Duration?"}).getByRole("button",{name:"Save Schedule",exact:true}).click();
  await expect(page.getByTestId("status-week-save")).toContainText("Saved 2 changes");
  const unified=await rows(page);
  expect(unified.map((r:any)=>r.data.consultationMinutes)).toEqual([30,30,30]);
  expect(unified.map((r:any)=>[r.data.startTime,r.data.endTime])).toEqual([["10:00","13:00"],["19:00","21:00"],["11:00","14:30"]]);
  await page.reload();await page.getByTestId(`button-edit-${original[0].id}`).click();
  await expect(page.getByTestId("select-duration-1")).toHaveAttribute("aria-label","Selected item: 30 minutes");
});

test("all seven days are independent; off drafts restore, individual removal and cancelled copy do not change neighbours",async({page})=>{
  await actor(page,"adm","clinicAdmin");await page.goto(url);await add(page);
  for(const [name,d] of Object.entries(dayNumbers)){
    await tab(page,name);await slot(page,"10:00","13:00");
    await control(page,"toggle-working-day").uncheck();
    await expect(control(page,"text-day-off")).toContainText("Draft slots return");
    await control(page,"toggle-working-day").check();
    await expect(timeField(page,1,"start")).toHaveValue("10:00");
    expect(await rows(page)).toHaveLength(0);
  }
  await defaults(page);
  await tab(page,"Mon");await slot(page,"19:00","21:00",2);
  await editor(page).getByRole("button",{name:"Remove Monday slot 2",exact:true}).click();
  await expect(timeField(page,1,"start")).toHaveValue("10:00");
  await tab(page,"Tue");await control(page,"select-copy-from").click();await page.getByRole("option",{name:"Monday",exact:true}).click();
  await control(page,"button-copy-cancel").click();
  await expect(control(page,"copy-from-panel")).toHaveCount(0);
  await expect(page.getByTestId("row-day-1").getByLabel("Monday slot 1 end time",{exact:true})).toHaveValue("13:00");
  expect(await rows(page)).toHaveLength(0);
  await page.getByRole("dialog",{name:"Add Schedule",exact:true}).getByTestId("button-dialog-close").click();
  await page.getByTestId("button-keep-editing").click();
  await expect(page.getByTestId("compact-day-editor").locator("[data-day-row]")).toHaveCount(7);
});

async function onboarding(page:Page,kind:string,linked=false){
  await actor(page,"sa","superAdmin");
  const week=Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,isOpen:[1,3,5].includes(dayOfWeek),sessions:[1,3,5].includes(dayOfWeek)?[{startTime:"08:00",endTime:"20:00"}]:[]}));
  const branch=(name:string)=>({name,slug:`schedule-${kind.toLowerCase()}-${name.toLowerCase()}`,address:"Fictional Way",city:"Mumbai",state:"Maharashtra",pincode:"400001",country:"IN",timezone:"Asia/Kolkata",email:"",phone:"",inheritEmail:true,inheritPhone:true,hours:week});
  const values={dateFormat:"YYYY-MM-DD",timeFormat:"24h",fullName:`Fictional ${kind} Owner`,email:`schedule-${kind.toLowerCase()}@test.invalid`,mobile:"+919876543210",name:`Fictional ${kind} Care`,slug:`schedule-${kind.toLowerCase()}-care`,categoryId:"",specialityIds:[],customCategory:null,customSpecialities:[],referralCode:"",clinicEmail:"front@test.invalid",phone:"+919876543210",branches:[branch("Main"),...(!linked?[branch("Second")]:[])],alsoConsult:true,specializationId:"",qualificationIds:[],linkConsultationHours:linked,sessionCapacity:"10",consultationMinutes:"20"};
  await page.addInitScript(({values})=>{
    const key="digiq:registration:v1:admin:sa";
    if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify({version:1,expires:Date.now()+3600000,data:{requestId:crypto.randomUUID(),step:3,values}}));
  },{values});
  await page.goto(url+"&onboard=1");
  await expect(page.getByTestId("registration-password")).toBeVisible();
  return values;
}
async function password(page:Page){
  await page.getByTestId("registration-password").fill("FictionalSchedule123");
  await page.getByTestId("registration-confirmPassword").fill("FictionalSchedule123");
}
test("onboarding shared custom week persists all settings only on Finish; multi-location copy, hidden errors, reload and uncertain-response recovery",async({page})=>{
  await onboarding(page,"Custom");
  const initial=await(await page.request.get("/__schedule-evidence/counts")).json();
  await slot(page,"09:00","12:00");await slot(page,"14:00","16:00",2);
  await editor(page).locator(".cde-adv summary").first().click();
  await editor(page).getByLabel("Token prefix",{exact:true}).first().fill("OWN");
  await editor(page).getByLabel("Max tokens",{exact:true}).first().fill("13");
  await editor(page).getByLabel("Buffer (min)",{exact:true}).first().fill("5");
  for(const [label,value] of [["Break start","10:00"],["Break end","10:20"],["Queue opens","08:30"],["Queue closes","11:30"]]){
    await editor(page).getByLabel(label,{exact:true}).first().fill(value);await editor(page).getByLabel(label,{exact:true}).first().blur();
  }
  await tab(page,"Wed");await control(page,"select-copy-from").click();await page.getByRole("option",{name:"Monday",exact:true}).click();
  await control(page,"button-copy-from-apply").click();await page.getByRole("button",{name:"Copy Day",exact:true}).click();
  await tab(page,"Fri");await slot(page,"15:00","18:00");
  await editor(page).locator(".cde-adv summary").first().click();
  await editor(page).getByLabel("Max tokens",{exact:true}).fill("1001");
  await tab(page,"Mon");await password(page);
  await page.getByTestId("registration-next").click();
  await expect(page.getByTestId("registration-error")).toContainText("correct the consultation sessions");
  expect(await(await page.request.get("/__schedule-evidence/counts")).json()).toEqual(initial);
  await tab(page,"Fri");
  await editor(page).getByLabel("Max tokens",{exact:true}).fill("11");
  await page.getByTestId("details-copy-locations").locator("summary").click();
  await page.getByTestId("check-copy-location-1").check();
  await page.getByTestId("button-apply-locations").click();
  // Reloading an unsaved onboarding draft must retain settings, not just times.
  await page.reload();await tab(page,"Mon");await editor(page).locator(".cde-adv summary").first().click();
  await expect(editor(page).getByLabel("Token prefix",{exact:true}).first()).toHaveValue("OWN");
  await expect(editor(page).getByLabel("Break start",{exact:true}).first()).toHaveValue("10:00");
  expect(await rows(page)).toHaveLength(0);
  let creates=0;
  await page.route("**/api/clinic-admin-onboarding",async route=>{
    if(route.request().method()==="POST"){creates++;const response=await route.fetch();expect(response.status()).toBe(201);await route.abort("failed");}
    else await route.continue();
  });
  await password(page);await page.getByTestId("registration-next").click();
  await expect(page.getByTestId("registration-configure-sessions")).toBeVisible();
  expect(creates).toBe(1);
  const saved=await rows(page);
  expect(saved).toHaveLength(10);
  const locations=[...new Set(saved.map((r:any)=>r.branch_id))];
  expect(locations).toHaveLength(2);
  for(const location of locations){
    const week=saved.filter((r:any)=>r.branch_id===location);
    expect(week.map((r:any)=>[r.day_of_week,r.data.startTime,r.data.endTime])).toEqual([[1,"09:00","12:00"],[1,"14:00","16:00"],[3,"09:00","12:00"],[3,"14:00","16:00"],[5,"15:00","18:00"]]);
    expect(week[0].data).toMatchObject({timezone:"Asia/Kolkata",tokenPrefix:"OWN",maxTokens:13,bufferMinutes:5,breakStart:"10:00",breakEnd:"10:20",queueOpenTime:"08:30",queueCloseTime:"11:30"});
  }
  const counts=await(await page.request.get("/__schedule-evidence/counts")).json();
  expect(counts.clinics).toBe(initial.clinics+1);expect(counts.appointments).toBe(0);expect(counts.outbox).toBe(0);
});
test("onboarding linked-hours mode and discard without writes stay separate from custom sessions",async({page})=>{
  await onboarding(page,"Linked",true);
  expect(await rows(page)).toHaveLength(0);
  await expect(page.getByTestId("registration-link-hours")).toBeChecked();
  await expect(editor(page)).toHaveCount(0);
  await password(page);await page.getByTestId("registration-next").click();
  await expect(page.getByTestId("registration-configure-sessions")).toBeVisible();
  const saved=await rows(page);expect(saved).toHaveLength(3);
  expect(saved.map((r:any)=>[r.day_of_week,r.data.startTime,r.data.endTime])).toEqual([[1,"08:00","20:00"],[3,"08:00","20:00"],[5,"08:00","20:00"]]);
  expect(saved.every((r:any)=>r.data.linkedBranchId===r.branch_id)).toBe(true);
});
test("cancelling unsaved onboarding sessions performs no SQL writes",async({page})=>{
  await onboarding(page,"Discard");const initial=await(await page.request.get("/__schedule-evidence/counts")).json();
  await slot(page,"09:00","12:00");
  await page.getByTestId("registration-discard").click();
  await page.getByRole("button",{name:"Discard draft",exact:true}).click();
  expect(await(await page.request.get("/__schedule-evidence/counts")).json()).toEqual(initial);
  expect(await rows(page)).toHaveLength(0);
});
