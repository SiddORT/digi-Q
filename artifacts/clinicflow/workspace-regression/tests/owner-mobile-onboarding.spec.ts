import { test, expect, type Page } from "@playwright/test";

async function mock(page: Page, role?: "superAdmin") {
  const calls: {path:string;body:any}[]=[];
  const state={sms:"provider_accepted",verified:false,mobile:""};
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const body=req.postDataJSON();
    if(req.method()!=="GET")calls.push({path,body});
    let result:any={items:[],total:0,page:1,pageSize:25};
    if(path==="/api/auth/status") result=role?{authenticated:true,role,requiresStaffPassword:true,staffPasswordVerified:true}:{authenticated:false};
    else if(path==="/api/auth/csrf")result={csrfToken:"fictional"};
    else if(path==="/api/me"||path==="/api/users/fictional-super")result={user:{id:"fictional-super",role:role||"clinicAdmin",fullName:"Fictional Super",email:"super@test.invalid",mobile:state.mobile,clinicIds:[],branchIds:[]},permissions:{}};
    else if(path==="/api/auth/owner-mobile/start")result={challengeId:"fictional-mobile-proof",sms:{status:state.sms}};
    else if(path==="/api/auth/owner-mobile/verify")result={mobileVerified:true};
    else if(path==="/api/auth/owner-mobile/invalidate")result={mobileVerified:false};
    else if(path==="/api/auth/register/start")result={challengeId:"fictional-email",channels:{email:{status:"provider_accepted"}}};
    else if(path==="/api/public/registration-options")result={categories:[],specialities:[],qualifications:[]};
    else if(path==="/api/clinic-admin-onboarding/completion")result={result:null};
    else if(req.method()!=="GET"){await route.fulfill({status:400,json:{error:"Fictional unexpected write"}});return;}
    await route.fulfill({json:result});
  });
  return {calls,state};
}
async function verify(page:Page) {
  await page.getByRole("button",{name:"Send SMS code",exact:true}).click();
  await page.getByRole("textbox",{name:"SMS verification code",exact:true}).fill("123456");
  await page.getByRole("button",{name:"Verify mobile",exact:true}).click();
}
test("public owner starts mobile-first, rejects extra digits, preserves international paste and still requires email",async({page},info)=>{
  const m=await mock(page);
  await page.goto("/register-clinic?mode=app");
  const proof=page.getByTestId("owner-mobile-proof");
  await expect(proof.getByRole("button",{name:/^Selected item: \+91/})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Your Name",exact:true})).toBeHidden();
  const number=proof.locator('input[type="tel"]');
  await number.fill("98765432101");
  await page.getByRole("button",{name:"Send SMS code",exact:true}).click();
  await expect(proof.getByRole("alert")).toContainText("exactly 10");
  expect(m.calls.filter(c=>c.path.endsWith("owner-mobile/start"))).toHaveLength(0);
  await number.fill("+447911123456");
  await expect(proof.getByRole("button",{name:/^Selected item: \+44/})).toBeVisible();
  await verify(page);
  expect(m.calls.find(c=>c.path.endsWith("owner-mobile/start"))?.body.mobile).toBe("+447911123456");
  await expect(page.getByRole("textbox",{name:"Your Name",exact:true})).toBeVisible();
  await page.getByRole("textbox",{name:"Your Name",exact:true}).fill("Fictional Owner");
  await page.getByTestId("input-registration-email").fill("fictional-owner@test.invalid");
  await page.locator('input[autocomplete="new-password"]').fill("Fictional-Owner!2026");
  await page.getByRole("button",{name:"Send verification code",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Verify your email",exact:true})).toBeVisible();
  const start=m.calls.find(c=>c.path.endsWith("register/start"))!.body;
  expect(start.mobileProofId).toBe("fictional-mobile-proof");
  expect(start.mobile).toBe("+447911123456");
  await page.screenshot({path:info.outputPath("public-required-email.jpg"),fullPage:true});
});
test("admin keeps the existing setup in place behind exact-number proof and resets it when the mobile changes",async({page},info)=>{
  const m=await mock(page,"superAdmin");
  await page.goto("/register-clinic?mode=app");
  const proof=page.getByTestId("owner-mobile-proof");
  await expect(page.getByTestId("registration-fullName")).toBeHidden();
  await proof.locator('input[type="tel"]').fill("9876543210");
  await verify(page);
  await expect(page.getByTestId("registration-fullName")).toBeVisible();
  await page.getByTestId("registration-fullName").fill("Fictional Preserved Name");
  await proof.locator('input[type="tel"]').fill("9876543211");
  await expect(page.getByTestId("registration-fullName")).toBeHidden();
  await expect(page.getByTestId("registration-fullName")).toHaveValue("Fictional Preserved Name");
  expect(m.calls.filter(c=>c.path==="/api/clinic-admin-onboarding")).toHaveLength(0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath("admin-mobile-first-phone.jpg"),fullPage:true});
});
test("disabled and unknown SMS never unlock account fields or automatically retry",async({page})=>{
  const m=await mock(page);
  m.state.sms="disabled";
  await page.goto("/register-clinic?mode=app");
  await page.getByTestId("owner-mobile-proof").locator('input[type="tel"]').fill("9876543210");
  await page.getByRole("button",{name:"Send SMS code",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Please try again later.");
  await expect(page.getByRole("textbox",{name:"Your Name",exact:true})).toBeHidden();
  expect(m.calls.filter(c=>c.path.endsWith("owner-mobile/start"))).toHaveLength(1);
  await page.reload();
  m.state.sms="delivery_unknown";
  await page.getByTestId("owner-mobile-proof").locator('input[type="tel"]').fill("9876543210");
  await page.getByRole("button",{name:"Send SMS code",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Please wait and check your phone");
  await expect(page.getByRole("textbox",{name:"Your Name",exact:true})).toBeHidden();
});
for (const status of ["provider_rejected","unavailable","pre_dispatch_failed"]) test(`owner SMS ${status} keeps errors non-technical and sends only on the explicit button`,async({page})=>{
  const m=await mock(page);m.state.sms=status;
  await page.goto("/register-clinic?mode=app");
  const proof=page.getByTestId("owner-mobile-proof");
  await proof.locator('input[type="tel"]').fill("9876543210");
  expect(m.calls.filter(c=>c.path.endsWith("owner-mobile/start"))).toHaveLength(0);
  await proof.getByRole("button",{name:"Send SMS code",exact:true}).click();
  await expect(proof.getByRole("alert")).toHaveText(status==="provider_rejected"
    ? "The SMS provider rejected the request. Please try again later."
    : "We couldn’t send the SMS code. Please try again later.");
  await expect(proof.getByRole("alert")).not.toContainText(/DLT|sender|template|System Admin/i);
  const requests=m.calls.filter(c=>c.path.endsWith("owner-mobile/start"));
  expect(requests).toHaveLength(1);
  expect(requests[0].body).toEqual({flow:"public",mobile:"+919876543210"});
  await expect(proof.getByRole("button",{name:/Request SMS in/})).toBeDisabled();
  await expect(proof.getByRole("textbox",{name:"SMS verification code",exact:true})).toHaveCount(0);
  await expect(page.getByRole("textbox",{name:"Your Name",exact:true})).toBeHidden();
  expect(m.calls.filter(c=>c.path.endsWith("owner-mobile/start"))).toHaveLength(1);
});
test("Super Admin uses the existing profile editor and separate saved-contact verification",async({page},info)=>{
  let mobile="",verified=false,sends=0;
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON();
    let result:any={items:[],total:0};
    if(path==="/api/staff-verification")result={email:"fixture-super@test.invalid",mobile,emailVerified:true,mobileVerified:verified,promptRequired:false};
    else if(path==="/api/me"&&req.method()==="PATCH"){mobile=body.mobile;verified=false;result={id:"fixture-super",role:"superAdmin",fullName:"Fictional Super Admin",mobile};}
    else if(path==="/api/staff-verification/request"){sends++;result={challengeId:"fictional-profile",expiresAt:"2030-01-01T00:00:00Z",resendAfterSeconds:60};}
    else if(path==="/api/staff-verification/confirm"){verified=true;result={ok:true};}
    else if(path==="/api/auth/csrf")result={csrfToken:"fictional"};
    await route.fulfill({json:result});
  });
  await page.goto("/workspace-regression/index.html?mode=staff-verification&fixtureRole=superAdmin");
  const number=page.locator('input[type="tel"]');
  await number.fill("98765432101");
  await page.getByRole("button",{name:"Save Changes",exact:true}).click();
  await expect(page.getByText(/exactly 10 digits/)).toBeVisible();
  expect(mobile).toBe("");
  await number.fill("+447911123456");
  await page.getByRole("button",{name:"Save Changes",exact:true}).click();
  await expect(page.getByTestId("verify-sms")).toContainText("+447911123456");
  expect(sends).toBe(0);
  await page.getByTestId("button-send-code-sms").click();
  await page.getByTestId("input-code-sms").fill("123456");
  await page.getByTestId("button-confirm-code-sms").click();
  await expect(page.getByTestId("verify-sms")).toContainText("Verified");
  expect(sends).toBe(1);
  await page.screenshot({path:info.outputPath("super-admin-profile.jpg"),fullPage:true});
});
