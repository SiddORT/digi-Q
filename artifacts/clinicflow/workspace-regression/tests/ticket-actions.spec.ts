import { test, expect, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { emailVisit } from "../ticket-email-test-data";

const labels = ["Download Ticket","Print Ticket","Email Ticket","SMS Booking Status Link","Get Directions","Open Live Ticket"];
const json = (r:Route, data:unknown, status=200) => r.fulfill({status,json:data});
type State = { result?: string; denied?: boolean; missingAddress?: boolean; ineligible?: boolean; failure?:number; hold?:Promise<void> };
async function mount(page:Page, state:State={},entry="lifecycle") {
  const sends:{id:string;requestId:string;previewToken?:string}[]=[];
  const links:unknown[]=[];
  await page.addInitScript(()=>sessionStorage.setItem("friendly-fixture-intercepted","yes"));
  await page.route("**/api/**",async r=>{
    const req=r.request(), path=new URL(req.url()).pathname;
    if(path.endsWith("/auth/csrf"))return json(r,{csrfToken:"fictional"});
    if(path.endsWith("/me"))return json(r,{user:{id:"fixture",role:"superAdmin"}});
    if(path.endsWith("/live-ticket-links")){links.push(req.postDataJSON());return json(r,{url:"https://example.invalid/live-ticket#fictional-capability"});}
    if(/\/appointments\/(one|two)$/.test(path)){
      const id=path.split("/").pop();
      if(state.denied)return json(r,{error:"Outside your scope"},403);
      return json(r,{...emailVisit,id,reference:`VISIT-${id?.toUpperCase()}`,branchAddress:state.missingAddress?null:emailVisit.branchAddress});
    }
    if(path.endsWith("/qr"))return json(r,{checkInUrl:"https://example.invalid/private"});
    if(path.endsWith("/queue"))return json(r,{entries:[],presence:{status:"available"},ownEntry:{estimate:{state:"ready",patientsAhead:3,waitMinutes:90,basis:"remainingQueue",asOf:new Date().toISOString(),guidance:"Estimate only."}}});
    if(path.endsWith("/sms-status-link") || path.endsWith("/email-ticket")){
      const id=path.split("/")[3];
      if(req.method()==="GET")return json(r,path.endsWith("/email-ticket")?{eligible:true,recipient:`${id}@example.invalid`}:{eligible:!state.ineligible,reason:"The saved account mobile is missing or invalid. Ask the patient to update their account.",recipient:"+919876543210",message:"Your booking status link.",previewToken:`preview-${id}`});
      sends.push({id,...req.postDataJSON()});
      if(state.hold)await state.hold;
      if(state.failure)return json(r,{error:"HTTP 503 SMTP PRIVATE_DIAGNOSTIC"},state.failure);
      return json(r,{state:state.result ?? "provider_accepted"});
    }
    return json(r,{error:`Unexpected fictional endpoint ${path}`},404);
  });
  await page.goto(`/friendly-messages.html?fixture=ticket-feedback&entry=${entry}${state.missingAddress?"&missingAddress=1":""}`);
  return {sends,links};
}
async function rowAction(page:Page,key:string,id="one") {
  await page.getByTestId(`menu-${id}`).click();
  await page.getByTestId(`action-ticket-${key}-${id}`).click();
}
async function expanded(page:Page) {
  await page.getByTestId("button-expand-appointment-one").click();
  await expect(page.getByTestId("group-ticket-actions")).toBeVisible();
}

test("Six Ticket actions have identical wording and missing-address availability",async({page})=>{
  await mount(page,{missingAddress:true});
  await page.getByTestId("menu-one").click();
  await expect(page.getByRole("menuitem")).toHaveText(labels);
  await expect(page.getByTestId("action-ticket-directions-one")).toBeDisabled();
  await expect(page.getByTestId("action-ticket-directions-one")).toHaveAttribute("title",/no saved address/);
  await page.keyboard.press("Escape");
  await expanded(page);
  await expect(page.getByTestId("group-ticket-actions").getByRole("button")).toHaveCount(6);
  for(const label of labels)await expect(page.getByTestId("group-ticket-actions").getByRole("button",{name:label,exact:true})).toBeVisible();
  await expect(page.getByTestId("button-get-directions")).toBeDisabled();
  await expect(page.getByTestId("ticket-waiting-number")).toHaveText("1");
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("90 minutes");
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("Patients ahead");
});

for(const kind of ["email","sms"]) {
  test(`Ticket ${kind} survives tab/accordion unmount; single shared host and selected booking`,async({page})=>{
    let finish!:()=>void;
    const hold=new Promise<void>(r=>finish=r);
    const {sends}=await mount(page,{hold});
    await expanded(page);
    await page.getByTestId(`button-ticket-${kind}`).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByTestId(kind==="sms"?"text-sms-recipient":"text-email-recipient-one").waitFor();
    // Simulate parent navigation while the modal owns pointer/focus; do not weaken the modal.
    await page.getByTestId("tab-detail-details").evaluate(el=>(el as HTMLElement).click());
    await page.getByTestId("button-expand-appointment-one").evaluate(el=>(el as HTMLElement).click());
    await page.getByTestId(`button-${kind}-confirm`).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect.poll(()=>sends.length).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeVisible();
    finish();
    await expect(page.getByTestId(`status-${kind}-success`)).toBeVisible();
    await expect(page.getByTestId(`button-${kind}-ok`)).toBeFocused();
    await page.getByTestId(`button-${kind}-ok`).click();
    expect(sends[0].id).toBe("one");
    await rowAction(page,kind,"two");
    await page.getByTestId(`button-${kind}-confirm`).click();
    await expect(page.getByTestId(`status-${kind}-success`)).toBeVisible();
    expect(sends.map(s=>s.id)).toEqual(["one","two"]);
    expect(sends[0].requestId).not.toBe(sends[1].requestId);
  });
}

for(const result of ["delivery_unknown","unexpected","pre_dispatch_failed","failed","provider_rejected","blocked"]) {
  test(`Ticket SMS ${result} stays honest and same-request recovery is stable`,async({page})=>{
    const state:State={result:result==="failed"?undefined:result,failure:result==="failed"?503:undefined};
    const {sends}=await mount(page,state);
    await rowAction(page,"sms");
    await expect(page.getByTestId("text-sms-recipient")).toBeVisible();
    expect(sends).toHaveLength(0);
    await page.getByTestId("button-sms-confirm").click();
    await expect(page.getByTestId("status-sms-result")).toBeVisible();
    await expect(page.getByTestId("status-sms-success")).toHaveCount(0);
    await expect(page.getByRole("dialog")).not.toContainText(/PRIVATE_DIAGNOSTIC|SMTP|provider|dispatch|invalid/i);
    if(["provider_rejected","blocked"].includes(result))await expect(page.getByTestId("button-sms-confirm")).toBeDisabled();
    else {
      await expect(page.getByTestId("button-sms-confirm")).toHaveText("Check same request");
      state.result="provider_accepted";state.failure=undefined;
      await page.getByTestId("button-sms-confirm").click();
      await expect(page.getByTestId("status-sms-success")).toHaveText("SMS submitted successfully.");
      expect(sends).toHaveLength(2);
      expect(sends[0].requestId).toBe(sends[1].requestId);
      expect(sends[0].previewToken).toBe(sends[1].previewToken);
    }
  });
}

test("Ticket SMS compact success is green, keyboard accessible and legible on phone and desktop",async({page},info)=>{
  const {sends}=await mount(page,{},"booking");
  await page.getByTestId("button-ticket-sms").click();
  await page.getByTestId("button-sms-confirm").click();
  const success=page.getByTestId("status-sms-success"), ok=page.getByTestId("button-sms-ok");
  await expect(success).toHaveText("SMS submitted successfully.");
  await expect(success.locator("svg")).toHaveCSS("color","rgb(21, 115, 71)");
  await expect(ok).toBeFocused();
  await expect.poll(()=>ok.evaluate(el=>{
    const c=getComputedStyle(el),lum=(v:string)=>v.match(/\d+/g)!.slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
    const a=lum(c.color),b=lum(c.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  })).toBeGreaterThanOrEqual(4.5);
  const bounds=await ok.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await mkdir("generated-artifacts/ticket-actions",{recursive:true});
  await page.screenshot({path:`generated-artifacts/ticket-actions/sms-${info.project.name}.png`});
  await page.keyboard.press("Enter");await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(sends).toHaveLength(1);
});

test("Ticket SMS ineligible and offline never submit",async({page})=>{
  const state:State={ineligible:true};
  const {sends}=await mount(page,state);
  await rowAction(page,"sms");
  await expect(page.getByTestId("text-sms-blocked")).toContainText("saved account mobile");
  await expect(page.getByTestId("button-sms-confirm")).toBeDisabled();
  await page.keyboard.press("Escape");
  state.ineligible=false;
  await rowAction(page,"sms");
  await expect(page.getByTestId("text-sms-recipient")).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(navigator,"onLine",{get:()=>false,configurable:true});window.dispatchEvent(new Event("offline"));});
  await page.getByTestId("button-sms-confirm").click();
  await expect(page.getByTestId("status-sms-result")).toContainText("offline");
  expect(sends).toHaveLength(0);
});

