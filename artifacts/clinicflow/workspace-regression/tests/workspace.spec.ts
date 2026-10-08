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
const patient = { id: "patient-1", fullName: "Fixture Patient", status: "active", clinicId: clinic.id, branchId: branch.id };
type Calls = { method: string; pathname: string; params: URLSearchParams; body?: unknown };
type Fixture = {
  calls: Calls[];
  previewCount: number;
  staff: typeof staff;
  failStatus: boolean;
  failBranches: boolean;
  patients: (typeof patient)[];
};
const listing = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });

async function fixture(page: Page, multiClinic = false, patientPickers = false): Promise<Fixture> {
  // External fonts are not part of the behavior under test and can hold load open offline.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.abort());
  const state: Fixture = { calls: [], previewCount: 0, staff: { ...staff }, failStatus: false, failBranches: false, patients: [{ ...patient }] };
  // Picker journeys need more than one in-scope option: a sole location is
  // intentionally auto-selected and rendered read-only by the shared lookup.
  const branches = [
    branch,
    ...(patientPickers ? [{ ...branch, id: "branch-alternate", name: "Alternate Fixture Location" }] : []),
    ...(multiClinic ? [otherBranch, ...(patientPickers ? [{ ...otherBranch, id: "branch-other-alternate", name: "Alternate Other Location" }] : [])] : []),
  ];
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
    if (path === "/api/auth/csrf") reply = { csrfToken: "workspace-fixture" };
    else if (path === "/api/settings") reply = { timezone: "Asia/Kolkata" };
    else if (path === "/api/me") reply = { clerkId: "fixture-only", user: { id: "fixture-admin", role: "superAdmin", fullName: "Fixture Administrator" }, doctorId: "doctor-1" };
    else if (path === "/api/clinics" && method === "GET") reply = listing((multiClinic ? [clinic, otherClinic] : [clinic]).filter(item =>
     (!url.searchParams.get("search") || item.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase())) &&
     (!url.searchParams.get("status") || item.status === url.searchParams.get("status"))));
    else if (path === "/api/branches" && method === "GET" && state.failBranches) { status = 503; reply = { message: "Fixture branch lookup unavailable" }; }
    else if (path === "/api/branches" && method === "GET") reply = listing(branches.filter(item =>
      (!url.searchParams.get("clinicId") || url.searchParams.get("clinicId") === item.clinicId) &&
      (!url.searchParams.get("search") || item.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()))));
    else if (path === "/api/users" && method === "GET") reply = listing(
      (!url.searchParams.get("role") || url.searchParams.get("role") === "receptionist") &&
      (!url.searchParams.get("status") || url.searchParams.get("status") === state.staff.status) ? [state.staff] : [],
    );
    else if (path === "/api/users/staff-1" && method === "GET") reply = state.staff;
    else if (path === "/api/patients" && method === "GET") reply = listing(state.patients);
    else if (path === "/api/patients" && method === "POST") {
      const created = { ...patient, ...(body as object), id: "patient-2" };
      state.patients.push(created); reply = created;
    }
    else if (path.startsWith("/api/patients/") && ["GET", "PATCH"].includes(method)) {
      const record = state.patients.find(item => item.id === path.split("/").at(-1));
      if (!record) { status = 404; reply = { message: "Fixture patient not found" }; }
      else { if (method === "PATCH") Object.assign(record, body); reply = record; }
    }
    else if (path === "/api/doctors" && method === "GET") reply = listing([{ id: "doctor-1", fullName: "Fixture Doctor", userId: "fixture-admin", status: "active", branchIds: [branch.id] }]);
    else if (path === "/api/masters" && method === "GET") reply = listing([]);
    else if (path === "/api/staff-assignment-options") reply = {clinics:[clinic],branches:[branch],doctors:[{id:"doctor-1",fullName:"Fixture Doctor"}],pagination:{clinics:{total:1},branches:{total:1},doctors:{total:1}}};
    else if (path === "/api/public/availability/sessions") reply = [{sessionId:"session-1",startTime:"09:00",endTime:"12:00",remainingTokens:10,available:true},{sessionId:"session-2",startTime:"14:00",endTime:"17:00",remainingTokens:10,available:true}];
    else if (path === "/api/management/system-users") reply = { data: [{...state.staff, clinics:[{id:clinic.id,name:clinic.name}]}], total:1, page:1, pageSize:20 };
    else if (path === "/api/schedules") reply = listing([{id:"schedule-1", doctorId:"doctor-1", doctorName:"Fixture Doctor", clinicId:clinic.id, branchId:branch.id, branchName:branch.name, dayOfWeek:1, isOpen:true, startTime:"09:00", endTime:"12:00", timezone:"Asia/Kolkata", maxTokens:10}]);
    else if (path === "/api/availability-exceptions") reply = listing([{id:"exception-1", doctorId:"doctor-1", branchId:branch.id, date:"2026-10-08", reason:"Fixture exception", isClosed:true}]);
    else if (path === "/api/appointments" && method === "GET") reply = listing([{id:"appointment-1", patientId:"patient-1",patientName:"Fixture Patient", doctorId:"doctor-1",doctorName:"Fixture Doctor",clinicId:clinic.id,clinicName:clinic.name,branchId:branch.id,branchName:branch.name,date:"2026-10-08",startTime:"09:00",endTime:"12:00",status:"booked",token:"A001",reference:"FIXTURE-001",allowedActions:[],revision:1}]);
    else if (path.includes("calendar")) reply = { days:[], total:0 };
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
  // Generated captures belong to this case's artifacts, not tracked historical images.
  const dir = test.info().outputPath("screenshots");
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
      for(const button of [filters,columns,add])expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await screenshot(page,`clinic-toolbar-${width}.png`);
  }
  await page.setViewportSize({width:1280,height:900});
  await filters.focus();
  await expect(page.locator('[role="tooltip"]')).toContainText("Filter clinic groups");
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

