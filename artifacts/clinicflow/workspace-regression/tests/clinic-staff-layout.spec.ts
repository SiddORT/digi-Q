import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Every API request is intercepted. No staff, credentials or messages are created.
const clinics = [
  { id: "c1", name: "Fictional Community Clinic", status: "active", adminId: "fixture-admin" },
  { id: "c2", name: "Other Fictional Clinic", status: "active", adminId: "fixture-admin" },
];
const branches = [
  { id: "b1", clinicId: "c1", name: "Central Family Medicine and Community Health Location", status: "active" },
  { id: "b2", clinicId: "c1", name: "Second Fictional Location", status: "active" },
];
const staff = [
  { id: "s1", fullName: "Fictional staff member with a very long name for layout checks", email: "fictional@example.invalid", mobile: "+919876543210", role: "receptionist", clinicIds: ["c1"], branchIds: ["b1","b2"], clinicNames: [clinics[0].name], branchNames: branches.map(b=>b.name), status: "active", passwordEnabled: true, invitationStatus: "notRequired" },
  { id: "s2", fullName: "Another Fictional Staff Member", email: "another@example.invalid", role: "receptionist", clinicIds: ["c1"], branchIds: ["b1"], status: "inactive", invitationStatus: "failed" },
];
async function fixture(page: Page) {
  const writes: string[] = [];
  const list = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,r=>r.abort());
  await page.route("**/api/**", async route=>{
    const request=route.request(), url=new URL(request.url()), path=url.pathname;
    if (!["GET","HEAD"].includes(request.method())) writes.push(`${request.method()} ${path}`);
    let data: unknown = list([]);
    if(path==="/api/auth/csrf") data={csrfToken:"fictional-layout-token"};
    else if(path==="/api/settings") data={timezone:"UTC"};
    else if(path==="/api/clinics") data=list(clinics);
    else if(/^\/api\/clinics\/[^/]+\/settings$/.test(path)) data={clinic:clinics.find(c=>c.id===path.split("/")[3]),branches,policies:{}};
    else if(path.startsWith("/api/clinics/")) data=clinics.find(c=>c.id===path.split("/")[3]);
    else if(path==="/api/staff-assignment-options") data={clinics:[clinics[0]],branches,doctors:[],pagination:{clinics:{total:1},branches:{total:2},doctors:{total:0}}};
    else if(path==="/api/users") data=list(staff.filter(s=>!url.searchParams.get("status")||s.status===url.searchParams.get("status")));
    else if(path.startsWith("/api/users/")) data=staff.find(s=>s.id===path.split("/")[3]);
    else if(path==="/api/branches") data=list(branches);
    else if(path.startsWith("/api/branches/")) data=branches.find(b=>b.id===path.split("/")[3]);
    await route.fulfill({json:data ?? {}});
  });
  return writes;
}
async function measurement(page: Page) {
  return page.evaluate(()=>{
    const box=(selector:string)=>{
      const el=document.querySelector(selector);
      if(!el)return null;
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return {x:r.x,y:r.y,width:r.width,height:r.height,position:s.position,minWidth:s.minWidth,whiteSpace:s.whiteSpace,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
    };
    return Object.fromEntries([
      ".page-heading",".settings-scope","[data-testid=clinic-overview]",
      ".lh-search input","[data-testid=select-staff-type]","[data-testid=button-open-account-recovery]",
      ".table-scroll",".table-scroll table","th.col-status","td.col-status","th.col-actions","td.col-actions",
      ".status-switch",".status-sub","#input-fullName","[data-testid=input-user-email]",
      "[data-testid=select-add-staff-role]","#input-clinicIds","#input-branchIds",".phone-input",
    ].map(s=>[s,box(s)]));
  });
}

async function checkListing(page: Page, width: number) {
  await expect(page.locator("h1")).toHaveText("Clinic");
  await expect(page.getByTestId("settings-scope")).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>{
    const heading=document.querySelector(".clinic-workspace-heading")!.getBoundingClientRect();
    const overview=document.querySelector("[data-testid=clinic-overview]")!.getBoundingClientRect();
    return overview.top-heading.bottom;
  })).toBeLessThanOrEqual(13);
  if(width>=768){
    const h=(await page.locator("h1").boundingBox())!;
    const scope=(await page.getByTestId("settings-scope").boundingBox())!;
    expect(scope.x).toBeGreaterThan(h.x+h.width);
    expect(Math.abs(scope.y+scope.height/2-h.y-h.height/2)).toBeLessThan(3);
  }
  await expect.poll(()=>page.locator(".lh-search-row").evaluate(el=>{
    const search=el.querySelector(".lh-search input")!.getBoundingClientRect();
    const type=el.querySelector(".staff-type-selector .searchable-select-control")!.getBoundingClientRect();
    const recovery=el.querySelector("[data-testid=button-open-account-recovery]")!.getBoundingClientRect();
    // Wrapping is allowed, but controls sharing a line must align at their edges.
    const rects=[search,type,recovery];
    return rects.flatMap((a,i)=>rects.slice(i+1).filter(b=>!(
      Math.abs(a.height-b.height)<=2&&
      (a.bottom<=b.top||b.bottom<=a.top||Math.abs(a.top-b.top)<=2))).map(b=>({a:a.toJSON(),b:b.toJSON()})));
  })).toEqual([]);
  if(width>640){
    const scroll=page.locator(".staff-list .table-scroll");
    for(const fraction of [0,.5,1]){
      await scroll.evaluate((el,f)=>{el.scrollLeft=(el.scrollWidth-el.clientWidth)*f;},fraction);
      expect(await scroll.locator("tr").evaluateAll(rows=>rows.every(row=>{
        const status=row.querySelector(".col-status"),actions=row.querySelector(".col-actions");
        if(!status||!actions)return true;
        const s=status.getBoundingClientRect(),a=actions.getBoundingClientRect();
        if(s.right>a.left+1)return false;
        const range=document.createRange();range.selectNodeContents(status);
        return [...range.getClientRects()].every(r=>r.left>=s.left-1&&r.right<=s.right+1);
      }))).toBe(true);
    }
    await scroll.evaluate(el=>{el.scrollLeft=0;});
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
}

