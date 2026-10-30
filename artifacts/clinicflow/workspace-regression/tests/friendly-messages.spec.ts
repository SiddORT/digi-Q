import { test,expect,type Page,type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const raw="HTTP 503 SMTP provider payload PRIVATE_DIAGNOSTIC";
const json=(route:Route,data:unknown,status=200,headers:Record<string,string>={})=>route.fulfill({status,contentType:"application/json",headers,body:JSON.stringify(data)});
async function mock(page:Page,handler:(route:Route,path:string)=>Promise<unknown>){
  await page.addInitScript(()=>sessionStorage.setItem("friendly-fixture-intercepted","yes"));
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/auth/status")return json(route,{authenticated:false,csrfToken:"fictional-csrf"});
    if(path==="/api/auth/csrf")return json(route,{csrfToken:"fictional-csrf"});
    return handler(route,path);
  });
}
async function open(page:Page,fixture:string,extra=""){
  await page.goto(`/friendly-messages.html?fixture=${fixture}${extra}`);
}
test("registration email states remain practical, distinct and free of raw diagnostics",async({page},info)=>{
  await open(page,"security");
  await expect(page.getByText("Check your inbox and spam folder for the verification code. If it doesn’t arrive, request another code when the timer ends.",{exact:true})).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Provider accepted|registration intent|email proof|challenge|PRIVATE_DIAGNOSTIC/);
  await mkdir(resolve("generated-artifacts/friendly-messages"),{recursive:true});
  await page.screenshot({path:resolve(`generated-artifacts/friendly-messages/security-${info.project.name}.png`),fullPage:true});
});
test("transient exact-record retry loads the same record and hides payloads",async({page})=>{
  let calls=0;
  await mock(page,route=>json(route,++calls===1?{error:raw}:{name:"Fictional saved record"},calls===1?503:200));
  await open(page,"record");
  await expect(page.getByTestId("exact-record-error")).not.toContainText(/HTTP|SMTP|PRIVATE_DIAGNOSTIC/);
  await page.getByRole("button",{name:"Try again",exact:true}).click();
  await expect(page.getByText("Fictional saved record")).toBeVisible();
  expect(calls).toBe(2);
});
for(const status of [401,403,404]){
  test(`record ${status} offers sign-in or close, not a dead-end retry`,async({page})=>{
    await mock(page,route=>json(route,{error:raw},status));
    await open(page,"record");
    await expect(page.getByTestId("exact-record-error")).toBeVisible();
    await expect(page.getByRole("button",{name:"Try again",exact:true})).toHaveCount(0);
    if(status===401)await expect(page.getByRole("link",{name:"Staff sign in"})).toHaveAttribute("href","/sign-in");
    await page.getByTestId("exact-record-error").getByRole("button",{name:"Close",exact:true}).click();
    await expect(page.getByText("Record closed")).toBeVisible();
  });
}
test("server wait disables recovery before expiry",async({page})=>{
  await open(page,"wait");
  await expect(page.getByRole("button",{name:/Try again in/})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Try again",exact:true})).toBeEnabled();
});
test("ticket recipient retry is scoped; mixed results reconcile the same request without resending accepted rows",async({page},info)=>{
  const previews:Record<string,number>={},sends:{id:string;requestId:string}[]=[];
  await mock(page,async(route,path)=>{
    const id=path.split("/")[3];
    if(route.request().method()==="GET"){
      previews[id]=(previews[id]||0)+1;
      if(id==="two"&&previews[id]===1)return json(route,{error:raw},503);
      return json(route,{recipient:`${id}@example.invalid`,eligible:id!=="three",reason:"Completed visits do not need a ticket."});
    }
    const body=route.request().postDataJSON();sends.push({id,requestId:body.requestId});
    return json(route,{state:id==="two"&&sends.filter(s=>s.id===id).length===1?"unknown":"provider_accepted"});
  });
  await open(page,"tickets");
  await page.getByRole("button",{name:"Check recipient again"}).click();
  await expect(page.getByTestId("text-email-recipient-two")).toContainText("two@example.invalid");
  expect(previews).toEqual({one:1,two:2,three:1});
  await page.getByTestId("button-email-confirm").click();
  await expect(page.getByTestId("status-email-summary")).toContainText("1 submitted, 1 unconfirmed");
  await page.getByRole("button",{name:"Check same request"}).click();
  await expect(page.getByTestId("status-email-summary")).toContainText("2 submitted, 0 unconfirmed");
  expect(sends.filter(s=>s.id==="one")).toHaveLength(1);
  const twice=sends.filter(s=>s.id==="two");expect(twice).toHaveLength(2);expect(twice[1].requestId).toBe(twice[0].requestId);
  expect(sends.filter(s=>s.id==="three")).toHaveLength(0);
  await mkdir(resolve("generated-artifacts/friendly-messages"),{recursive:true});
  await page.screenshot({path:resolve(`generated-artifacts/friendly-messages/ticket-reconciliation-${info.project.name}.png`),fullPage:true});
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await expect(page.getByText("Tickets closed")).toBeVisible();
});
test("patient code failure keeps email and code actions, honors server wait and lets details change",async({page},info)=>{
  let verify=0;
  await mock(page,async(route,path)=>{
    if(path.endsWith("/patient/start"))return json(route,{challengeId:"fictional-session",channels:{email:{status:"not_reported"}}});
    if(path.endsWith("/patient/verify")){verify++;return json(route,{error:"Too many attempts. Try again in 3 seconds."},429,{"Retry-After":"3"});}
    return json(route,{error:"Fictional endpoint not expected."},503);
  });
  await open(page,"patient","&mode=signup");
  await page.getByTestId("input-patient-email").fill("fictional@example.invalid");
  await page.getByTestId("button-send-patient-code").click();
  await expect(page.getByTestId("button-resend-patient-code")).toBeDisabled();
  await page.getByTestId("input-patient-code").fill("123456");
  await page.getByTestId("button-verify-patient-code").click();
  await expect(page.getByTestId("button-verify-patient-code")).toBeDisabled();
  expect(verify).toBe(1);
  await expect(page.getByTestId("button-verify-patient-code")).toBeEnabled();
  await page.getByTestId("button-change-patient-email").click();
  await expect(page.getByTestId("input-patient-email")).toHaveValue("fictional@example.invalid");
  await mkdir(resolve("generated-artifacts/friendly-messages"),{recursive:true});
  await page.screenshot({path:resolve(`generated-artifacts/friendly-messages/patient-code-recovery-${info.project.name}.png`),fullPage:true});
});
test("search retry retains query and retries only the failed source",async({page})=>{
  const calls:Record<string,number>={};
  await mock(page,async(route,path)=>{
    calls[path]=(calls[path]||0)+1;
    if(path==="/api/patients"&&calls[path]===1)return json(route,{error:raw},503);
    return json(route,{items:[],total:0,page:1,pageSize:5});
  });
  await open(page,"search");
  await page.getByRole("button",{name:/Search/i}).first().click();
  const input=page.getByRole("searchbox").first();await input.fill("fictional");
  await expect(page.getByTestId("search-source-patients")).toContainText("We couldn’t search");
  const before={...calls};
  await page.getByTestId("search-source-patients").getByRole("button",{name:"Retry Patients"}).click();
  await expect(page.getByTestId("search-source-patients")).toContainText("No matching");
  expect(await input.inputValue()).toBe("fictional");
  expect(calls["/api/patients"]).toBe(before["/api/patients"]+1);
  for(const path of Object.keys(before).filter(p=>p!=="/api/patients"))expect(calls[path]).toBe(before[path]);
});
test("unexpected-page fallback never exposes preview diagnostics and is keyboard reachable",async({page})=>{
  await open(page,"crash");
  await expect(page.getByRole("heading",{name:"Something went wrong"})).toBeVisible();
  await expect(page.locator("body")).not.toContainText("PRIVATE_DIAGNOSTIC");
  await page.getByRole("button",{name:"Try Again"}).focus();
  await expect(page.getByRole("button",{name:"Try Again"})).toBeFocused();
});
test("password completion succeeds despite a failed confirmation email and offers workspace recovery",async({page})=>{
  let statusReads=0;
  await page.addInitScript(()=>sessionStorage.setItem("friendly-fixture-intercepted","yes"));
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/auth/status"){statusReads++;return json(route,{authenticated:false,csrfToken:"fictional-csrf"});}
    if(path==="/api/auth/csrf")return json(route,{csrfToken:"fictional-csrf"});
    if(path.endsWith("/invitation/accept"))return json(route,{authenticated:true,channels:{email:{status:"provider_rejected"}}});
    return json(route,{error:"Fictional endpoint not expected."},503);
  });
  await open(page,"password","&token=fictional-token");
  await page.getByTestId("input-invitation-password").fill("Fictional-Password-82!");
  await page.getByTestId("button-set-invitation-password").click();
  await expect(page.getByText("Your password is saved. You can continue even if the confirmation message doesn’t arrive.")).toBeVisible();
  await page.getByRole("button",{name:"Continue to workspace"}).click();
  expect(statusReads).toBeGreaterThan(1);
});
