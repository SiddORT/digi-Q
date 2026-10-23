import { test, expect, type Page } from "@playwright/test";

test.use({ hasTouch: true });
test.skip(!process.env.OWNER_BOOKING_BASE_URL, "Opt-in disposable Preview fixture only.");

const password="Fictional-Owner!2026";
const sizes = [[1024,640],[1366,768],[390,844]] as const;

async function help(page: Page, label: string) {
  const trigger = page.getByRole("button", { name: label, exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  const bubble = page.locator('[role="tooltip"]');
  await expect(bubble).toBeVisible();
  const anchor = await trigger.boundingBox();
  const box = await bubble.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  expect(Math.min(Math.abs(box!.y + box!.height - anchor!.y),
    Math.abs(anchor!.y + anchor!.height - box!.y))).toBeLessThan(20);
  await page.keyboard.press("Escape");
  await expect(bubble).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.tap();
  await expect(bubble).toBeVisible();
  await page.getByRole("heading", { name: "Where would you like to visit?" }).tap();
  await expect(bubble).toHaveCount(0);
}

async function directoryStates(page: Page, url: string, width: number, height: number) {
  let mode: "pending" | "failure" | "ready" = "pending";
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pattern = "**/api/doctors?*";
  await page.route(pattern, async route => {
    if (mode === "pending") await gate;
    if (mode === "failure") {
      await route.fulfill({ status: 503, contentType: "application/json",
        body: JSON.stringify({ error: "Fictional directory temporarily unavailable" }) });
    } else await route.continue();
  });
  try {
    await page.goto(url);
    const doctor = page.getByRole("button", { name: /^Doctor(?::|$)/ });
    await doctor.click();
    await expect(page.getByText("Loading…", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("button-booking-continue-visit")).toBeDisabled();
    await compact(page,width,height,"directory-pending");
    mode = "failure";
    release();
    const retries = page.locator(".resource-lookup-field").filter({has:doctor})
      .getByRole("button", { name: "Retry Options", exact: true });
    // Picker options and sole-assignment readiness have independent retry
    // actions. Restore both failed reads, without an arbitrary page reload.
    await expect(retries).toHaveCount(2);
    await expect(retries.first()).toBeVisible();
    await expect(page.getByTestId("button-booking-continue-visit")).toBeDisabled();
    await compact(page,width,height,"directory-failure");
    mode = "ready";
    await retries.first().click();
    await expect(retries).toHaveCount(1);
    await retries.first().click();
    await expect(doctor).toHaveAccessibleName("Doctor: Fictional Recovery Owner");
    await expect(page.getByTestId("button-booking-continue-visit")).toBeEnabled();
    await expect(retries).toHaveCount(0);
    await compact(page,width,height,"directory-retried");
  } finally {
    mode = "ready";
    release();
    await page.unroute(pattern);
  }
}
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
  const doctor=page.getByRole("button",{name:/^Doctor(?::|$)/});
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
  for(const [width,height] of sizes){
    await compact(page,width,height,"empty");
    await help(page,"About consulting profile recovery");
  }
  await page.getByTestId("button-owner-booking-recovery").click();
  await page.getByTestId("button-confirm-owner-recovery").click();
  await expect(page.getByRole("button",{name:"Doctor: Fictional Recovery Owner",exact:true})).toBeVisible();
  await expect(date).toHaveValue(originalDate);
  await expect(page.getByTestId("button-owner-booking-recovery")).toHaveCount(0);
  await expect(page.getByText(/No doctor session is listed/)).toBeVisible();
  for(const [width,height] of sizes){
    await compact(page,width,height,"recovered");
    await help(page,"About missing sessions");
    await help(page,"About next-date search");
  }
  await page.reload();
  await expect(page.getByRole("button",{name:"Doctor: Fictional Recovery Owner",exact:true})).toBeVisible();
  const after=await (await page.request.get("/api/__owner-booking-evidence")).json();
  expect(after.doctors.filter((item:any)=>item.user_id===owner.id)).toHaveLength(1);
  expect(after.assignments).toEqual(initial.assignments);
  expect(after.appointments).toEqual(initial.appointments);
  expect(after.doctors.find((item:any)=>item.user_id===owner.id).data.branchIds).toEqual([branch.id]);
  const doctorId = after.doctors.find((item:any)=>item.user_id===owner.id).id;
  // Real authenticated schedule API, only after the disposable-fixture guard
  // and explicit recovery. Browser transport keeps the genuine session cookie.
  const schedule = await page.evaluate(async data => {
    const response = await fetch("/api/schedules", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return { status: response.status, body: await response.text() };
  }, { doctorId, clinicId: assignment.clinic_id, branchId: branch.id,
    dayOfWeek: new Date(`${requestedDate}T12:00:00Z`).getUTCDay(),
    isOpen: true, startTime: "09:00", endTime: "18:00", timezone: "UTC",
    tokenPrefix: "FICT", maxTokens: 20, consultationMinutes: 20, queueMode: "mixed" });
  expect(schedule.status, schedule.body).toBe(201);
  const bookingUrl = `/admin/book?clinic=${assignment.clinic_id}&branch=${branch.id}&date=${requestedDate}`;
  for (const [width,height] of sizes) {
    await page.setViewportSize({ width,height });
    await directoryStates(page,bookingUrl,width,height);
    await expect(page.getByTestId("booking-availability-status")).toContainText("20 places remaining");
    await help(page,"About next-date search");
    const continued = page.getByTestId("button-booking-continue-visit");
    await continued.scrollIntoViewIfNeeded();
    await expect(continued).toBeInViewport();
    await continued.click();
    await expect(page.getByRole("heading", { name: "Who is this visit for?" })).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`generated-artifacts/owner-booking-regression/continued-${width}.png`,fullPage:true});
  }
  const final = await (await page.request.get("/api/__owner-booking-evidence")).json();
  expect(final.appointments).toEqual(initial.appointments);
  expect(final.assignments).toEqual(initial.assignments);
  expect(final.doctors.filter((item:any)=>item.user_id===owner.id)).toHaveLength(1);
  for(const email of [owner.email,"super@owner.test.invalid"]){
    const context=await browser.newContext({baseURL:test.info().project.use.baseURL});
    const fresh=await context.newPage();
    await login(fresh,email);
    await fresh.goto(`/admin/book?clinic=${assignment.clinic_id}&branch=${branch.id}`);
    await expect(fresh.getByRole("button",{name:"Doctor: Fictional Recovery Owner",exact:true})).toBeVisible();
    await context.close();
  }
});
