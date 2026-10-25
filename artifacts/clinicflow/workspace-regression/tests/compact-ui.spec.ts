import { test, expect, type Page } from "@playwright/test";
import { expectFormBounds, expectPopupBounds } from "./compact-geometry";

async function mount(page:Page){
  await page.route("**/api/**",async route=>{
    const p=new URL(route.request().url()).pathname;
    if(route.request().method()!=="GET")throw Error(`Unexpected compact fixture write: ${p}`);
    if(p==="/api/auth/status")return route.fulfill({json:{authenticated:false}});
    if(p==="/api/workspaces")return route.fulfill({json:{workspaces:[],switchable:false,activeClinicId:null}});
    if(p==="/api/me")return route.fulfill({json:{user:{id:"fictional-compact",role:"superAdmin",fullName:"Fictional"},needsOnboarding:false}});
    if(/geography|masters/.test(p))return route.fulfill({json:{items:[],total:0,page:1,pageSize:20}});
    if(/pincode/.test(p))return route.fulfill({json:{items:[],available:false}});
    throw Error(`Missing compact fixture contract: ${p}`);
  });
  await page.goto("/?mode=compact-ui");
  await expect(page.getByRole("heading",{name:"Compact UI fixture"})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}

for(const [width,height] of [[390,844],[768,900],[1024,640],[1366,768],[1920,1080]]){
  test(`compact field, feedback, switch, menu and dialog geometry ${width}x${height}`,async({page},info)=>{
    await page.setViewportSize({width,height});await mount(page);
    await expectFormBounds(page);
    const text=page.getByTestId("text-field");
    const expectedHeight=width<768?44:40;
    expect((await text.boundingBox())!.height).toBe(expectedHeight);
    expect((await page.getByTestId("email-field").boundingBox())!.height).toBe(expectedHeight);
    expect((await page.locator(".searchable-multi-select-control").first().boundingBox())!.height).toBe(expectedHeight);
    if(width>=768)expect(Math.abs((await text.boundingBox())!.y-(await page.getByTestId("email-field").boundingBox())!.y)).toBeLessThanOrEqual(1);
    const control=page.getByTestId("compact-switch");
    await control.scrollIntoViewIfNeeded();
    expect((await control.boundingBox())!.height).toBe(20);
    expect((await control.boundingBox())!.width).toBe(36);
    await control.click();await expect(control).toBeChecked();
    await expect(control.locator("span")).toHaveCSS("transform","matrix(1, 0, 0, 1, 16, 0)");
    // Reproduce the old real-cascade defect without changing application files.
    await page.evaluate(()=>{const style=document.querySelector<HTMLStyleElement>('style[data-vite-dev-id$="/src/compact-ui.css"]');if(!style?.sheet)throw Error("Final application stylesheet missing");style.sheet.disabled=true;});
    const before=await control.boundingBox();
    await control.screenshot({path:info.outputPath("switch-before.png")});
    await page.evaluate(()=>{document.querySelector<HTMLStyleElement>('style[data-vite-dev-id$="/src/compact-ui.css"]')!.sheet!.disabled=false;});
    await control.screenshot({path:info.outputPath("switch-after.png")});
    await info.attach("switch-geometry",{body:JSON.stringify({before,after:await control.boundingBox()}),contentType:"application/json"});
    await page.getByRole("button",{name:"Toggle errors",exact:true}).click();
    await text.focus();
    await expect(text).toHaveCSS("outline-width","2px");
    await expect(text).toHaveCSS("border-color","rgb(143, 31, 24)");
    const focused=await text.evaluate(el=>({height:el.getBoundingClientRect().height,outline:getComputedStyle(el).outlineWidth,border:getComputedStyle(el).borderColor}));
    expect(focused.height).toBe(expectedHeight);expect(focused.outline).toBe("2px");expect(focused.border).toBe("rgb(143, 31, 24)");
    await expect(page.locator(".form-field-error")).toHaveCount(2);
    await expectFormBounds(page);
    await page.screenshot({path:info.outputPath("feedback.png")});
    await page.getByRole("button",{name:"Toggle disabled",exact:true}).click();
    await expect(text).toBeDisabled();expect((await text.boundingBox())!.height).toBe(expectedHeight);
    expect((await control.boundingBox())!.height).toBe(20);
    await page.getByRole("button",{name:"Toggle disabled",exact:true}).click();
    await page.getByRole("button",{name:"Toggle readonly",exact:true}).click();await expect(text).toHaveAttribute("readonly","");
    await page.getByRole("button",{name:"Toggle readonly",exact:true}).click();
    for(const kind of ["dialog","drawer"]){
      await page.getByRole("button",{name:`Open ${kind}`,exact:true}).click();
      const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
      await expectFormBounds(page,'[role="dialog"]');
      expect((await dialog.getByTestId("compact-switch").boundingBox())!.height).toBe(20);
      await dialog.getByTestId("compact-switch").scrollIntoViewIfNeeded();
      const footer=await dialog.locator(".form-footer").boundingBox(),switchBox=await dialog.getByTestId("compact-switch").boundingBox();
      expect(switchBox!.y+switchBox!.height).toBeLessThanOrEqual(footer!.y+1);
      await page.screenshot({path:info.outputPath(`${kind}.png`)});
      await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button",{name:`Open ${kind}`,exact:true})).toBeFocused();
    }
    await page.getByRole("button",{name:"Fictional row actions",exact:true}).click();
    await expectPopupBounds(page,".row-menu-list");
    await page.keyboard.press("Escape");await expect(page.locator(".row-menu-list")).toHaveCount(0);
    await page.getByTestId("button-profile-menu").click();await expectPopupBounds(page,".profile-menu-panel");
    await page.keyboard.press("Escape");await expect(page.getByTestId("button-profile-menu")).toBeFocused();
  });
}

test("multi-select keeps long chips readable and keyboard selection/removal intact",async({page})=>{
  await page.setViewportSize({width:390,height:844});await mount(page);
  const trigger=page.locator("#compact-multiple").first();
  await trigger.scrollIntoViewIfNeeded();await trigger.click();
  await expectPopupBounds(page,".searchable-select-popup");
  await page.locator(".searchable-select-popup").getByRole("option").first().click();
  const field=page.locator(".searchable-multi-select-control").first();
  expect((await field.boundingBox())!.height).toBeGreaterThan(44);
  await page.keyboard.press("Escape");
  await expectFormBounds(page);
  await field.getByRole("button",{name:/Remove/}).click();
  expect((await field.boundingBox())!.height).toBe(44);
  await trigger.focus();await page.keyboard.press("Enter");
  await expect(page.locator(".searchable-select-popup")).toBeVisible();
  await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
});

test("help families share dismissal, permit pointer travel and preserve unclipped text",async({page})=>{
  await page.setViewportSize({width:1024,height:640});await mount(page);
  const help=page.getByRole("button",{name:"Explanation",exact:true});
  await help.hover();const bubble=page.locator(".helptip-bubble");await expect(bubble).toBeVisible();
  await bubble.hover();await page.waitForTimeout(250);await expect(bubble).toBeVisible();
  await page.keyboard.press("Escape");await expect(bubble).toHaveCount(0);
  await help.focus();await expect(bubble).toBeVisible();
  await page.getByTestId("compact-clipped").focus();await expect(bubble).toHaveCount(0);await expect(page.locator(".ov-pop")).toBeVisible();
  await expectPopupBounds(page,".ov-pop");
  await page.getByRole("button",{name:"Library help",exact:true}).focus();
  await expect(page.locator(".ov-pop")).toHaveCount(0);await expect(page.locator(".dq-tooltip")).toBeVisible();
  await help.focus();await expect(page.locator(".dq-tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(bubble).toHaveCount(0);
  await page.getByTestId("compact-short").hover();await expect(page.locator(".ov-pop")).toHaveCount(0);
});

test("real touch toggles and outside dismissal remains settled",async({browser})=>{
  const context=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  const page=await context.newPage();await mount(page);
  const reveal=page.getByTestId("compact-clipped");
  await reveal.tap();await expect(page.locator(".ov-pop")).toBeVisible();
  await reveal.tap();await expect(page.locator(".ov-pop")).toHaveCount(0);
  await reveal.tap();await page.getByRole("heading",{name:"Compact UI fixture"}).tap();
  await page.waitForTimeout(500);await expect(page.locator(".ov-pop")).toHaveCount(0);
  const help=page.getByRole("button",{name:"Explanation",exact:true});
  await help.tap();await expect(page.locator(".helptip-bubble")).toBeVisible();
  await help.tap();await expect(page.locator(".helptip-bubble")).toHaveCount(0);
  await help.tap();await page.getByRole("heading",{name:"Compact UI fixture"}).tap();
  await page.waitForTimeout(500);await expect(page.locator(".helptip-bubble")).toHaveCount(0);
  await context.close();
});

test("contrast, reduced motion, uploading and 200% reflow",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await mount(page);
  const pairs=await page.locator("[data-feedback]").evaluateAll(els=>els.map(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor})));
  const luminance=(rgb:string)=>{const v=rgb.match(/\d+/g)!.slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
  for(const p of pairs){const a=luminance(p.color),b=luminance(p.bg);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);}
  await page.getByRole("button",{name:"Explanation",exact:true}).focus();
  expect(await page.locator(".helptip-bubble").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  await page.locator('input[type="file"]').setInputFiles({name:"Fictional-long-filename-for-compact-ui-verification.txt",mimeType:"text/plain",buffer:Buffer.from("Fictional fixture")});
  expect(await page.locator('input[type="file"]').evaluate(el=>(el as HTMLInputElement).files?.[0]?.name)).toBe("Fictional-long-filename-for-compact-ui-verification.txt");
  // 200% CSS zoom at 1366px gives the same 683px layout viewport used for reflow.
  await page.setViewportSize({width:683,height:384});await expectFormBounds(page);
  await page.evaluate(()=>{document.documentElement.style.zoom="2";});
  await page.setViewportSize({width:1366,height:768});await expectFormBounds(page);
});
