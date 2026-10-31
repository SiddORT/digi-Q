import { test, expect, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { emailVisit } from "../ticket-email-test-data";

const json = (route: Route, data: unknown, status=200) => route.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
type Send = { id:string; requestId:string; recipient:string };
async function setup(page:Page, options:{
  role?:string; ineligible?:string[]; previewFailure?:boolean; denied?:boolean;
  reply?:(route:Route,send:Send,sends:Send[])=>Promise<unknown>;
}={}) {
  const sends:Send[]=[];
  let previews=0;
  await page.addInitScript(()=>sessionStorage.setItem("friendly-fixture-intercepted","yes"));
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith("/auth/csrf"))return json(route,{csrfToken:"fictional-csrf"});
    if(path.endsWith("/me"))return json(route,{user:{id:"fixture",role:options.role||"superAdmin",fullName:"Fictional Actor"}});
    if(path.endsWith("/appointments/one"))return json(route,emailVisit);
    if(path.endsWith("/qr"))return json(route,{appointmentId:"one",checkInUrl:"https://example.invalid/private"});
    if(path.endsWith("/queue"))return json(route,{entries:[],presence:{status:"available"}});
    if(path.endsWith("/email-ticket")){
      const id=path.split("/")[3];
      if(options.denied)return json(route,{error:"Appointment outside your scope"},403);
      if(route.request().method()==="GET"){
        previews++;
        if(options.previewFailure&&previews===1)return json(route,{error:"HTTP 503 SMTP PRIVATE_DIAGNOSTIC"},503);
        return json(route,{recipient:`${id}@example.invalid`,eligible:!options.ineligible?.includes(id),reason:"Add an email address to the patient’s account, then try again."});
      }
      const send={id,...route.request().postDataJSON()};sends.push(send);
      return options.reply?options.reply(route,send,sends):json(route,{state:"provider_accepted"});
    }
    return json(route,{error:`Unexpected fictional endpoint: ${path}`},404);
  });
  return sends;
}
async function open(page:Page,entry="single",expectRecipient=true){
  await page.goto(`/friendly-messages.html?fixture=ticket-feedback&entry=${entry}`);
  if(entry==="single")await page.getByTestId("open-email").click();
  if(entry==="row"){
    await page.getByTestId("menu-one").click();
    await page.getByTestId("action-ticket-email-one").click();
  }
  if(entry==="booking")await page.getByTestId("button-ticket-email").click();
  if(entry==="bulk"){
    await page.getByTestId("menu-bulk-more").click();
    await page.getByRole("menuitem",{name:"Email Tickets…",exact:true}).click();
  }
  if(expectRecipient)await expect(page.getByTestId("text-email-recipient-one")).toBeVisible();
}
async function noDiagnostics(page:Page){
  await expect(page.getByTestId("status-email-summary")).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toContainText(/submitted|unconfirmed|not completed|ineligible|unchecked|provider|PRIVATE_DIAGNOSTIC|0 recipients/i);
}
async function visibleOK(page:Page){
  const ok=page.getByRole("button",{name:"OK",exact:true});
  await expect(ok).toBeVisible();
  await expect(ok).toBeFocused();
  const rgb=(v:string)=>v.match(/\d+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
  const light=(v:string)=>rgb(v).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const contrast=(color:string,background:string)=>{
    const a=light(color),b=light(background);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  };
  // The shared primary action animates its background for 180ms when the
  // sending action becomes OK. Check settled contrast, not an animation frame.
  await expect.poll(async()=>{
    const colors=await ok.evaluate(el=>{const s=getComputedStyle(el);return [s.color,s.backgroundColor];});
    return contrast(colors[0],colors[1]);
  }).toBeGreaterThanOrEqual(4.5);
  const appearance=await ok.evaluate(el=>{
    const style=getComputedStyle(el),r=el.getBoundingClientRect();
    return {color:style.color,background:style.backgroundColor,width:r.width,height:r.height,
      inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight};
  });
  expect(appearance.inside).toBe(true);
  expect(appearance.height).toBeGreaterThanOrEqual(40);
  expect(contrast(appearance.color,appearance.background)).toBeGreaterThanOrEqual(4.5);
}

for(const role of ["superAdmin","clinicAdmin","doctor","receptionist"])
  for(const entry of ["row","booking","bulk"]){
    test(`Ticket accepted: ${role} ${entry} confirms recipients and dismisses without resending`,async({page},info)=>{
      const sends=await setup(page,{role});
      await open(page,entry);
      expect(sends).toHaveLength(0);
      await page.getByTestId("button-email-confirm").click();
      await expect(page.getByTestId("status-email-success")).toHaveText(entry==="bulk"?"Ticket emails sent successfully.":"Ticket email sent successfully.");
      await expect(page.getByTestId("list-ticket-email")).toHaveCount(0);
      await noDiagnostics(page);await visibleOK(page);
      expect(sends).toHaveLength(entry==="bulk"?3:1);
      if(role==="superAdmin"&&entry==="row"){
        await mkdir(resolve("generated-artifacts/ticket-email"),{recursive:true});
        await page.screenshot({path:resolve(`generated-artifacts/ticket-email/accepted-${info.project.name}.png`)});
      }
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(sends).toHaveLength(entry==="bulk"?3:1);
    });
  }

for(const entry of ["row","booking","bulk"]){
  test(`Ticket unauthorized patient ${entry} cannot confirm or send`,async({page})=>{
    const sends=await setup(page,{role:"patient",denied:true});
    await open(page,entry,false);
    await expect(page.getByRole("dialog")).toContainText("You do not have permission");
    await expect(page.getByTestId("button-email-confirm")).toBeDisabled();
    await expect(page.getByTestId("status-email-success")).toHaveCount(0);
    await noDiagnostics(page);
    expect(sends).toHaveLength(0);
  });
}

test("Ticket repeated confirmation clicks dispatch once, block Escape while sending and restore focus after OK",async({page})=>{
  let finish!:()=>void;
  const hold=new Promise<void>(r=>finish=r);
  const sends=await setup(page,{reply:async route=>{await hold;return json(route,{state:"provider_accepted"});}});
  await open(page);
  await page.getByTestId("button-email-confirm").evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect.poll(()=>sends.length).toBe(1);
  await expect(page.getByTestId("status-email-success")).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toBeVisible();
  finish();
  await expect(page.getByTestId("status-email-success")).toBeVisible();
  await visibleOK(page);
  await page.getByTestId("button-email-ok").click();
  await expect(page.getByTestId("open-email")).toBeFocused();
  expect(sends).toHaveLength(1);
});

for(const outcome of ["unknown","unexpected","empty","failed","conflict"]){
  test(`Ticket ${outcome} never claims success; safe recovery keeps the same request`,async({page})=>{
    const sends=await setup(page,{reply:async(route,_send,list)=>{
      if(list.length>1)return json(route,{state:"provider_accepted"});
      if(outcome==="failed")return json(route,{error:"HTTP 503 SMTP PRIVATE_DIAGNOSTIC"},503);
      if(outcome==="conflict")return json(route,{error:"Recipient changed. Review and confirm again."},409);
      return json(route,outcome==="empty"?{}:{state:outcome});
    }});
    await open(page);await page.getByTestId("button-email-confirm").click();
    await expect(page.getByText("Ticket email needs attention.",{exact:true})).toBeVisible();
    await expect(page.getByTestId("status-email-success")).toHaveCount(0);
    await noDiagnostics(page);
    await visibleOK(page);
    if(outcome==="conflict"){
      await page.getByRole("button",{name:"Review recipient",exact:true}).click();
      await expect(page.getByTestId("text-email-recipient-one")).toBeVisible();
      expect(sends).toHaveLength(1);
      await page.getByTestId("button-email-confirm").click();
    }else await page.getByRole("button",{name:outcome==="failed"?"Retry same request":"Check same request",exact:true}).click();
    await expect(page.getByTestId("status-email-success")).toBeVisible();
    expect(sends).toHaveLength(2);
    expect(sends[1].requestId).toBe(sends[0].requestId);
    expect(sends[1].recipient).toBe("one@example.invalid");
    await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(sends).toHaveLength(2);
  });
}

test("Ticket missing recipient is actionable and cannot send",async({page})=>{
  const sends=await setup(page,{ineligible:["one"]});
  await page.goto("/friendly-messages.html?fixture=ticket-feedback");
  await page.getByTestId("open-email").click();
  await expect(page.getByTestId("text-email-disabled-one")).toContainText("Add an email address");
  await expect(page.getByTestId("button-email-confirm")).toBeDisabled();
  await noDiagnostics(page);
  await expect(page.getByTestId("status-email-success")).toHaveCount(0);
  expect(sends).toHaveLength(0);
});

test("Ticket preview failure recovers only the recipient before explicit sending",async({page})=>{
  const sends=await setup(page,{previewFailure:true});
  await page.goto("/friendly-messages.html?fixture=ticket-feedback");
  await page.getByTestId("open-email").click();
  await page.getByRole("button",{name:"Check recipient again",exact:true}).click();
  await expect(page.getByTestId("text-email-recipient-one")).toBeVisible();
  expect(sends).toHaveLength(0);
  await page.getByTestId("button-email-confirm").click();
  await expect(page.getByTestId("status-email-success")).toBeVisible();
  expect(sends).toHaveLength(1);
});

test("Ticket mixed bulk hides accepted tickets, shows only affected tickets and preserves safe recovery",async({page})=>{
  const sends=await setup(page,{ineligible:["three"],reply:async(route,send,list)=>json(route,{
    state:send.id==="two"&&list.filter(s=>s.id==="two").length===1?"unknown":"provider_accepted",
  })});
  await open(page,"bulk");
  await page.getByTestId("button-email-confirm").click();
  await expect(page.getByText("Some ticket emails need attention.")).toBeVisible();
  await expect(page.getByTestId("row-ticket-email-one")).toHaveCount(0);
  await expect(page.getByTestId("row-ticket-email-two")).toBeVisible();
  await expect(page.getByTestId("row-ticket-email-three")).toBeVisible();
  await expect(page.getByTestId("status-email-success")).toHaveCount(0);
  await noDiagnostics(page);
  await page.getByRole("button",{name:"Check same request",exact:true}).click();
  await expect(page.getByTestId("row-ticket-email-two")).toHaveCount(0);
  await expect(page.getByTestId("row-ticket-email-three")).toBeVisible();
  await expect(page.getByTestId("status-email-success")).toHaveCount(0);
  expect(sends.map(s=>s.id)).toEqual(["one","two","two"]);
  expect(sends[1].requestId).toBe(sends[2].requestId);
});