test("unrelated shared headers retain labelled tools, views and quick status",async({page})=>{
  await fixture(page);
  await page.setViewportSize({width:1440,height:900});
  for(const resource of ["qrs","branches"]){
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
  const state = await fixture(page, true, true);
  await page.goto(pageUrl("patients"));
  await page.getByTestId("button-add-patients").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Clinic Group", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await dialog.getByRole("button", { name: "Clinic", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Location", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  const clinicRequests = listCalls(state, "/api/clinics").length;
  const branchRequests = listCalls(state, "/api/branches").length;
  await dialog.getByTestId("input-fullName").fill("Unsaved Name");
  await dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true }).click();
  await page.getByPlaceholder("Search clinic group…", { exact: true }).fill("Other");
  await expect.poll(() => listCalls(state, "/api/clinics").filter(call => call.params.get("search") === "Other").length).toBe(1);
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true }).click();
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Unsaved Name");
  expect(listCalls(state, "/api/branches")).toHaveLength(branchRequests);
  expect(listCalls(state, "/api/clinics")).toHaveLength(clinicRequests + 1);
  await dialog.getByTestId("button-save").click();
  await expect(dialog).toHaveCount(0);
  expect(state.calls.find(call => call.pathname === "/api/patients" && call.method === "POST")?.body).toMatchObject({
    fullName: "Unsaved Name", clinicId: "clinic-1", branchId: "branch-1",
  });
  await page.getByRole("button", { name: "Edit Unsaved Name", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
});

