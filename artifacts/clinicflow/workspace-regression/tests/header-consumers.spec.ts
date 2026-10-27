import { test, expect } from "@playwright/test";
import { appWideFixture } from "./app-wide-fixture";

// Actual routed consumers, not lookalike toolbars. All requests are intercepted
// and writes rejected. Permission fixtures demonstrate layout, not live auth.
const surfaces=[
  ["superAdmin","/admin/appointments"],["superAdmin","/admin/patients"],["superAdmin","/admin/clinics"],
  ["superAdmin","/admin/staff"],["superAdmin","/admin/clinics/c1/locations"],
  ["superAdmin","/admin/clinics/c1/staff"],["superAdmin","/admin/availability"],["superAdmin","/admin/exceptions"],
  ["superAdmin","/admin/settings?area=masters"],["superAdmin","/admin/settings?area=audit"],
  ["superAdmin","/admin/users?area=system"],["superAdmin","/admin/reports"],
  ["superAdmin","/admin/reports?area=operational"],["superAdmin","/admin/reports?area=templates"],
  ["superAdmin","/admin/reports?area=communication-usage"],["superAdmin","/admin/communication?tab=logs"],
  ["superAdmin","/admin/templates"],["doctor","/doctor/clinics"],
  ["doctor","/doctor/clinics?area=staff"],["doctor","/doctor/clinics?area=qrs"],
  ["clinicAdmin","/admin/patients"],["receptionist","/receptionist/appointments"],
  ["patient","/patient/appointments"],["anonymous","/fictional-clinic/central"],
];
for(const [role,path] of surfaces)test(`${role}: real header/list consumer ${path}`,async({page},info)=>{
  const state=await appWideFixture(page,role);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${path}${path.includes("?")?"&":"?"}mode=app`);
  await expect(page.locator("main h1:visible")).toHaveCount(1);
  await expect(page.locator("[data-testid=list-header]:visible,.standard-page-header:visible").first()).toBeVisible();
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>document.fonts.ready);
    // Desktop-to-mobile resizing animates the existing drawer out. Inspect its
    // settled state, and fail if it actually remains over the page.
    if(width<=900 && await page.locator(".sidebar").count())await expect.poll(()=>page.locator(".sidebar").evaluate(e=>e.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    const measurements=await page.evaluate(()=>{
      const visible=(e:Element)=>!!(e as HTMLElement).offsetParent;
      const headers=[...document.querySelectorAll(".list-header")].filter(visible);
      const footers=[...document.querySelectorAll(".listing-region")].filter(visible).map(e=>{
        const f=e.querySelector(":scope>.pagination,:scope>.listing-footer");
        return f?{inside:f.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+2,position:getComputedStyle(f).position}:null;
      }).filter(Boolean);
      return {overflow:document.documentElement.scrollWidth-innerWidth,headers:headers.map(h=>({heads:h.querySelectorAll("h1,h2").length,hasLegacySeparateRow:!!h.querySelector(".lh-head")})),footers};
    });
    expect.soft(measurements.overflow,JSON.stringify({role,path,width})).toBeLessThanOrEqual(1);
    for(const h of measurements.headers)expect.soft(h.hasLegacySeparateRow).toBe(false);
    for(const f of measurements.footers){expect.soft(f?.inside).toBe(true);expect.soft(f?.position).toBe("static");}
  }
  await page.screenshot({path:info.outputPath("consumer-mobile.png")});
  expect(state.writes,"Layout tests cannot mutate records").toEqual([]);
  expect(state.missing,"Unknown API fixtures cannot count as rendered coverage").toEqual([]);
  expect(errors).toEqual([]);
});

test("active user tabs retain exactly one visible shell title",async({page})=>{
  const state=await appWideFixture(page,"superAdmin");
  await page.goto("/admin/users?mode=app&area=roles");
  for(const name of ["Permissions","System users","Roles"]){
    await page.getByRole("tab",{name,exact:true}).click();
    await expect(page.locator("main h1:visible")).toHaveCount(1);
  }
  expect(state.writes).toEqual([]);expect(state.missing).toEqual([]);
});

test("queue zero results and nested two-request footer remain panel-local",async({page},info)=>{
  const state=await appWideFixture(page,"superAdmin");
  await page.route("**/api/session-contexts?**",route=>route.fulfill({json:[{sessionId:"s1",doctorId:"d1",branchId:"b1",clinicId:"c1",date:"2026-10-25",startTime:"09:00",endTime:"12:00",timezone:"UTC",snapshotOnly:false}]}));
  await page.route("**/api/guest-requests?**",route=>route.fulfill({json:{items:[1,2].map(n=>({id:`g${n}`,fullName:`Fictional Request ${n}`,doctorName:"Dr. Fictional",branchName:"Fictional Central",date:"2026-10-25",startTime:"09:00",endTime:"12:00",timezone:"UTC",status:"pending"})),total:2,page:1,pageSize:10}}));
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/admin/queue?mode=app&clinic=c1&branch=b1&doctor=d1&date=2026-10-25&startTime=09:00");
  await expect(page.getByRole("heading",{level:1,name:"Queue",exact:true})).toBeVisible();
  await expect(page.locator(".sq-table>.pagination")).toContainText("0–0");
  await expect(page.getByRole("heading",{name:/Earlier Booking Requests/})).toBeVisible();
  const nested=page.getByRole("region",{name:"Earlier booking requests"});
  await expect(nested.locator(".pagination")).toContainText("1–2");
  const geometry=await nested.evaluate(e=>{
    const footer=e.querySelector(".pagination")!.getBoundingClientRect(),body=e.querySelector(".activity-list")!.getBoundingClientRect();
    return {gap:footer.top-body.bottom,position:getComputedStyle(e.querySelector(".pagination")!).position};
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(0);expect(geometry.position).toBe("static");
  await page.screenshot({path:info.outputPath("queue-nested.png"),fullPage:true});
  expect(state.missing).toEqual([]);expect(state.writes).toEqual([]);expect(errors).toEqual([]);
});
