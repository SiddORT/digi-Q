// Run only against the disposable server in api-server/src/acceptance-server.mjs.
// No workspace credentials, workspace database, or external email is used.
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const origin="http://127.0.0.1:8099";
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const out=new URL("../screenshots/doctor-context/",import.meta.url).pathname;
await mkdir(out,{recursive:true});
async function loginAs(context,email){
  const page=await context.newPage();
  await page.goto(`${origin}/sign-in`);
  await page.getByTestId("input-staff-email").fill(email);
  await page.getByTestId("input-staff-password").fill("Disposable browser verification 2026!");
  await page.getByTestId("button-staff-login").click();
  await page.waitForURL(url=>url.pathname!=="/sign-in");
  return page;
}
try{
  const context=await browser.newContext();
  const page=await loginAs(context,"sa@test.invalid");
  for(const width of process.env.AUDIT_PERMISSIONS_ONLY||process.env.AUDIT_CREATE_ONLY?[]:[1440,768,390]){
    await page.setViewportSize({width,height:900});
    await page.goto(`${origin}/admin/queue`);await expect(page.locator(".session-queue")).toBeVisible();
    await page.screenshot({path:`${out}queue-${width}.png`});
    const queueFont=await page.locator(".session-queue").evaluate(el=>getComputedStyle(el).fontFamily);
    await page.goto(`${origin}/admin/staff?tab=doctors`);
    await page.getByTestId("button-manage-schedule-d1").click();
    await expect(page.locator(".doctor-editor")).toBeVisible();
    await page.getByLabel("Full Name",{exact:false}).scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}doctor-details-${width}.png`});
    expect(await page.locator(".doctor-editor").evaluate(el=>getComputedStyle(el).fontFamily)).toBe(queueFont);
    expect(await page.locator(".doctor-editor form form").count()).toBe(0);
    const audit=await page.locator(".doctor-editor").evaluate(root=>{
      const dialog=root.closest(".app-dialog").getBoundingClientRect();
      const bad=[];
      for(const el of root.querySelectorAll("input:not([type=checkbox]),.phone-input,.form-actions")){
        const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
        if(r.left<dialog.left-1||r.right>dialog.right+1)bad.push({kind:el.tagName,name:el.getAttribute("name"),left:r.left,right:r.right});
      }
      return {bad,dialogLeft:dialog.left,dialogRight:dialog.right,viewport:innerWidth};
    });
    expect(audit.bad).toEqual([]);expect(audit.dialogLeft).toBeGreaterThanOrEqual(0);expect(audit.dialogRight).toBeLessThanOrEqual(audit.viewport);
    expect(await page.locator(".doctor-editor .form-actions").evaluateAll(els=>els.every(e=>getComputedStyle(e).position==="static"))).toBe(true);
    const phoneLabel=await page.locator(".phone-input .searchable-select-control>span").boundingBox();
    expect(phoneLabel.width).toBeGreaterThan(40);expect(phoneLabel.height).toBeLessThan(30);
    await page.getByRole("button",{name:/Saved assigned location/}).click();
    await page.getByRole("option",{name:"Lakeview Main",exact:true}).click();
    await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();
    await page.getByTestId("panel-weekly-editor").scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}doctor-schedule-${width}.png`});
    await page.getByTestId("button-dialog-close").click();
    await expect(page.getByTestId("button-manage-schedule-d1")).toBeFocused();
    console.log(`Queue/editor ${width}px: matching font, bounded compound controls/footer, no nested forms, focus restored.`);
  }
  if(process.env.AUDIT_CREATE_ONLY){
    await page.goto(`${origin}/admin/staff?tab=doctors`);
    await page.getByTestId("button-add-staff").click();
    await page.getByLabel("Full Name",{exact:false}).fill("Native Context Doctor");
    await page.getByTestId("input-user-email").fill(`native-context-${Date.now()}@test.invalid`);
    await page.getByRole("button",{name:/Clinic Groups/}).click();await page.getByRole("option",{name:"Lakeview Clinic",exact:true}).click();await page.keyboard.press("Escape");
    await page.getByRole("button",{name:/Locations/}).click();await page.getByRole("option",{name:"Lakeview Main",exact:true}).click();await page.keyboard.press("Escape");
    await page.getByTestId("checkbox-confirm-inherited").check();
    const createdResponse=page.waitForResponse(r=>r.url().endsWith("/api/doctors")&&r.request().method()==="POST");
    await page.getByTestId("button-save-staff").click();
    const response=await createdResponse;expect(response.status()).toBe(201);
    const doctor=await response.json();
    await expect(page.getByTestId("panel-weekly-editor")).toBeVisible();
    await expect(page.getByTestId("select-add-staff-role")).toHaveCount(0);
    await page.getByTestId("switch-day-1").check();
    for(const [key,value] of [["startTime","9:00 AM"],["endTime","12:00 PM"]]){
      await page.getByTestId(`input-${key}-1-0`).fill(value);await page.getByTestId(`input-${key}-1-0`).press("Tab");
    }
    await page.getByTestId("input-default-token-prefix").fill("NATIVE");await page.getByTestId("input-default-max-tokens").fill("10");
    await page.getByRole("button",{name:/Expected Consultation Duration/}).click();await page.getByRole("option",{name:"20 minutes",exact:true}).click();
    await page.getByTestId("button-save-week").click();await expect(page.getByTestId("status-week-save")).toContainText("Saved");
    await expect(page.locator(".doctor-editor")).toHaveAttribute("data-details-dirty","false");
    await expect(page.locator(".doctor-editor")).toHaveAttribute("data-schedule-dirty","false");
    await page.getByTestId("button-dialog-close").click();
    await page.getByTestId(`button-manage-schedule-${doctor.id}`).click();
    await expect(page.getByTestId("input-startTime-1-0")).toHaveValue("9:00 AM");
    const rows=await page.evaluate(async id=>(await (await fetch(`/api/schedules?doctorId=${id}&branchId=b1`)).json()).items,doctor.id);
    expect(rows).toHaveLength(1);expect(rows[0].maxTokens).toBe(10);expect(rows[0].consultationMinutes).toBe(20);
    console.log("New doctor saved before first session; same dialog continued, real PostgreSQL session persisted and reopened with explicit capacity/duration.");
  }
  await context.close();
  if(!process.env.AUDIT_CREATE_ONLY){
  const scoped=await browser.newContext();
  const scopedPage=await loginAs(scoped,"adm@test.invalid");
  expect(await scopedPage.evaluate(async()=>(await fetch("/api/branches/b3")).status)).toBe(403);
  await scopedPage.goto(`${origin}/admin/clinic?clinicId=c2&section=staff&tab=doctors`);
  await scopedPage.getByTestId("button-manage-schedule-d1").click();
  await expect(scopedPage.locator(".doctor-context-value").filter({hasText:"Lakeview Main"})).toBeVisible();
  await expect(scopedPage.getByRole("button",{name:"Remove Lakeview Main",exact:true})).toHaveCount(0);
  await scoped.close();
  const reception=await browser.newContext();
  const recPage=await loginAs(reception,"rec@test.invalid");await recPage.goto(`${origin}/receptionist/availability`);
  await expect(recPage.getByTestId("button-manage-schedule-d1")).toHaveCount(0);
  expect(await recPage.evaluate(async()=>{
    const {csrfToken}=await (await fetch("/api/auth/csrf")).json();
    return (await fetch("/api/doctors/d1",{method:"PATCH",headers:{"Content-Type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({fullName:"Unauthorised",email:"docu@test.invalid",role:"doctor",status:"active",clinicIds:["c1","c2"],branchIds:["b1","b2"]})})).status;
  })).toBe(403);
  await reception.close();
  console.log("Scoped external labels are read-only and human-readable; foreign branch and receptionist doctor writes remain denied.");
  }
}finally{await browser.close();}
