import { test, expect, type Page } from "@playwright/test";
import { appWideFixture } from "./app-wide-fixture";

async function openApp(page:Page, path:string) {
  await page.goto(`${path}${path.includes("?")?"&":"?"}mode=app`);
}
async function sidebar(page:Page, name:string) {
  if(await page.locator(".mobile-menu").isVisible())await page.locator(".mobile-menu").click();
  await page.getByTestId(`nav-${name}`).click();
}

for(const width of [390,1366])for(const role of ["superAdmin","clinicAdmin","doctor"]){
  test(`${role} shared clinic and nested staff journey at ${width}`,async({page},info)=>{
    await page.setViewportSize({width,height:844});
    const state=await appWideFixture(page,role);
    const prefix=role==="doctor"?"doctor":"admin";
    await openApp(page,`/${prefix}/clinics`);
    await expect(page.getByTestId("row-clinics-c1")).toBeVisible();
    await expect(page.locator(".content .list-header").first()).toBeVisible();
    if(role!=="doctor"){
      await page.getByTestId("row-clinics-c1").getByRole("link",{name:"Fictional Long Named Community Clinic",exact:true}).click();
      await expect(page.getByTestId("clinic-overview")).toBeVisible();
      for(const section of ["details","locations","staff","policies","activity-history"]){
        await page.getByTestId(`tab-clinic-${section}`).click();
        await expect(page.getByTestId(`tab-clinic-${section}`)).toHaveAttribute("aria-selected","true");
      }
      await page.getByTestId("link-all-clinic-groups").click();
      await expect(page.getByTestId("row-clinics-c1")).toBeVisible();
      if(role==="clinicAdmin")await expect(page.getByTestId("button-add-clinics")).toHaveCount(0);
    }else{
      await expect(page.getByTestId("button-add-clinics")).toHaveCount(0);
      await expect(page.getByTestId("clinic-overview")).toHaveCount(0);
      await page.getByTestId("tab-staff").click();
      await expect(page.getByTestId("select-staff-type")).toHaveCount(0);
      await page.getByTestId("tab-qrs").click();
      await expect(page.getByRole("heading",{name:/Booking QR/i})).toBeVisible();
    }
    await page.getByRole("button",{name:/Search workspace \(/}).click();
    await page.locator("#workspace-command-query").fill("Fictional");
    const search=page.getByRole("dialog",{name:"Search Workspace"});
    await expect(search.getByTestId("search-group-staff")).toBeVisible();
    if(role!=="superAdmin")await expect(search.getByTestId("search-source-clinicAdmins")).toHaveCount(0);
    await expect(search.getByTestId("search-group-clinics")).toBeVisible();
    if(role==="superAdmin"){
      await expect(search.getByTestId("search-group-branches")).toBeVisible();
      await expect(search.getByTestId("search-group-audit")).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await page.screenshot({path:info.outputPath(`${role}-${width}.png`),fullPage:true});
    expect(state.writes).toEqual([]);
    expect(state.missing).toEqual([]);
  });
}

for(const area of ["profile","settings"]){
  test(`${area} actual dirty drafts survive repeated Back cancellation, save failure and pending double submit`,async({page})=>{
    const state=await appWideFixture(page,"superAdmin");
    let saveCount=0,release:(()=>void)|undefined;
    let fail=true;
    const endpoint=area==="profile"?"/me":"/settings";
    await page.route(`**/api${endpoint}`,async route=>{
      if(route.request().method()==="GET")return route.fallback();
      saveCount++;
      if(fail)return route.fulfill({status:503,json:{error:"Fictional save failure"}});
      await new Promise<void>(resolve=>{release=resolve;});
      const value=route.request().postDataJSON();
      await route.fulfill({json:area==="profile"?{...state.user,...value}:{timezone:"UTC",...value}});
    });
    await openApp(page,"/admin/dashboard");
    await sidebar(page,area);
    const field=page.locator(area==="profile"?'input[name="fullName"]':'input[name="platformName"]');
    await expect(field).toBeVisible();
    // A pristine form has no exit prompt.
    await sidebar(page,"appointments");
      await expect(page.getByRole("dialog",{name:"Leave this page?"})).toHaveCount(0);
    await sidebar(page,area);
    await field.fill("Fictional unsaved draft");
    for(let attempt=0;attempt<2;attempt++){
      await page.goBack();
      const confirmation=page.getByRole("dialog",{name:"Leave this page?"});
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button",{name:"Cancel",exact:true}).click();
      await expect(field).toHaveValue("Fictional unsaved draft");
      await field.fill(`Fictional unsaved draft`);
    }
    if(area==="settings"){
      await page.getByTestId("tab-masters").click();
      await expect(page.getByRole("dialog",{name:"Leave this page?"})).toBeVisible();
      await page.getByRole("dialog",{name:"Leave this page?"}).getByRole("button",{name:"Cancel",exact:true}).click();
      await expect(field).toHaveValue("Fictional unsaved draft");
    }
    const save=page.getByTestId("button-save").last();
    await save.click();
    await expect.poll(()=>saveCount).toBe(1);
    await expect(page.getByTestId("status-error").last()).toBeVisible();
    await expect(field).toHaveValue("Fictional unsaved draft");
    fail=false;
    await save.dblclick({delay:10,force:true});
    await expect.poll(()=>saveCount).toBe(2);
    release?.();
    await expect(save).toBeEnabled();
    await sidebar(page,"appointments");
    await expect(page.getByRole("dialog",{name:"Leave this page?"})).toHaveCount(0);
    expect(state.writes).toEqual([]);
  });
}

test("communication usage shared categorical controls keep transactional filter drafts",async({page})=>{
  const state=await appWideFixture(page,"superAdmin");
  await openApp(page,"/admin/reports?area=communication-usage");
  const section=page.getByTestId("communication-usage");
  await section.getByTestId("button-toggle-advanced-filters").click();
  const dialog=page.getByRole("dialog");
  await dialog.locator("#cu-channel").click();
  await page.getByRole("option",{name:"SMS",exact:true}).click();
  await dialog.locator("#cu-source").click();
  await page.getByRole("option",{name:"Test sends",exact:true}).click();
  await expect(dialog.locator("select")).toHaveCount(0);
  await dialog.getByTestId("button-close-filters").click();
  await expect.poll(()=>state.seen.filter(p=>p==="/reports/communication-usage").length).toBeGreaterThan(1);
  await section.getByTestId("button-toggle-advanced-filters").click();
  await expect(page.locator("#cu-channel")).toHaveAttribute("aria-label","Channel: SMS");
  await page.keyboard.press("Escape");
  expect(state.writes).toEqual([]);
});
