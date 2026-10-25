import {test,expect} from "@playwright/test";
import {appWideFixture} from "./app-wide-fixture";
import {expectFormBounds,expectPopupBounds} from "./compact-geometry";

for(const [path,label] of [
  ["/admin/settings","Settings areas"],
  ["/admin/users","User administration"],
  ["/admin/reports","Report sections"],
  ["/doctor/clinics","Clinic sections"],
])test(`workspace tabs keyboard focus follows the selected section ${path}`,async({page})=>{
  await appWideFixture(page,path.startsWith("/doctor")?"doctor":"superAdmin");
  await page.goto(`${path}?mode=app`);
  const tabs=page.getByRole("tablist",{name:label}).getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  await tabs.first().focus();await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected","true");
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected","true");
});

for(const width of [768,1024,1366])test(`resource lead controls do not obscure record text ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:768});
  const state=await appWideFixture(page,"superAdmin");
  await page.goto("/admin/clinics?mode=app");
  const row=page.getByTestId("row-clinics-c1");
  await expect(row).toBeVisible();
  await expect.poll(()=>row.evaluate(el=>{
    const lead=el.querySelector(".row-lead")!,cell=lead.closest("td")!,next=cell.nextElementSibling!;
    const a=lead.getBoundingClientRect(),b=cell.getBoundingClientRect(),c=next.getBoundingClientRect();
    return a.left>=b.left-1&&a.right<=b.right+1&&a.right<=c.left+1;
  })).toBe(true);
  await row.getByTestId("button-expand-c1").click();
  await expect(page.locator("#expand-c1")).toBeVisible();
  await row.getByTestId("button-expand-c1").click();
  expect(state.writes).toEqual([]);
  await page.screenshot({path:info.outputPath(`lead-column-${width}.png`)});
});

for(const width of [390,1024,1366])test(`patient editor and filter actions remain reachable ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:640});
  const state=await appWideFixture(page,"superAdmin");
  await page.goto("/admin/patients?mode=app");
  await expect(page.getByRole("heading",{name:"Patients",exact:true})).toBeVisible();
  await page.getByTestId("button-add-patients").click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectFormBounds(page,'[role="dialog"]');
  await expectPopupBounds(page,'[role="dialog"]');
  await dialog.locator('input[name="fullName"]').fill("Fictional Unsaved Patient");
  await page.keyboard.press("Escape");
  const discard=page.getByRole("alertdialog");
  await expect(discard).toBeVisible();
  await discard.getByRole("button",{name:"Keep editing",exact:true}).click();
  await expect(dialog.locator('input[name="fullName"]')).toHaveValue("Fictional Unsaved Patient");
  await page.keyboard.press("Escape");
  await discard.getByRole("button",{name:"Discard changes",exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("button-add-patients")).toBeFocused();
  await page.getByTestId("button-toggle-advanced-filters").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFormBounds(page,'[role="dialog"]');
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("button-toggle-advanced-filters")).toBeFocused();
  await page.screenshot({path:info.outputPath(`patient-return-${width}.png`)});
  expect(state.writes).toEqual([]);
  expect(state.missing).toEqual([]);
});

for(const width of [390,1024,1366])test(`communication usage expanded filters contain long selected values ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:width===390?844:768});
  const state=await appWideFixture(page,"superAdmin");
  await page.goto("/admin/reports?area=communication-usage&mode=app");
  const section=page.getByTestId("communication-usage");
  await expect(section).toBeVisible();
  await section.locator("summary").click();
  await expect(section.locator("#cu-channel")).toBeVisible();
  await section.locator('select').filter({has:page.locator('option[value="actor"]')}).selectOption("actor");
  await expectFormBounds(page,'[data-testid="communication-usage"]');
  await page.screenshot({path:info.outputPath(`usage-filters-${width}.png`),fullPage:true});
  expect(state.missing).toEqual([]);expect(state.writes).toEqual([]);
});