test("Ticket authorization loss or view transition drops private dialogs and ignores late results",async({page})=>{
  let finish!:()=>void;
  const state:State={hold:new Promise<void>(r=>finish=r)};
  const {sends}=await mount(page,state);
  await expanded(page);await page.getByTestId("button-ticket-sms").click();
  await page.getByTestId("button-sms-confirm").click();
  await expect.poll(()=>sends.length).toBe(1);
  state.denied=true;
  await page.getByTestId("refresh-authority").evaluate(el=>(el as HTMLElement).click());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("appointment-details")).toHaveCount(0);
  finish();
  await expect(page.getByTestId("status-sms-success")).toHaveCount(0);
  state.denied=false;state.hold=undefined;
  await page.getByTestId("switch-scope").click();
  await rowAction(page,"email","two");
  await expect(page.getByTestId("text-email-recipient-two")).toBeVisible();
  await page.getByTestId("switch-scope").evaluate(el=>(el as HTMLElement).click());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("status-sms-success")).toHaveCount(0);
});

for(const kind of ["email","sms"])test(`Ticket ${kind} late send cannot attach to a replacement view or booking`,async({page})=>{
  let finish!:()=>void;
  const state:State={hold:new Promise<void>(r=>finish=r)};
  const {sends}=await mount(page,state);
  await rowAction(page,kind);
  await page.getByTestId(`button-${kind}-confirm`).click();
  await expect.poll(()=>sends.length).toBe(1);
  await page.getByTestId("switch-scope").evaluate(el=>(el as HTMLElement).click());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await rowAction(page,kind,"two");
  await expect(page.getByTestId(`button-${kind}-confirm`)).toBeEnabled();
  finish();
  await expect(page.getByTestId(`status-${kind}-success`)).toHaveCount(0);
  await expect(page.getByTestId(`button-${kind}-confirm`)).toBeEnabled();
  expect(sends.map(s=>s.id)).toEqual(["one"]);
});

