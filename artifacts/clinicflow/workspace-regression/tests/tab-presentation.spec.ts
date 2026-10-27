import { test, expect, type Page, type Locator } from "@playwright/test";
import inventory from "../../../../docs/ui/tab-inventory.json" with { type: "json" };

async function mount(page: Page) {
  const writes: string[] = [];
  await page.route("**/api/**", async route => {
    const req=route.request(), path=new URL(req.url()).pathname;
    if(req.method()!=="GET") { writes.push(`${req.method()} ${path}`); return route.fulfill({status:403,json:{message:"Fixture forbids writes"}}); }
    if(path==="/api/notifications") return route.fulfill({json:{items:[],unread:0}});
    if(path==="/api/settings") return route.fulfill({json:{timezone:"Asia/Kolkata",timeFormat:"24h"}});
    if(path==="/api/public/website-config") return route.fulfill({json:{publicOrigin:"https://example.invalid"}});
    return route.fulfill({json:{items:[],total:12345,page:1,pageSize:25}});
  });
  await page.goto("/?mode=tabs");
  await expect(page.getByRole("heading",{name:/Tab presentation fixtures/})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  return writes;
}
async function geometry(strip: Locator, touch: boolean) {
  return strip.evaluate((el, touch) => {
    const rect=el.getBoundingClientRect();
    const tabs=Array.from(el.querySelectorAll<HTMLElement>(':scope > .dq-tab'));
    return {width:rect.width, client:el.clientWidth, scroll:el.scrollWidth, y:tabs.map(t=>t.getBoundingClientRect().top), defects:tabs.flatMap(t=>{
      const box=t.getBoundingClientRect(), css=getComputedStyle(t);
      const icon=t.querySelector("svg"), ib=icon?.getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(t);const text=range.getBoundingClientRect();
      return [
        ...(box.height<(touch?44:40)?["height"]:[]),
        ...(t.scrollWidth>t.clientWidth+1?["clipped content"]:[]),
        ...(text.left<box.left||text.right>box.right+1?["child bounds"]:[]),
        ...(!icon||icon.getAttribute("aria-hidden")!=="true"?["icon accessibility"]:[]),
        ...(ib&&(Math.abs(ib.width-18)>.5||Math.abs(ib.height-18)>.5)?["icon size"]:[]),
        ...(css.whiteSpace!=="nowrap"?["wrapped label"]:[]),
        ...(Math.abs((ib?.y||0)+(ib?.height||0)/2-(box.y+box.height/2))>1?["icon alignment"]:[]),
      ].map(reason=>`${t.textContent}: ${reason}`);
    })};
  },touch);
}
for(const viewport of [{width:390,height:844},{width:768,height:768},{width:1024,height:640},{width:1366,height:768},{width:1920,height:1080},{width:512,height:320}]) {
  test(`all inventoried tab presentations ${viewport.width}x${viewport.height}`, async({page},info)=>{
    await page.setViewportSize(viewport);const writes=await mount(page);
    const measurements=[];
    for(const group of inventory.groups) {
      const section=page.locator(`[data-tab-sample="${group.id}"]`).first();
      const strip=section.getByRole("tablist").first();
      await strip.scrollIntoViewIfNeeded();
      const result=await geometry(strip,viewport.width<768);
      expect(result.defects,group.id).toEqual([]);
      expect(new Set(result.y.map(y=>Math.round(y))).size,group.id).toBe(1);
      const selected=strip.getByRole("tab",{selected:true}).first();
      await expect(selected).toHaveCSS("background-color","rgb(233, 241, 255)");
      await expect(selected).toHaveCSS("border-bottom-width","2px");
      await expect(selected.locator("svg")).toHaveCSS("color",await selected.evaluate(el=>getComputedStyle(el).color));
      measurements.push({id:group.id,...result});
    }
    const selector=page.getByRole("group",{name:"Appointment layout",exact:true});
    await selector.scrollIntoViewIfNeeded();
    const viewGeometry=await geometry(selector,viewport.width<768);
    expect(viewGeometry.defects).toEqual([]);
    expect(viewGeometry.width).toBeLessThan(260);
    expect(viewGeometry.scroll).toBeLessThanOrEqual(viewGeometry.client+1);
    for(const button of await selector.getByRole("button").all())
      await expect(button).toHaveCSS("flex-grow","0");
    const list=selector.getByRole("button",{name:"List",exact:true});
    const calendar=selector.getByRole("button",{name:"Calendar",exact:true});
    await calendar.hover();await expect(calendar).toHaveCSS("background-color","rgb(241, 246, 253)");
    await list.hover();await expect(list).toHaveCSS("background-color","rgb(233, 241, 255)");
    await list.focus();await page.keyboard.press("Tab");
    await expect(calendar).toBeFocused();await expect(calendar).toHaveCSS("outline-width","2px");
    await page.keyboard.press("Enter");
    await expect(calendar).toHaveAttribute("aria-pressed","true");
    await expect(calendar).toHaveCSS("background-color","rgb(233, 241, 255)");
    await expect(calendar).toHaveCSS("color",await page.locator('[data-tab-sample="appointment"] [aria-selected=true]').evaluate(el=>getComputedStyle(el).color));
    await expect(calendar).toHaveCSS("border-bottom-width","2px");
    await expect(calendar).toHaveCSS("box-shadow","none");
    await expect(list).toHaveAttribute("aria-pressed","false");
    await page.keyboard.press("Shift+Tab");await expect(list).toBeFocused();
    await page.keyboard.press("Space");await expect(list).toHaveAttribute("aria-pressed","true");
    await expect(selector.getByRole("tab")).toHaveCount(0);
    measurements.push({id:"appointment-layout",...viewGeometry});
    await page.screenshot({path:info.outputPath("appointment-view-selector.png")});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(writes).toEqual([]);
    await info.attach("geometry.json",{body:JSON.stringify(measurements,null,2),contentType:"application/json"});
    await page.locator('[data-tab-sample="appointment"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath("reference-tabs.png")});
    await page.getByRole("button",{name:"Open tab dialog",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const actual=await dialog.boundingBox();expect(actual!.width).toBeLessThanOrEqual(viewport.width);
    expect((await geometry(dialog.locator('[data-tab-sample="schedule-editor"] [role="tablist"]'),viewport.width<768)).defects).toEqual([]);
    await dialog.locator('[data-tab-sample="schedule-editor"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath("short-overlay.png")});
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"Open tab drawer",exact:true}).click();
    const drawer=page.getByRole("dialog");
    await drawer.locator('[data-tab-sample="patient-drawer"]').scrollIntoViewIfNeeded();
    expect((await geometry(drawer.locator('[data-tab-sample="patient-drawer"] [role="tablist"]'),viewport.width<768)).defects).toEqual([]);
    await page.screenshot({path:info.outputPath("drawer.png")});
  });
}
test("hover, selected, focus, flags, disabled, roving navigation and rejected selection",async({page},info)=>{
  await page.setViewportSize({width:1366,height:768});await mount(page);
  const strip=page.locator('[data-tab-sample="appointment"] [role="tablist"]');
  const inactive=strip.getByRole("tab",{name:"Details",exact:true});
  await inactive.hover();await expect(inactive).toHaveCSS("background-color","rgb(241, 246, 253)");
  await inactive.click();await expect(inactive).toHaveCSS("background-color","rgb(233, 241, 255)");
  await page.keyboard.press("ArrowRight");const history=strip.getByRole("tab",{name:"History",exact:true});
  await expect(history).toBeFocused();await expect(history).toHaveCSS("outline-width","2px");
  await page.screenshot({path:info.outputPath("selected-keyboard-focus.png")});
  await page.keyboard.press("Home");await expect(strip.getByRole("tab",{name:"Booking",exact:true})).toBeFocused();
  const form=page.locator('[data-tab-sample="schedule-editor"]');
  const error=form.getByRole("tab").first(), attention=form.getByRole("tab").nth(1);
  await error.click();await expect(error.locator(".editor-tab-flag")).toBeVisible();
  await expect(error).toHaveCSS("background-color","rgb(233, 241, 255)");
  await attention.click();await expect(attention.locator('[data-attention=true]')).toBeVisible();
  await expect(error.locator(".editor-tab-flag")).not.toHaveCSS("color",await attention.locator(".editor-tab-flag").evaluate(el=>getComputedStyle(el).color));
  const disabled=page.getByRole("tab",{name:"Disabled",exact:true});await expect(disabled).toBeDisabled();await expect(disabled).toHaveCSS("opacity","0.5");
  const long=page.locator('[data-tab-sample="long"]');await long.getByRole("tab").first().focus();await page.keyboard.press("End");
  await expect(long.getByRole("tab").last()).toBeFocused();await expect(long.getByRole("tab").last()).toHaveAttribute("aria-selected","true");
  await page.screenshot({path:info.outputPath("flags-and-long-labels.png")});
  const rejected=page.getByRole("tablist",{name:"Rejected selection",exact:true});
  await rejected.getByRole("tab").first().focus();await page.keyboard.press("ArrowRight");
  await expect(rejected.getByRole("tab").first()).toBeFocused();
  await expect(rejected.getByRole("tab").first()).toHaveAttribute("aria-selected","true");
});
test("real onboarding nested tabs, notification popup, patient drawer and dynamic search",async({page},info)=>{
  await page.setViewportSize({width:390,height:844});const writes=await mount(page);
  const owner=page.locator('[data-tab-sample="owner-locations"]');
  const location=owner.getByRole("tablist",{name:"Location",exact:true});
  await location.getByRole("tab").first().focus();await page.keyboard.press("End");
  await expect(location.getByRole("tab").last()).toHaveAttribute("aria-selected","true");
  // The real onboarding editor renders weekdays as seven schedule rows, not a nested tablist.
  await expect(owner.getByTestId("owner-weekly-sessions").locator(".wdr-row")).toHaveCount(7);
  await page.screenshot({path:info.outputPath("real-onboarding-nested.png")});
  await page.getByRole("button",{name:"Open real patient drawer",exact:true}).click();
  const drawer=page.getByRole("dialog");const patientTabs=drawer.getByRole("tablist");
  await expect(patientTabs.getByRole("tab")).toHaveCount(3);
  await patientTabs.getByRole("tab",{name:"Timeline",exact:true}).focus();await page.keyboard.press("ArrowRight");
  await expect(patientTabs.getByRole("tab",{name:"Activity",exact:true})).toBeFocused();
  await page.screenshot({path:info.outputPath("real-patient-drawer.png")});await page.keyboard.press("Escape");
  await page.getByTestId("button-notifications").click();
  const notif=page.getByRole("tablist",{name:"Notification type"});
  await expect(notif.getByRole("tab")).toHaveCount(4);
  await notif.getByRole("tab",{name:"All",exact:true}).focus();await page.keyboard.press("End");
  await expect(notif.getByRole("tab",{name:"System",exact:true})).toBeFocused();
  await page.screenshot({path:info.outputPath("real-notification-popup.png")});await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Search workspace (Control or Command K)",exact:true}).click();
  await page.getByRole("searchbox").fill("test");
  const search=page.getByRole("tablist",{name:"Search categories"});
  await expect(search.locator(".ws-tab-count").first()).toContainText("12345");
  await page.getByTestId("search-tab-more").click();
  await page.getByRole("menuitem",{name:"Schedules",exact:true}).click();
  await expect(page.getByTestId("search-tab-schedules")).toHaveAttribute("aria-selected","true");
  expect((await geometry(search,true)).defects).toEqual([]);
  await page.screenshot({path:info.outputPath("real-dynamic-search.png")});
  expect(writes).toEqual([]);
});
test("touch tabs retain 44px targets and internal scrolling",async({browser},info)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();await mount(page);
  const section=page.locator('[data-tab-sample="settings"]').first(), strip=section.getByRole("tablist");
  await strip.scrollIntoViewIfNeeded();expect((await geometry(strip,true)).defects).toEqual([]);
  await strip.evaluate(el=>el.scrollLeft=el.scrollWidth);
  const last=strip.getByRole("tab").last();await last.tap();await expect(last).toHaveAttribute("aria-selected","true");
  await page.screenshot({path:info.outputPath("touch-scroll.png")});await context.close();
});
