import {test,expect,type Page} from "@playwright/test";
for(const editor of ["full","focused"])for(const removal of ["typed","calendar"])test(`saved DOB removal requires confirmation: ${editor} ${removal}`,async({page})=>{
  await setup(page);
  await page.goto(`/?mode=profile-completion&editor=${editor}`);
  await expect(page.locator("#input-dateOfBirth")).toHaveValue("2000-02-29");
  if(removal==="typed")await page.locator("#input-dateOfBirth").fill("");
  else {await page.getByRole("button",{name:"Open calendar"}).click();await page.getByRole("button",{name:"Clear",exact:true}).click();}
  await page.getByRole("button",{name:"Save",exact:true}).click();
  const confirmation=page.getByRole("dialog",{name:"Remove saved date of birth?"});
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button",{name:"Cancel",exact:true}).click();
  await expect(page.getByTestId("dob-removal-saved")).toHaveCount(0);
  await page.getByRole("button",{name:"Save",exact:true}).click();
  await confirmation.getByRole("button",{name:"Remove date of birth",exact:true}).click();
  await expect(page.getByTestId("dob-removal-saved")).toBeVisible();
  await page.reload();
  await expect(page.locator("#input-dateOfBirth")).toHaveValue("2000-02-29");
});
async function setup(page:Page, kind="patients") {
  let record:any={id:"profile-fixture",fullName:"Fictional Patient",clinicId:"c1",branchId:"b1",email:kind==="patients"?null:"doctor@example.test"};
  let failure=0, denied=false;
  const saves:any[]=[];
  await page.route("**/api/**",async route=>{
    const req=route.request(), path=new URL(req.url()).pathname;
    let data:any={items:[],total:0};
    if(path==="/api/auth/csrf")data={csrfToken:"fixture-only"};
    else if(path==="/api/me")data={user:{id:"fixture-admin",role:"superAdmin",fullName:"Fictional Administrator"}};
    else if(path==="/api/settings")data={timezone:"Asia/Kolkata",dateFormat:"YYYY-MM-DD",timeFormat:"24h"};
    else if(path.endsWith("/profile-fields")){
      if(req.method()==="GET")data={fields:denied?[]:["dateOfBirth","age","gender","mobile","email","address","country","state","city","pincode","emergencyContactName","emergencyContactPhone","photoUrl","about","specializationId","qualificationIds","languages","registrationNumber","experienceYears","consultationFee"]};
      else {
        if(failure){const status=failure;failure=0;await route.fulfill({status,json:{error:"Unable to save this profile. Please retry."}});return;}
        const body=req.postDataJSON();saves.push(body);record={...record,...body.values};
        if(body.values.age!==undefined)record.ageReferenceDate="2026-10-30";
        data=record;
      }
    } else if(path===`/api/${kind}/profile-fixture`)data=record;
    else if(path==="/api/masters")data={items:[{id:"master-test",name:"Test Qualification",category:"qualification",status:"active"}],total:1};
    await route.fulfill({json:data});
  });
  await page.goto(`/?mode=profile-completion&kind=${kind}`);
  return {saves,record:()=>record,fail:(status:number)=>{failure=status;},deny:()=>{denied=true;}};
}
const dialog=(page:Page)=>page.getByRole("dialog").filter({has:page.getByRole("button",{name:"Save",exact:true})});
async function discard(page:Page) {
  const d=dialog(page);
  await d.getByRole("button",{name:"Cancel",exact:true}).click();
  const discard=page.getByRole("button",{name:/^Discard/});
  if(await discard.isVisible())await discard.click();
  await expect(d).not.toBeVisible();
}
test("DOB and approximate age focus, cancel, zero save and reload",async({page})=>{
  const state=await setup(page);
  await page.getByRole("button",{name:"Add approximate age",exact:true}).click();
  await expect(dialog(page).locator("#input-age")).toBeFocused();
  await dialog(page).locator("#input-age").fill("41");
  await discard(page);expect(state.saves).toHaveLength(0);
  await page.getByRole("button",{name:"Add approximate age",exact:true}).click();
  await dialog(page).locator("#input-age").fill("-1");
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  expect(state.saves).toHaveLength(0);
  await dialog(page).locator("#input-age").fill("0");
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText(/Approximately 0 years/)).toBeVisible();
  await page.reload();await expect(page.getByText(/Approximately 0 years/)).toBeVisible();
  await page.getByRole("button",{name:"Add date of birth",exact:true}).click();
  const dob=dialog(page).locator('input[name="dateOfBirth"]');
  await expect(dob).toBeFocused();await dob.fill("2000-02-29");await dob.blur();
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("2000-02-29",{exact:true})).toBeVisible();
  expect(state.record().age).toBe(0);
});
test("contact failure retains draft, cancel is clean, and saved values replace actions",async({page})=>{
  const state=await setup(page);
  await page.getByRole("button",{name:"Add email",exact:true}).click();
  const input=dialog(page).getByRole("textbox");
  await expect(input).toBeFocused();await input.fill("invalid");
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();expect(state.saves).toHaveLength(0);
  await input.fill("person@example.test");state.fail(500);
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(dialog(page).getByRole("alert")).toBeVisible();await expect(input).toHaveValue("person@example.test");
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByText("person@example.test",{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText("person@example.test",{exact:true})).toBeVisible();
  expect(state.saves[0].values).toEqual({email:"person@example.test"});
  await page.getByRole("button",{name:"Add mobile number",exact:true}).click();
  await expect(dialog(page).locator('input[type="tel"]')).toBeVisible();await discard(page);
  await page.getByRole("button",{name:"Add gender",exact:true}).click();
  await expect(dialog(page).locator("#input-gender")).toBeFocused();await discard(page);
  await page.getByRole("button",{name:"Add city",exact:true}).click();
  await expect(dialog(page).locator("#input-city")).toBeFocused();await expect(dialog(page).getByRole("group",{name:"Address",exact:true})).toBeVisible();await discard(page);
  await page.getByRole("button",{name:"Add emergency contact",exact:true}).click();
  await expect(dialog(page).locator("#input-emergencyContactName")).toBeFocused();await discard(page);
});
test("doctor input types and valid zero fee persist without assignments",async({page})=>{
  const state=await setup(page,"doctors");
  for(const [label,key] of [["photo","photoUrl"],["about","about"],["specialization","specializationId"],["qualifications","qualificationIds"],["languages","languages"],["registration number","registrationNumber"],["experience","experienceYears"]]){
    await page.getByRole("button",{name:`Add ${label}`,exact:true}).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator(`#input-${key}`)).toBeFocused();
    await discard(page);
  }
  await page.getByRole("button",{name:"Add consultation fee",exact:true}).click();
  await dialog(page).locator("#input-consultationFee").fill("0");
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(page.getByRole("button",{name:"Add consultation fee",exact:true})).toHaveCount(0);
  expect(state.saves[0].values).toEqual({consultationFee:0});
  await page.reload();expect(state.record().consultationFee).toBe(0);
});
test("read-only, denied and revoked access never reports a successful save",async({page})=>{
  const state=await setup(page);
  await page.goto("/?mode=profile-completion&readonly=1");
  await expect(page.getByText("Not entered").first()).toBeVisible();
  await expect(page.getByRole("button",{name:/^Add /})).toHaveCount(0);
  await page.goto("/?mode=profile-completion");await page.getByRole("button",{name:"Add email",exact:true}).click();
  await dialog(page).getByRole("textbox").fill("draft@example.test");state.fail(403);
  await dialog(page).getByRole("button",{name:"Save",exact:true}).click();
  await expect(dialog(page).getByRole("alert")).toBeVisible();
  await expect(dialog(page).getByRole("textbox")).toHaveValue("draft@example.test");expect(state.saves).toHaveLength(0);
  await discard(page);state.deny();await page.reload();
  await expect(page.getByRole("button",{name:/^Add /})).toHaveCount(0);
});
