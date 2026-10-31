import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { writeFile } from "node:fs/promises";

const group={id:"c1",name:"Fictional Clinic Group with a long saved name for schedule editing",status:"active",timezone:"Asia/Kolkata",timeFormat:"24h"};
const clinic={id:"b1",clinicId:"c1",name:"Fictional Clinic with a long saved location name",status:"active",timezone:"Asia/Kolkata",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"17:00"}]};
const doctor={id:"d1",fullName:"Fictional Doctor with a long saved name",status:"active",clinicIds:["c1"],branchIds:["b1"]};
const summary={id:"s1",doctorId:"d1",clinicId:"c1",branchId:"b1",doctorName:doctor.fullName,branchName:clinic.name,dayOfWeek:1,isOpen:true,startTime:"09:00",endTime:"12:00",breakStart:"10:00",breakEnd:"10:15",tokenPrefix:"A",maxTokens:10,consultationMinutes:20,bufferMinutes:5};
const full={...summary,timezone:"Asia/Kolkata",queueMode:"mixed",queueOpenTime:"08:30",queueCloseTime:"11:30"};
// Full-week layout: every day renders as a row, footer stays sticky and reachable, nothing overflows.
for (const viewport of [{width:1024,height:640},{width:1366,height:768}]) test(`full-week layout evidence ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);
  const state=await setup(page,"clinicAdmin",true,true);
  state.row={...full,dayOfWeek:0,startTime:"09:00",endTime:"13:00",breakStart:null,breakEnd:null,queueOpenTime:null,queueCloseTime:null,linkedBranchId:"b1"};
  state.extraRows=[{...state.row,id:"s2",startTime:"19:00",endTime:"22:00"}];
  state.clinicHours=[];
  await edit(page);
  for(const d of [1,2,3,4,5,6,0])await expect(day(schedule(page),d)).toHaveCount(1);
  await expect(day(schedule(page),0).getByLabel("Sunday slot 2 end time",{exact:true})).toBeVisible();
  await expect(schedule(page).getByRole("tab")).toHaveCount(0);
  await page.evaluate(()=>document.fonts.ready);
  const geometry=await schedule(page).evaluate(dialog=>{
    const rect=(el:Element|null)=>{const r=el!.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const rows=[...dialog.querySelectorAll("[data-day-row]")].map(el=>Number(el.getAttribute("data-day-row")));
    const footer=dialog.querySelector(".cde-footer")!;
    const box=dialog.getBoundingClientRect();
    const overflow=[...dialog.querySelectorAll("input,button,.searchable-select-control")].filter(el=>el.getClientRects().length).filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<box.left-1||b.right>box.right+1);}).map(el=>el.outerHTML.slice(0,100));
    return {dialog:rect(dialog),footer:rect(footer),footerPosition:getComputedStyle(footer).position,rows,overflow,scrollFits:dialog.scrollWidth<=dialog.clientWidth+1};
  });
  const dir="generated-artifacts/schedule-full-week";
  await mkdir(dir,{recursive:true});
  await page.screenshot({path:`${dir}/${viewport.width}.png`});
  await writeFile(`${dir}/${viewport.width}.json`,JSON.stringify(geometry,null,2));
  expect(geometry.rows).toEqual([1,2,3,4,5,6,0]);
  expect(geometry.overflow).toEqual([]);
  expect(geometry.scrollFits).toBe(true);
  expect(geometry.footerPosition).toBe("sticky");
  expect(geometry.footer.bottom).toBeLessThanOrEqual(geometry.dialog.bottom+1);
  await expect(schedule(page).getByTestId("button-save-week")).toBeInViewport();
  await expect(schedule(page).getByTestId("text-outside-hours-0")).toContainText("Slots 1, 2");
});
const list=(items:unknown[])=>({items,total:items.length,page:1,pageSize:20,totalPages:1});
async function setup(page:Page, role="superAdmin", extra=true, linked=false, resource="availability", apiRole=role) {
  const state={row:{...(extra?full:summary),...(linked?{linkedBranchId:"b1"}:{})} as Record<string,any>,extraRows:[] as Record<string,any>[],clinicHours:[...clinic.openingHours],customDays:new Set<number>(),revision:0,writes:[] as Record<string,any>[],consoleErrors:[] as string[],pageErrors:[] as string[],fail:false,failDay:undefined as number|undefined,pause:undefined as Promise<void>|undefined};
  const rows=()=>[state.row,...state.extraRows].filter(r=>r.status!=="inactive");
  const context=()=>({items:rows(),days:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,following:linked&&!state.customDays.has(dayOfWeek),custom:state.customDays.has(dayOfWeek),snapshot:`day-${dayOfWeek}-${state.revision}`}))});
  await page.route(/https:\/\/fonts\./,r=>r.abort());
  page.on("console",msg=>{if(msg.type()==="error")state.consoleErrors.push(msg.text());});
  page.on("pageerror",error=>state.pageErrors.push(error.message));
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let reply:any=list([]),status=200;
    if(path==="/api/auth/csrf")reply={csrfToken:"fixture-csrf-token"};
    else if(path==="/api/me")reply={userId:"fixture-admin",user:{id:"fixture-admin",role:apiRole,fullName:"Fictional Actor",clinicIds:["c1"],branchIds:["b1"]},...(apiRole==="doctor"?{doctorId:"d1"}:{}),needsOnboarding:false};
    else if(path==="/api/settings")reply={timezone:"Asia/Kolkata",timeFormat:"24h",dateFormat:"YYYY-MM-DD"};
    else if(path==="/api/clinics/c1")reply=group;
    else if(path==="/api/branches/b1")reply={...clinic,openingHours:state.clinicHours,...(linked?{linkedSchedule:{enabled:true,doctorId:"d1",maxTokens:10,consultationMinutes:20,tokenPrefix:"A",queueMode:"mixed"}}:{})};
    else if(path==="/api/doctors/d1")reply=doctor;
    else if(path==="/api/clinics")reply=list([group]);
    else if(path==="/api/branches")reply=list([clinic]);
    else if(path==="/api/doctors")reply=list([doctor]);
    else if(path==="/api/schedules/day-context")reply=context();
    else if(path==="/api/schedules"&&req.method()==="GET"){
      const params=new URL(req.url()).searchParams;
      const pageNumber=Number(params.get("page")||1),pageSize=Number(params.get("pageSize")||20);
      reply={...list(rows().slice((pageNumber-1)*pageSize,pageNumber*pageSize)),total:rows().length,page:pageNumber,pageSize,totalPages:Math.ceil(rows().length/pageSize)};
    }
    else if(path==="/api/availability-exceptions")reply=list([{...state.row,date:"2030-01-01",isClosed:false,reason:"Holiday hours"}]);
    else if(path.startsWith("/api/schedules")&&["POST","PATCH"].includes(req.method())){
      const body=req.postDataJSON();state.writes.push(body);
      if(state.pause)await state.pause;
      if(state.fail || body.dayOfWeek===state.failDay){status=409;reply={message:"Schedule changed. Reload before saving."};}
      else if(path==="/api/schedules/day-overrides"){
        const saved=body.sessions.map((slot:any,i:number)=>({...slot.session,id:slot.id||`new-${state.revision}-${i}`,linkedBranchId:null,draftKey:slot.key,status:"active"}));
        const kept=rows().filter(r=>r.dayOfWeek!==body.dayOfWeek);
        const next=[...kept,...saved];
        state.row=next[0]||{...state.row,status:"inactive"};state.extraRows=next.slice(1);
        state.customDays.add(body.dayOfWeek);state.revision++;reply=context();
      } else if(req.method()==="POST"){reply={...body,id:`created-${state.extraRows.length+1}`,status:"active"};state.extraRows.push(reply);}
      else {const id=path.split("/").pop();if(state.row.id===id){state.row={...state.row,...body};reply=state.row;}else{state.extraRows=state.extraRows.map(r=>r.id===id?{...r,...body}:r);reply=state.extraRows.find(r=>r.id===id);}}
    }
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(reply)});
  });
  await page.goto(`/?mode=resource&resource=${resource}&fixtureRole=${role}`);
  await expect(page.getByTestId(`row-${resource}-s1`)).toBeVisible();
  return state;
}
type Scope=ReturnType<Page["locator"]>;
const day=(scope:Scope,d:number)=>scope.getByTestId(`row-day-${d}`);
const DAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const slotLabel=(d:number,i:number,edge:"start"|"end")=>`${DAY_NAMES[d]} slot ${i} ${edge} time`;
async function pick(page:Page,scope:Scope,testId:string,option:string){
  await scope.getByTestId(testId).click();
  await page.getByRole("option",{name:option,exact:true}).click();
}
const schedule=(page:Page)=>page.getByRole("dialog",{name:"Edit Schedule",exact:true});
async function actionsFor(editor:ReturnType<Page["getByTestId"]>){
  const dialog=editor.locator('xpath=ancestor::*[@role="dialog"][1]');
  return await dialog.count()?dialog.locator(".cde-footer"):editor.locator(".cde-footer");
}
async function edit(page:Page){
  await page.getByTestId("button-edit-s1").click();
  await expect(page.getByRole("dialog",{name:"Edit Schedule",exact:true})).toBeVisible();
}
async function time(page:Page,key:string,value:string){
  await page.locator(`#input-${key}`).fill(value);
  await page.locator(`#input-${key}`).press("Tab");
}
for(const role of ["superAdmin","clinicAdmin","doctor"] as const) test(`days retain full settings, keyboard navigation, save and reopen for ${role}`,async({page})=>{
  const state=await setup(page,role);await edit(page);
  await expect(schedule(page).getByRole("tab")).toHaveCount(0);
  const mon=day(schedule(page),1);
  // Keyboard: Tab moves from Monday's working-day switch into its first time slot.
  await mon.getByTestId("toggle-working-day-1").focus();await page.keyboard.press("Tab");
  await expect(mon.getByLabel(slotLabel(1,1,"start"),{exact:true})).toBeFocused();
  await mon.getByText("Advanced settings",{exact:true}).click();
  await mon.getByLabel("Max tokens",{exact:true}).fill("14");
  await mon.locator('[data-field="queueCloseTime"] input').fill("11:45");
  // Other days stay independent and Monday's draft is kept.
  await expect(day(schedule(page),2).getByTestId("toggle-working-day-2")).not.toBeChecked();
  await expect(mon.getByLabel("Max tokens",{exact:true})).toHaveValue("14");
  expect(state.writes).toHaveLength(0);
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await schedule(page).getByTestId("button-save-week").click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Saved");
  expect(state.writes[0]).toMatchObject({maxTokens:14,queueCloseTime:"11:45",breakStart:"10:00",consultationMinutes:20});
  await schedule(page).getByTestId("button-dialog-close").click();await edit(page);
  await day(schedule(page),1).getByText("Advanced settings",{exact:true}).click();
  await expect(day(schedule(page),1).getByLabel("Max tokens",{exact:true})).toHaveValue("14");
  await expect(day(schedule(page),1).locator('[data-field="queueCloseTime"] input')).toHaveValue("11:45");
});
test("save reopens and focuses the invalid advanced field in its day row and makes no writes",async({page})=>{
  const state=await setup(page);await edit(page);
  const mon=day(schedule(page),1);
  await mon.getByText("Advanced settings",{exact:true}).click();
  for(const [field,value,reset] of [["Max tokens","0","10"],["Break end","","10:15"],["Queue closes","13:00","11:30"],["Queue closes","25:90","11:30"]]){
    const input=field==="Queue closes"?mon.locator('[data-field="queueCloseTime"] input'):mon.getByLabel(field,{exact:true});
    await input.fill(value);
    // Collapse the disclosure: save must reopen it and focus inside Monday's row.
    await mon.locator(".cde-adv").first().evaluate((el:HTMLDetailsElement)=>{el.open=false;});
    await schedule(page).getByTestId("button-save-week").click();
    await expect(mon.locator(".cde-adv").first()).toHaveAttribute("open","");
    await expect(mon.locator(".field-error").first()).toBeVisible();
    await expect(mon.locator(":focus")).toHaveCount(1);
    await input.fill(reset);
  }
  expect(state.writes).toHaveLength(0);
});
test("failed save retains the draft; Cancel and Escape share one discard prompt",async({page})=>{
  const state=await setup(page);state.fail=true;await edit(page);
  await day(schedule(page),1).getByText("Advanced settings",{exact:true}).click();await schedule(page).getByLabel("Max tokens",{exact:true}).fill("15");
  await schedule(page).getByTestId("button-save-week").click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Partly saved");
  await expect(schedule(page).getByLabel("Max tokens",{exact:true})).toHaveValue("15");
  await schedule(page).getByTestId("button-reset-week").click();
  await expect(page.getByTestId("discard-confirm")).toHaveCount(1);
  await page.keyboard.press("Escape");await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(page.getByTestId("discard-confirm")).toHaveCount(1);
  await page.getByTestId("button-keep-editing").click();
  await expect(schedule(page).getByLabel("Max tokens",{exact:true})).toHaveValue("15");
  await schedule(page).getByTestId("button-dialog-close").click();await page.getByTestId("button-discard-changes").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("saving blocks repeated submission and all dismissal paths",async({page})=>{
  const state=await setup(page);await edit(page);
  let release!:()=>void;state.pause=new Promise(resolve=>{release=resolve;});
  await day(schedule(page),1).getByText("Advanced settings",{exact:true}).click();await schedule(page).getByLabel("Max tokens",{exact:true}).fill("12");
  await schedule(page).getByTestId("button-save-week").click();
  await expect.poll(()=>state.writes.length).toBe(1);
  await expect(schedule(page).getByTestId("button-save-week")).toBeDisabled();
  await expect(schedule(page).getByTestId("button-reset-week")).toBeDisabled();
  await expect(schedule(page).getByTestId("button-dialog-close")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await expect(page.getByRole("dialog",{name:"Edit Schedule"})).toBeVisible();
  release();await expect(schedule(page).getByTestId("status-week-save")).toContainText("Saved");
});
test("Add Schedule loads the saved week and adds a session through the shared weekly editor",async({page})=>{
  const state=await setup(page);
  await page.getByTestId("button-add-availability").click();
  await expect(page.getByRole("dialog",{name:"Add Schedule"})).toBeVisible();
  await page.getByRole("button",{name:"Doctor",exact:true}).click();
  await page.getByRole("option",{name:doctor.fullName,exact:true}).click();
  const editor=page.getByTestId("panel-weekly-editor");
  await expect(editor.getByLabel(slotLabel(1,1,"start"),{exact:true})).toHaveValue("09:00");
  // New slots take the supported common week duration (20 min); no choice required.
  await editor.getByTestId("button-add-time-slot-1").click();
  await expect(editor.getByTestId("text-duration-required")).toHaveCount(0);
  await editor.getByLabel(slotLabel(1,2,"start"),{exact:true}).fill("13:00");await editor.getByLabel(slotLabel(1,2,"start"),{exact:true}).blur();
  await editor.getByLabel(slotLabel(1,2,"end"),{exact:true}).fill("15:00");await editor.getByLabel(slotLabel(1,2,"end"),{exact:true}).blur();
  await (await actionsFor(editor)).getByTestId("button-save-week").click();
  await expect(editor.getByTestId("status-week-save")).toContainText("Saved 1 change");
  expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({doctorId:"d1",clinicId:"c1",branchId:"b1",startTime:"13:00",endTime:"15:00",consultationMinutes:20});
  expect(state.row).toEqual(full);expect(state.extraRows).toHaveLength(1);
});
for(const role of ["superAdmin","clinicAdmin","doctor"] as const) test(`linked-day confirmation cancellation, multiple intervals, save and reload for ${role}`,async({page})=>{
  const state=await setup(page,role,true,true);
  state.extraRows.push({...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,linkedBranchId:"b1"});
  await edit(page);
  await expect(schedule(page).getByTestId("text-day-source-1")).toContainText("Following clinic hours");
  await expect(schedule(page).getByTestId("text-day-source-1")).toContainText("09:00–17:00");
  await schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true}).fill("11:45");
  await schedule(page).getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Confirm Custom Schedule",exact:true});
  await expect(confirm).toContainText(doctor.fullName);
  await expect(confirm).toContainText("Clinic hours and other days are unchanged");
  await expect(confirm).toContainText("14:00–16:00");
  expect(state.writes).toHaveLength(0);
  await confirm.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true})).toHaveValue("11:45");
  expect(state.writes).toHaveLength(0);
  await schedule(page).getByTestId("button-save-week").click();
  await confirm.getByRole("button",{name:"Confirm & Save",exact:true}).click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Custom schedule saved");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({doctorId:"d1",branchId:"b1",dayOfWeek:1,confirmed:true});
  expect(state.writes[0].sessions).toHaveLength(2);
  expect([state.row,...state.extraRows].every(r=>!r.linkedBranchId)).toBe(true);
  await page.reload();await edit(page);
  await expect(schedule(page).getByTestId("text-day-source-1")).toContainText("Custom schedule");
  await expect(schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true})).toHaveValue("11:45");
});
test("custom day off persists with no inherited interval left active",async({page})=>{
  const state=await setup(page,"doctor",true,true);await edit(page);
  await schedule(page).getByTestId("toggle-working-day-1").uncheck();
  await schedule(page).getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Confirm Custom Schedule",exact:true});
  await expect(confirm).toContainText("Day off");
  await confirm.getByRole("button",{name:"Confirm & Save",exact:true}).click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Custom schedule saved");
  expect(state.writes[0].sessions).toEqual([]);
  await schedule(page).getByTestId("button-dialog-close").click();
  // Open another retained row at this doctor/location to verify the persisted off day.
  state.row={...full,id:"s3",dayOfWeek:2,linkedBranchId:"b1"};
  await page.reload();await page.getByTestId("button-edit-s3").click();
  await expect(schedule(page).getByTestId("toggle-working-day-1")).not.toBeChecked();
  await expect(schedule(page).getByTestId("text-day-source-1")).toContainText("Custom schedule");
});
test("uncertain linked-day failure retains draft and reuses save identifier on retry",async({page})=>{
  const state=await setup(page,"superAdmin",true,true);state.fail=true;await edit(page);
  await schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true}).fill("11:45");
  for(let attempt=0;attempt<2;attempt++){
    await schedule(page).getByTestId("button-save-week").click();
    await page.getByRole("button",{name:"Confirm & Save",exact:true}).click();
    await expect(schedule(page).getByTestId("status-week-save")).toContainText("not confirmed saved");
  }
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0].requestId).toBe(state.writes[1].requestId);
  await expect(schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true})).toHaveValue("11:45");
});
test("partial linked-day save retries only the failed day with its original baseline and request id",async({page})=>{
  const state=await setup(page,"superAdmin",true,true);
  state.extraRows.push({...full,id:"s2",dayOfWeek:2,linkedBranchId:"b1"});
  state.clinicHours.push({dayOfWeek:2,startTime:"09:00",endTime:"17:00"});
  state.failDay=2;
  await edit(page);
  await schedule(page).getByLabel(slotLabel(1,1,"end"),{exact:true}).fill("11:45");
  await schedule(page).getByLabel(slotLabel(2,1,"end"),{exact:true}).fill("11:45");
  await schedule(page).getByTestId("button-save-week").click();
  await page.getByRole("button",{name:"Confirm & Save",exact:true}).click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Partly saved");
  expect(state.writes).toHaveLength(2);
  state.failDay=undefined;
  await schedule(page).getByTestId("button-save-week").click();
  const confirmation=page.getByRole("dialog",{name:"Confirm Custom Schedule",exact:true});
  await expect(confirmation.locator("li")).toHaveCount(1);
  await expect(confirmation.locator("li")).toContainText("Tue");
  await confirmation.getByRole("button",{name:"Confirm & Save",exact:true}).click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Custom schedule saved");
  expect(state.writes.filter(w=>w.dayOfWeek===1)).toHaveLength(1);
  expect(state.writes.filter(w=>w.dayOfWeek===2)).toHaveLength(2);
  expect(state.writes[2].requestId).toBe(state.writes[1].requestId);
  expect(state.writes[2].expectedSnapshot).toBe(state.writes[1].expectedSnapshot);
});
test("schedule expansion only exposes genuinely additional settings",async({page})=>{
  await setup(page);await page.getByTestId("button-expand-s1").click();
  const facts=page.getByTestId("expansion-availability-s1");
  await expect(facts).toContainText("Queue Open Time");await expect(facts).toContainText("Queue Close Time");
  await expect(facts).not.toContainText("Queue Mode");await expect(facts).not.toContainText("Timezone");
  await expect(page.getByTestId("row-availability-s1")).toContainText("Appointments and walk-ins");
  for(const label of ["Start Time","End Time","Break Start","Max Tokens","Doctor"])await expect(facts).not.toContainText(label);
});
test("redundant-only rows have no chevron; hiding a column restores its useful summary",async({page})=>{
  await setup(page,"superAdmin",false);
  await expect(page.getByTestId("button-expand-s1")).toHaveCount(0);
  await page.getByRole("button",{name:/Columns/}).click();
  await page.getByLabel("Session hours",{exact:true}).uncheck();
  await page.keyboard.press("Escape");
  await page.getByTestId("button-expand-s1").click();
  await expect(page.getByTestId("expansion-availability-s1")).toContainText("Session");
  await expect(page.getByTestId("expansion-availability-s1")).not.toContainText("Start Time");
});
for(const resource of ["availability","exceptions"])for(const width of [1440,1280,1024,768,390]){
  test(`schedule list control geometry ${resource} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});await setup(page,"superAdmin",true,false,resource);
    const row=page.getByTestId(`row-${resource}-s1`);
    const bounds=await row.evaluate(el=>{
      const lead=el.querySelector(".row-expand-toggle")!.getBoundingClientRect();
      const cell=el.querySelector(".col-select")!.getBoundingClientRect();
      const next=el.children[1].getBoundingClientRect();
      return {leadRight:lead.right,cellRight:cell.right,nextLeft:next.left};
    });
    expect(bounds.leadRight).toBeLessThanOrEqual(bounds.cellRight);
    if(width>640)expect(bounds.leadRight).toBeLessThanOrEqual(bounds.nextLeft);
    await page.getByTestId("button-expand-s1").focus();await page.keyboard.press("Enter");
    await expect(page.getByTestId(`expansion-${resource}-s1`)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId(`expansion-${resource}-s1`)).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page.getByRole("button",{name:"Next page",exact:true})).toHaveCount(0);
    await expect(page.getByRole("navigation",{name:"Pagination"})).toContainText("of 1");
    await mkdir("generated-artifacts/schedule-readability",{recursive:true});
    await page.screenshot({path:`generated-artifacts/schedule-readability/${resource}-${width}.png`});
  });
}
test("schedule navigation remains for multiple pages and URL Back retains list state",async({page})=>{
  const state=await setup(page);
  state.extraRows=Array.from({length:24},(_,i)=>({...full,id:`s${i+2}`,dayOfWeek:(i+1)%7}));
  await page.reload();
  await expect(page.getByRole("navigation",{name:"Pagination"})).toContainText("of 25");
  await expect(page.getByRole("button",{name:"Next page",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Next page",exact:true}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("tbody>tr[data-testid]")).toHaveCount(5);
  await page.goBack();
  await expect(page.locator("tbody>tr[data-testid]")).toHaveCount(20);
  expect(new URL(page.url()).searchParams.has("sort")).toBe(false);
});
test("session queue differences stay visible without redundant disclosures",async({page})=>{
  const state=await setup(page);
  state.row={...full,queueOpenTime:"09:00",queueCloseTime:"12:00"};
  state.extraRows=[{...state.row,id:"s2",startTime:"13:00",endTime:"16:00",queueOpenTime:"13:00",queueCloseTime:"16:00",queueMode:"walkInsOnly"}];
  await page.reload();
  await expect(page.getByTestId("row-availability-s1")).toContainText("Appointments and walk-ins");
  await expect(page.getByTestId("row-availability-s2")).toContainText("Walk-ins only");
  await expect(page.getByTestId("button-expand-s1")).toHaveCount(0);
  await expect(page.getByTestId("button-expand-s2")).toHaveCount(0);
});
test("custom columns preserve pinned day, selection and actions during internal scrolling",async({page})=>{
  await setup(page);
  await page.getByRole("button",{name:/Columns/}).click();
  await page.getByLabel("Break",{exact:true}).uncheck();
  await page.getByRole("button",{name:"Pin Day as the one pinned column",exact:true}).click();
  await page.keyboard.press("Escape");
  for(const width of [1280,1024,768]){
    await page.setViewportSize({width,height:900});
    const table=page.locator(".schedule-list-table .table-scroll");
    await table.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
    const overlap=await page.getByTestId("row-availability-s1").evaluate(el=>{
      const select=el.querySelector(".col-select")!.getBoundingClientRect();
      const pinned=el.querySelector(".col-pinned")!.getBoundingClientRect();
      const expansion=el.querySelector(".row-expand-toggle")!.getBoundingClientRect();
      const action=el.querySelector(".col-actions")!.getBoundingClientRect();
      const container=el.closest(".table-scroll")!.getBoundingClientRect();
      return {selectRight:select.right,pinnedLeft:pinned.left,expandRight:expansion.right,actionRight:action.right,containerRight:container.right};
    });
    expect(overlap.expandRight).toBeLessThanOrEqual(overlap.selectRight);
    expect(overlap.pinnedLeft).toBeGreaterThanOrEqual(overlap.selectRight-1);
    expect(overlap.actionRight).toBeLessThanOrEqual(overlap.containerRight+1);
    await page.getByTestId("button-expand-s1").click();
    await expect(page.getByTestId("expansion-availability-s1")).toContainText("Break");
    await page.getByTestId("button-expand-s1").click();
  }
});
test.describe("200 percent layout zoom",()=>{
test.use({viewport:{width:720,height:500},deviceScaleFactor:2});
test("schedule list and editor fit at 200 percent layout zoom",async({page})=>{
  // Native 200% browser zoom halves the CSS viewport and doubles device pixels.
  // CSS zoom on <html> is NOT equivalent: it leaves vh-based dialogs twice as tall.
  await setup(page);
  const button=page.getByTestId("button-expand-s1");
  const next=await page.getByTestId("row-availability-s1").locator("td").nth(1).boundingBox();
  const control=await button.boundingBox();
  expect(control!.x+control!.width).toBeLessThanOrEqual(next!.x);
  await button.click();await expect(page.getByTestId("expansion-availability-s1")).toBeVisible();
  await edit(page);
  await day(schedule(page),1).getByText("Advanced settings",{exact:true}).click();
  expect(await schedule(page).evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  const body=schedule(page).locator(".app-dialog-body");
  await expect(body).toBeVisible();
  await schedule(page).getByLabel("Max tokens",{exact:true}).focus();
  await expect(schedule(page).getByLabel("Max tokens",{exact:true})).toBeFocused();
  await mkdir("generated-artifacts/schedule-readability",{recursive:true});
  await page.screenshot({path:"generated-artifacts/schedule-readability/zoom-200-editor.png"});
});
});
for(const [role,width] of [["superAdmin",1440],["clinicAdmin",1024],["clinicAdmin",768],["doctor",390]] as const){
  test(`schedule layout ${role} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});await setup(page,role);await edit(page);
    await mkdir("generated-artifacts/day-overrides",{recursive:true});
    for(const [name,d] of [["Mon",1],["Tue",2],["Sun",0]] as const){
      await day(schedule(page),d).scrollIntoViewIfNeeded();await expect(day(schedule(page),d)).toBeVisible();
      await expect(schedule(page).getByTestId("button-save-week")).toBeVisible();
      const bad=await page.getByRole("dialog",{name:"Edit Schedule"}).evaluate(root=>{
        const box=root.getBoundingClientRect();
        return [...root.querySelectorAll("input,button,.searchable-select-control")].filter(el=>el.getClientRects().length).filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<box.left-1||b.right>box.right+1);}).map(el=>el.outerHTML.slice(0,100));
      });
      expect(bad).toEqual([]);
      await page.screenshot({path:`generated-artifacts/day-overrides/availability-${role}-${width}-${name}.png`});
    }
  });
}

