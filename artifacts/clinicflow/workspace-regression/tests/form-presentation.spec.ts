import { test, expect, type Page } from "@playwright/test";
import { expectFormBounds } from "./compact-geometry";

// Exercise the actual route/identity mapping, not a role caption on generic fields.
// Every request is intercepted; unknown contracts and any write fail explicitly.
async function profileFixture(page: Page, role: string, custom = false) {
  const user = { id:`fictional-${custom?"custom":role}`, role, fullName:`Fictional ${custom?"custom receptionist":role}`, email:"fictional@example.invalid", mobile:"+919876543210", status:"active", clinicIds:["c1"], branchIds:["b1"], ...(custom?{customRoleId:"limited-desk"}:{}) };
  const record = { ...user, id:role==="doctor"?"d1":role==="patient"?"p1":user.id, clinicId:"c1", branchId:"b1", userId:user.id };
  const seen:string[] = [], unexpected:string[] = [], writes:string[] = [];
  await page.route("**/api/**",async route=>{
    const request=route.request(),p=new URL(request.url()).pathname;
    seen.push(p);
    if(request.method()!=="GET"){writes.push(p);return route.abort();}
    let json:unknown;
    if(p==="/api/auth/status")json={authenticated:true,role,staffPasswordVerified:true};
    else if(p==="/api/me")json={userId:user.id,user,needsOnboarding:false,doctorId:role==="doctor"?"d1":null,patientId:role==="patient"?"p1":null,permissions:{},...(custom?{customRole:{id:"limited-desk",baseRole:"receptionist",denied:["patients:update"]}}:{})};
    else if(p==="/api/settings")json={timezone:"UTC",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};
    else if(p==="/api/public/website-config")json={publicOrigin:"https://clinic.example.invalid"};
    else if(p==="/api/clinics/c1")json={id:"c1",name:"Fictional Clinic",timezone:"UTC",active:true};
    else if(p==="/api/staff-verification")json={email:user.email,mobile:user.mobile,emailVerified:true,mobileVerified:false,promptRequired:false};
    else if(p==="/api/doctors/d1"||p==="/api/patients/p1")json=record;
    else if(p==="/api/branches")json={items:[{id:"b1",clinicId:"c1",name:"Fictional Location",clinicName:"Fictional Clinic",status:"active"}],total:1,page:1,pageSize:20};
    else if(p==="/api/clinics")json={items:[{id:"c1",adminId:user.id,name:"Fictional Clinic",status:"active"}],total:1,page:1,pageSize:20};
    else if(p==="/api/workspaces")json={workspaces:[],switchable:false,activeClinicId:null};
    else if(/\/(geography|masters|saved-views|notifications)(\/|$)/.test(p))json={items:[],total:0,page:1,pageSize:20,unreadCount:0};
    else {unexpected.push(p);return route.fulfill({status:501,json:{error:`Missing fictional contract: ${p}`}});}
    await route.fulfill({json});
  });
  return {user,seen,unexpected,writes};
}

for(const [role,routeRole,custom] of [
  ["superAdmin","admin",false],["clinicAdmin","admin",false],["doctor","doctor",false],
  ["receptionist","receptionist",false],["patient","patient",false],["receptionist","receptionist",true],
] as const) test(`real profile form route: ${custom?"custom receptionist":role}`,async({page},info)=>{
  const state=await profileFixture(page,role,custom);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`/${routeRole}/profile?mode=app`);
  const profile=page.locator(".profile-compact");
  await expect(profile.getByRole("heading",{name:state.user.fullName,exact:true})).toBeVisible();
  // The editable saved profile value and route must agree with the asserted actor.
  await expect(profile.locator("input").filter({visible:true}).first()).toBeVisible();
  await expect(profile.locator('input[name="fullName"]')).toHaveValue(state.user.fullName);
  expect(state.seen).toContain("/api/me");
  for(const viewport of [{width:390,height:844},{width:768,height:900},{width:1024,height:640},{width:1920,height:1080}]){
    await page.setViewportSize(viewport);
    await expectFormBounds(page,".profile-compact");
    const inputs=profile.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio])');
    const heights=await inputs.evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>n.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    for(const height of heights)expect(height).toBe(viewport.width<768?44:40);
    await profile.screenshot({path:info.outputPath(`profile-${viewport.width}.png`)});
  }
  expect(state.unexpected).toEqual([]);expect(state.writes).toEqual([]);expect(errors).toEqual([]);
});

for(const path of ["/sign-in","/patient-login","/forgot-password","/set-password?token=fictional-layout-only"])test(`public standalone form ${path}`,async({page},info)=>{
  const writes:string[]=[];
  await page.route("**/api/**",route=>{
    const p=new URL(route.request().url()).pathname;
    if(route.request().method()!=="GET"){writes.push(p);return route.abort();}
    if(p==="/api/auth/status")return route.fulfill({json:{authenticated:false}});
    return route.fulfill({status:501,json:{error:`Unexpected public fixture request: ${p}`}});
  });
  await page.goto(`${path}${path.includes("?")?"&":"?"}mode=app`);
  const card=page.locator(".auth-card");await expect(card).toBeVisible();
  for(const viewport of [{width:390,height:844},{width:1024,height:640},{width:512,height:320}]){
    await page.setViewportSize(viewport);await expectFormBounds(page,".auth-card");
    const password=card.locator(".password-input input").first();
    if(await password.count()){
      const reveal=card.locator(".password-toggle").first();
      // Existing button transitions animate 40↔44px during viewport changes.
      // Assert exact settled edges rather than an intermediate frame.
      await expect.poll(async()=>{
        const a=(await password.boundingBox())!,b=(await reveal.boundingBox())!;
        return Math.max(Math.abs(a.y-b.y),Math.abs(a.height-b.height));
      }).toBeLessThanOrEqual(1);
      await reveal.click();await expect(password).toHaveAttribute("type","text");
      await reveal.click();await expect(password).toHaveAttribute("type","password");
    }
    await page.screenshot({path:info.outputPath(`public-${viewport.width}.png`)});
  }
  expect(writes).toEqual([]);
});
