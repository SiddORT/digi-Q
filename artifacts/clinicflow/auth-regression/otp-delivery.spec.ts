import { test, expect, type Page } from "@playwright/test";

const eligibilityError = "No patient account eligible for SMS login was found for this mobile. Choose Email OTP to sign in or register, or check the mobile saved on your patient account.";
type Reply = {status?:number;body:unknown};
async function finishResendTimer(page:Page) {
  const button=page.getByTestId("registration-resend-code");
  // React installs the next one-shot timer after each render. Allow that render
  // between virtual seconds instead of batching a minute into one clock call.
  for(let second=0;second<65 && await button.isDisabled();second++) {
    await page.clock.runFor(1000);
    await page.waitForTimeout(30);
  }
  await expect(button).toBeEnabled();
}
async function mockApi(page:Page, handler:(path:string,body:any)=>Reply|undefined) {
  // A catch-all guard: even unexpected auth requests cannot dispatch live messages.
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    const input=route.request().postDataJSON();
    const reply=handler(path,input);
    await route.fulfill({status:reply?.status??200,contentType:"application/json",
      body:JSON.stringify(reply?.body ?? (path.endsWith("/auth/status")?{role:null}:path.endsWith("/auth/csrf")?{csrfToken:"fictional-csrf"}:{}))});
  });
}

for(const match of ["unregistered","ambiguous"])test(`${match} patient SMS stays at mobile entry and offers email registration`,async({page})=>{
  let attempts=0;
  await mockApi(page,path=>path.endsWith("/patient/start")?(attempts++,{status:400,body:{code:"PATIENT_SMS_NOT_REGISTERED",error:eligibilityError}}):undefined);
  await page.goto("/patient-login");
  await page.getByTestId("button-patient-sms-login").click();
  await page.getByTestId("input-patient-mobile").fill("+919876543212");
  await page.getByTestId("button-send-patient-code").click();
  await expect(page.getByTestId("status-patient-login-error")).toHaveText(eligibilityError);
  await expect(page.getByTestId("input-patient-mobile")).toBeVisible();
  await expect(page.getByTestId("input-patient-code")).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByTestId("button-patient-email-login").click();
  await expect(page.getByTestId("input-patient-email")).toBeVisible();
});

test("eligible SMS login opens code entry and submits the original challenge and code",async({page})=>{
  let verified:any;
  await mockApi(page,(path,input)=>{
    if(path.endsWith("/patient/start"))return {body:{challengeId:"fictional-patient-challenge"}};
    if(path.endsWith("/patient/verify")) {
      verified=input;
      return {status:400,body:{code:"INVALID_VERIFICATION",error:"Invalid or expired verification"}};
    }
  });
  await page.goto("/patient-login");
  await page.getByTestId("button-patient-sms-login").click();
  await page.getByTestId("input-patient-mobile").fill("+919876543210");
  await page.getByTestId("button-send-patient-code").click();
  await expect(page.getByTestId("input-patient-code")).toBeVisible();
  await page.getByTestId("input-patient-code").fill("123456");
  await page.getByTestId("button-verify-patient-code").click();
  await expect(page.getByTestId("status-patient-code-error")).toContainText("Invalid or expired");
  expect(verified).toEqual({channel:"sms",challengeId:"fictional-patient-challenge",code:"123456"});
});

test("registration email rejection retains draft and safe explicit resend without optional SMS",async({page})=>{
  let starts=0,resends=0;
  await page.clock.install();
  await mockApi(page,(path)=>{
    if(path.endsWith("/register/start")) {
      starts++;
      return {body:{challengeId:"fictional-registration",channels:{email:{status:"provider_rejected"},sms:{status:"unavailable"}}}};
    }
    if(path.endsWith("/registration/resend")) {
      resends++;
      if(resends===1)return {status:503,body:{code:"REGISTRATION_EMAIL_REJECTED",error:"Email was not accepted"}};
      return {body:{challengeId:"fictional-registration",channels:{email:{status:"provider_accepted"}}}};
    }
    if(path.endsWith("/registration/resume"))return {body:{challengeId:"fictional-registration",mobilePending:false}};
  });
  await page.goto("/register-clinic");
  await page.locator("#registration-account-fullName").fill("Fictional Owner");
  await page.getByTestId("input-registration-email").fill("owner@example.test");
  await page.locator("#registration-account-password").fill("FixturePassword123");
  await page.locator("button[type=submit]").click();
  await page.locator("button[type=submit]").click();
  const notice=page.getByTestId("registration-email-delivery");
  await expect(notice).toHaveAttribute("role","alert");
  await expect(notice).toContainText("provider rejected");
  await expect(notice).toContainText("System Admin");
  await expect(page.getByText("SMS: Unavailable")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Verify and continue"})).toBeVisible();
  await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
  const draft=await page.evaluate(()=>sessionStorage.getItem("digiq:registration:v1:account:anonymous"));
  expect(draft).toContain("owner@example.test");
  expect(draft).not.toContain("FixturePassword123");
  expect(starts).toBe(1);expect(resends).toBe(0);
  await finishResendTimer(page);
  await page.getByTestId("registration-resend-code").click();
  await expect(page.getByRole("alert").filter({hasText:"previous code and registration details are retained"})).toBeVisible();
  await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
  expect(resends).toBe(1);
  await finishResendTimer(page);
  await page.getByTestId("registration-resend-code").click();
  await expect(notice).toContainText("delivery is not confirmed");
  await expect(notice).toHaveAttribute("role","status");
  expect(resends).toBe(2);
  await page.reload();
  await expect(page.locator("#registration-account-code")).toBeVisible();
  await expect(page.getByText("Email verification is still required.",{exact:false}).first()).toBeVisible();
  expect(starts).toBe(1);expect(resends).toBe(2);
});