// All entry points mount the production context/editor, with HTTP-only fictional data.
async function openEntry(page:Page, entry:"page"|"doctor"|"dialog", role:string) {
  const state=await setup(page,role);
  state.extraRows.push({...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,maxTokens:23,tokenPrefix:"B",queueMode:"walkInsOnly",queueOpenTime:"13:30",queueCloseTime:"15:30"});
  if(entry==="dialog")await edit(page);
  else if(entry==="page")await page.goto(`/?mode=schedule&resource=availability&doctorId=d1&manage=1&fixtureRole=${role}`);
  else if(role==="doctor"){
    await page.goto("/doctor/availability?fixtureRole=doctor&clinicId=c1");
    await page.getByRole("button",{name:"Edit my weekly schedule",exact:true}).click();
  }
  else {
    await page.goto(`/?mode=staff&tab=doctors&fixtureRole=${role}`);
    await page.getByTestId("button-manage-schedule-d1").click();
  }
  const editor=entry==="dialog"
    ? page.getByRole("dialog",{name:"Edit Schedule",exact:true}).getByTestId("panel-weekly-editor")
    : page.getByTestId("panel-weekly-editor");
  // Dialog and its doctor context expose the same production fields in nested scopes.
  await expect(editor.getByLabel(slotLabel(1,2,"start"),{exact:true}).first()).toBeVisible();
  return {state,editor};
}
for(const role of ["superAdmin","clinicAdmin","doctor"])for(const entry of ["page","doctor","dialog"] as const) {
  test(`shared editor context and session ownership ${entry} ${role}`,async({page})=>{
    const {state,editor}=await openEntry(page,entry,role);
    const actions=await actionsFor(editor);
    const contextScope=entry==="dialog"?page.getByRole("dialog",{name:"Edit Schedule",exact:true})
      :entry==="doctor"&&role!=="doctor"?page.getByRole("dialog",{name:"Edit Doctor Schedule",exact:true})
      :page.getByRole("region",{name:"Doctor schedule"});
    await expect(contextScope.getByTestId("schedule-header")).toHaveCount(1);
    await expect(contextScope.getByTestId("schedule-header")).toContainText(group.name);
    await expect(contextScope.getByTestId("indicator-time-format")).toHaveCount(1);
    await expect(contextScope.getByTestId("indicator-time-format")).toContainText("24-hour");
    for(const d of [0,1,2,3,4,5,6])await expect(day(editor,d)).toHaveCount(1);
    await expect(editor.getByTestId("button-add-time-slot-1")).toHaveCount(1);
    await expect(actions.getByTestId("link-week-exceptions")).toHaveCount(1);
    await expect(actions.getByTestId("button-save-week")).toBeDisabled();
    const slots=day(editor,1).locator(".cde-slot");
    for(const [i,capacity] of [10,23].entries()){
      await slots.nth(i).locator("summary").click();
      await expect(slots.nth(i).getByLabel("Max tokens",{exact:true})).toHaveValue(String(capacity));
      await expect(slots.nth(i).locator("summary")).toContainText(`Slot ${i+1}`);
    }
    await slots.nth(1).getByLabel("Max tokens",{exact:true}).fill("24");
    await expect(slots.nth(0).getByLabel("Max tokens",{exact:true})).toHaveValue("10");
    await expect(actions.getByTestId("link-week-exceptions")).toBeDisabled();
    await actions.getByTestId("button-save-week").click();
    await expect.poll(()=>state.writes.length).toBe(1);
    expect(state.writes[0]).toMatchObject({maxTokens:24,tokenPrefix:"B",queueMode:"walkInsOnly",queueCloseTime:"15:30"});
  });
}
for(const entry of ["page","doctor","dialog"] as const)for(const [width,height] of [[390,844],[768,900],[1024,640],[1366,768],[1920,1080],[512,320]]){
  test(`shared editor bounds and keyboard ${entry} ${width}`,async({page})=>{
    await page.setViewportSize({width,height});
    const {editor}=await openEntry(page,entry,"superAdmin");
    await page.evaluate(()=>document.fonts.ready);
    const controls=await editor.evaluate(root=>[...root.querySelectorAll("[data-day-row]")].map(row=>{
      const r=row.getBoundingClientRect();return {day:row.getAttribute("data-day-row"),top:r.top,height:r.height};
    }));
    // All seven days render in Monday-Sunday order, stacked without overlap.
    expect(controls.map(c=>c.day)).toEqual(["1","2","3","4","5","6","0"]);
    for(let i=1;i<controls.length;i++)expect(controls[i].top).toBeGreaterThanOrEqual(controls[i-1].top+controls[i-1].height-1);
    await editor.getByTestId("select-copy-from-1").click();
    const menu=page.getByRole("listbox");
    await expect(menu).toBeVisible();
    const popup=await menu.boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(0);
    expect(popup!.x+popup!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await editor.locator(".cde-adv summary").first().click();
    const bad=await editor.evaluate(root=>{
      const b=root.getBoundingClientRect();
      return [...root.querySelectorAll("input,button,summary")].filter(el=>el.getClientRects().length).filter(el=>{
        const r=el.getBoundingClientRect();return r.width>0&&(r.left<b.left-1||r.right>b.right+1);
      }).map(el=>el.outerHTML.slice(0,100));
    });
    expect(bad).toEqual([]);
    const textOverflow=await editor.evaluate(root=>{
      const bounds=root.getBoundingClientRect();
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      const bad:string[]=[];
      let node:Node|null;
      while((node=walker.nextNode())){
        const parent=node.parentElement!;
        if(!node.textContent?.trim()||parent.closest('.sr-only,.sr-only-helptip,[hidden],details:not([open]) .form-grid')||!parent.getClientRects().length)continue;
        const range=document.createRange();range.selectNodeContents(node);
        for(const r of range.getClientRects())if(r.width&&(r.left<bounds.left-1||r.right>bounds.right+1))bad.push(node.textContent!.trim());
      }
      return bad;
    });
    expect(textOverflow).toEqual([]);
    const session=await day(editor,1).locator(".cde-slot").first().evaluate(slot=>{
      const start=slot.querySelector('[data-field="startTime"] input')!.getBoundingClientRect();
      const end=slot.querySelector('[data-field="endTime"] input')!.getBoundingClientRect();
      const arrow=slot.querySelector('.cde-arrow')!.getBoundingClientRect();
      return {start:{x:start.x,right:start.right,width:start.width,height:start.height},end:{x:end.x,width:end.width},arrowX:arrow.x,container:slot.closest(".cde")!.clientWidth};
    });
    if(session.container>640){
      // Start and end share one line, separated horizontally by the arrow.
      expect(Math.abs(session.start.width-session.end.width)).toBeLessThanOrEqual(1);
      expect(session.arrowX).toBeGreaterThanOrEqual(session.start.right-1);
      expect(session.end.x).toBeGreaterThan(session.arrowX);
    }
    expect(session.start.height).toBeGreaterThanOrEqual(width<640?44:40);
    const capacity=editor.getByLabel("Max tokens",{exact:true}).first();
    await capacity.focus();await expect(capacity).toBeFocused();
    const actions=await actionsFor(editor);
    const actionBoxes=await actions.evaluate(root=>[...root.querySelectorAll('button')].map(button=>{
      const r=button.getBoundingClientRect();return {text:button.textContent,width:r.width,height:r.height};
    }));
    // Read actual action/text geometry: a page can have no overflow while Cancel collapses vertically.
    for(const box of actionBoxes){
      expect(box.width,`${box.text} action width`).toBeGreaterThanOrEqual(80);
      expect(box.height,`${box.text} action height`).toBeLessThanOrEqual(64);
    }
    expect(await page.locator(".cde-footer").evaluate(el=>getComputedStyle(el).position)).toBe("sticky");
    // Footer stays reachable after scrolling to the last day (Sunday).
    await day(editor,0).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("button-save-week")).toBeInViewport();
    const dialog=page.getByRole("dialog").first();
    if(await dialog.count()){
      const footer=page.locator(".cde-footer");
      await expect(page.getByTestId("button-save-week")).toBeInViewport();
      const bodyBox=await dialog.locator(".app-dialog-body").first().boundingBox();
      const footerBox=await footer.boundingBox();
      if(!await footer.evaluate(el=>!!el.closest(".app-dialog-body")))expect(bodyBox!.y+bodyBox!.height).toBeLessThanOrEqual(footerBox!.y+1);
      await editor.locator(".cde-adv").last().evaluate((el:HTMLDetailsElement)=>{el.open=true;});
      const lastInput=editor.locator(".cde-adv").last().locator("input").last();
      await lastInput.focus();
      await expect(lastInput).toBeFocused();
      const fieldBox=await lastInput.boundingBox();
      expect(fieldBox!.y+fieldBox!.height).toBeLessThanOrEqual(footerBox!.y);
      expect(fieldBox!.y).toBeGreaterThanOrEqual(bodyBox!.y);
    } else {
      expect(await page.locator(".cde-footer").evaluate(el=>!!el.closest(".app-dialog-actions-host"))).toBe(false);
    }
    await mkdir("generated-artifacts/shared-schedule",{recursive:true});
    await writeFile(`generated-artifacts/shared-schedule/${entry}-${width}.json`,JSON.stringify({viewport:{width,height},controls,session,textOverflow,actionBoxes},null,2));
    await page.screenshot({path:`generated-artifacts/shared-schedule/${entry}-${width}.png`});
  });
}
for(const entry of ["page","doctor","dialog"] as const)test(`shared editor effective 200 percent viewport ${entry}`,async({page})=>{
  // A 720px CSS viewport models the 1440px layout at native 200% browser zoom.
  await page.setViewportSize({width:720,height:500});
  const {editor,state}=await openEntry(page,entry,"superAdmin");
  await editor.locator(".cde-adv summary").first().click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  const capacity=editor.getByLabel("Max tokens",{exact:true}).first();
  await capacity.focus();await expect(capacity).toBeFocused();
  await mkdir("generated-artifacts/shared-schedule",{recursive:true});
  await page.screenshot({path:`generated-artifacts/shared-schedule/${entry}-zoom-200.png`});
  console.log(`${entry} console errors`,state.consoleErrors,state.pageErrors);
});
test("per-day outside-hours warning follows slot numbers without hiding different warnings",async({page})=>{
  const state=await setup(page);
  state.row={...full,startTime:"08:00",endTime:"08:30",breakStart:null,breakEnd:null,queueOpenTime:null,queueCloseTime:null};
  state.extraRows=Array.from({length:4},(_,i)=>({...state.row,id:`extra-${i}`,startTime:`${18+i}:00`,endTime:`${18+i}:30`}));
  await edit(page);
  const mon=day(schedule(page),1);
  const warning=mon.getByTestId("text-outside-hours-1");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("Slots 1, 2, 3, 4, 5:");
  // The unrelated session-count warning stays visible and separate.
  await expect(mon.locator(".notice:not([data-testid^='text-outside-hours'])")).toBeVisible();
  await mon.getByRole("button",{name:"Remove Monday slot 1",exact:true}).click();
  await expect(warning).toContainText("Slots 1, 2, 3, 4:");
  await mon.getByLabel(slotLabel(1,1,"start"),{exact:true}).fill("09:00");
  await mon.getByLabel(slotLabel(1,1,"end"),{exact:true}).fill("10:00");
  await expect(warning).toContainText("Slots 2, 3, 4:");
  await expect(schedule(page).getByTestId("text-outside-hours-2")).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
});
test("inherited clinic slot remains locked in shared editor",async({page})=>{
  const state=await setup(page,"superAdmin",true,true,"availability","receptionist");await edit(page);
  const editor=page.getByTestId("panel-weekly-editor");
  await expect(editor.getByTestId("text-day-source-1")).toContainText("Following clinic hours");
  await expect(editor.getByLabel(slotLabel(1,1,"start"),{exact:true})).toBeDisabled();
  await expect(editor.getByLabel(slotLabel(1,1,"end"),{exact:true})).toBeDisabled();
  await expect(editor.getByTestId("toggle-working-day-1")).toBeDisabled();
  await expect(editor.getByTestId("select-copy-from-1")).toBeDisabled();
  await expect(day(editor,1).getByText("These sessions follow clinic hours.",{exact:false})).toBeVisible();
  expect(state.writes).toHaveLength(0);
  console.log("inherited-slot console errors",state.consoleErrors,state.pageErrors);
});
test("empty schedule has blank defaults and a clear off-day state",async({page})=>{
  const state=await setup(page);
  state.row.status="inactive";state.extraRows=[];
  await page.goto("/?mode=schedule&resource=availability&doctorId=d1&manage=1&fixtureRole=superAdmin");
  const editor=page.getByTestId("panel-weekly-editor");
  await expect(editor.getByTestId("toggle-working-day-2")).not.toBeChecked();
  await expect(editor.getByTestId("text-day-off-2")).toContainText("No slots");
  await expect(editor.getByTestId("fieldset-session-defaults")).toHaveCount(0);
  await expect(editor.locator(".cde-slot")).toHaveCount(0);
  await editor.getByTestId("toggle-working-day-2").check();
  await expect(day(editor,2).locator(".cde-slot")).toHaveCount(1);
  await expect(editor.getByTestId("fieldset-session-defaults")).toBeVisible();
  await expect(editor.getByTestId("input-default-token-prefix")).toHaveValue("");
  await expect(editor.getByTestId("input-default-max-tokens")).toHaveValue("");
  expect(state.writes).toHaveLength(0);
  console.log("empty-schedule console errors",state.consoleErrors,state.pageErrors);
});
test("long unbroken context and unconfigured hours wrap without losing actions",async({page})=>{
  await page.setViewportSize({width:768,height:640});
  await setup(page);
  await page.route("**/api/clinics/c1",route=>route.fulfill({json:{...group,name:"FictionalClinic".repeat(12)}}));
  await page.route("**/api/branches/b1",route=>route.fulfill({json:{...clinic,name:"FictionalLocation".repeat(12),openingHours:null}}));
  await page.route("**/api/doctors/d1",route=>route.fulfill({json:{...doctor,fullName:"FictionalDoctor".repeat(12)}}));
  await page.reload();await edit(page);
  await expect(schedule(page).getByTestId("text-day-source-1")).toContainText("Hours not configured");
  await expect(schedule(page).locator("[data-testid^='text-outside-hours']")).toHaveCount(0);
  const bad=await schedule(page).getByTestId("schedule-header").evaluate(header=>{
    const b=header.getBoundingClientRect();
    return [...header.querySelectorAll(".dsc-id strong,.dsc-context strong")].filter(el=>{
      const range=document.createRange();range.selectNodeContents(el);
      return [...range.getClientRects()].some(r=>r.left<b.left-1||r.right>b.right+1);
    }).map(el=>el.textContent);
  });
  expect(bad).toEqual([]);
  await expect(schedule(page).getByTestId("button-save-week")).toBeInViewport();
});
for(const entry of ["page","doctor","dialog"] as const)test(`shared date exception flow ${entry}`,async({page})=>{
  const {editor,state}=await openEntry(page,entry,"superAdmin");
  const opener=(await actionsFor(editor)).getByTestId("link-week-exceptions");
  await opener.focus();await opener.click();
  const list=page.getByRole("dialog",{name:"Date Exceptions",exact:true});
  await expect(list.getByText("Holiday hours")).toBeVisible();
  await list.getByRole("button",{name:"Add Date Exception",exact:true}).click();
  const form=page.getByRole("dialog",{name:"Add Date Exception",exact:true});
  await expect(form).toBeVisible();
  await form.getByLabel("Reason",{exact:false}).fill("Fictional closure");
  await form.getByTestId("button-dialog-close").click();
  const confirm=page.getByTestId("discard-confirm");
  await expect(confirm).toHaveCount(1);
  await expect(page.getByTestId("button-keep-editing")).toBeFocused();
  await page.getByTestId("button-keep-editing").click();
  await expect(form.getByLabel("Reason",{exact:false})).toHaveValue("Fictional closure");
  await expect(form.getByTestId("button-dialog-close")).toBeFocused();
  await form.getByTestId("button-dialog-close").click();
  await expect(confirm).toHaveCount(1);
  await page.getByTestId("button-discard-changes").click();
  await expect(form).toHaveCount(0);
  await expect(list).toBeVisible();
  await expect(list.getByRole("button",{name:"Add Date Exception",exact:true})).toBeFocused();
  expect(state.writes).toHaveLength(0);
  console.log(`exception ${entry} console errors`,state.consoleErrors,state.pageErrors);
});