for (const closeAction of ["Cancel", "Close", "Escape"] as const) {
  test(`patient editor ${closeAction} uses one discard guard and preserves or discards the draft`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto(pageUrl("patients"));
    const dialog = page.getByRole("dialog", { name: "Edit Patient", exact: true });
    const confirmation = page.getByRole("alertdialog", { name: "Discard unsaved changes?", exact: true });
    const patientWrites = () => state.calls.filter(call =>
      call.pathname === "/api/patients/patient-1" && call.method === "PATCH");
    const requestClose = async () => {
      if (closeAction === "Cancel") await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      else if (closeAction === "Close") await dialog.getByRole("button", { name: "Close", exact: true }).click();
      else await page.keyboard.press("Escape");
    };
    const expectSingleConfirmation = async () => {
      await expect(confirmation).toBeVisible();
      await expect(page.getByRole("alertdialog")).toHaveCount(1);
      // A second ResourcePage dialog must not sit over the inline confirmation.
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(page.getByTestId("discard-confirm")).toHaveCount(1);
    };

    await page.getByRole("button", { name: "Edit Fixture Patient", exact: true }).click();
    await dialog.getByTestId("input-fullName").fill("Unsaved patient draft");
    await requestClose();
    await expectSingleConfirmation();
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(dialog.getByTestId("input-fullName")).toHaveValue("Unsaved patient draft");
    expect(patientWrites()).toHaveLength(0);

    await requestClose();
    await expectSingleConfirmation();
    await confirmation.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    expect(patientWrites()).toHaveLength(0);
    expect(state.patients[0].fullName).toBe("Fixture Patient");

    await page.getByRole("button", { name: "Edit Fixture Patient", exact: true }).click();
    await expect(dialog.getByTestId("input-fullName")).toHaveValue("Fixture Patient");
    // The same draft can still be saved after declining the discard prompt.
    await dialog.getByTestId("input-fullName").fill("Saved patient edit");
    await requestClose();
    await expectSingleConfirmation();
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(patientWrites()).toHaveLength(1);
    expect(patientWrites()[0].body).toMatchObject({ fullName: "Saved patient edit" });
    await page.getByRole("button", { name: "Edit Saved patient edit", exact: true }).click();
    await expect(dialog.getByTestId("input-fullName")).toHaveValue("Saved patient edit");
    // A clean editor closes immediately, without introducing a discard prompt.
    await requestClose();
    await expect(dialog).toHaveCount(0);
    await expect(confirmation).toHaveCount(0);
    expect(patientWrites()).toHaveLength(1);
  });
}

test("edit form retains valid branch for unchanged clinic and removes it for another clinic", async ({ page }) => {
  const state = await fixture(page, true, true);
  await page.goto(pageUrl("patients"));
  await page.getByRole("button", { name: /Edit Fixture Patient/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  await dialog.getByTestId("input-fullName").fill("Cancelled edit");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Discard unsaved changes?", exact: true });
  await expect(confirmation).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await confirmation.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.calls.filter(call => call.pathname === "/api/patients/patient-1" && call.method === "PATCH")).toHaveLength(0);
  await page.getByRole("button", { name: "Edit Fixture Patient", exact: true }).click();
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Fixture Patient");
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  await dialog.getByTestId("input-fullName").fill("Unsaved edit");
  await dialog.getByRole("button", { name: "Clinic Group: Fixture Clinic", exact: true }).click();
  await page.getByRole("option", { name: "Other Fixture Clinic", exact: true }).click();
  await expect.poll(() => listCalls(state, "/api/branches").some(call => call.params.get("clinicId") === "clinic-2")).toBe(true);
  await expect(dialog.getByRole("button", { name: "Clinic", exact: true })).toHaveAttribute("aria-label", "Clinic");
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Unsaved edit");
  await dialog.getByRole("button", { name: "Clinic", exact: true }).click();
  await page.getByRole("option", { name: "Other Fixture Location", exact: true }).click();
  await dialog.getByTestId("button-save").click();
  await expect(dialog).toHaveCount(0);
  expect(state.calls.find(call => call.pathname === "/api/patients/patient-1" && call.method === "PATCH")?.body).toMatchObject({
    fullName: "Unsaved edit", clinicId: "clinic-2", branchId: "branch-2",
  });
  await page.getByRole("button", { name: "Edit Unsaved edit", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Clinic Group: Other Fixture Clinic", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clinic: Other Fixture Location", exact: true })).toBeVisible();
});