async function checkAccount(page: Page,width: number) {
  const dialog=page.getByRole("dialog");
  await expect.poll(()=>dialog.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;
  })).toBe(true);
  expect(await dialog.evaluate(el=>[...el.querySelectorAll("input:not([type=hidden]),.staff-verify,.doctor-context-value,.searchable-multi-select-control,.form-field-label,.staff-assignment-label")].every(node=>{
    const r=node.getBoundingClientRect(),root=el.getBoundingClientRect();
    return !r.width||(r.left>=root.left-1&&r.right<=root.right+1);
  }))).toBe(true);
  const box=async(selector:string)=>(await dialog.locator(selector).boundingBox())!;
  const name=await box("#input-fullName"),email=await box("[data-testid=input-user-email]");
  const pw=await box("[data-testid=input-staff-password]"),confirm=await box("[data-testid=input-staff-confirm-password]");
  for(const a of [email,pw,confirm])expect(Math.abs(a.width-name.width)).toBeLessThan(2);
  if(width>=768){
    expect(Math.abs(name.y-email.y)).toBeLessThan(2);
    expect(Math.abs(pw.y-confirm.y)).toBeLessThan(2);
    expect(Math.abs(name.x-pw.x)).toBeLessThan(2);
    expect(Math.abs(email.x-confirm.x)).toBeLessThan(2);
    const role=await box(".staff-role-cell .searchable-select-control");
    const clinic=await box("#input-clinicIds");
    const locations=await box(".searchable-multi-select-control");
    expect(Math.abs(role.y-clinic.y)).toBeLessThan(2);
    expect(Math.abs(role.y-locations.y)).toBeLessThan(2);
    // Long fixed values/chips may grow, but empty controls share a height floor.
    expect(Math.abs(role.height-locations.height)).toBeLessThan(2);
  }
  const mobile=await box(".phone-input");
  expect(Math.abs(mobile.x-name.x)).toBeLessThan(2);
  expect(Math.abs(mobile.width-name.width)).toBeLessThan(2);
  const country=await box(".phone-input .searchable-select-control"),local=await box(".phone-input input");
  expect(Math.abs(country.y-local.y)).toBeLessThan(2);
  expect(Math.abs(country.height-local.height)).toBeLessThan(2);
  expect(await dialog.locator(".form-field-label label,.staff-assignment-label label,.staff-role-cell .searchable-select-field>label,.doctor-context-value").evaluateAll(nodes=>nodes.every(el=>{
    const r=el.getBoundingClientRect(),range=document.createRange();
    range.selectNodeContents(el);
    return [...range.getClientRects()].every(text=>text.left>=r.left-1&&text.right<=r.right+1);
  }))).toBe(true);
  await expect(dialog.getByTestId("input-user-email")).toHaveAttribute("aria-describedby",/help/);
  await expect(dialog.getByTestId("status-email-verification")).toContainText("Not verified");
  await expect(dialog.getByTestId("status-mobile-verification")).toContainText("Not verified");
}

