/**
 * Fictional read-only rendered baselines and candidate evidence.
 * FORM_EVIDENCE_URL selects an archived-source harness for a genuine baseline.
 * Never replace baseline output with candidate captures.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase=process.argv[2];
assert(["before","after"].includes(phase),"Use before or after");
const base=process.env.FORM_EVIDENCE_URL || "http://127.0.0.1:43720";
const dir=`generated-artifacts/form-presentation/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
const results=[];
try{
  for(const viewport of [{width:390,height:844},{width:768,height:900},{width:1024,height:640},{width:1366,height:768},{width:1920,height:1080},{width:512,height:320}]){
    const context=await browser.newContext({viewport,reducedMotion:"reduce"});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/api/**",async route=>{
      assert.equal(route.request().method(),"GET","evidence must not send notifications or write records");
      const p=new URL(route.request().url()).pathname;
      let json;
      if(p==="/api/auth/status")json={authenticated:false};
      else if(p==="/api/me")json={user:{id:"fixture-admin",role:"superAdmin",fullName:"Fictional Administrator"},needsOnboarding:false};
      else if(p==="/api/workspaces")json={workspaces:[],switchable:false,activeClinicId:null};
      else if(p==="/api/settings")json={timezone:"UTC"};
      else if(/geography|masters|pincode|saved-views|doctors|users|clinics|branches|staff-assignment-options/.test(p))json={items:[],total:0,page:1,pageSize:20};
      else throw Error(`Unaccounted evidence request ${p}`);
      await route.fulfill({json});
    });
    for(const mode of ["compact-ui","staff"]){
      await page.goto(`${base}/?mode=${mode}&tab=receptionists`);
      if(mode==="staff"){
        await page.getByTestId("button-add-staff").click();
        await page.getByRole("dialog").waitFor();
      }else await page.getByRole("heading",{name:"Compact UI fixture"}).waitFor();
      await page.evaluate(()=>document.fonts.ready);
      const scope=mode==="staff"?'[role="dialog"]':"main";
      const geometry=await page.locator(scope).evaluate(root=>{
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
        return {
          root:rect(root),scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,
          headings:[...root.querySelectorAll(".form-section h3")].map(el=>el.textContent),
          controls:[...root.querySelectorAll("input:not([type=hidden]),textarea,select,.searchable-select-control,.searchable-multi-select-control,.staff-verify,.form-field-label,.form-footer")].map(el=>({
            tag:el.tagName,type:el.getAttribute("type"),testId:el.getAttribute("data-testid"),className:el.className,
            rect:rect(el),lineHeight:getComputedStyle(el).lineHeight,marginTop:getComputedStyle(el).marginTop,
          })),
        };
      });
      results.push({viewport,mode,geometry,errors:[...errors]});
      await page.screenshot({path:`${dir}/${mode}-${viewport.width}.png`});
    }
    await context.close();
  }
}finally{await browser.close();}
await writeFile(`${dir}/geometry.json`,JSON.stringify(results,null,2));
console.log(`${phase}: ${results.length} rendered profiles; ${results.reduce((n,r)=>n+r.errors.length,0)} browser errors; ${dir}`);
