import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const group={id:"c1",name:"Fictional Clinic Group with a long saved name for schedule editing",status:"active",timezone:"Asia/Kolkata",timeFormat:"24h"};
const clinic={id:"b1",clinicId:"c1",name:"Fictional Clinic with a long saved location name",status:"active",timezone:"Asia/Kolkata",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"17:00"}]};
const doctor={id:"d1",fullName:"Fictional Doctor with a long saved name",status:"active",clinicIds:["c1"],branchIds:["b1"]};
const summary={id:"s1",doctorId:"d1",clinicId:"c1",branchId:"b1",doctorName:doctor.fullName,branchName:clinic.name,dayOfWeek:1,isOpen:true,startTime:"09:00",endTime:"12:00",breakStart:"10:00",breakEnd:"10:15",tokenPrefix:"A",maxTokens:10,consultationMinutes:20,bufferMinutes:5};
const full={...summary,timezone:"Asia/Kolkata",queueMode:"mixed",queueOpenTime:"08:30",queueCloseTime:"11:30"};
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
      } else {state.row={...state.row,...body};reply=state.row;}
    }
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(reply)});
  });
  await page.goto(`/?mode=resource&resource=${resource}&fixtureRole=${role}`);
  await expect(page.getByTestId(`row-${resource}-s1`)).toBeVisible();
  return state;
}
const tab=(page:Page,name:string)=>page.getByTestId(`tab-editor-${name.toLowerCase().replace(/[^a-z]+/g,"-")}`);
const schedule=(page:Page)=>page.getByRole("dialog",{name:"Edit Schedule",exact:true});
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
  await expect(schedule(page).getByRole("tab",{name:"Mon",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(schedule(page).getByRole("tabpanel")).toHaveCount(1);
  await schedule(page).getByRole("tab",{name:"Mon",exact:true}).focus();await page.keyboard.press("ArrowRight");
  await expect(schedule(page).getByRole("tab",{name:"Tue",exact:true})).toBeFocused();
  await schedule(page).getByRole("tab",{name:"Mon",exact:true}).click();
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();
  await schedule(page).getByLabel("Max tokens",{exact:true}).fill("14");
  await schedule(page).getByLabel("Queue closes",{exact:true}).fill("11:45");
  await schedule(page).getByRole("tab",{name:"Tue",exact:true}).click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await schedule(page).getByTestId("button-save-week").click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Saved");
  expect(state.writes[0]).toMatchObject({maxTokens:14,queueCloseTime:"11:45",breakStart:"10:00",consultationMinutes:20});
  await schedule(page).getByTestId("button-dialog-close").click();await edit(page);
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();
  await expect(schedule(page).getByLabel("Max tokens",{exact:true})).toHaveValue("14");
  await expect(schedule(page).getByLabel("Queue closes",{exact:true})).toHaveValue("11:45");
});
test("save reveals invalid settings on hidden days and makes no writes",async({page})=>{
  const state=await setup(page);await edit(page);
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();
  for(const [field,value,reset] of [["Max tokens","0","10"],["Break end","","10:15"],["Queue closes","13:00","11:30"],["Queue closes","25:90","11:30"]]){
    await schedule(page).getByLabel(field,{exact:true}).fill(value);
    await schedule(page).getByRole("tab",{name:"Tue",exact:true}).click();
    await schedule(page).getByTestId("button-save-week").click();
    await expect(schedule(page).getByRole("tab",{name:/^Mon(?: has errors)?$/})).toHaveAttribute("aria-selected","true");
    await expect(schedule(page).locator(".field-error").first()).toBeVisible();
    await schedule(page).getByLabel(field,{exact:true}).fill(reset);
  }
  expect(state.writes).toHaveLength(0);
});
test("failed save retains the draft; Cancel and Escape share one discard prompt",async({page})=>{
  const state=await setup(page);state.fail=true;await edit(page);
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();await schedule(page).getByLabel("Max tokens",{exact:true}).fill("15");
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
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();await schedule(page).getByLabel("Max tokens",{exact:true}).fill("12");
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
test("Add Schedule uses the same panels and one creation boundary",async({page})=>{
  const state=await setup(page);
  await page.getByTestId("button-add-availability").click();
  await expect(page.getByRole("dialog",{name:"Add Schedule"})).toBeVisible();
  await expect(tab(page,"Schedule")).toHaveAttribute("aria-selected","true");
  await page.locator("#input-dayOfWeek").click();await page.getByRole("option",{name:"Monday",exact:true}).click();
  await page.getByTestId("input-isOpen").check();
  await tab(page,"Timing & Break").click();await time(page,"startTime","13:00");await time(page,"endTime","15:00");
  await tab(page,"Capacity").click();
  await page.getByTestId("input-tokenPrefix").fill("N");await page.locator('[name="maxTokens"]').fill("10");
  await page.locator("#input-consultationMinutes").click();await page.getByRole("option",{name:"20 minutes",exact:true}).click();
  await tab(page,"Queue Settings").click();await page.getByTestId("button-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({doctorId:"d1",clinicId:"c1",branchId:"b1",startTime:"13:00",endTime:"15:00",consultationMinutes:20});
});
for(const role of ["superAdmin","clinicAdmin","doctor"] as const) test(`linked-day confirmation cancellation, multiple intervals, save and reload for ${role}`,async({page})=>{
  const state=await setup(page,role,true,true);
  state.extraRows.push({...full,id:"s2",startTime:"14:00",endTime:"16:00",breakStart:null,breakEnd:null,linkedBranchId:"b1"});
  await edit(page);
  await expect(schedule(page).getByTestId("text-day-source")).toContainText("Following clinic hours");
  await expect(schedule(page).getByTestId("text-day-source")).toContainText("09:00–17:00");
  await schedule(page).getByLabel("Slot 1 end time",{exact:true}).fill("11:45");
  await schedule(page).getByTestId("button-save-week").click();
  const confirm=page.getByRole("dialog",{name:"Confirm Custom Schedule",exact:true});
  await expect(confirm).toContainText(doctor.fullName);
  await expect(confirm).toContainText("Clinic hours and other days are unchanged");
  await expect(confirm).toContainText("14:00–16:00");
  expect(state.writes).toHaveLength(0);
  await confirm.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(schedule(page).getByLabel("Slot 1 end time",{exact:true})).toHaveValue("11:45");
  expect(state.writes).toHaveLength(0);
  await schedule(page).getByTestId("button-save-week").click();
  await confirm.getByRole("button",{name:"Confirm & Save",exact:true}).click();
  await expect(schedule(page).getByTestId("status-week-save")).toContainText("Custom schedule saved");
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({doctorId:"d1",branchId:"b1",dayOfWeek:1,confirmed:true});
  expect(state.writes[0].sessions).toHaveLength(2);
  expect([state.row,...state.extraRows].every(r=>!r.linkedBranchId)).toBe(true);
  await page.reload();await edit(page);
  await expect(schedule(page).getByTestId("text-day-source")).toContainText("Custom schedule");
  await expect(schedule(page).getByLabel("Slot 1 end time",{exact:true})).toHaveValue("11:45");
});
test("custom day off persists with no inherited interval left active",async({page})=>{
  const state=await setup(page,"doctor",true,true);await edit(page);
  await schedule(page).getByTestId("toggle-working-day").uncheck();
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
  await schedule(page).getByRole("tab",{name:"Mon",exact:true}).click();
  await expect(schedule(page).getByTestId("toggle-working-day")).not.toBeChecked();
  await expect(schedule(page).getByTestId("text-day-source")).toContainText("Custom schedule");
});
test("uncertain linked-day failure retains draft and reuses save identifier on retry",async({page})=>{
  const state=await setup(page,"superAdmin",true,true);state.fail=true;await edit(page);
  await schedule(page).getByLabel("Slot 1 end time",{exact:true}).fill("11:45");
  for(let attempt=0;attempt<2;attempt++){
    await schedule(page).getByTestId("button-save-week").click();
    await page.getByRole("button",{name:"Confirm & Save",exact:true}).click();
    await expect(schedule(page).getByTestId("status-week-save")).toContainText("not confirmed saved");
  }
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0].requestId).toBe(state.writes[1].requestId);
  await expect(schedule(page).getByLabel("Slot 1 end time",{exact:true})).toHaveValue("11:45");
});
test("partial linked-day save retries only the failed day with its original baseline and request id",async({page})=>{
  const state=await setup(page,"superAdmin",true,true);
  state.extraRows.push({...full,id:"s2",dayOfWeek:2,linkedBranchId:"b1"});
  state.clinicHours.push({dayOfWeek:2,startTime:"09:00",endTime:"17:00"});
  state.failDay=2;
  await edit(page);
  await schedule(page).getByLabel("Slot 1 end time",{exact:true}).fill("11:45");
  await schedule(page).getByRole("tab",{name:"Tue",exact:true}).click();
  await schedule(page).getByLabel("Slot 1 end time",{exact:true}).fill("11:45");
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
  await schedule(page).getByText("Capacity, breaks and queue settings",{exact:true}).click();
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
    for(const name of ["Mon","Tue","Sun"]){
      await schedule(page).getByRole("tab",{name,exact:true}).click();await expect(schedule(page).getByTestId("button-save-week")).toBeVisible();
      const bad=await page.getByRole("dialog",{name:"Edit Schedule"}).evaluate(root=>{
        const box=root.getBoundingClientRect();
        return [...root.querySelectorAll("input,button,[role=tab],.searchable-select-control")].filter(el=>el.getClientRects().length).filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<box.left-1||b.right>box.right+1);}).map(el=>el.outerHTML.slice(0,100));
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
  else if(entry==="page")await page.goto(`/?mode=schedule&resource=availability&doctorId=d1&fixtureRole=${role}`);
  else if(role==="doctor")await page.goto("/doctor/availability?fixtureRole=doctor&clinicId=c1");
  else {
    await page.goto(`/?mode=staff&tab=doctors&fixtureRole=${role}`);
    await page.getByTestId("button-manage-schedule-d1").click();
  }
  const editor=entry==="dialog"
    ? page.getByRole("dialog",{name:"Edit Schedule",exact:true}).getByTestId("panel-weekly-editor")
    : page.getByTestId("panel-weekly-editor");
  // Dialog and its doctor context expose the same production fields in nested scopes.
  await expect(editor.getByLabel("Slot 2 start time").first()).toBeVisible();
  return {state,editor};
}
for(const role of ["superAdmin","clinicAdmin","doctor"])for(const entry of ["page","doctor","dialog"] as const) {
  test(`shared editor context and session ownership ${entry} ${role}`,async({page})=>{
    const {state,editor}=await openEntry(page,entry,role);
    const contextScope=entry==="dialog"?page.getByRole("dialog",{name:"Edit Schedule",exact:true})
      :entry==="doctor"&&role!=="doctor"?page.getByRole("dialog",{name:"Edit Doctor Schedule",exact:true})
      :page.getByRole("region",{name:"Doctor schedule"});
    await expect(contextScope.getByTestId("schedule-header")).toHaveCount(1);
    await expect(contextScope.getByTestId("schedule-header")).toContainText(group.name);
    await expect(contextScope.getByTestId("indicator-time-format")).toHaveCount(1);
    await expect(contextScope.getByTestId("indicator-time-format")).toContainText("24-hour");
    await expect(editor.getByTestId("button-add-time-slot")).toHaveCount(1);
    await expect(editor.getByTestId("link-week-exceptions")).toHaveCount(1);
    await expect(editor.getByTestId("button-save-week")).toBeDisabled();
    const slots=editor.locator(".cde-row:not(.cde-head)");
    for(const [i,capacity] of [10,23].entries()){
      await slots.nth(i).locator("summary").click();
      await expect(slots.nth(i).getByLabel("Max tokens",{exact:true})).toHaveValue(String(capacity));
      await expect(slots.nth(i).locator("summary")).toContainText(`Slot ${i+1}`);
    }
    await slots.nth(1).getByLabel("Max tokens",{exact:true}).fill("24");
    await expect(slots.nth(0).getByLabel("Max tokens",{exact:true})).toHaveValue("10");
    await expect(editor.getByTestId("link-week-exceptions")).toBeDisabled();
    await editor.getByRole("tab",{name:"Tue",exact:true}).click();
    await editor.getByTestId("button-save-week").click();
    await expect.poll(()=>state.writes.length).toBe(1);
    expect(state.writes[0]).toMatchObject({maxTokens:24,tokenPrefix:"B",queueMode:"walkInsOnly",queueCloseTime:"15:30"});
  });
}
for(const entry of ["page","doctor","dialog"] as const)for(const width of [1440,1280,1024,768,390]){
  test(`shared editor bounds and keyboard ${entry} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const {editor}=await openEntry(page,entry,"superAdmin");
    await editor.locator(".cde-adv summary").first().click();
    const bad=await editor.evaluate(root=>{
      const b=root.getBoundingClientRect();
      return [...root.querySelectorAll("input,button,summary")].filter(el=>el.getClientRects().length).filter(el=>{
        const r=el.getBoundingClientRect();return r.width>0&&(r.left<b.left-1||r.right>b.right+1);
      }).map(el=>el.outerHTML.slice(0,100));
    });
    expect(bad).toEqual([]);
    const capacity=editor.getByLabel("Max tokens",{exact:true}).first();
    await capacity.focus();await expect(capacity).toBeFocused();
    expect(await editor.locator(".cde-footer").evaluate(el=>getComputedStyle(el).position)).toBe("static");
    await mkdir("generated-artifacts/shared-schedule",{recursive:true});
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
test("inherited clinic slot remains locked in shared editor",async({page})=>{
  const state=await setup(page,"superAdmin",true,true,"availability","receptionist");await edit(page);
  const editor=page.getByTestId("panel-weekly-editor");
  await expect(editor.getByTestId("text-day-source")).toContainText("Following clinic hours");
  await expect(editor.getByLabel("Slot 1 start time",{exact:true})).toBeDisabled();
  await expect(editor.getByLabel("Slot 1 end time",{exact:true})).toBeDisabled();
  await expect(editor.getByTestId("toggle-working-day")).toBeDisabled();
  await expect(editor.getByText("These sessions follow clinic hours.",{exact:false})).toBeVisible();
  expect(state.writes).toHaveLength(0);
  console.log("inherited-slot console errors",state.consoleErrors,state.pageErrors);
});
test("empty schedule has blank defaults and a clear off-day state",async({page})=>{
  const state=await setup(page);
  state.row.status="inactive";state.extraRows=[];
  await page.goto("/?mode=schedule&resource=availability&doctorId=d1&fixtureRole=superAdmin");
  const editor=page.getByTestId("panel-weekly-editor");
  await editor.getByRole("tab",{name:"Tue",exact:true}).click();
  await expect(editor.getByTestId("toggle-working-day")).not.toBeChecked();
  await expect(editor.getByTestId("text-day-off")).toContainText("Not a working day");
  await expect(editor.getByTestId("fieldset-session-defaults")).toHaveCount(0);
  await expect(editor.locator(".cde-row:not(.cde-head)")).toHaveCount(0);
  await editor.getByTestId("button-add-time-slot").click();
  await expect(editor.getByTestId("fieldset-session-defaults")).toBeVisible();
  await expect(editor.getByTestId("input-default-token-prefix")).toHaveValue("");
  await expect(editor.getByTestId("input-default-max-tokens")).toHaveValue("");
  expect(state.writes).toHaveLength(0);
  console.log("empty-schedule console errors",state.consoleErrors,state.pageErrors);
});
for(const entry of ["page","doctor","dialog"] as const)test(`shared date exception flow ${entry}`,async({page})=>{
  const {editor,state}=await openEntry(page,entry,"superAdmin");
  const opener=editor.getByTestId("link-week-exceptions");
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