test("legacy mixed week duration needs explicit confirmation; cancel keeps values",async({page})=>{
  const state=await setup(page);
  state.extraRows=[{...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,consultationMinutes:45}];
  await edit(page);
  const ed=schedule(page);
  await expect(ed.getByTestId("text-duration-mixed")).toContainText("20, 45");
  // Unrelated edits leave mixed records unchanged.
  await day(ed,1).getByText("Advanced settings",{exact:true}).first().click();
  await day(ed,1).getByLabel("Max tokens",{exact:true}).first().fill("11");
  await pick(page,ed,"select-duration-1","30 minutes");
  const confirm=page.getByRole("dialog",{name:"Use 30 minutes for the whole week?",exact:true});
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(ed.getByTestId("text-duration-mixed")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await pick(page,ed,"select-duration-1","30 minutes");
  await confirm.getByRole("button",{name:"Apply to Week",exact:true}).click();
  await expect(ed.getByTestId("text-duration-mixed")).toHaveCount(0);
  await ed.getByTestId("button-save-week").click();
  await page.getByRole("dialog",{name:"Change Consultation Duration?",exact:true}).getByRole("button",{name:"Save Schedule",exact:true}).click();
  await expect(ed.getByTestId("status-week-save")).toContainText("Saved");
  expect(state.writes.map(w=>w.consultationMinutes)).toEqual([30,30]);
  expect(state.writes[0]).toMatchObject({maxTokens:11,breakStart:"10:00"});
});
test("unrelated edit of a mixed week saves without touching durations",async({page})=>{
  const state=await setup(page);
  state.extraRows=[{...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,consultationMinutes:45}];
  await edit(page);
  await schedule(page).getByLabel(slotLabel(1,2,"end"),{exact:true}).fill("16:30");
  await schedule(page).getByTestId("button-save-week").click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Saved");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({endTime:"16:30",consultationMinutes:45});
});
test("mixed durations block copying until a common duration is chosen",async({page})=>{
  const state=await setup(page);
  state.extraRows=[{...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,consultationMinutes:45}];
  await edit(page);
  const ed=schedule(page);
  await pick(page,ed,"select-copy-from-3","Monday");
  await expect(ed.getByTestId("copy-from-panel-3")).toContainText("Choose one consultation duration");
  await expect(ed.getByTestId("button-copy-from-apply-3")).toBeDisabled();
  await expect(ed.getByTestId("toggle-working-day-3")).not.toBeChecked();
  expect(state.writes).toHaveLength(0);
});
test("per-day copy from: cancel panel, cancel confirmation, copy entire day and one slot",async({page})=>{
  const state=await setup(page);
  state.extraRows=[{...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null}];
  await edit(page);
  const ed=schedule(page);
  await pick(page,ed,"select-copy-from-3","Monday");
  await ed.getByTestId("button-copy-cancel-3").click();
  await expect(ed.getByTestId("copy-from-panel-3")).toHaveCount(0);
  await pick(page,ed,"select-copy-from-3","Monday");
  await ed.getByTestId("button-copy-from-apply-3").click();
  const confirm=page.getByRole("dialog",{name:"Copy Monday to Wednesday?",exact:true});
  await confirm.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(ed.getByTestId("toggle-working-day-3")).not.toBeChecked();
  await ed.getByTestId("button-copy-from-apply-3").click();
  await confirm.getByRole("button",{name:"Copy Day",exact:true}).click();
  await expect(ed.getByTestId("toggle-working-day-3")).toBeChecked();
  await expect(day(ed,3).getByLabel(slotLabel(3,2,"end"),{exact:true})).toHaveValue("16:00");
  await expect(day(ed,1).locator(".cde-slot")).toHaveCount(2);
  // One-slot copy appends to Friday.
  await pick(page,ed,"select-copy-from-5","Monday");
  const panel=ed.getByTestId("copy-from-panel-5");
  await panel.getByRole("button",{name:"Copy: Entire day",exact:true}).click();
  await page.getByRole("option",{name:"One time slot",exact:true}).click();
  await panel.getByRole("button",{name:"Source slot",exact:true}).click();
  await page.getByRole("option",{name:"14:00 – 16:00",exact:true}).click();
  await ed.getByTestId("button-copy-from-apply-5").click();
  await page.getByRole("dialog",{name:"Add Copied Slot?",exact:true}).getByRole("button",{name:"Add Slot",exact:true}).click();
  await expect(day(ed,5).locator(".cde-slot")).toHaveCount(1);
  await expect(day(ed,5).getByLabel(slotLabel(5,1,"start"),{exact:true})).toHaveValue("14:00");
  expect(state.writes).toHaveLength(0);
  await ed.getByTestId("button-save-week").click();
  await page.getByRole("dialog",{name:"Doctor Hours Beyond Clinic Hours",exact:true}).getByTestId("button-outside-submit").click();
  await expect(ed.getByTestId("status-week-save")).toContainText("Saved");
  expect(state.writes.filter(w=>w.dayOfWeek===3)).toHaveLength(2);
  expect(state.writes.filter(w=>w.dayOfWeek===3||w.dayOfWeek===5).every(w=>w.consultationMinutes===20)).toBe(true);
});
