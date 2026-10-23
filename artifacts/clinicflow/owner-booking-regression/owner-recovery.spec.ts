import { test, expect, type Page } from "@playwright/test";

const password="Fictional-Owner!2026";
async function login(page:Page,email:string){
  await page.goto("/sign-in");
  await page.getByTestId("input-staff-email").fill(email);
  await page.getByTestId("input-staff-password").fill(password);
  await page.getByTestId("button-staff-login").click();
  await expect(page.getByTestId("button-profile-menu")).toBeVisible();
}
async function compact(page:Page,width:number,height:number,label:string){
  await page.setViewportSize({width,height});
  await expect(page.getByTestId("button-booking-continue-visit")).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const doctor=page.getByRole("combobox",{name:"Doctor",exact:false});
  const warning=page.locator(".resource-lookup-field").filter({has:doctor});
  await expect(warning).toHaveCount(1);
  const dimensions=await warning.boundingBox();
  expect(dimensions!.width).toBeGreaterThan(130);
  await page.getByTestId("button-booking-continue-visit").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("button-booking-continue-visit")).toBeInViewport();
  await page.screenshot({path:`generated-artifacts/owner-booking-regression/${label}-${width}.png`,fullPage:true});
}

test("missing owner recovery retains booking context and named discovery after reload and fresh sign-in",async({page,browser})=>{
  // This file must only run against the opted-in disposable Preview fixture.
  const evidence=await page.request.get("/api/__owner-booking-evidence");
  expect(evidence.status(),"Disposable fixture is required; never run against UAT").toBe(200);
  const initial=await evidence.json();
  const owner=initial.users.find((user:any)=>user.email==="recovery@owner.test.invalid");
  const assignment=initial.assignments.find((item:any)=>item.user_id===owner.id);
  const branch=initial.branches.find((item:any)=>item.clinic_id===assignment.clinic_id);
  expect(initial.doctors.filter((item:any)=>item.user_id===owner.id)).toHaveLength(0);
  await login(page,owner.email);
  const requestedDate=new Date(Date.now()+86400000).toISOString().slice(0,10);
  await page.goto(`/admin/book?clinic=${assignment.clinic_id}&branch=${branch.id}&date=${requestedDate}`);
  const date=page.getByTestId("input-booking-date");
  await expect(page.getByTestId("button-owner-booking-recovery")).toBeVisible();
  const originalDate=await date.inputValue();
  for(const [width,height] of [[1024,640],[1366,768],[390,844]])await compact(page,width,height,"empty");
  await page.getByTestId("button-owner-booking-recovery").click();
  await page.getByTestId("button-confirm-owner-recovery").click();
  await expect(page.getByRole("combobox",{name:"Doctor",exact:false})).toContainText("Fictional Recovery Owner");
  await expect(date).toHaveValue(originalDate);
  await expect(page.getByTestId("button-owner-booking-recovery")).toHaveCount(0);
  await expect(page.getByText(/No doctor session is listed/)).toBeVisible();
  for(const [width,height] of [[1024,640],[1366,768],[390,844]])await compact(page,width,height,"recovered");
  await page.reload();
  await expect(page.getByRole("combobox",{name:"Doctor",exact:false})).toContainText("Fictional Recovery Owner");
  const after=await (await page.request.get("/api/__owner-booking-evidence")).json();
  expect(after.doctors.filter((item:any)=>item.user_id===owner.id)).toHaveLength(1);
  expect(after.assignments).toEqual(initial.assignments);
  expect(after.appointments).toEqual(initial.appointments);
  expect(after.doctors.find((item:any)=>item.user_id===owner.id).data.branchIds).toEqual([branch.id]);
  for(const email of [owner.email,"super@owner.test.invalid"]){
    const context=await browser.newContext({baseURL:test.info().project.use.baseURL});
    const fresh=await context.newPage();
    await login(fresh,email);
    await fresh.goto(`/admin/book?clinic=${assignment.clinic_id}&branch=${branch.id}`);
    await expect(fresh.getByRole("combobox",{name:"Doctor",exact:false})).toContainText("Fictional Recovery Owner");
    await context.close();
  }
});
