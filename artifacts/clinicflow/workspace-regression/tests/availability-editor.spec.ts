import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const group={id:"c1",name:"Fictional Clinic Group with a long saved name for schedule editing",status:"active",timezone:"Asia/Kolkata",timeFormat:"24h"};
const clinic={id:"b1",clinicId:"c1",name:"Fictional Clinic with a long saved location name",status:"active",timezone:"Asia/Kolkata",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"17:00"}]};
const doctor={id:"d1",fullName:"Fictional Doctor with a long saved name",status:"active",clinicIds:["c1"],branchIds:["b1"]};
const summary={id:"s1",doctorId:"d1",clinicId:"c1",branchId:"b1",doctorName:doctor.fullName,branchName:clinic.name,dayOfWeek:1,isOpen:true,startTime:"09:00",endTime:"12:00",breakStart:"10:00",breakEnd:"10:15",tokenPrefix:"A",maxTokens:10,consultationMinutes:20,bufferMinutes:5};
const full={...summary,timezone:"Asia/Kolkata",queueMode:"mixed",queueOpenTime:"08:30",queueCloseTime:"11:30"};
const list=(items:unknown[])=>({items,total:items.length,page:1,pageSize:20,totalPages:1});
async function setup(page:Page, role="superAdmin", extra=true) {
  const state={row:{...(extra?full:summary)} as Record<string,any>,writes:[] as Record<string,any>[],fail:false,pause:undefined as Promise<void>|undefined};
  await page.route(/https:\/\/fonts\./,r=>r.abort());
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let reply:any=list([]),status=200;
    if(path==="/api/auth/csrf")reply={csrfToken:"fixture-csrf-token"};
    else if(path==="/api/me")reply={userId:"fixture-admin",user:{id:"fixture-admin",role,fullName:"Fictional Actor",clinicIds:["c1"],branchIds:["b1"]},...(role==="doctor"?{doctorId:"d1"}:{}),needsOnboarding:false};
    else if(path==="/api/settings")reply={timezone:"Asia/Kolkata",timeFormat:"24h",dateFormat:"YYYY-MM-DD"};
    else if(path==="/api/clinics/c1")reply=group;
    else if(path==="/api/branches/b1")reply=clinic;
    else if(path==="/api/doctors/d1")reply=doctor;
    else if(path==="/api/clinics")reply=list([group]);
    else if(path==="/api/branches")reply=list([clinic]);
    else if(path==="/api/doctors")reply=list([doctor]);
    else if(path==="/api/schedules"&&req.method()==="GET")reply=list([state.row]);
    else if(path.startsWith("/api/schedules")&&["POST","PATCH"].includes(req.method())){
      const body=req.postDataJSON();state.writes.push(body);
      if(state.pause)await state.pause;
      if(state.fail){status=409;reply={message:"Schedule changed. Reload before saving."};}
      else {state.row={...state.row,...body};reply=state.row;}
    }
    await route.fulfill({status,contentType:"application/json",body:JSON.stringify(reply)});
  });
  await page.goto(`/?mode=resource&resource=availability&fixtureRole=${role}`);
  await expect(page.getByTestId("row-availability-s1")).toBeVisible();
  return state;
}
const tab=(page:Page,name:string)=>page.getByTestId(`tab-editor-${name.toLowerCase().replace(/[^a-z]+/g,"-")}`);
async function edit(page:Page){
  await page.getByTestId("button-edit-s1").click();
  await expect(page.getByRole("dialog",{name:"Edit Schedule",exact:true})).toBeVisible();
}
async function time(page:Page,key:string,value:string){
  await page.locator(`#input-${key}`).fill(value);
  await page.locator(`#input-${key}`).press("Tab");
}
for(const role of ["superAdmin","clinicAdmin","doctor"] as const) test(`tabs retain the full draft, keyboard navigation, save and reopen for ${role}`,async({page})=>{
  const state=await setup(page,role);await edit(page);
  await expect(tab(page,"Schedule")).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await tab(page,"Schedule").focus();await page.keyboard.press("ArrowRight");
  await expect(tab(page,"Timing & Break")).toBeFocused();
  await expect(page.locator("#input-startTime")).toBeVisible();
  await tab(page,"Capacity").click();await page.locator('[name="maxTokens"]').fill("14");
  await tab(page,"Queue Settings").click();await time(page,"queueCloseTime","11:45");
  await tab(page,"Schedule").click();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await page.getByTestId("button-save").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.writes[0]).toMatchObject({maxTokens:14,queueCloseTime:"11:45",breakStart:"10:00",consultationMinutes:20});
  await edit(page);await tab(page,"Capacity").click();await expect(page.locator('[name="maxTokens"]')).toHaveValue("14");
  await tab(page,"Queue Settings").click();await expect(page.locator("#input-queueCloseTime")).toHaveValue("11:45");
});
test("save reveals and focuses hidden capacity, break and queue errors",async({page})=>{
  const state=await setup(page);await edit(page);
  await tab(page,"Capacity").click();await page.locator('[name="maxTokens"]').fill("0");
  await tab(page,"Schedule").click();await page.getByTestId("button-save").click();
  await expect(tab(page,"Capacity")).toHaveAttribute("aria-selected","true");
  await expect(page.locator('[name="maxTokens"]')).toBeFocused();
  await page.locator('[name="maxTokens"]').fill("10");
  await tab(page,"Timing & Break").click();await time(page,"breakEnd","");
  await tab(page,"Schedule").click();await page.getByTestId("button-save").click();
  await expect(tab(page,"Timing & Break")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#input-breakStart")).toBeFocused();
  await time(page,"breakEnd","10:15");
  await tab(page,"Queue Settings").click();await time(page,"queueCloseTime","13:00");
  await tab(page,"Schedule").click();await page.getByTestId("button-save").click();
  await expect(tab(page,"Queue Settings")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#input-queueCloseTime")).toBeFocused();
  expect(state.writes).toHaveLength(0);
});
test("failed save retains the draft; Cancel and Escape share one discard prompt",async({page})=>{
  const state=await setup(page);state.fail=true;await edit(page);
  await tab(page,"Capacity").click();await page.locator('[name="maxTokens"]').fill("15");
  await page.getByTestId("button-save").click();
  await expect(page.getByTestId("status-error")).toBeVisible();
  await expect(page.locator('[name="maxTokens"]')).toHaveValue("15");
  await page.getByTestId("button-cancel").click();
  await expect(page.getByTestId("discard-confirm")).toHaveCount(1);
  await page.keyboard.press("Escape");await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(page.getByTestId("discard-confirm")).toHaveCount(1);
  await page.getByTestId("button-keep-editing").click();
  await expect(page.locator('[name="maxTokens"]')).toHaveValue("15");
  await page.getByTestId("button-dialog-close").click();await page.getByTestId("button-discard-changes").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("saving blocks repeated submission and all dismissal paths",async({page})=>{
  const state=await setup(page);await edit(page);
  let release!:()=>void;state.pause=new Promise(resolve=>{release=resolve;});
  await tab(page,"Capacity").click();await page.locator('[name="maxTokens"]').fill("12");
  await page.getByTestId("button-save").click();
  await expect.poll(()=>state.writes.length).toBe(1);
  await expect(page.getByTestId("button-save")).toBeDisabled();
  await expect(page.getByTestId("button-cancel")).toBeDisabled();
  await expect(page.getByTestId("button-dialog-close")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("discard-confirm")).toHaveCount(0);
  await expect(page.getByRole("dialog",{name:"Edit Schedule"})).toBeVisible();
  release();await expect(page.getByRole("dialog")).toHaveCount(0);
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
test("schedule expansion only exposes genuinely additional settings",async({page})=>{
  await setup(page);await page.getByTestId("button-expand-s1").click();
  const facts=page.getByTestId("expansion-availability-s1");
  await expect(facts).toContainText("Queue Mode");await expect(facts).toContainText("Timezone");
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
for(const [role,width] of [["superAdmin",1440],["clinicAdmin",1024],["clinicAdmin",768],["doctor",390]] as const){
  test(`schedule layout ${role} ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900});await setup(page,role);await edit(page);
    await mkdir("artifacts/clinicflow/workspace-regression/evidence",{recursive:true});
    for(const name of ["Schedule","Timing & Break","Capacity","Queue Settings"]){
      await tab(page,name).click();await expect(page.getByTestId("button-save")).toBeVisible();
      const bad=await page.getByRole("dialog",{name:"Edit Schedule"}).evaluate(root=>{
        const box=root.getBoundingClientRect();
        return [...root.querySelectorAll("input,button,[role=tab],.searchable-select-control")].filter(el=>el.getClientRects().length).filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<box.left-1||b.right>box.right+1);}).map(el=>el.outerHTML.slice(0,100));
      });
      expect(bad).toEqual([]);
      await page.screenshot({path:`artifacts/clinicflow/workspace-regression/evidence/availability-${role}-${width}-${name.replace(/\W/g,"-")}.png`});
    }
  });
}
