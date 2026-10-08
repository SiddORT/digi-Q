import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const first = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const second = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const clinicId = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const list = (items: unknown[]) => ({items,total:items.length,page:1,pageSize:20});
async function fixtures(page: Page, failed = false) {
  const state = {failed,missing:false,missingName:false,delay:0,calls:[] as string[]};
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    state.calls.push(path+url.search);
    if (state.delay) await new Promise(resolve=>setTimeout(resolve,state.delay));
    if (state.failed && (/\/doctors\//.test(path) || path.includes("assignment-options") || path.includes("/public/branches") || /\/appointments\//.test(path)))
      return route.fulfill({status:503,json:{message:"Fixture unavailable"}});
    const id = path.split("/").pop()!;
    const selectedIds = url.searchParams.get("selectedIds");
    const doctor = {id:first,fullName:"Dr Fixture",status:"active",clinicIds:[clinicId],branchIds:[first]};
    const clinic = {id:clinicId,name:"Fixture Clinic",status:"active"};
    const branch = {id:first,name:"Fixture Location",clinicId,status:"active",timezone:"Asia/Kolkata"};
    let body: unknown = list([]);
    if (path === "/api/me") body={user:{id:"selector-fixture",role:"doctor",fullName:"Fixture Staff"},doctorId:first};
    else if (path.includes("assignment-options")) body={clinics:[],branches:[branch,{...branch,id:second,name:"Second Location"}],doctors:[],pagination:{branches:{total:2}}};
    else if (/\/doctors\/[^/]+$/.test(path)) body={...doctor,id,fullName:state.missingName?undefined:id===first?"Dr Fixture":"Dr Second"};
    else if (/\/clinics\/[^/]+$/.test(path)) body=clinic;
    else if (/\/branches\/[^/]+$/.test(path)) body=branch;
    else if (/\/appointments\/[^/]+$/.test(path)) body={id,clinicId,branchId:first,doctorId:first,token:7,doctorName:"Dr Fixture",branchName:"Fixture Location",date:"2026-10-08",startTime:"09:00",reference:"VISIT-7"};
    else if (path.endsWith("/clinics")) body=list([clinic]);
    else if (path.endsWith("/branches")) body=list(state.missing?[]:selectedIds?[{...branch,id:selectedIds}]:[branch,{...branch,id:second,name:"Second Location"}]);
    else if (path.endsWith("/doctors")) body=list(url.searchParams.get("search")?[]:[{...doctor,id:second,fullName:"Dr Second"}]);
    else if (path.includes("session-contexts")) body=[];
    return route.fulfill({json:body});
  });
  return state;
}
async function evidence(page: Page, name: string) {
  await mkdir("artifacts/clinicflow/workspace-regression/evidence/selector-names",{recursive:true});
  await page.screenshot({path:`artifacts/clinicflow/workspace-regression/evidence/selector-names/${name}.png`,fullPage:true});
}

test("disabled cold selections hydrate exact names and preserve IDs, including public and appointments", async ({page})=>{
  const state=await fixtures(page);
  await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Assigned locations: Fixture Location, Second Location",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Public location: Fixture Location",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:/Your appointment: Token 7 · Dr Fixture · Fixture Location/})).toBeDisabled();
  await expect(page.getByTestId("submission-values")).toContainText(first);
  expect(state.calls.filter(path=>path.includes("assignment-options"))).toEqual([expect.stringContaining("selectedIds=")]);
  expect(state.calls.some(path=>path==="/api/doctors")).toBe(false);
  await evidence(page,"disabled-cold");
  await page.reload();
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toBeVisible();
});

