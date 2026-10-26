/** Actual Chromium tab zoom, fictional intercepted GETs only; requires the workspace fixture server. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const dir="generated-artifacts/schedule-compact/native-zoom";
const extension=resolve(dir,"extension");
await mkdir(extension,{recursive:true});
await writeFile(`${extension}/manifest.json`,JSON.stringify({manifest_version:3,name:"Schedule zoom evidence",version:"1.0",permissions:["tabs"],background:{service_worker:"worker.js"}}));
await writeFile(`${extension}/worker.js`,"chrome.runtime.onInstalled.addListener(()=>{});");
const context=await chromium.launchPersistentContext("",{
  executablePath:"/repl/tools/bin/chromium",headless:true,viewport:null,
  ignoreDefaultArgs:["--disable-extensions"],
  args:["--no-sandbox","--window-size=1024,640",`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
});
const clinic={id:"c1",name:"Fictional long clinic group for zoom evidence",status:"active",timezone:"Asia/Kolkata",timeFormat:"12h"};
const branch={id:"b1",clinicId:"c1",name:"Fictional location with a long saved name",status:"active",timezone:"Asia/Kolkata",openingHours:[{dayOfWeek:1,startTime:"09:00",endTime:"22:00"}]};
const doctor={id:"d1",fullName:"Fictional doctor for native browser zoom",clinicIds:["c1"],branchIds:["b1"],status:"active"};
const base={doctorId:"d1",branchId:"b1",clinicId:"c1",doctorName:doctor.fullName,dayOfWeek:1,isOpen:true,status:"active",consultationMinutes:30,maxTokens:12,tokenPrefix:"A",queueMode:"mixed",timezone:"Asia/Kolkata"};
const rows=[{...base,id:"s1",startTime:"09:00",endTime:"13:00"},{...base,id:"s2",startTime:"19:00",endTime:"22:00"}];
const listing=items=>({items,total:items.length,totalPages:1,page:1,pageSize:20});
try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent("serviceworker",{timeout:15000});
  const page=context.pages()[0]||await context.newPage();
  await page.route(/https:\/\/fonts\./,route=>route.abort());
  await page.route("**/api/**",async route=>{
    assert.equal(route.request().method(),"GET","No account or schedule writes authorized");
    const path=new URL(route.request().url()).pathname;
    const json=path==="/api/me"?{user:{id:"fictional-actor",role:"superAdmin",fullName:"Fictional Actor"},needsOnboarding:false}:
      path==="/api/settings"?clinic:path==="/api/auth/csrf"?{csrfToken:"fictional"}:
      path==="/api/clinics/c1"?clinic:path==="/api/branches/b1"?branch:path==="/api/doctors/d1"?doctor:
      path==="/api/clinics"?listing([clinic]):path==="/api/branches"?listing([branch]):path==="/api/doctors"?listing([doctor]):
      path==="/api/schedules"?listing(rows):
      path==="/api/schedules/day-context"?{items:rows,days:Array.from({length:7},(_,dayOfWeek)=>({dayOfWeek,following:false,custom:true,snapshot:`fictional-${dayOfWeek}`}))}:listing([]);
    await route.fulfill({json});
  });
  const origin="http://127.0.0.1:43720";
  await page.goto(`${origin}/?mode=resource&resource=availability`);
  const before=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,devicePixelRatio}));
  const zoom=await worker.evaluate(async()=>{
    const tab=(await chrome.tabs.query({})).find(t=>t.url?.startsWith("http://127.0.0.1:43720/"));
    if(!tab?.id)throw Error("Evidence tab unavailable");
    await chrome.tabs.setZoom(tab.id,2);
    return chrome.tabs.getZoom(tab.id);
  });
  assert.equal(zoom,2);
  const after=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,devicePixelRatio}));
  assert(after.innerWidth<=before.innerWidth/2+1);
  const evidence=[];
  for(const entry of ["dialog","page","doctor"]){
    await page.goto(`${origin}/${entry==="page"?"?mode=schedule&resource=availability&doctorId=d1":entry==="doctor"?"?mode=staff&tab=doctors":"?mode=resource&resource=availability"}`);
    if(entry==="dialog")await page.getByTestId("button-edit-s1").click();
    if(entry==="doctor")await page.getByTestId("button-manage-schedule-d1").click();
    const editor=page.getByTestId("compact-day-editor");
    await editor.waitFor();await page.evaluate(()=>document.fonts.ready);
    // Portal entry animations must settle before scrolling or sampling the focused field.
    await page.waitForTimeout(300);
    await editor.locator(".cde-adv summary").last().click();
    const lastInput=editor.locator(".cde-adv").last().locator("input").last();
    await lastInput.scrollIntoViewIfNeeded();
    await lastInput.focus();
    const field=await lastInput.boundingBox();
    assert(field&&field.x>=0&&field.x+field.width<=after.innerWidth);
    const footer=await page.locator(".cde-footer").boundingBox();
    const dialog=page.getByRole("dialog").first();
    if(await dialog.count()){
      const body=await dialog.locator(".app-dialog-body").first().boundingBox();
      assert(footer&&footer.y+footer.height<=after.innerHeight);
      assert(field.y+field.height<=footer.y);
      assert(body&&field.y>=body.y,"Focused field must clear the dialog header");
    }else{
      assert.equal(await page.locator(".cde-footer").evaluate(el=>getComputedStyle(el).position),"static");
      await page.getByTestId("button-save-week").scrollIntoViewIfNeeded();
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const actionBoxes=await page.locator(".cde-footer button").evaluateAll(buttons=>buttons.map(button=>({text:button.textContent,width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})));
    assert(actionBoxes.every(box=>box.width>=80&&box.height<=64),"Footer labels must remain readable");
    // Native tab zoom needs the physical browser surface, not Playwright's CSS viewport clip.
    const cdp=await context.newCDPSession(page);
    const image=await cdp.send("Page.captureScreenshot",{format:"png",fromSurface:false});
    await writeFile(`${dir}/${entry}-200-percent.png`,Buffer.from(image.data,"base64"));
    await cdp.detach();
    evidence.push({entry,field,footer});
  }
  await writeFile(`${dir}/geometry.json`,JSON.stringify({zoom,before,after,method:"chrome.tabs.setZoom(2); unchanged physical window; no CSS zoom or viewport emulation",evidence},null,2));
  console.log(JSON.stringify({zoom,before,after,evidence}));
}finally{await context.close();}