test("branch option errors are not reported as empty or endless loading, and keep the edit selection", async ({ page }) => {
  const state = await fixture(page, false, true);
  await page.goto(pageUrl("patients"));
  await page.getByRole("button", { name: /Edit Fixture Patient/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  state.failBranches = true;
  await dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true }).click();
  await page.getByPlaceholder("Search clinic…", { exact: true }).fill("missing");
  await expect.poll(() => listCalls(state, "/api/branches").filter(call => call.params.get("search") === "missing").length).toBe(1);
  const lookupError = dialog.getByRole("alert").filter({ hasText: "Your selection has been retained." });
  await expect(lookupError).toContainText("Unable to load options.");
  await expect(lookupError.getByRole("button", { name: "Retry Options", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
  await expect(page.getByText(/^Searching(?:…|\.\.\.)$/)).toHaveCount(0);
  state.failBranches = false;
  await lookupError.getByRole("button", { name: "Retry Options", exact: true }).click();
  await expect(lookupError).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Clinic: Fixture Location", exact: true })).toBeVisible();
});

test("clinic staff link preserves global editing for unassigned staff outside Users administration",async({page})=>{
  const state=await fixture(page);
  state.staff.clinicIds=[];state.staff.branchIds=[];
  await page.goto("/?mode=settings&clinicId=clinic-1&section=staff");
  const link=page.getByTestId("link-global-staff");
  await expect(link).toHaveAttribute("href","/admin/staff");
  await link.click();await expect(page).toHaveURL(/\/admin\/staff(?:\?.*)?$/);
  const listing=page.waitForRequest(r=>new URL(r.url()).pathname==="/api/users"&&new URL(r.url()).searchParams.get("role")==="receptionist"&&!new URL(r.url()).searchParams.has("clinicId"));
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByRole("button",{name:/^Staff Type/}).click();
  await page.getByRole("option",{name:"Receptionists",exact:true}).click();
  await page.getByTestId("button-close-filters").click();await listing;
  await page.getByRole("button",{name:"Edit Fixture Receptionist"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Full Name")).toBeEnabled();
});
test("the real Staff page confirms status changes, invalidates lists, and reports rejection", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/?mode=staff&tab=receptionists");
  const row = page.getByRole("row").filter({ hasText: "Fixture Receptionist" });
  await expect(row).toBeVisible();
  const statusSwitch = row.getByRole("switch", { name: /account active for fixture receptionist/i });
  const switchLabel = row.locator("label.staff-status-switch");
  await expect(statusSwitch).toHaveAttribute("aria-checked", "true");
  await switchLabel.click();
  const confirmation = page.getByRole("dialog", { name: "Deactivate Fixture Receptionist?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(statusSwitch).toHaveAttribute("aria-checked", "true");
  expect(state.calls.filter(call => call.pathname === "/api/users/staff-1" && call.method === "PATCH")).toHaveLength(0);
  const beforeSave = listCalls(state, "/api/users").filter(call => call.params.get("role") === "receptionist").length;
  await switchLabel.click();
  await confirmation.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect.poll(() => state.calls.filter(call => call.pathname === "/api/users/staff-1" && call.method === "PATCH").length).toBe(1);
  await expect.poll(() => state.staff.status).toBe("inactive");
  await expect.poll(() => listCalls(state, "/api/users").filter(call => call.params.get("role") === "receptionist").length).toBeGreaterThan(beforeSave);
  await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  state.failStatus = true;
  await switchLabel.click();
  await expect(page.getByRole("alert")).toContainText(/protected user status/i);
  await expect(row.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await screenshot(page, "staff-status-rejected-desktop.png");
});

test("clinic section tabs retain selection and a conflict never enables Apply", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/?mode=settings&clinicId=clinic-1&section=locations");
  const sections = page.getByRole("tablist", { name: "Clinic sections" });
  await expect(sections).toBeVisible();
  await expect(sections.getByRole("tab", { name: "Locations", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(sections.getByRole("tab", { name: "Sessions", exact: true })).toHaveCount(0);
  await page.getByTestId("row-branches-branch-1").getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect(page.getByText("Existing booked session cannot change.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply reviewed changes" })).toBeDisabled();
  expect(state.calls.filter(call => call.pathname === "/api/clinics/clinic-1/settings" && call.method !== "GET")).toHaveLength(0);
  await page.getByTestId("hours-startTime-1-0").fill("9:30 AM");
  await page.getByTestId("hours-startTime-1-0").press("Tab");
  await page.getByRole("button", { name: "Review changes" }).click();
  await expect.poll(() => state.previewCount).toBe(2);
  const preview = state.calls.filter(call => call.pathname === "/api/clinics/clinic-1/settings/preview").at(-1)?.body;
  expect(preview).toMatchObject({ branches: [{ id: "branch-1", openingHours: [{ dayOfWeek: 1, startTime: "09:30", endTime: "17:00" }] }] });
  await expect(page.getByRole("button", { name: "Apply reviewed changes" })).toBeEnabled();
  await screenshot(page, "clinic-location-review-desktop.png");
  // AppDialog makes the background inert; assert its retained state by test id.
  await expect(page.getByTestId("tab-clinic-locations")).toHaveAttribute("aria-selected", "true");
});

test("embedded scheduling changes section without leaving the selected clinic", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/?mode=schedule&fixedClinicId=clinic-1");
  const scheduling = page.getByRole("region", { name: "Scheduling workspace" });
  await expect(scheduling).toBeVisible();
  await expect(scheduling.getByLabel("Clinic", { exact: true })).toHaveCount(0);
  await scheduling.getByRole("tab", { name: "Exceptions", exact: true }).click();
  await expect(page).toHaveURL(/fixedClinicId=clinic-1.*schedule=exceptions/);
  await expect(scheduling.getByRole("tab", { name: "Exceptions", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => state.calls.filter(call => call.pathname.includes("exceptions")).at(-1)?.params.get("clinicId")).toBe("clinic-1");
  await page.reload();
  await expect(scheduling.getByRole("tab", { name: "Exceptions", exact: true })).toHaveAttribute("aria-selected", "true");
  await scheduling.getByRole("tab", { name: "Weekly", exact: true }).click();
  await expect(scheduling.getByRole("tab", { name: "Weekly", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => listCalls(state, "/api/schedules").at(-1)?.params.get("clinicId")).toBe("clinic-1");
  expect(state.calls.filter(call => ["/api/schedules", "/api/availability-exceptions"].includes(call.pathname)).every(call => call.params.get("clinicId") === "clinic-1")).toBe(true);
});

test("supported schedule routes retain clinic scope through tabs and reload", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/admin/availability?clinicId=clinic-1");
  const scheduling = page.getByRole("region", { name: "Scheduling workspace" });
  await expect(scheduling.getByRole("tab", { name: "Weekly", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => listCalls(state, "/api/schedules").at(-1)?.params.get("clinicId")).toBe("clinic-1");
  await scheduling.getByRole("tab", { name: "Exceptions", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/exceptions\?clinicId=clinic-1$/);
  await expect.poll(() => listCalls(state, "/api/availability-exceptions").at(-1)?.params.get("clinicId")).toBe("clinic-1");
  await page.reload();
  await expect(scheduling.getByRole("tab", { name: "Exceptions", exact: true })).toHaveAttribute("aria-selected", "true");
  await scheduling.getByRole("tab", { name: "Weekly", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/availability\?clinicId=clinic-1$/);
  await expect(scheduling.getByRole("tab", { name: "Weekly", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("mobile clinic workspace and list remain readable without overflow or undersized actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/?mode=settings&clinicId=clinic-1&section=locations");
  await expect(page.getByRole("tablist", { name: "Clinic sections" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Locations", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("row-branches-branch-1")).toBeVisible();
  expect(await utilityDisplays(page)).toEqual({ flex: "flex", hidden: "none" });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await screenshot(page, "clinic-settings-mobile.png");
  await page.getByRole("tab", { name: "Policies", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Policies", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/clinicId=clinic-1.*section=policies/);
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

test("compact appointment session filter waits for Apply and clears on Reset",async({page})=>{
  const state=await fixture(page);
  const open=()=>page.getByTestId("button-toggle-advanced-filters").click();
  await page.goto("/admin/appointments?clinic=clinic-1&branch=branch-1&doctor=doctor-1&from=2026-10-08&to=2026-10-08");
  await expect(page.getByRole("button",{name:/^Consulting Session/})).toHaveCount(0);
  await open();
  await page.getByRole("button",{name:/^Consulting Session/}).click();
  await page.getByRole("option",{name:/^2:00 PM/}).click();
  expect(listCalls(state,"/api/appointments").some(call=>call.params.get("startTime")==="14:00")).toBe(false);
  await page.getByTestId("button-close-filters").click();
  await expect.poll(()=>listCalls(state,"/api/appointments").some(call=>call.params.get("startTime")==="14:00")).toBe(true);
  await open();
  await expect(page.getByRole("button",{name:/^Consulting Session/})).toHaveAccessibleName(/2:00 PM/);
  await page.getByTestId("button-clear-filters-panel").click();
  await expect.poll(()=>listCalls(state,"/api/appointments").at(-1)?.params.has("startTime")).toBe(false);
});

const compactPages = [
  {url:"/?mode=users&area=system",name:"System users",path:"/api/management/system-users"},
  {url:"/?mode=staff&tab=receptionists",name:"Staff",path:"/api/users"},
  {url:"/?mode=resource&resource=patients",name:"patients",path:"/api/patients"},
  {url:"/?mode=schedule&resource=availability",name:"Weekly Schedules",path:"/api/schedules"},
  {url:"/?mode=schedule&resource=exceptions",name:"Date Exceptions",path:"/api/availability-exceptions"},
  {url:"/admin/appointments",name:"Appointments",path:"/api/appointments"},
];
for (const listingPage of compactPages) {
  test(`compact workspace ${listingPage.name}: bounds, focus, drawer-only filters and columns`,async({page})=>{
    const state=await fixture(page);
    await page.goto(listingPage.url);
    const header=page.locator('[data-testid="list-header"]:visible').first();
    const search=header.getByRole("combobox");
    const filters=header.getByTestId("button-toggle-advanced-filters");
    const columns=header.getByTestId("button-column-settings");
    await expect(columns).toBeVisible();
    await expect(header).toHaveClass(/list-header--compact/);
    for(const width of [1024,1600,820,390,320]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await expect(header.getByTestId("list-header-filters")).toHaveCount(0);
      await expect(header.getByTestId("list-header-subrow")).toHaveCount(0);
      await expect(page.getByTestId("button-toggle-quick-filters")).toHaveCount(0);
      await expect(header.getByTestId("button-saved-views")).toHaveCount(0);
      await expect(page.getByRole("tablist",{name:"Filter staff by role"})).toHaveCount(0);
      await expect(header.locator("select,input[type=date],.searchable-select-control")).toHaveCount(0);
      const controls=header.getByTestId("list-header-search-row").locator("h1,h2,input:visible,button:visible,a.button:visible");
      const headerBox=(await header.boundingBox())!;
      const boxes=await Promise.all((await controls.all()).map(async control=>{
        const box=(await control.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(headerBox.x-1);
        expect(box.x+box.width).toBeLessThanOrEqual(headerBox.x+headerBox.width+1);
        // Badges intentionally extend outside their icon button, and help controls
        // have enlarged pseudo-element hit targets. Measure text, not scrollWidth.
        expect(await control.evaluate(el=>{
          const bounds=el.getBoundingClientRect();
          const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
          let node:Node|null;
          while((node=walker.nextNode())){
            if(!node.textContent?.trim()||(node.parentElement?.closest(".filter-count,.sr-only,.sr-only-helptip")))continue;
            const range=document.createRange();range.selectNodeContents(node);
            const rect=range.getBoundingClientRect();
            if(rect.width&&(rect.left<bounds.left-1||rect.right>bounds.right+1))return false;
          }
          return true;
        }),await control.evaluate(el=>el.outerHTML)).toBe(true);
        return box;
      }));
      if(width>=1024){
        const centers=boxes.map(box=>box.y+box.height/2);
        expect(Math.max(...centers)-Math.min(...centers)).toBeLessThan(3);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await screenshot(page,`workspace-${listingPage.name.replaceAll(" ","-")}-${width}.png`);
    }
    await page.setViewportSize({width:1280,height:900});
    await search.evaluate(el=>(el as HTMLElement).dataset.stable="yes");
    await search.pressSequentially("Fixture",{delay:30});
    await expect(search).toBeFocused();
    await expect(search).toHaveAttribute("data-stable","yes");
    await expect.poll(()=>listCalls(state,listingPage.path).some(call=>call.params.get("search")==="Fixture")).toBe(true);
    await filters.focus();
    await expect(filters).toHaveAttribute("aria-describedby",/.+/);
    expect(await filters.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe("none");
    await filters.press("Enter");
    const drawer=page.getByTestId("form-filter-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("button,input").first()).toBeVisible();
    await drawer.getByTestId("button-close-filters").click();
    await expect(filters).toBeFocused();
    await columns.click();
    const optional=page.locator(".lvc-columns input[type=checkbox]:not(:disabled)").first();
    await optional.uncheck();
    await page.getByRole("dialog",{name:"Columns",exact:true}).getByRole("button",{name:"Done",exact:true}).click();
    await expect(columns).toHaveAccessibleName(/hidden/);
    await page.reload();
    await expect(columns).toHaveAccessibleName(/hidden/);
    await columns.click();
    await page.getByTestId("button-reset-columns").click();
    await page.getByRole("dialog",{name:"Columns",exact:true}).getByRole("button",{name:"Done",exact:true}).click();
    if(listingPage.path==="/api/appointments"){
      await page.getByTestId("button-mode-calendar").click();
      await expect(page.getByRole("region",{name:"Appointment calendar",exact:true})).toBeVisible();
      await expect(columns).toBeVisible();
      const month=await page.getByTestId("text-calendar-month").innerText();
      await page.getByTestId("button-calendar-next").click();
      await expect(page.getByTestId("text-calendar-month")).not.toHaveText(month);
      await expect(page.getByTestId("button-toggle-quick-filters")).toHaveCount(0);
      await page.getByTestId("button-mode-list").click();
      await expect(page.getByTestId("appointment-appointment-1")).toBeVisible();
      await expect(page.getByTestId("link-page-book-appointment")).toHaveAttribute("href","/admin/book");
    }
    if(listingPage.path==="/api/patients")await expect(header.getByRole("button",{name:/Export/})).toBeVisible();
    if(listingPage.path==="/api/users"){
      await page.getByTestId("button-open-account-recovery").click();
      await expect(page.getByRole("dialog",{name:"Account Recovery Assistance",exact:true})).toBeVisible();
      await page.getByRole("dialog",{name:"Account Recovery Assistance",exact:true}).getByRole("button",{name:"Close",exact:true}).click();
      await page.getByTestId("button-add-staff").click();
      await expect(page.getByRole("dialog")).toContainText("Add Staff");
    }
  });
}

test("compact drawers commit combined filters, staff type and appointment time view",async({page})=>{
  const state=await fixture(page, true);
  const open=async()=>{await page.getByTestId("button-toggle-advanced-filters").click();};
  const choose=async(label:RegExp,option:string)=>{
    await page.getByTestId("form-filter-drawer").getByRole("button",{name:label}).click();
    await page.getByRole("option",{name:new RegExp(`^${option}(?: \\(\\d+\\))?(?: \\(selected\\))?$`)}).click();
  };
  for(const target of [
    {url:"/?mode=users&area=system",status:/^Account Status/,testId:"select-system-user-status",path:"/api/management/system-users"},
    {url:"/?mode=staff&tab=receptionists",status:/^Account Status/,testId:"select-staff-status",path:"/api/users"},
    {url:"/?mode=resource&resource=patients",status:/^Status/,testId:"select-patients-status",path:"/api/patients"},
    {url:"/admin/appointments",status:/^Status/,testId:"select-appointment-status",path:"/api/appointments"}
  ]){
    await page.goto(target.url);await open();
    if(target.path!=="/api/appointments")await choose(target.status,"Inactive");
    if(target.path==="/api/appointments"){
      await choose(/^Status/,"Waiting");
      await choose(/^Visit Range/,"Past Visits");
      await page.getByTestId("input-appointment-from").fill("01 Oct 2026");
      await page.getByTestId("input-appointment-to").fill("08 Oct 2026");
    }else if(target.path==="/api/users"){
      await choose(/^Staff Type/,"Doctors");
    }else if(target.path==="/api/patients"){
      await page.getByTestId("input-patients-from").fill("01 Oct 2026");
      await page.getByTestId("input-patients-to").fill("08 Oct 2026");
    }
    await choose(target.path==="/api/patients"?/^Registration clinic/:/^Clinic(?::|$)/,"Fixture Clinic");
    if(target.path==="/api/management/system-users")await choose(/^Role/,"Receptionist");
    await page.getByTestId("button-close-filters").click();
    await expect(page.getByTestId("form-filter-drawer")).toHaveCount(0);
    await expect(page.getByTestId("button-toggle-advanced-filters")).toHaveAccessibleName(/active/);
    await expect.poll(()=>listCalls(state,target.path==="/api/users"?"/api/doctors":target.path).some(call=>
      call.params.get(target.path==="/api/appointments"?"statusGroup":"status")===(target.path==="/api/appointments"?"waiting":"inactive")
      &&call.params.get("clinicId")==="clinic-1"
      &&(!(target.path==="/api/patients"||target.path==="/api/appointments")||call.params.get("from")==="2026-10-01")
    )).toBe(true);
    await open();await page.getByTestId("button-clear-filters-panel").click();
    await expect(page.getByTestId("form-filter-drawer")).toHaveCount(0);
    await expect(page.getByTestId("button-toggle-advanced-filters")).not.toHaveAccessibleName(/active/);
  }
});

test("compact schedule drawer keeps scope, day, date and actual workspace tabs",async({page})=>{
  const state=await fixture(page);
  for(const resource of ["availability","exceptions"]){
    await page.goto(`/?mode=schedule&resource=${resource}&fixedClinicId=clinic-1${resource==="exceptions"?"&schedule=exceptions":""}`);
    await expect(page.getByRole("tablist",{name:"Schedule sections"})).toBeVisible();
    await page.getByTestId("button-toggle-advanced-filters").click();
    const drawer=page.getByTestId("form-filter-drawer");
    await expect(drawer.getByRole("button",{name:/^Clinic:/})).toHaveCount(0);
    await expect(drawer.getByRole("button",{name:/^Location/})).toBeVisible();
    await expect(drawer.getByRole("button",{name:/^Doctor/})).toBeVisible();
    await drawer.getByRole("button",{name:/^Location/}).click();
    await page.getByRole("option",{name:"Fixture Location",exact:true}).click();
    await drawer.getByRole("button",{name:/^Doctor/}).click();
    await page.getByRole("option",{name:"Fixture Doctor",exact:true}).click();
    if(resource==="availability"){
      await drawer.getByRole("button",{name:/^Day/}).click();
      await page.getByRole("option",{name:"Monday",exact:true}).click();
    }else await page.getByTestId("input-exceptions-date-filter").fill("08 Oct 2026");
    await drawer.getByTestId("button-close-filters").click();
    const path=resource==="availability"?"/api/schedules":"/api/availability-exceptions";
    await expect.poll(()=>listCalls(state,path).at(-1)?.params.get(resource==="availability"?"dayOfWeek":"date")).toBe(resource==="availability"?"1":"2026-10-08");
    expect(listCalls(state,path).at(-1)?.params.get("clinicId")).toBe("clinic-1");
    expect(listCalls(state,path).at(-1)?.params.get("branchId")).toBe("branch-1");
    expect(listCalls(state,path).at(-1)?.params.get("doctorId")).toBe("doctor-1");
    await page.getByTestId("button-clear-all-filters").click();
    await expect.poll(()=>listCalls(state,path).at(-1)?.params.has(resource==="availability"?"dayOfWeek":"date")).toBe(false);
  }
  await page.goto("/?mode=resource&resource=patients&fixtureRole=doctor");
  await expect(page.getByTestId("button-add-patients")).toHaveCount(0);
  await page.goto("/?mode=staff&fixtureRole=doctor");
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByRole("button",{name:/^Staff Type/}).click();
  await expect(page.getByRole("option",{name:/^Receptionists/})).toBeVisible();
  await expect(page.getByRole("option",{name:"Doctors",exact:true})).toHaveCount(0);
  await expect(page.getByRole("option",{name:"Clinic Admins",exact:true})).toHaveCount(0);
});