test("Ticket Directions and Live Ticket use protected new tabs and friendly popup/offline failures",async({page})=>{
  const {links}=await mount(page);
  await page.context().route("https://example.invalid/**",r=>r.fulfill({body:"Fictional live ticket"}));
  await page.context().route("https://www.google.com/**",r=>r.fulfill({body:"Fictional Maps"}));
  const mapEvent=page.waitForEvent("popup");
  await rowAction(page,"directions");
  const map=await mapEvent;await map.waitForURL(/google/);
  expect(new URL(map.url()).searchParams.get("destination")).toBe(emailVisit.branchAddress);
  expect(await map.evaluate(()=>window.opener)).toBeNull();
  await map.close();
  const liveEvent=page.waitForEvent("popup");
  await rowAction(page,"live");
  const live=await liveEvent;await live.waitForURL(/example.invalid/);
  expect(await live.evaluate(()=>window.opener)).toBeNull();
  expect(links).toEqual([{appointmentId:"one"}]);await live.close();
  expect(page.url()).toContain("friendly-messages");
  await page.evaluate(()=>{window.open=()=>null;});
  await rowAction(page,"live");
  await expect(page.getByTestId("status-ticket-action-error")).toContainText("Allow pop-ups");
  expect(links).toHaveLength(1);
  await expanded(page);await page.getByTestId("button-get-directions").click();
  await expect(page.getByTestId("status-ticket-action-error")).toContainText("Allow pop-ups");
});