test("changed values never borrow previous labels; search retention and actor reset cover single and multi",async({page})=>{
  await fixtures(page); await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Local single: First fixture",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Search away",exact:true}).click();
  await expect(page.getByRole("button",{name:"Local single: First fixture",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Change value",exact:true}).click();
  await expect(page.getByRole("button",{name:"Local single: Selected item unavailable",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Second",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Change actor scope",exact:true}).click();
  await expect(page.getByRole("button",{name:/Local multi: Selected item unavailable, Selected item unavailable/})).toBeVisible();
  await page.getByRole("button",{name:"Resolve second",exact:true}).click();
  await expect(page.getByRole("button",{name:"Local single: Second fixture",exact:true})).toBeVisible();
  await expect(page.getByTestId("submission-values")).toContainText(second);
  await evidence(page,"changed-and-multi");
});

test("failed disabled hydration exposes readable errors and retry without clearing saved IDs",async({page})=>{
  const state=await fixtures(page,true); await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Saved doctor: Selected name could not be loaded",exact:true})).toBeVisible();
  await expect(page.getByTestId("submission-values")).toContainText(first);
  await expect(page.getByRole("button",{name:/^(Saved doctor|Assigned locations|Public location|Your appointment):/})).toHaveCount(4);
  for (const button of await page.getByRole("button",{name:/^(Saved doctor|Assigned locations|Public location|Your appointment):/}).all()) {
    await expect(button).not.toHaveAttribute("aria-label",new RegExp(first));
  }
  state.failed=false;
  const retries=page.getByRole("button",{name:"Retry names",exact:true});
  while(await retries.count()){
    const count=await retries.count();
    await retries.first().click();
    await expect(retries).toHaveCount(count-1);
  }
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Public location: Fixture Location",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/Your appointment: Token 7/})).toBeVisible();
  await evidence(page,"retry-recovered");
});

test("loading, missing public records and actor lookup failures are explicit and preserve values",async({page})=>{
  const state=await fixtures(page);
  state.delay=500; state.missing=true;
  await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Saved doctor: Loading selected name…",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Public location: Selected name could not be loaded",exact:true})).toBeVisible();
  await expect(page.getByTestId("submission-values")).toContainText(first);
  state.delay=0; state.failed=true;
  await page.getByRole("button",{name:"Change actor scope",exact:true}).click();
  await expect(page.getByRole("button",{name:"Saved doctor: Selected name could not be loaded",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toHaveCount(0);
  await evidence(page,"missing-and-actor");
});

for (const role of ["doctor","clinicAdmin","receptionist"]) test(`Queue restored context shows names for ${role}`,async({page})=>{
  await fixtures(page);
  await page.addInitScript(({clinicId,first})=>{
    sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:"selector-fixture",clinicId,branchId:first,doctorId:first,date:"2026-10-08"}));
  },{clinicId,first});
  await page.goto(`/?mode=queue&fixtureRole=${role}`);
  await expect(page.getByRole("button",{name:"Doctor: Dr Fixture",exact:true})).toBeVisible();
  if (role==="doctor") await expect(page.getByRole("button",{name:"Doctor: Dr Fixture",exact:true})).toBeDisabled();
  await expect(page.getByLabel("Clinic",{exact:true})).toHaveValue("Fixture Clinic");
  await expect(page.locator(".sq-session-scope")).toContainText("Fixture Location");
  await expect(page.locator(".sq-session-scope")).not.toContainText(first);
  await evidence(page,`queue-${role}`);
  await page.reload();
  await expect(page.getByRole("button",{name:"Doctor: Dr Fixture",exact:true})).toBeVisible();
});

test("Queue pinned clinic and location hydrate names even when disabled",async({page})=>{
  await fixtures(page);
  await page.addInitScript(({clinicId,first})=>{
    localStorage.setItem("dq.workspace.branch.selector-fixture",first);
    sessionStorage.setItem("clinicflow-staff-session",JSON.stringify({staffId:"selector-fixture",clinicId,branchId:first,doctorId:first,date:"2026-10-08"}));
  },{clinicId,first});
  await page.goto("/?mode=queue&fixtureRole=doctor&pinned=1");
  await expect(page.getByRole("button",{name:"Location: Fixture Location",exact:true})).toBeDisabled();
  await expect(page.getByRole("textbox",{name:"Clinic",exact:true})).toHaveValue("Fixture Clinic");
  await expect(page.getByRole("textbox",{name:"Clinic",exact:true})).toHaveAttribute("readonly","");
  await expect(page.getByRole("button",{name:"Doctor: Dr Fixture",exact:true})).toBeDisabled();
  await evidence(page,"queue-pinned");
});

test("off-page and remote-searched selected labels survive without granting menu eligibility",async({page})=>{
  const state=await fixtures(page); await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Toggle editable",exact:true}).click();
  await page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true}).click();
  await expect(page.getByRole("option",{name:"Dr Fixture (selected)",exact:true})).toHaveAttribute("aria-disabled","true");
  await page.getByPlaceholder("Search saved doctor…").fill("absent");
  await expect.poll(()=>state.calls.some(url=>url.includes("search=absent"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Saved doctor: Dr Fixture",exact:true})).toBeVisible();
  await expect(page.getByTestId("submission-values")).toContainText(first);
  await evidence(page,"off-page-search");
});

test("missing-name payloads show an explicit state instead of an ID",async({page})=>{
  const state=await fixtures(page); state.missingName=true;
  await page.goto("/?mode=selectors");
  await expect(page.getByRole("button",{name:"Saved doctor: Name unavailable",exact:true})).toBeVisible();
  await expect(page.getByTestId("submission-values")).toContainText(first);
});

test("patient Queue appointment selection uses a meaningful appointment summary",async({page})=>{
  await fixtures(page);
  await page.goto(`/?mode=queue&fixtureRole=patient&appointment=${first}`);
  await expect(page.getByRole("button",{name:/Your Appointment: Token 7 · Dr Fixture · Fixture Location/})).toBeVisible();
  await evidence(page,"queue-patient");
});