test("Clinic staff rendered layout and reflow",async({page})=>{
  const writes=await fixture(page);
  const evidence: unknown[]=[];
  for(const viewport of [{width:1440,height:900},{width:1024,height:640},{width:768,height:768},{width:390,height:640},{width:512,height:320}]){
    await page.setViewportSize(viewport);
    await page.goto("/admin/clinics/c1/staff?tab=receptionists&fixtureRole=clinicAdmin");
    await expect(page.getByTestId("row-staff-s1")).toBeVisible();
    await checkListing(page,viewport.width);
    evidence.push({viewport,listing:await measurement(page)});
    await mkdir("generated-artifacts/clinic-staff-layout",{recursive:true});
    await page.screenshot({path:`generated-artifacts/clinic-staff-layout/listing-${viewport.width}.png`});
    await page.getByTestId("button-add-staff").click();
    await expect(page.getByTestId("input-user-email")).toBeVisible();
    await checkAccount(page,viewport.width);
    evidence.push({viewport,create:await measurement(page)});
    const dialog=page.getByRole("dialog");
    await dialog.screenshot({path:`generated-artifacts/clinic-staff-layout/after-${viewport.width}.png`});
    // Multiple long chips may grow the field vertically; they cannot cover the
    // trigger, help or adjacent fields. Exercise the actual picker hit targets.
    await dialog.locator("#input-branchIds").click();
    await page.getByRole("option",{name:branches[0].name,exact:true}).click();
    await page.getByRole("option",{name:branches[1].name,exact:true}).click();
    await page.keyboard.press("Escape");
    await expect(dialog.getByRole("button",{name:`Remove ${branches[0].name}`})).toBeVisible();
    expect(await dialog.locator(".searchable-multi-select-control").evaluate(el=>{
      const r=el.getBoundingClientRect(),range=document.createRange();
      const chips=[...el.querySelectorAll("span")].filter(n=>n.classList.contains("inline-flex"));
      return chips.length===2&&chips.every(chip=>{
        range.selectNodeContents(chip);
        return [...range.getClientRects()].every(c=>c.left>=r.left-1&&c.right<=r.right+1);
      });
    })).toBe(true);
    await dialog.getByTestId("button-save-staff").click();
    await expect(dialog.getByTestId("input-user-email")).toHaveAttribute("aria-invalid","true");
    await expect(dialog.getByTestId("input-user-email")).toHaveAttribute("aria-describedby",/error.*help/);
    await dialog.getByTestId("button-save-staff").scrollIntoViewIfNeeded();
    await expect(dialog.getByTestId("button-save-staff")).toBeInViewport();
    await dialog.screenshot({path:`generated-artifacts/clinic-staff-layout/errors-chips-${viewport.width}.png`});
  }
  expect(writes).toEqual([]);
  await writeFile("generated-artifacts/clinic-staff-layout/after.json",JSON.stringify(evidence,null,2));
});

