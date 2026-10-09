import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const actor = { id: "fictional-registration-owner", fullName: "Fictional Owner", email: "fictional-owner@test.invalid", mobile: "", role: "clinicAdmin", clinicIds: [], branchIds: [] };
async function services(page: Page, signedIn = true) {
  const state = { signedIn, failResend: false, saved: null as any, writes: [] as any[] };
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const data = req.postDataJSON();
    let result: any = {};
    if (path === "/api/auth/status") result = state.signedIn ? { authenticated: true, role: "clinicAdmin", requiresStaffPassword: true, staffPasswordVerified: true } : { authenticated: false };
    else if (path === "/api/auth/csrf") result = { csrfToken: "fictional-csrf" };
    else if (path === "/api/me") result = { user: actor, permissions: {} };
    else if (path === "/api/auth/register/start") result = { challengeId: "fictional-challenge" };
    else if (path === "/api/auth/registration/resume") result = { challengeId: "fictional-challenge" };
    else if (path === "/api/auth/registration/resend") {
      if (state.failResend) { await route.fulfill({status:503,json:{error:"Email service is temporarily unavailable."}}); return; }
      result = { challengeId: "fictional-challenge" };
    }
    else if (path === "/api/auth/register/verify") { state.signedIn = true; result = { authenticated: true, role: "clinicAdmin" }; }
    else if (path === "/api/public/registration-options") result = { categories: [], specialities: [], qualifications: [] };
    else if (path === "/api/public/slug-availability") result = { available: true };
    else if (path.startsWith("/api/public/pincode/")) result = { items: [{locality:"Mulund West",district:"Mumbai",state:"Maharashtra"},{locality:"Nahur",district:"Mumbai",state:"Maharashtra"}], available:true, source:"Fictional fixture" };
    else if (path === "/api/clinic-registration/completion") result = {result:state.saved};
    else if (path === "/api/clinic-registration" && req.method() === "POST") {
      state.writes.push(data);
      state.saved = { clinic: { ...data.clinic, id:"fictional-saved-clinic", adminId:actor.id }, branches:data.branches.map((b:any,i:number)=>({...b,id:`fictional-location-${i}`,clinicId:"fictional-saved-clinic",effectiveEmail:b.inheritEmail?data.clinic.email:b.email,effectivePhone:b.inheritPhone?data.clinic.phone:b.phone})), doctorId: data.ownDoctor ? "fictional-doctor" : null };
      result = state.saved;
    } else if (path.includes("/masters") || path.includes("/geography")) result = {items:[],total:0,page:1,pageSize:20};
    else { await route.fulfill({status:500,json:{error:`Unhandled fictional API ${path}`}}); return; }
    await route.fulfill({json:result});
  });
  return state;
}
const go = (page:Page) => page.goto("/?mode=onboarding");
const next = (page:Page) => page.getByRole("button",{name:"Continue",exact:true}).click();
async function identity(page:Page) {
  await page.getByTestId("registration-name").fill("Fictional Long Clinic Group");
  await page.getByTestId("registration-slug").fill("fictional-long-group");
  await page.getByTestId("registration-clinicEmail").fill("front@test.invalid");
  const phone = page.locator(".clinic-registration input[type=tel]").last();
  await phone.fill("9876543210");
  await next(page);
}
async function location(page:Page) {
  await page.getByTestId("registration-branch-0-name").fill("Fictional Location");
  await page.getByTestId("registration-branch-0-slug").fill("fictional-location");
  await page.getByTestId("registration-branch-0-address").fill("Fictional Street");
  await page.getByRole("combobox",{name:"State/UT"}).fill("Maharashtra");
  await page.getByRole("combobox",{name:"City/Town"}).fill("Mumbai");
  await page.getByTestId("registration-branch-0-address-pincode").fill("400080");
  const locality = page.getByRole("button",{name:/Add: Mulund West/});
  await locality.click();
  await expect(page.getByRole("button",{name:/Selected: Mulund West/})).toHaveAttribute("aria-pressed","true");
  await page.reload();
  await expect(page.getByTestId("registration-branch-0-address")).toHaveValue("Fictional Street, Mulund West");
  await page.getByRole("button",{name:/Selected: Mulund West/}).click();
  await expect(page.getByTestId("registration-branch-0-address")).toHaveValue("Fictional Street");
  await next(page);
}
test("onboarding saves, reloads, reviews, completes and reconciles one fictional registration", async ({page}) => {
  const state = await services(page);
  await go(page); await identity(page);
  await mkdir("screenshots/registration",{recursive:true});
  for (const width of [1366,768,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await page.screenshot({path:`screenshots/registration/${width}-location.png`,fullPage:true});
  }
  await page.setViewportSize({width:1366,height:900});
  await location(page);
  await expect(page.getByText("unconfigured draft",{exact:false})).toBeVisible();
  const monday = page.getByRole("switch",{name:"Monday open"});
  await monday.check();
  const times = page.getByTestId("row-hours-day-1").locator(".registration-session input[type=text]");
  await times.nth(0).fill("9:00 AM"); await times.nth(0).blur();
  await times.nth(1).fill("12:00 PM"); await times.nth(1).blur();
  await page.getByRole("button",{name:"Add Session"}).first().click();
  await times.nth(2).fill("1:00 PM"); await times.nth(2).blur();
  await times.nth(3).fill("6:00 PM"); await times.nth(3).blur();
  for (const width of [1366,768,390]) {
    await page.setViewportSize({width,height:900});
    await expect(monday).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await page.screenshot({path:`screenshots/registration/${width}-hours.png`,fullPage:true});
  }
  await page.setViewportSize({width:1366,height:900});
  await page.reload(); await expect(times.nth(0)).toHaveValue("9:00 AM"); await expect(times.nth(3)).toHaveValue("6:00 PM");
  await next(page); // your practice
  await expect(page.getByRole("heading",{name:"Your practice"})).toBeVisible();
  await next(page); // care team
  await next(page); // review
  await expect(page.getByText("Monday: 9:00 AM–12:00 PM, 1:00 PM–6:00 PM")).toBeVisible();
  await expect(page.getByText(/front@test.invalid · \+919876543210/).first()).toBeVisible();
  await page.screenshot({path:"screenshots/registration/review.png",fullPage:true});
  await page.getByRole("textbox",{name:"Confirm Your Account Password"}).fill("FictionalPass123");
  await page.getByRole("button",{name:"Finish registration",exact:true}).click();
  await expect(page.getByRole("heading",{name:/registered|setup.*complete|clinic.*ready|registration complete/i}).first()).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].branches[0].openingHours).toEqual([{dayOfWeek:1,startTime:"09:00",endTime:"12:00"},{dayOfWeek:1,startTime:"13:00",endTime:"18:00"}]);
  expect(state.saved.branches[0].address).toBe("Fictional Street");
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("digiq:registration:")))).toEqual([]);
});
test("onboarding account secrets are not restored and latest-code success differs from resend failure", async ({page}) => {
  await page.addInitScript(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: any[]) =>
      original(callback, delay === 1000 ? 5 : delay, ...args)) as typeof setTimeout;
  });
  const state = await services(page,false);
  await go(page);
  await page.getByLabel("Your Name",{exact:false}).fill("Fictional Owner");
  await page.getByLabel("Email Address",{exact:false}).fill(actor.email);
  await page.locator('input[autocomplete="new-password"]').fill("FictionalPass123");
  await page.getByRole("button",{name:"Review account details",exact:true}).click();
  await expect(page.getByText("Patient accounts cannot",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Send verification code",exact:true}).click();
  await page.getByLabel(/Code Emailed/).fill("123456");
  const raw = await page.evaluate(()=>JSON.stringify(Object.values(sessionStorage)));
  expect(raw).not.toMatch(/FictionalPass123|123456|fictional-challenge/);
  await page.reload(); await expect(page.getByLabel(/Code Emailed/)).toHaveValue("");
  await expect(page.getByTestId("registration-resend-code")).toBeEnabled({timeout:15000});
  await page.getByTestId("registration-resend-code").click();
  await expect(page.getByText("Use the code in the latest verification email. Earlier codes no longer work.",{exact:true}).first()).toBeVisible();
  const close = page.locator("[data-sonner-toast] [data-close-button]").first();
  await expect(close).toBeVisible();
  const rect = await close.boundingBox(); expect(rect?.width).toBeCloseTo(44, 1); expect(rect?.height).toBeCloseTo(44, 1);
  await expect(page.getByTestId("registration-resend-code")).toBeEnabled({timeout:15000});
  state.failResend=true;
  await page.getByTestId("registration-resend-code").click();
  await expect(page.getByRole("alert").first()).toContainText("Something went wrong. Please try again.");
  await expect(page.getByText("Use the code in the latest verification email. Earlier codes no longer work.",{exact:true})).toHaveCount(0);
});
test("onboarding safely falls back when tab storage is blocked", async ({page}) => {
  await page.addInitScript(()=>{ Object.defineProperty(window,"sessionStorage",{get(){throw new DOMException("Blocked","SecurityError");}}); });
  await services(page); await go(page);
  await expect(page.getByText("temporary browser storage is unavailable",{exact:false})).toBeVisible();
  await identity(page);
  await expect(page.getByTestId("registration-branch-0-name")).toBeVisible();
});
test("location contact inheritance is independent and missing effective contacts block continuation", async ({page}) => {
  await services(page); await go(page); await identity(page);
  await page.getByTestId("registration-branch-0-name").fill("Contact Fixture");
  await page.getByTestId("registration-branch-0-slug").fill("contact-fixture");
  await page.getByTestId("registration-branch-0-address").fill("Fictional Street");
  const email = page.getByRole("checkbox",{name:"Use Clinic Group email"});
  const phone = page.getByRole("checkbox",{name:"Use Clinic Group phone"});
  await email.uncheck();
  await expect(phone).toBeChecked();
  await next(page);
  await expect(page.getByRole("heading",{name:"Locations"})).toBeVisible();
  await expect(page.getByTestId("input-branch-email-0")).toHaveAttribute("required","");
  await page.getByTestId("input-branch-email-0").fill("location@test.invalid");
  await phone.uncheck(); await expect(email).not.toBeChecked();
  await next(page); await expect(page.getByRole("heading",{name:"Locations"})).toBeVisible();
  await page.locator('.registration-branch input[type=tel]').last().fill("9876543210");
  await next(page); await expect(page.getByRole("heading",{name:"Opening hours"})).toBeVisible();
});
test("copying over another open day warns, preserves the draft and offers linked/custom owner schedules", async ({page}) => {
  await services(page); await go(page); await identity(page); await location(page);
  const setHours = async (day: number, start: string, end: string) => {
    await page.getByTestId(`hours-open-${day}`).check();
    await page.getByTestId(`hours-startTime-${day}-0`).fill(start);
    await page.getByTestId(`hours-startTime-${day}-0`).blur();
    await page.getByTestId(`hours-endTime-${day}-0`).fill(end);
    await page.getByTestId(`hours-endTime-${day}-0`).blur();
  };
  await setHours(1,"9:00 AM","12:00 PM"); await setHours(2,"10:00 AM","1:00 PM");
  await page.getByText("Copy Monday hours").click();
  await page.getByTestId("row-hours-day-1").getByRole("checkbox",{name:"Tuesday"}).check();
  await page.getByRole("button",{name:"Copy to Selected Days"}).click();
  await expect(page.getByRole("dialog")).toContainText("replaces all intervals on Tuesday");
  await page.getByRole("button",{name:"Replace draft hours"}).click();
  await expect(page.getByTestId("hours-startTime-2-0")).toHaveValue("9:00 AM");
  await page.reload();
  await page.getByTestId("button-hours-expand-2").click();
  await expect(page.getByTestId("hours-startTime-2-0")).toHaveValue("9:00 AM");
  await next(page);
  await page.getByRole("checkbox",{name:/I also consult as a doctor/}).check();
  await expect(page.getByTestId("registration-link-hours")).toBeChecked();
  await expect(page.getByText("One timetable:",{exact:false})).toBeVisible();
  await page.getByTestId("registration-link-hours").uncheck();
  await expect(page.getByText("Custom consultation hours:",{exact:false})).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("registration-link-hours")).not.toBeChecked();
});
