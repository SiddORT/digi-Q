import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const clinic = { id: "clinic-1", name: "Fixture Clinic", code:"CF-001", adminName:"Fixture Owning Administrator", phone:"+919876543210", email:"care@example.invalid", area:"Central", slug: "fixture-clinic", address: "1 Fixture Road", city: "Pune", status: "active", adminId: "fixture-admin" };
const otherClinic = { ...clinic, id: "clinic-2", name: "Other Fixture Clinic", slug: "other-fixture-clinic" };
const branch = {
  id: "branch-1", clinicId: clinic.id, name: "Fixture Location", address: "1 Fixture Road", city: "Pune",
  timezone: "Asia/Kolkata", status: "active", slug: "fixture-location", inheritEmail: true, inheritPhone: true,
  linkedSchedule: { enabled: true, doctorId: "doctor-1", maxTokens: 10, consultationMinutes: 30, tokenPrefix: "A", queueMode: "mixed" },
  openingHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
};
const staff = { id: "staff-1", fullName: "Fixture Receptionist", email: "fixture@example.invalid", status: "active", role: "receptionist", clinicIds: [clinic.id], branchIds: [branch.id] };
const otherBranch = { ...branch, id: "branch-2", clinicId: otherClinic.id, name: "Other Fixture Location", slug: "other-fixture-location" };
type Calls = { method: string; pathname: string; params: URLSearchParams; body?: unknown };
type Fixture = {
  calls: Calls[];
  previewCount: number;
  staff: typeof staff;
  failStatus: boolean;
  failBranches: boolean;
};
const listing = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });

async function fixture(page: Page, multiClinic = false): Promise<Fixture> {
  // External fonts are not part of the behavior under test and can hold load open offline.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
  const state: Fixture = { calls: [], previewCount: 0, staff: { ...staff }, failStatus: false, failBranches: false };
  // Intercept all application API requests, including unexpected endpoints. Never proxy to a running API.
  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body: unknown;
    try { body = request.postDataJSON(); } catch { /* GET has no JSON body. */ }
    state.calls.push({ method, pathname: path, params: url.searchParams, body });
    let reply: unknown;
    let status = 200;
    if (path === "/api/settings") reply = { timezone: "Asia/Kolkata" };
    else if (path === "/api/me") reply = { clerkId: "fixture-only", user: { id: "fixture-admin", role: "superAdmin", fullName: "Fixture Administrator" }, doctorId: "doctor-1" };
    else if (path === "/api/clinics" && method === "GET") reply = listing((multiClinic ? [clinic, otherClinic] : [clinic]).filter(item =>
     (!url.searchParams.get("search") || item.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) &&
     (!url.searchParams.get("status") || item.status === url.searchParams.get("status"))));
    else if (path === "/api/branches" && method === "GET" && state.failBranches) { status = 503; reply = { message: "Fixture branch lookup unavailable" }; }
    else if (path === "/api/branches" && method === "GET") reply = listing((multiClinic ? [branch, otherBranch] : [branch]).filter(item =>
      (!url.searchParams.get("clinicId") || url.searchParams.get("clinicId") === item.clinicId) &&
      (!url.searchParams.get("search") || item.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()))));
    else if (path === "/api/users" && method === "GET") reply = listing(
      (!url.searchParams.get("role") || url.searchParams.get("role") === "receptionist") &&
      (!url.searchParams.get("status") || url.searchParams.get("status") === state.staff.status) ? [state.staff] : [],
    );
    else if (path === "/api/users/staff-1" && method === "GET") reply = state.staff;
    else if (path === "/api/patients" && method === "GET") reply = listing([{ id: "patient-1", fullName: "Fixture Patient", status: "active", clinicId: clinic.id, branchId: branch.id }]);
    else if (path === "/api/doctors" && method === "GET") reply = listing([{ id: "doctor-1", fullName: "Fixture Doctor", userId: "fixture-admin", status: "active", branchIds: [branch.id] }]);
    else if (path === "/api/masters" && method === "GET") reply = listing([]);
    else if (path === "/api/clinics/clinic-1/settings" && method === "GET") reply = { clinic, branches: [branch], policies: { bookingHorizonDays: 30, cancellationCutoffMinutes: 60 } };
    else if (path === "/api/clinics/clinic-1" && method === "GET") reply = clinic;
    else if (path === "/api/branches/branch-1" && method === "GET") reply = branch;
    else if (path === "/api/branches/branch-2" && method === "GET") reply = otherBranch;
    else if (path === "/api/clinics/clinic-2" && method === "GET") reply = otherClinic;
    else if (path === "/api/clinics/clinic-1/settings/preview" && method === "POST") {
      state.previewCount++;
      reply = state.previewCount === 1
        ? { allowed: false, impacts: [{ branchId: branch.id, create: 1, update: 0, retire: 1, unlink: false }], conflicts: ["Existing booked session cannot change."] }
        : { allowed: true, impacts: [{ branchId: branch.id, create: 1, update: 0, retire: 0, unlink: false }], conflicts: [] };
    } else if (path === "/api/users/staff-1" && method === "PATCH") {
      if (state.failStatus) { status = 409; reply = { message: "Protected user status cannot be changed" }; }
      else { state.staff = { ...state.staff, status: (body as { status: "active" | "inactive" }).status }; reply = state.staff; }
    } else if (path === "/api/doctors/doctor-1" && method === "GET") reply = { id: "doctor-1", fullName: "Fixture Doctor", branchIds: [branch.id], status: "active" };
    else if (path === "/api/qrs" && method === "GET") reply = listing([]);
    else if (path === "/api/audit" && method === "GET") reply = listing([]);
    else { status = 501; reply = { message: `Unmocked fixture API: ${method} ${path}` }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(reply) });
  });
  return state;
}

