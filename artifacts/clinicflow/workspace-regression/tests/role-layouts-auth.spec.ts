import { test, expect } from "@playwright/test";

// Real native session authentication, routers, CSRF, authorization and disposable
// PostgreSQL, reusing the local-only schedule harness. No hosted credentials/data.
test("authenticated inline-save baseline persists after reopen and settings context remains guarded",async({page},info)=>{
  test.setTimeout(120000);
  const {token}=await (await page.request.get("/__schedule-evidence/actor/sa")).json();
  await page.context().addCookies([{name:"digiq_session",value:token,domain:"127.0.0.1",path:"/api",httpOnly:true,sameSite:"Lax"}]);
  const me=await page.request.get("/api/me");
  expect(me.status()).toBe(200);expect((await me.json()).user.role).toBe("superAdmin");
  await page.goto("/admin/profile?mode=app");
  const field=page.locator('input[name="fullName"]');
  await expect(field).toBeVisible();
  const name="Fictional Layout Acceptance";
  await field.fill(name);
  await page.getByTestId("button-save").last().click();
  await expect.poll(async()=>((await (await page.request.get("/api/me")).json()).user.fullName)).toBe(name);
  await expect(page.getByTestId("button-save").last()).toBeEnabled();
  await page.getByTestId("nav-appointments").click();
  await expect(page.getByRole("dialog",{name:"Leave this page?"})).toHaveCount(0);
  await page.getByTestId("nav-profile").click();
  await expect(field).toHaveValue(name);
  await page.goto("/admin/settings?mode=app");
  const platform=page.locator('input[name="platformName"]');
  await platform.fill("Fictional Shared Platform");
  await page.getByTestId("button-save").last().click();
  await expect.poll(async()=>((await (await page.request.get("/api/settings")).json()).platformName)).toBe("Fictional Shared Platform");
  await platform.fill("Discard fictional preference");
  await page.getByTestId("tab-masters").click();
  await page.getByRole("dialog",{name:"Leave this page?"}).getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(platform).toHaveValue("Discard fictional preference");
  await page.getByTestId("tab-masters").click();
  await page.getByRole("dialog",{name:"Leave this page?"}).getByRole("button",{name:"Discard and Leave",exact:true}).click();
  await page.getByTestId("tab-platform").click();
  await expect(platform).toHaveValue("Fictional Shared Platform");
  await page.screenshot({path:info.outputPath("authenticated-platform.png"),fullPage:true});
});
