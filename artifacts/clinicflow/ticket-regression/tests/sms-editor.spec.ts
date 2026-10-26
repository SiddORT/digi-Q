import { test, expect, type Page } from "@playwright/test";

async function setup(page:Page,event="booking") {
  const requests:any[]=[];
  const security=event!=="booking";
  let ready=false, revision=5, draft:any=null;
  let content={enabled:false,subject:"SMS",body:security?"Code {{otp}} expires in {{expiry_minutes}} minutes.":"Dear {{patient_name}}.",prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:"1777179180199333856"};
  const catalog=()=>({scopeName:"Platform defaults",variables:security?["otp","expiry_minutes"]:["patient_name"],items:[{
    event,recipient:event==="staff_mobile_otp"?"receptionist":"patient",title:"Fixture SMS",revision,source:"platform",content,draft,previewBody:"Fictional",previewSubject:"SMS",
  }]});
  await page.route("**/api/**",async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const body=req.method()==="GET"?null:req.postDataJSON();
    if(body)requests.push({path,body});
    if(path.endsWith("/auth/csrf"))return route.fulfill({json:{csrfToken:"fictional"}});
    if(path.endsWith("/integrations"))return route.fulfill({json:{notificationSms:{ready,keys:[]},smtp:{ready:false,keys:[]}}});
    if(path.endsWith("/templates/preview"))return route.fulfill({json:{status:"preview",subject:"",body:body.content.body.replace("{{patient_name}}",body.values.patient_name),message:"Nothing sent"}});
    if(path.endsWith("/templates/test"))return route.fulfill({json:{status:"delivery_unknown",subject:"",body:"Fictional",message:"Do not resend"}});
    if(path.endsWith("/templates")){
      if(body){
        revision++;
        if(body.mode==="draft")draft=body.content;
        if(body.mode==="publish"){content=body.content;draft=null;}
        if(body.mode==="reset")draft=null;
      }
      return route.fulfill({json:catalog()});
    }
    return route.fulfill({json:{items:[],total:0}});
  });
  await page.goto(`/?mode=sms-tests&event=${event}`);
  await expect(page.getByTestId("input-body")).toBeVisible();
  await page.getByText("Advanced",{exact:true}).click();
  await expect(page.getByTestId("panel-template-test")).toBeVisible();
  return {requests,enable:()=>{ready=true;}};
}

test("empty samples, missing recipient, consent and readiness block sends; preview uses current edits and uncertain retry stays locked",async({page},info)=>{
  const f=await setup(page);
  await expect(page.getByTestId("button-save-draft")).toBeDisabled();
  await expect(page.getByTestId("button-test-preview")).toBeDisabled();
  await expect(page.getByTestId("button-send-test")).toBeDisabled();
  await page.getByTestId("input-body").fill("Edited {{patient_name}}.");
  await page.getByTestId("input-test-value-patient_name").fill("Fictional Patient");
  await expect(page.getByTestId("button-test-preview")).toBeEnabled();
  await page.getByTestId("button-test-preview").click();
  await expect(page.getByTestId("text-test-body")).toHaveText("Edited Fictional Patient.");
  expect(f.requests.at(-1).body.content.body).toBe("Edited {{patient_name}}.");
  await page.getByTestId("input-test-recipient").fill("9876543210");
  await page.getByTestId("checkbox-confirm-test").check();
  await expect(page.getByTestId("button-send-test")).toBeDisabled();
  f.enable();await page.getByTestId("button-test-recheck").click();
  await expect(page.getByTestId("button-send-test")).toBeEnabled();
  await page.getByTestId("button-send-test").click();
  await expect(page.getByTestId("status-test-result")).toContainText("unknown");
  await expect(page.getByTestId("button-send-test")).toBeDisabled();
  await expect(page.getByTestId("button-start-new-test")).toHaveCount(0);
  expect(f.requests.filter(r=>r.path.endsWith("/templates/test"))).toHaveLength(1);
  await page.screenshot({path:info.outputPath("sms-editor.png"),fullPage:true});
});

for(const event of ["patient_login_otp","staff_mobile_otp"])test(`${event} is fictional preview only and shows no real-send controls`,async({page})=>{
  const f=await setup(page,event);
  await expect(page.getByTestId("button-test-preview")).toBeEnabled();
  await expect(page.getByTestId("input-test-value-otp")).toHaveValue("123456");
  await expect(page.getByTestId("input-test-value-otp")).toHaveAttribute("readonly","");
  await expect(page.getByTestId("button-send-test")).toHaveCount(0);
  await expect(page.getByTestId("checkbox-confirm-test")).toHaveCount(0);
  expect(f.requests).toHaveLength(0);
});