const listCalls = (state: Fixture, path: string) => state.calls.filter(call => call.pathname === path && call.method === "GET");

test("Superadmin Clinic listing, View, tabs and both return paths retain URL state (intercepted fixtures)", async ({page})=>{
 await fixture(page);
 await page.route("**/api/clinics?*",route=>route.fulfill({json:{...listing([clinic]),total:101}}));
 const list="/admin/clinics?search=Fixture&adminId=fixture-admin&status=active&sort=name&page=2&pageSize=50";
 await page.goto(list,{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("nav-clinics")).toHaveAttribute("href","/admin/clinics");
 await expect(page.getByTestId("nav-clinics")).toHaveAttribute("aria-current","page");
 const row=page.getByTestId("row-clinics-clinic-1");
 for(const value of ["CF-001","Fixture Owning Administrator","Central","Pune","+919876543210","care@example.invalid","Active"])await expect(row).toContainText(value);
 const view=page.getByRole("link",{name:"View Fixture Clinic",exact:true});
 const href=await view.getAttribute("href");
 expect(href).toMatch(/^\/admin\/clinic\?clinicId=clinic-1&returnTo=/);
 await view.click();
 await expect(page.getByRole("heading",{name:"Fixture Clinic",exact:true})).toBeVisible();
 await expect(page.getByTestId("nav-clinics")).toHaveAttribute("aria-current","page");
 for(const tab of ["general","locations","staff","policies"])await expect(page.getByTestId(`tab-clinic-${tab}`)).toBeVisible();
 await page.getByTestId("tab-clinic-policies").click();
 await expect(page.getByText("Booking horizon: 30 days", {exact:false})).toBeVisible();
 await page.goBack();
 await expect(page.getByTestId("tab-clinic-general")).toHaveAttribute("aria-selected","true");
 await page.getByTestId("link-all-clinic-groups").click();
 expect(new URL(page.url()).pathname+new URL(page.url()).search).toBe(list);
 await expect(row).toBeVisible();
 await page.getByRole("link",{name:"View Fixture Clinic",exact:true}).click();
 await expect(page.getByTestId("tab-clinic-general")).toBeVisible();
 await page.goBack();
 expect(new URL(page.url()).pathname+new URL(page.url()).search).toBe(list);
});

test("old landing redirects but direct clinic and legacy section links keep their context",async({page})=>{
 await fixture(page);
 await page.goto("/admin/clinic",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/\/admin\/clinics$/);
 await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
 await page.goto("/admin/clinic?clinicId=clinic-1&section=qrs",{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("tab-clinic-locations")).toHaveAttribute("aria-selected","true");
 await expect(page.getByTestId("row-branches-branch-1")).toBeVisible();
 await page.goto("/admin/clinic?section=staff",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/\/admin\/clinic\?section=staff$/);
 await expect(page.getByText("Select a clinic to manage its settings.",{exact:false})).toBeVisible();
});

test("Clinic Admin settings and Doctor navigation remain role-specific (not real authentication)",async({page})=>{
 await fixture(page);
 await page.goto("/?mode=settings&fixtureRole=clinicAdmin",{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("nav-clinic")).toHaveAttribute("href","/admin/clinic");
 await expect(page.getByTestId("tab-clinic-general")).toHaveAttribute("aria-selected","true");
 await expect(page.getByRole("heading",{name:"Fixture Clinic",exact:true})).toBeVisible();
 await expect(page.getByTestId("link-all-clinic-groups")).toHaveCount(0);
 await page.getByTestId("tab-clinic-policies").click();
 await expect(page.getByRole("button",{name:"Edit Policies",exact:true})).toBeVisible();
 await page.goto("/?mode=resource&resource=clinics&fixtureRole=doctor",{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("nav-clinics")).toHaveAttribute("href","/doctor/clinics");
 await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
 await expect(page.getByTestId("button-view-clinic-clinic-1")).toHaveCount(0);
 await expect(page.getByTestId("button-edit-clinic-1")).toHaveCount(0);
});

test("long and absent clinic information keeps actions usable on desktop, tablet and phone",async({page})=>{
 test.setTimeout(60000);
 await fixture(page);
 const long={...clinic,name:"VeryLongClinicName".repeat(8),adminName:"LongOwnerName".repeat(8),email:"longemail".repeat(12)+"@example.invalid",city:"LongCityName".repeat(10)};
 const missing={...clinic,id:"missing",name:"Missing Optional Clinic",code:"",adminName:null,city:"",area:"",phone:"",email:""};
 await page.route("**/api/clinics?*",route=>route.fulfill({json:listing([long,missing])}));
 await page.goto("/admin/clinics",{waitUntil:"domcontentloaded"});
 for(const width of [1440,820,390]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const row=page.getByTestId("row-clinics-clinic-1");
  await expect(row).toBeVisible();
  await expect(page.getByTestId("row-clinics-missing")).toContainText("Code not set");
  await expect(page.getByTestId("row-clinics-missing")).toContainText("Phone not set");
  await expect(page.getByTestId("row-clinics-missing")).toContainText("Email not set");
  const action=page.getByTestId("button-view-clinic-clinic-1");
  await action.scrollIntoViewIfNeeded();
  const box=await action.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
  if(width>=640){
   const owner=page.getByRole("columnheader",{name:"Owning administrator",exact:true});
   expect((await owner.boundingBox())!.width).toBeGreaterThanOrEqual(180);
   for(const header of await page.locator(".superadmin-clinics-table th").all())
    expect(await header.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  if(width===1440){
   const scroller=page.locator(".superadmin-clinics-table .table-scroll");
   expect(await scroller.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   const status=await page.getByRole("columnheader",{name:/Sort by Status/}).boundingBox();
   const actions=await page.getByRole("columnheader",{name:"Actions",exact:true}).boundingBox();
   expect(status!.x+status!.width).toBeLessThanOrEqual(actions!.x+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await screenshot(page,`superadmin-clinics-${width}.png`);
 }
});
const pageUrl = (resource: string, query = "") => `/?mode=resource&resource=${resource}${query ? `&${query}` : ""}`;
async function screenshot(page: Page, filename: string) {
  const dir = "screenshots/workspace-regression";
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${filename}`, fullPage: true });
}
async function utilityDisplays(page: Page) {
  return page.evaluate(() => {
    const element = document.createElement("div");
    document.body.append(element);
    element.className = "flex";
    const flex = getComputedStyle(element).display;
    element.className = "hidden";
    const hidden = getComputedStyle(element).display;
    element.remove();
    return { flex, hidden };
  });
}

test("Clinic drawer status filters and server-backed sortable headings", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(pageUrl("clinics"));
  await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
  expect(await utilityDisplays(page)).toEqual({ flex: "flex", hidden: "none" });
  await expect(page.getByRole("button", { name: /comfortable/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /compact/i })).toHaveCount(0);
   await page.getByTestId("button-toggle-advanced-filters").click();
   await page.getByRole("button", {name:/^Status/}).click();
   await page.getByRole("option", {name:"Active",exact:true}).click();
   await page.getByTestId("button-close-filters").click();
   await expect.poll(() => listCalls(state, "/api/clinics").at(-1)?.params.get("status")).toBe("active");
   await page.getByTestId("button-toggle-advanced-filters").click();
   await page.getByRole("button", {name:/^Status/}).click();
   await page.getByRole("option", {name:"Inactive",exact:true}).click();
   await page.getByTestId("button-close-filters").click();
  await expect.poll(() => listCalls(state, "/api/clinics").at(-1)?.params.get("status")).toBe("inactive");
   await page.getByTestId("button-toggle-advanced-filters").click();
   await page.getByTestId("button-clear-filters-panel").click();
   await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
  const heading = page.getByTestId("sort-clinics-name");
  await heading.click();
  await expect.poll(() => listCalls(state, "/api/clinics").at(-1)?.params.get("sort")).toBe("name");
  await heading.click();
  await expect.poll(() => listCalls(state, "/api/clinics").at(-1)?.params.get("sort")).toBe("-name");
  await screenshot(page, "compact-clinics-desktop.png");
});

test("Clinic compact toolbar keeps bounds, descriptions, stable search and working preferences", async ({page})=>{
  test.setTimeout(60000);
  const state=await fixture(page);
  await page.goto("/admin/clinics",{waitUntil:"domcontentloaded"});
  await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
  const header=page.getByTestId("list-header");
  const search=header.getByRole("combobox");
  const filters=header.getByTestId("button-toggle-advanced-filters");
  const columns=header.getByTestId("button-column-settings");
  const add=header.getByTestId("button-add-clinics");
  await expect(header.getByTestId("button-saved-views")).toHaveCount(0);
  await expect(header.getByTestId("quick-filters-clinics")).toHaveCount(0);
  await expect(header.getByTestId("list-header-subrow")).toHaveCount(0);
  await expect(header.getByTestId("button-more-actions")).toHaveCount(0);
  await expect(filters).toHaveText("");
  await expect(columns).toHaveText("");
  for(const width of [1024,1280,1600,820,390,320]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const controls=[header.getByRole("heading",{name:"Clinic",exact:true}),search,filters,columns,add];
    const boxes=await Promise.all(controls.map(control=>control.boundingBox()));
    const bounds=(await header.boundingBox())!;
    for(let i=0;i<boxes.length;i++){
      const box=boxes[i]!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x-1);
      expect(box.x+box.width).toBeLessThanOrEqual(bounds.x+bounds.width+1);
      expect(await controls[i].evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    }
    expect(boxes[1]!.width).toBeGreaterThanOrEqual(120);
    if(width>=820){
      const centers=boxes.map(box=>box!.y+box!.height/2);
      expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(3);
      expect(bounds.height).toBeLessThanOrEqual(48);
      for(let i=1;i<boxes.length;i++)expect(boxes[i-1]!.x+boxes[i-1]!.width).toBeLessThanOrEqual(boxes[i]!.x);
    }else{
      expect(bounds.height).toBeLessThanOrEqual(104);
      for(const button of [filters,columns,add])expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await screenshot(page,`clinic-toolbar-${width}.png`);
  }
  await page.setViewportSize({width:1280,height:900});
  await filters.focus();
  await expect(page.locator('[role="tooltip"]')).toContainText("Filter clinics");
  expect(await filters.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe("none");
  await filters.press("Enter");
  const status=page.getByRole("button",{name:/^Status/});
  await status.click();
  await page.getByRole("option",{name:"Inactive",exact:true}).click();
  expect(listCalls(state,"/api/clinics").at(-1)?.params.has("status")).toBe(false);
  await page.getByTestId("button-close-filters").click();
  await expect(filters).toBeFocused();
  await expect(filters).toHaveAccessibleName(/1 active/);
  await expect.poll(()=>listCalls(state,"/api/clinics").at(-1)?.params.get("status")).toBe("inactive");
  await filters.click();
  await page.getByTestId("button-clear-filters-panel").click();
  await expect.poll(()=>listCalls(state,"/api/clinics").at(-1)?.params.has("status")).toBe(false);
  await expect(page.getByRole("columnheader",{name:/Status/})).toBeVisible();
  await expect(filters).not.toHaveAccessibleName(/active/);
  await search.evaluate(el=>(el as HTMLElement).dataset.stableSearch="yes");
  await search.fill("Fixture");
  await expect.poll(()=>listCalls(state,"/api/clinics").at(-1)?.params.get("search")).toBe("Fixture");
  await expect(search).toHaveAttribute("data-stable-search","yes");
  await columns.focus();
  await expect(page.locator('[role="tooltip"]')).toContainText("Show, order and pin columns");
  await columns.press("Enter");
  await page.getByTestId("column-setting-adminName").getByRole("checkbox").uncheck();
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await expect(columns).toBeFocused();
  await expect(columns).toHaveAccessibleName("Columns, 1 hidden");
  await expect(page.getByRole("columnheader",{name:"Owning administrator",exact:true})).toHaveCount(0);
  await page.reload();
  await expect(columns).toHaveAccessibleName("Columns, 1 hidden");
  await columns.click();
  await page.getByTestId("button-reset-columns").click();
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await expect(page.getByRole("columnheader",{name:"Owning administrator",exact:true})).toBeVisible();
  await add.click();
  await expect(page.getByRole("dialog")).toContainText("Add Clinic");
  await expect(page.getByRole("dialog").getByTestId("input-name")).toBeVisible();
});

test("non-Clinic shared headers retain labelled tools, views and quick status",async({page})=>{
  await fixture(page);
  await page.setViewportSize({width:1440,height:900});
  for(const resource of ["patients","branches"]){
    await page.goto(pageUrl(resource));
    const header=page.getByTestId("list-header");
    await expect(header).not.toHaveClass(/list-header--compact/);
    await expect(header.getByTestId("button-column-settings")).toContainText("Columns");
    await expect(header.getByTestId("button-saved-views")).toBeVisible();
    await expect(header.getByTestId(`quick-filters-${resource}`)).toBeVisible();
    if(resource==="branches")await expect(header.getByRole("button",{name:/^Status/})).toBeVisible();
  }
  await page.goto(pageUrl("clinics","fixtureRole=doctor"));
  await expect(page.getByTestId("list-header")).toHaveClass(/list-header--compact/);
  await expect(page.getByTestId("button-view-clinic-clinic-1")).toHaveCount(0);
});

test("advanced filter values do not fetch until Apply and Reset clears the server scope", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(pageUrl("patients"));
  await expect(page.getByTestId("row-patients-patient-1")).toBeVisible();
  await page.getByTestId("button-toggle-advanced-filters").click();
  const before = listCalls(state, "/api/patients").length;
  await page.getByTestId("input-patients-from").fill("01 Feb 2030");
  expect(listCalls(state, "/api/patients")).toHaveLength(before);
  await page.getByRole("button", { name: /^apply/i }).click();
  await expect.poll(() => listCalls(state, "/api/patients").at(-1)?.params.get("from")).toBe("2030-02-01");
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByRole("button", { name: /reset/i }).click();
  await expect.poll(() => listCalls(state, "/api/patients").at(-1)?.params.has("from")).toBe(false);
});

test("embedded locations never request another clinic even with a foreign URL filter", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(pageUrl("branches", "fixedClinicId=clinic-1&clinicId=other-clinic"));
  await expect(page.getByTestId("row-branches-branch-1")).toBeVisible();
  expect(listCalls(state, "/api/branches").length).toBeGreaterThan(0);
  expect(listCalls(state, "/api/branches").every(call => call.params.get("clinicId") === clinic.id)).toBe(true);
  await expect(page.getByRole("button", { name: "Clear clinic" })).toHaveCount(0);
});

test("create form preserves clinic and branch across unrelated edits, search and option refresh", async ({ page }) => {
  const state = await fixture(page, true);
  await page.goto(pageUrl("patients"));
  await page.getByTestId("button-add-patients").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: /^Clinic/ }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await dialog.getByRole("combobox", { name: /^Branch/ }).click();
  await page.getByRole("option", { name: "Fixture Location", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: /Branch: Fixture Location/ })).toBeVisible();
  const clinicRequests = listCalls(state, "/api/clinics").length;
  const branchRequests = listCalls(state, "/api/branches").length;
  await dialog.getByTestId("input-fullName").fill("Unsaved Name");
  await dialog.getByRole("combobox", { name: /^Clinic/ }).click();
  await page.getByPlaceholder("Search clinic...").fill("Other");
  await expect.poll(() => listCalls(state, "/api/clinics").filter(call => call.params.get("search") === "Other").length).toBe(1);
  await expect(dialog.getByRole("combobox", { name: /Branch: Fixture Location/ })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: /Clinic: Fixture Clinic/ })).toBeVisible();
  await dialog.getByRole("combobox", { name: /^Clinic/ }).click();
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Unsaved Name");
  expect(listCalls(state, "/api/branches")).toHaveLength(branchRequests);
  expect(listCalls(state, "/api/clinics")).toHaveLength(clinicRequests + 1);
});

test("edit form retains valid branch for unchanged clinic and removes it for another clinic", async ({ page }) => {
  const state = await fixture(page, true);
  await page.goto(pageUrl("patients"));
  await page.getByRole("button", { name: /Edit Fixture Patient/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: /Clinic: Fixture Clinic/ })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: /Branch: Fixture Location/ })).toBeVisible();
  await dialog.getByTestId("input-fullName").fill("Unsaved edit");
  await dialog.getByRole("combobox", { name: /^Clinic/ }).click();
  await page.getByRole("option", { name: "Other Fixture Clinic", exact: true }).click();
  await expect.poll(() => listCalls(state, "/api/branches").some(call => call.params.get("clinicId") === "clinic-2")).toBe(true);
  await expect(dialog.getByRole("combobox", { name: /^Branch/ })).not.toHaveAttribute("aria-label", /Branch: Fixture Location/);
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Unsaved edit");
});

test("branch option errors are not reported as empty or endless loading, and keep the edit selection", async ({ page }) => {
  const state = await fixture(page);
  await page.goto(pageUrl("patients"));
  await page.getByRole("button", { name: /Edit Fixture Patient/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: /Branch: Fixture Location/ })).toBeVisible();
  state.failBranches = true;
  await dialog.getByRole("combobox", { name: /^Branch/ }).click();
  await page.getByPlaceholder("Search branch...").fill("missing");
  await expect.poll(() => listCalls(state, "/api/branches").filter(call => call.params.get("search") === "missing").length).toBe(1);
  await expect(dialog.getByRole("alert")).toContainText("Fixture branch lookup unavailable");
  await expect(dialog.getByRole("combobox", { name: /Branch: Fixture Location/ })).toBeVisible();
  await expect(page.getByText("Searching...", { exact: true })).toHaveCount(0);
});

test("clinic staff link preserves global editing for unassigned staff outside Users administration",async({page})=>{
  const state=await fixture(page);
  state.staff.clinicIds=[];state.staff.branchIds=[];
  await page.goto("/?mode=settings&clinicId=clinic-1&section=staff");
  const link=page.getByTestId("link-global-staff");
  await expect(link).toHaveAttribute("href","/admin/staff");
  await link.click();await expect(page).toHaveURL(/\/admin\/staff(?:\?.*)?$/);
  const listing=page.waitForRequest(r=>new URL(r.url()).pathname==="/api/users"&&new URL(r.url()).searchParams.get("role")==="receptionist"&&!new URL(r.url()).searchParams.has("clinicId"));
  await page.getByTestId("tab-staff-receptionists").click();await listing;
  await page.getByRole("button",{name:"Edit Fixture Receptionist"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Full Name")).toBeEnabled();
});
test("the real Staff page confirms status changes, invalidates lists, and reports rejection", async ({ page }) => {
  const state = await fixture(page);
  page.on("dialog", dialog => dialog.dismiss());
  await page.goto("/?mode=staff&tab=receptionists");
  const row = page.getByRole("row").filter({ hasText: "Fixture Receptionist" });
  await expect(row).toBeVisible();
  const statusSwitch = row.getByRole("switch", { name: /account active for fixture receptionist/i });
  const switchLabel = row.locator("label.staff-status-switch");
  await expect(statusSwitch).toHaveAttribute("aria-checked", "true");
  await switchLabel.click();
  expect(state.calls.filter(call => call.pathname === "/api/users/staff-1" && call.method === "PATCH")).toHaveLength(0);
  page.removeAllListeners("dialog");
  page.on("dialog", dialog => dialog.accept());
  await switchLabel.click();
  await expect.poll(() => state.calls.filter(call => call.pathname === "/api/users/staff-1" && call.method === "PATCH").length).toBe(1);
  await expect.poll(() => state.staff.status).toBe("inactive");
  await expect.poll(() => listCalls(state, "/api/users").filter(call => call.params.get("role") === "receptionist").length).toBeGreaterThan(4);
  await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  state.failStatus = true;
  await switchLabel.click();
  await expect(page.getByRole("alert")).toContainText(/protected user status/i);
  await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await screenshot(page, "staff-status-rejected-desktop.png");
});

test("clinic sections are navigation, not tabs, and a conflict never enables Apply", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/?mode=settings&clinicId=clinic-1&section=locations");
  await expect(page.getByRole("navigation", { name: "Clinic configuration sections" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Clinic configuration sections" })).toHaveCount(0);
  await page.getByTestId("row-branches-branch-1").getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByText("Existing booked session cannot change.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed changes" })).toBeDisabled();
  await page.locator("details").filter({ has: page.locator("summary").filter({ hasText: /^Monday/ }) }).locator("summary").click();
  await page.getByLabel("Shift 1 starts").fill("09:30");
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect.poll(() => state.previewCount).toBe(2);
  await expect(page.getByRole("button", { name: "Apply reviewed changes" })).toBeEnabled();
  await screenshot(page, "clinic-location-review-desktop.png");
  await expect(page.getByLabel("Clinic section")).toBeHidden();
});

test("embedded scheduling changes section without leaving the selected clinic", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/?mode=settings&clinicId=clinic-1&section=sessions");
  const scheduling = page.getByRole("region", { name: "Scheduling workspace" });
  await expect(scheduling).toBeVisible();
  await expect(scheduling.getByLabel("Clinic", { exact: true })).toHaveCount(0);
  await scheduling.getByLabel("Schedule section").selectOption("exceptions");
  await expect(page).toHaveURL(/section=sessions.*schedule=exceptions/);
  await expect(scheduling.getByLabel("Schedule section")).toHaveValue("exceptions");
  await expect.poll(() => state.calls.filter(call => call.pathname.includes("exceptions")).at(-1)?.params.get("clinicId")).toBe("clinic-1");
  await page.reload();
  await expect(scheduling.getByLabel("Schedule section")).toHaveValue("exceptions");
  await scheduling.getByLabel("Schedule section").selectOption("availability");
  await expect(scheduling.getByLabel("Schedule section")).toHaveValue("availability");
});

test("mobile clinic workspace and list remain readable without overflow or undersized actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/?mode=settings&clinicId=clinic-1&section=locations");
  await expect(page.getByLabel("Clinic section")).toBeVisible();
  expect(await utilityDisplays(page)).toEqual({ flex: "flex", hidden: "none" });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, "clinic-settings-mobile.png");
  await expect(page.getByRole("navigation", { name: "Clinic configuration sections" })).toBeHidden();
  await page.goto(pageUrl("clinics"));
  await expect(page.getByTestId("row-clinics-clinic-1")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const visibleActions = page.locator(".admin-listing-filter button:visible");
  expect(await visibleActions.count()).toBeGreaterThan(0);
  await screenshot(page, "compact-clinics-mobile.png");
  for (const button of await visibleActions.all()) {
    const box = await button.boundingBox();
    expect(box?.height || 0, `Small mobile target: ${await button.getAttribute("aria-label") || (await button.innerText()).trim()}`).toBeGreaterThanOrEqual(44);
  }
});