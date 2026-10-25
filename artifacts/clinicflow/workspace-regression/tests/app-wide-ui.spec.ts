import { test, expect } from "@playwright/test";
import { appWideFixture } from "./app-wide-fixture";
import { expectFormBounds } from "./compact-geometry";
import { readFileSync, writeFileSync } from "node:fs";

// Derive registered destinations, not an independently maintained subset.
const source=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");
const routeBlock=source.match(/const routes: Record<string,string\[\]> = \{([\s\S]*?)\n\};/)![1];
const routes=Object.fromEntries([...routeBlock.matchAll(/(\w+):\[([^\]]+)\]/g)].map(m=>[m[1],[...m[2].matchAll(/"([^"]+)"/g)].map(x=>x[1])]));
const widths=[{width:1024,height:640},{width:1366,height:768},{width:390,height:844}];
const publicPaths=["/","/sign-in","/login","/patient-login","/demo-login","/forgot-password","/reset-password","/set-password?token=fictional-only","/register-clinic","/sign-up","/register","/register-doctor","/scan-qr","/check-in","/guest-booking","/book/fictional-qr","/fictional-clinic","/fictional-clinic/central","/display/fictional-qr","/not/a/valid/route"];
const variants=[
  {role:"doctor",path:"/register-clinic"},
  ...publicPaths.map(path=>({role:"anonymous",path})),
  ...["superAdmin","clinicAdmin","doctor","receptionist","patient"].flatMap(role=>(routes[["superAdmin","clinicAdmin"].includes(role)?"admin":role]||[]).map((page:string)=>({role,path:`/${["superAdmin","clinicAdmin"].includes(role)?"admin":role}/${page}`}))),
  ...["details","locations","staff","policies","activity-history"].flatMap(section=>["superAdmin","clinicAdmin"].map(role=>({role,path:`/admin/clinics/c1/${section}`}))),
  ...["live","templates","operational","communication-usage"].flatMap(area=>["superAdmin","clinicAdmin"].map(role=>({role,path:`/admin/reports?area=${area}`}))),
  ...["platform","integrations","masters","audit","demo"].map(area=>({role:"superAdmin",path:`/admin/settings?area=${area}`})),
  ...["roles","permissions","system"].map(area=>({role:"superAdmin",path:`/admin/users?area=${area}`})),
  ...["clinics","staff","qrs"].map(area=>({role:"doctor",path:`/doctor/clinics?area=${area}`})),
  ...["email","sms","logs"].map(tab=>({role:"superAdmin",path:`/admin/communication?tab=${tab}`})),
];

for(const {role,path} of variants) test(`app-wide ${role} ${path}`,async({page},info)=>{
  const state=await appWideFixture(page,role);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const target=`${path}${path.includes("?")?"&":"?"}mode=app`;
  await page.goto(target);
  await expect(page.locator("main,.public-book,.clinic-display,.empty,.page-loading").first()).toBeVisible();
  // Wait for the actual guarded route to resolve, not just the shell.
  await expect(page.locator(".page-loading")).toHaveCount(0);
  if(role==="anonymous")expect(new URL(page.url()).pathname).not.toContain("/anonymous/");
  const results=[];
  for(const size of widths){
    await page.setViewportSize(size);
    await page.evaluate(()=>document.fonts.ready);
    await expectFormBounds(page,"body");
    const geometry=await page.evaluate(()=>{
      const clipped:string[]=[];
      for(const control of document.querySelectorAll<HTMLElement>('main button,main a.button,[role="dialog"] button')){
        if(!control.checkVisibility()||control.closest('[hidden],[inert],.table-wrap,.table-scroll,table thead,[role="tablist"],.sr-only'))continue;
        const r=control.getBoundingClientRect();
        if(!r.width||!r.height)continue;
        if(r.left< -1||r.right>innerWidth+1)clipped.push(`control outside viewport: ${control.textContent?.trim()} (${control.className})`);
        // Text, not scrollWidth (badges and transparent hit areas add scroll extents).
        for(const node of control.childNodes){
          if(node.nodeType!==Node.TEXT_NODE||!node.textContent?.trim())continue;
          const range=document.createRange();range.selectNodeContents(node);
          const box=range.getBoundingClientRect();
          if(box.width&&(box.left<r.left-2||box.right>r.right+2))clipped.push(`text outside control: ${node.textContent.trim()}`);
        }
      }
      return {overflow:document.documentElement.scrollWidth-innerWidth,clipped,headings:[...document.querySelectorAll("main h1,main h2")].filter(n=>(n as HTMLElement).checkVisibility()).map(n=>n.textContent),url:location.pathname+location.search};
    });
    results.push({viewport:size,...geometry});
    await page.screenshot({path:info.outputPath(`${size.width}.png`)});
    expect.soft(geometry.overflow,`${size.width}: page overflow`).toBeLessThanOrEqual(1);
    expect.soft(geometry.clipped,`${size.width}: readable controls`).toEqual([]);
  }
  const resultPath=info.outputPath("route-result.json");
  writeFileSync(resultPath,JSON.stringify({role,path,identity:state.user,results,missingContracts:[...new Set(state.missing)],writes:state.writes,errors},null,2));
  await info.attach("route-result",{path:resultPath,contentType:"application/json"});
  expect(state.missing,"Fixture gaps are blockers, not accepted screens").toEqual([]);
  expect(state.writes).toEqual([]);
  expect(errors).toEqual([]);
});
