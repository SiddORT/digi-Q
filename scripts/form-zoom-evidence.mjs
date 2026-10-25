/**
 * Real Chromium tab zoom through the browser's tabs API, not CSS zoom, device
 * scale factor, pinch zoom or a manually reduced viewport. Fictional GETs only.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const dir="generated-artifacts/form-presentation/browser-zoom";
const extension=resolve(dir,"extension");
await mkdir(extension,{recursive:true});
await writeFile(`${extension}/manifest.json`,JSON.stringify({manifest_version:3,name:"Local form zoom evidence",version:"1.0",permissions:["tabs"],background:{service_worker:"worker.js"}}));
await writeFile(`${extension}/worker.js`,"chrome.runtime.onInstalled.addListener(()=>{});");
const context=await chromium.launchPersistentContext("",{
  executablePath:"/repl/tools/bin/chromium",headless:true,viewport:null,
  ignoreDefaultArgs:["--disable-extensions"],
  args:["--no-sandbox","--window-size=1024,640",`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],
});
try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent("serviceworker",{timeout:15000});
  const page=context.pages()[0]||await context.newPage();
  await page.route("**/api/**",async route=>{
    assert.equal(route.request().method(),"GET");
    const p=new URL(route.request().url()).pathname;
    const json=p==="/api/auth/status"?{authenticated:false}:
      p==="/api/me"?{user:{id:"fixture-admin",role:"superAdmin",fullName:"Fictional Administrator"},needsOnboarding:false}:
      p==="/api/settings"?{timezone:"UTC"}:
      p==="/api/workspaces"?{workspaces:[],switchable:false,activeClinicId:null}:
      {items:[],total:0,page:1,pageSize:20};
    await route.fulfill({json});
  });
  await page.goto("http://127.0.0.1:43720/?mode=staff&tab=receptionists");
  const before=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,devicePixelRatio}));
  const zoom=await worker.evaluate(async()=>{
    const tabs=await chrome.tabs.query({});
    const tab=tabs.find(t=>t.url?.startsWith("http://127.0.0.1:43720/"));
    if(!tab?.id)throw Error("Evidence tab unavailable");
    await chrome.tabs.setZoom(tab.id,2);
    return chrome.tabs.getZoom(tab.id);
  });
  assert.equal(zoom,2);
  await page.getByTestId("button-add-staff").click();
  const dialog=page.getByRole("dialog");await dialog.waitFor();
  const after=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,devicePixelRatio}));
  assert(after.innerWidth<=before.innerWidth/2+1,JSON.stringify({before,after}));
  const inputs=dialog.locator("input:not([type=hidden])");
  for(const input of await inputs.all()){
    if(!await input.isVisible()||await input.getAttribute("type")==="checkbox")continue;
    await input.scrollIntoViewIfNeeded();
    const r=await input.boundingBox();
    assert(r&&r.x>=-1&&r.x+r.width<=after.innerWidth+1,"zoomed field must remain reachable");
  }
  await dialog.getByTestId("button-save-staff").scrollIntoViewIfNeeded();
  await page.screenshot({path:`${dir}/staff-200-percent.png`});
  await writeFile(`${dir}/geometry.json`,JSON.stringify({browserZoom:zoom,before,after,method:"chrome.tabs.setZoom; physical window retained; no CSS or viewport scaling"},null,2));
  console.log(JSON.stringify({zoom,before,after}));
}finally{await context.close();}
