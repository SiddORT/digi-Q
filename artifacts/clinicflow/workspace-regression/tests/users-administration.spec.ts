import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Intercepted UI checks only. Real authorization and native-session checks live in API integration tests.
async function fixture(page:Page){
  const state={
    config:{revision:2,roles:[{id:"doctor",name:"Limited desk with a long descriptive role name",baseRole:"receptionist",denied:["patients:update"]}],bindings:[] as unknown[]},
    policy:{revision:3,roles:["superAdmin","clinicAdmin","doctor","receptionist","patient"],modules:["patients","appointments"],actions:["read","update"],denied:["receptionist:patients:read"]},
    users:[
      {id:"fixture-admin",fullName:"Fixture Administrator",email:"admin@example.invalid",role:"superAdmin",status:"active",clinics:[]},
      {id:"desk",fullName:"Receptionist with a very long full name for responsive actions",email:"long-receptionist-address@example.invalid",role:"receptionist",status:"active",clinics:[]},
      {id:"owner",fullName:"Clinic Owner",email:"owner@example.invalid",role:"clinicAdmin",status:"active",clinics:[{id:"c1",name:"Owned Clinic"}]},
    ],
    failStatus:false,conflict:false,writes:[] as {path:string;body:any}[],
  };
  await page.route("**/api/**",async route=>{
    const req=route.request();const url=new URL(req.url());const path=url.pathname;let data:any={};let status=200;
    if(path==="/api/auth/csrf")data={csrfToken:"fixture-token"};
    else if(path==="/api/me")data={user:state.users[0],permissions:{},needsOnboarding:false};
    else if(path==="/api/management/permissions"){
      if(req.method()==="PUT"){state.writes.push({path,body:req.postDataJSON()});state.policy={...state.policy,...req.postDataJSON(),revision:state.policy.revision+1};}
      data=state.policy;
    }else if(path==="/api/management/custom-roles"){
      if(req.method()==="PUT"){
        state.writes.push({path,body:req.postDataJSON()});
        if(state.conflict){status=409;data={error:"Roles changed. Reload before saving."};}
        else state.config={...req.postDataJSON(),revision:state.config.revision+1};
      }
      if(status===200)data=state.config;
    }else if(path==="/api/management/system-users"){
      const rows=state.users.filter(u=>(!url.searchParams.get("status")||u.status===url.searchParams.get("status"))&&(!url.searchParams.get("role")||u.role===url.searchParams.get("role")));
      data={data:rows,total:rows.length,page:1,pageSize:30};
    }else if(path.startsWith("/api/users/")){
      const user=state.users.find(u=>u.id===path.split("/").pop())!;
      if(req.method()==="PATCH"){
        state.writes.push({path,body:req.postDataJSON()});
        if(state.failStatus){status=409;data={error:"Account status changed; reload before retrying"};}
        else Object.assign(user,req.postDataJSON());
      }
      if(status===200)data=user;
    }else if(path==="/api/saved-views")data={items:[],total:0,page:1,pageSize:20};
    else if(path==="/api/settings")data={timezone:"UTC"};
    else data={items:[],total:0,page:1,pageSize:20};
    await route.fulfill({status,json:data});
  });
  return state;
}
test("Roles default, legacy Staff fallback, namespaced role selection, reload/history and invalid selection",async({page})=>{
  await fixture(page);await page.goto("/?mode=users&area=staff");
  await expect(page.getByTestId("tab-roles")).toHaveAttribute("aria-selected","true");
  await expect(page.getByTestId("tab-staff")).toHaveCount(0);
  await page.getByTestId("button-permissions-system-superAdmin").click();
  await expect(page).toHaveURL(/role=system%3AsuperAdmin/);
  await expect(page.getByTestId("super-admin-unrestricted")).toBeVisible();
  await expect(page.getByTestId("checkbox-superAdmin:patients:read")).toBeDisabled();
  await page.getByTestId("tab-roles").click();
  await page.getByTestId("button-permissions-custom-doctor").click();
  await expect(page).toHaveURL(/role=custom%3Adoctor/);
  await expect(page.getByTestId("custom-role-permissions").filter({visible:true})).toContainText("Inherited baseline: Receptionist");
  await page.reload();await expect(page.getByTestId("custom-cap-patients-read")).toBeDisabled();
  await page.getByTestId("tab-roles").click();await page.goBack();await expect(page.getByTestId("tab-permissions")).toHaveAttribute("aria-selected","true");
  await page.goForward();await expect(page.getByTestId("tab-roles")).toHaveAttribute("aria-selected","true");
  await page.goto("/?mode=users&area=permissions&role=custom:deleted");
  await expect(page.getByTestId("state-invalid-role")).toBeVisible();
  await expect(page.getByTestId("table-permissions")).not.toBeVisible();
});
test("Roles draft survives navigation; permissions save cannot publish a role rename draft",async({page})=>{
  const state=await fixture(page);await page.goto("/?mode=users&area=roles");
  await page.getByTestId("button-edit-role-doctor").click();
  await page.getByTestId("input-custom-role-name").fill("Unpublished rename");
  await page.getByTestId("button-apply-role").click();
  await page.getByTestId("button-back-custom-roles").click();
  await page.getByTestId("button-permissions-custom-doctor").click();
  await expect(page.getByRole("dialog")).toContainText("Continue without saving");
  await page.getByTestId("confirm-dialog-confirm").click();
  await page.getByTestId("custom-cap-appointments-update").uncheck();
  await page.getByTestId("button-save-custom-permissions").click();
  await page.getByTestId("button-confirm-custom-permissions").click();
  await expect(page.getByText("Custom role permissions saved.")).toBeVisible();
  expect(state.config.roles[0].name).not.toBe("Unpublished rename");
  await page.getByTestId("tab-roles").click();
  await page.getByTestId("confirm-dialog-confirm").click();
  await expect(page.getByTestId("row-custom-role-doctor")).toContainText("Unpublished rename");
  await expect(page.getByTestId("status-custom-roles-conflict")).toBeVisible();
});
test("custom permissions conflict preserves draft, and switching roles does not drop restrictions",async({page})=>{
  const state=await fixture(page);await page.goto("/?mode=users&area=permissions&role=custom:doctor");
  await page.getByTestId("custom-cap-appointments-update").uncheck();
  state.conflict=true;await page.getByTestId("button-save-custom-permissions").click();await page.getByTestId("button-confirm-custom-permissions").click();
  await expect(page.getByText("Another administrator changed roles or baseline permissions.")).toBeVisible();
  await expect(page.getByTestId("custom-cap-appointments-update")).not.toBeChecked();
  await page.getByTestId("tab-roles").click();await page.getByTestId("confirm-dialog-confirm").click();
  await page.goBack();await expect(page.getByTestId("custom-cap-appointments-update")).not.toBeChecked();
});
test("status cancel/error/success and refreshed counts preserve filters; self/ownership disabled",async({page})=>{
  const state=await fixture(page);await page.goto("/?mode=users&area=system");
  await expect(page.getByTestId("button-status-fixture-admin")).toBeDisabled();
  await expect(page.getByTestId("button-status-owner")).toBeDisabled();
  await page.getByTestId("button-status-desk").click();
  await expect(page.getByRole("dialog")).toContainText("existing sessions will be revoked");
  await page.getByRole("button",{name:"Cancel",exact:true}).click();expect(state.writes).toHaveLength(0);
  state.failStatus=true;await page.getByTestId("button-status-desk").click();await page.getByTestId("confirm-dialog-confirm").click();
  await expect(page.getByRole("alert").filter({hasText:"Account status changed"})).toBeVisible();
  state.failStatus=false;await page.getByTestId("button-status-desk").click();await page.getByTestId("confirm-dialog-confirm").click();
  await expect(page.getByTestId("system-status-counts")).toContainText("Inactive: 1");
  await expect(page.getByTestId("button-status-desk")).toHaveAttribute("aria-label",/^Activate /);
  await page.getByTestId("button-status-desk").click();await expect(page.getByRole("dialog")).toContainText("Revoked sessions stay revoked");
  await page.getByTestId("confirm-dialog-confirm").click();await expect(page.getByTestId("system-status-counts")).toContainText("Inactive: 0");
});
for(const width of [1440,768,390])test(`role and account actions remain accessible at ${width}px`,async({page})=>{
  await fixture(page);await page.setViewportSize({width,height:900});await page.goto("/?mode=users&area=roles");
  await expect(page.getByTestId("button-permissions-custom-doctor")).toBeVisible();
  await page.getByTestId("tab-system").click();await expect(page.getByTestId("button-status-desk")).toBeVisible();
  await mkdir("screenshots",{recursive:true});await page.screenshot({path:`screenshots/users-administration-${width}.png`});
  await page.getByTestId("button-status-desk").click();await expect(page.getByTestId("confirm-dialog-confirm")).toBeInViewport();
  await page.screenshot({path:`screenshots/users-administration-confirm-${width}.png`});
});