test("Heading scope keeps permitted options, staff filter, and discard safeguards",async({page})=>{
  const writes=await fixture(page);
  await page.goto("/admin/clinics/c1/staff?tab=receptionists&fixtureRole=clinicAdmin");
  await page.getByTestId("settings-scope").getByRole("button",{name:/^Your Clinic Group:/}).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.getByRole("option",{name:clinics[1].name,exact:true}).click();
  await expect(page).toHaveURL(/\/c2\/staff/);
  await expect(page.getByTestId("text-clinic-name")).toHaveText(clinics[1].name);
  await expect(page.getByTestId("select-staff-type")).toHaveAccessibleName("Staff Type: Receptionists");
  await page.getByTestId("button-edit-clinic").click();
  const editor=page.getByRole("dialog",{name:"Clinic Details",exact:true});
  await editor.getByRole("textbox",{name:"Name",exact:true}).fill("Unsaved fictional clinic name");
  await page.getByTestId("button-dialog-close").click();
  await expect(page.getByTestId("discard-confirm")).toBeVisible();
  await page.getByRole("button",{name:"Keep editing",exact:true}).click();
  await expect(editor.getByRole("textbox",{name:"Name",exact:true})).toHaveValue("Unsaved fictional clinic name");
  await page.getByTestId("button-dialog-close").click();
  await page.getByTestId("discard-confirm").getByRole("button",{name:"Discard changes",exact:true}).click();
  await expect(editor).toHaveCount(0);
  await page.getByTestId("settings-scope").getByRole("button",{name:/^Your Clinic Group:/}).click();
  await page.getByRole("option",{name:clinics[0].name,exact:true}).click();
  await expect(page).toHaveURL(/\/c1\/staff/);
  // Opening/editing/cancelling staff must retain saved assignments, without writes.
  await page.getByTestId("button-edit-staff-s1").click();
  await expect(page.getByRole("dialog",{name:"Edit Receptionist"}).getByTestId("input-user-email")).toHaveValue(staff[0].email);
  await expect(page.getByRole("dialog",{name:"Edit Receptionist"}).locator("#input-branchIds-value")).toContainText("2 selected");
  await page.getByTestId("button-dialog-close").click();
  expect(writes).toEqual([]);
});

test("Aligned account controls preserve intercepted create and edit payloads",async({page})=>{
  const unexpectedWrites=await fixture(page);
  const submitted: {method:string;body:Record<string,unknown>}[]=[];
  await page.route("**/api/users",async route=>{
    if(route.request().method()!=="POST")return route.fallback();
    const body=route.request().postDataJSON();
    submitted.push({method:"POST",body});
    await route.fulfill({json:{...staff[0],...body,id:"fictional-created",invitationStatus:"notRequired",passwordEnabled:true}});
  });
  await page.route("**/api/users/s1",async route=>{
    if(route.request().method()!=="PATCH")return route.fallback();
    const body=route.request().postDataJSON();
    submitted.push({method:"PATCH",body});
    await route.fulfill({json:{...staff[0],...body}});
  });
  await page.goto("/admin/clinics/c1/staff?tab=receptionists&fixtureRole=clinicAdmin");
  await page.getByTestId("button-add-staff").click();
  const dialog=page.getByRole("dialog");
  await dialog.locator("#input-branchIds").click();
  await page.getByRole("option",{name:branches[0].name,exact:true}).click();
  await page.keyboard.press("Escape");
  await dialog.getByLabel("Full Name").fill("Fictional Receptionist");
  await dialog.getByTestId("input-user-email").fill("fictional-create@example.invalid");
  await dialog.getByLabel(/^Mobile/).fill("9876543210");
  await dialog.getByTestId("input-staff-password").fill("FictionalOnly1234");
  await dialog.getByTestId("input-staff-confirm-password").fill("FictionalOnly1234");
  await dialog.getByTestId("button-save-staff").click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toHaveLength(1);
  expect(submitted[0].body).toMatchObject({fullName:"Fictional Receptionist",email:"fictional-create@example.invalid",mobile:"+919876543210",role:"receptionist",clinicIds:["c1"],branchIds:["b1"]});
  expect(typeof submitted[0].body.password).toBe("string");
  await page.getByTestId("button-edit-staff-s1").click();
  await dialog.getByLabel("Full Name").fill("Fictional Updated Staff");
  await dialog.getByTestId("button-save-staff").click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toHaveLength(2);
  expect(submitted[1].body.fullName).toBe("Fictional Updated Staff");
  expect(submitted[1].body).not.toHaveProperty("password");
  expect(submitted[1].body).not.toHaveProperty("confirmPassword");
  expect(unexpectedWrites).toEqual([]);
});
