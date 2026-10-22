import { test, expect, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { createFeatureHarness } from "../../../api-server/src/test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "../../../api-server/src/test-support/feature-fixtures.mjs";

// Native-session cookies and real /me + SQL authorization, not inferred role props.
// All network traffic is confined to a disposable migrated local database.
let h: Awaited<ReturnType<typeof createFeatureHarness>>;
const sessions: Record<string, string> = {};
test.beforeAll(async () => {
  process.env.AUTH_SESSION_MODE = "native";
  h = await createFeatureHarness({ administration: true, bookingLookups: true, simulatedMail: true, registration: true });
  await seedFeatureFixtures(h.pg);
  await h.pg.exec(`
    insert into doctors(id,user_id,owner_admin_id) values ('owner-doctor','adm','adm');
    insert into masters(id,category,data,code) values
      ('specialty-ready','specialization','{"name":"Fixture Medicine"}','READY'),
      ('qualification-ready','qualification','{"name":"Fixture Qualification"}','READY'),
      ('category-ready','clinicCategory','{"name":"Fixture Category"}','READY');
    update branches set data=data||'{"timezone":"UTC"}'::jsonb;
    insert into settings(id,data) values ('custom-roles','{"revision":1,"roles":[{"id":"dropdown-restricted","name":"Readiness Restricted Desk","baseRole":"receptionist","denied":["patients:read"]}],"bindings":[{"userId":"rec2","roleId":"dropdown-restricted"}]}'::jsonb);
  `);
  for (let i = 0; i < 24; i++) {
    await h.pg.query("insert into clinics(id,admin_id,owner_id,data) values($1,'adm','adm',$2::jsonb)",
      [`ready-${String(i).padStart(2,"0")}`, JSON.stringify({ name: `Readiness Clinic ${String(i).padStart(2,"0")}`, slug: `readiness-${i}` })]);
  }
  // Keep a known initial row and an explicitly off-page saved row regardless
  // of fixture creation speed. Default directory ordering is newest first.
  await h.pg.exec("update clinics set created_at='2000-01-02' where id like 'ready-%'; update clinics set created_at='2000-01-01' where id='c2'");
  for (const id of ["sa", "adm", "docu", "rec", "rec2", "patu"]) {
    const token = createHash("sha256").update(randomUUID()).digest("base64url");
    await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,$3)",
      [createHash("sha256").update(token).digest("hex"), id, new Date(Date.now() + 3600000)]);
    sessions[id] = `digiq_session=${token}`;
    const me = await h.call(null, "GET", "/me", undefined, { cookie: sessions[id] });
    expect(me.status, `verify native session for ${id} before launching any browser case`).toBe(200);
    expect(me.data.user.id).toBe(id);
    if (id === "adm") expect(me.data.doctorId).toBe("owner-doctor");
  }
  for (const path of ["/clinics/c1/settings", "/public/registration-options", "/staff-assignment-options?targetRole=receptionist"]) {
    expect((await h.call(null,"GET",path,undefined,{cookie:sessions.sa})).status, `fixture must mount ${path}`).toBe(200);
  }
  expect((await h.call(null,"GET","/patients",undefined,{cookie:sessions.rec2})).status).toBe(403);
});
test.afterAll(async () => { await h?.close(); });

type Read = { path: string; params: URLSearchParams; at: number; status?: number };
async function connect(page: Page, actor = "sa") {
  const state = { actor, reads: [] as Read[], fail: "", delay: "", release: undefined as undefined | (() => void) };
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    expect(request.method(), "readiness must not write or send communications").toBe("GET");
    const read: Read = { path: url.pathname, params: url.searchParams, at: Date.now() };
    state.reads.push(read);
    if (url.pathname === state.delay) await new Promise<void>(resolve => { state.release = resolve; });
    if (url.pathname === state.fail) { read.status = 503; return route.fulfill({ status: 503, json: { message: "Fictional outage" } }); }
    const result = await h.call(null, "GET", url.pathname.replace(/^\/api/, "") + url.search, undefined,
      state.actor ? { cookie: sessions[state.actor] } : {});
    read.status = result.status;
    await route.fulfill({ status: result.status, json: result.data });
  });
  return state;
}
const url = (area: string, extra = "") => `/?mode=dropdown-workspace&area=${area}${extra}`;
const initial = (reads: Read[], path: string) => reads.filter(read => read.path === path && !read.params.get("search") && !read.params.get("selectedIds"));
const trigger = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^${label}(?::|$)`) });

for (const [actor, role] of [["sa","superAdmin"],["adm","clinicAdmin"],["docu","doctor"],["rec","receptionist"],["rec2","receptionist"]]) {
  test(`${actor}: native identity, closed drawer readiness, first options and unauthorized exclusion`, async ({ page }, info) => {
    const state = await connect(page, actor);
    const start = Date.now();
    await page.goto(url("selectors"));
    await expect(page.getByTestId("dropdown-actor")).toContainText(`"id":"${actor}"`);
    await expect(page.getByTestId("dropdown-actor")).toContainText(`"role":"${role}"`);
    await expect.poll(() => initial(state.reads,"/api/clinics").some(r => r.status === 200)).toBe(true);
    expect(await page.getByRole("dialog").count()).toBe(0);
    expect(initial(state.reads,"/api/clinics").length).toBe(1);
    expect(state.reads.filter(r => r.path === "/api/branches")).toHaveLength(0);
    const cold = Date.now() - start;
    await trigger(page,"Clinic options").click();
    await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
    if (actor !== "sa") await expect(page.getByRole("option",{name:"Foreign Clinic",exact:true})).toHaveCount(0);
    await page.keyboard.press("Escape");
    const before = state.reads.length, warmStart = Date.now();
    await page.getByTestId("button-toggle-advanced-filters").click();
    await trigger(page,"Filter Clinic").click();
    await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
    expect(state.reads.length).toBe(before);
    const measurement = { actor, coldMs: cold, warmMs: Date.now()-warmStart, initialRequests: initial(state.reads,"/api/clinics").length };
    console.log("READINESS_MEASUREMENT", JSON.stringify(measurement));
    await info.attach("readiness-measurement", { body: JSON.stringify(measurement), contentType: "application/json" });
    await page.getByRole("option",{name:"Lakeview Clinic",exact:true}).click();
    await expect.poll(() => initial(state.reads,"/api/branches").some(r => r.params.get("clinicId")==="c1" && r.status===200)).toBe(true);
    await trigger(page,"Filter Location").click();
    await expect(page.getByRole("option",{name:"Lakeview Main",exact:true})).toBeVisible();
    await expect(page.getByRole("option",{name:"Foreign Main",exact:true})).toHaveCount(0);
  });
}

test("cold saved names beyond page one, bounded pagination and multi-select do not select the first row", async ({ page }) => {
  const state = await connect(page);
  await page.goto(url("selectors"));
  await expect(trigger(page,"Saved clinic")).toHaveAccessibleName("Saved clinic: Hillside Clinic");
  await expect(page.getByTestId("dropdown-draft")).toContainText('"value":""');
  await expect(page.getByTestId("dropdown-draft")).toContainText('"many":[]');
  await trigger(page,"Clinic multi").click();
  await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
  await page.getByRole("option",{name:"Lakeview Clinic",exact:true}).click();
  await expect(page.getByTestId("dropdown-draft")).toContainText('"many":["c1"]');
  await page.getByRole("option").last().scrollIntoViewIfNeeded();
  await expect.poll(() => initial(state.reads,"/api/clinics").some(r => r.params.get("page")==="2")).toBe(true);
  expect(initial(state.reads,"/api/clinics").every(r => Number(r.params.get("pageSize")) <= 20)).toBe(true);
});

test("custom-role restrictions are real and changing authenticated actor drops prior options and names", async ({ page }) => {
  const state = await connect(page);
  await page.goto(url("selectors"));
  await expect(trigger(page,"Saved clinic")).toHaveAccessibleName("Saved clinic: Hillside Clinic");
  state.actor = "rec2";
  await page.getByRole("button",{name:"Refresh identity",exact:true}).click();
  await expect(page.getByTestId("dropdown-actor")).toContainText('"id":"rec2"');
  await expect(trigger(page,"Saved clinic")).not.toHaveAccessibleName(/Hillside Clinic/);
  await trigger(page,"Clinic options").click();
  await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
  await expect(page.getByRole("option",{name:"Foreign Clinic",exact:true})).toHaveCount(0);
  const denied = await h.call(null,"GET","/patients",undefined,{cookie:sessions.rec2});
  expect(denied.status).toBe(403);
});

test("changing parent after a search starts a new unsearched child read before another menu click", async ({ page }) => {
  const state = await connect(page,"adm");
  await page.goto(url("selectors"));
  await page.getByTestId("button-toggle-advanced-filters").click();
  await trigger(page,"Filter Clinic").click();
  await page.getByRole("option",{name:"Lakeview Clinic",exact:true}).click();
  await expect.poll(() => initial(state.reads,"/api/branches").some(r=>r.params.get("clinicId")==="c1" && r.status===200)).toBe(true);
  await trigger(page,"Filter Location").click();
  await page.getByRole("combobox").fill("Main");
  await expect.poll(() => state.reads.some(r=>r.path==="/api/branches" && r.params.get("search")==="Main")).toBe(true);
  await page.keyboard.press("Escape");
  await trigger(page,"Filter Clinic").click();
  await page.getByRole("combobox").fill("Hillside");
  await page.getByRole("option",{name:"Hillside Clinic",exact:true}).click();
  await expect.poll(() => initial(state.reads,"/api/branches").some(r=>r.params.get("clinicId")==="c2" && r.status===200)).toBe(true);
  await trigger(page,"Filter Location").click();
  await expect(page.getByRole("option",{name:"Hillside Main",exact:true})).toBeVisible();
  await expect(page.getByRole("option",{name:"Lakeview Main",exact:true})).toHaveCount(0);
});

test("slow and failed initial reads remain distinct from empty; manual retry recovers without opening first", async ({ page }) => {
  const state = await connect(page);
  state.delay = "/api/clinics";
  await page.goto(url("selectors"));
  await expect.poll(() => !!state.release).toBe(true);
  await trigger(page,"Clinic options").click();
  await expect(page.getByText("Loading…",{exact:true})).toBeVisible();
  await expect(page.getByText("No options available.",{exact:true})).toHaveCount(0);
  state.fail = "/api/clinics"; state.delay = ""; state.release!();
  await expect(page.getByRole("listbox").getByText(/Unable to load options/)).toBeVisible();
  state.fail = "";
  await page.getByRole("button",{name:"Retry",exact:true}).click();
  await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
});

test("six original areas start the relevant first page on page or form entry before a menu click", async ({ page }, info) => {
  const state = await connect(page);
  const evidence: Record<string, string[]> = {};
  for (const area of ["clinic","doctors","patients","staff","booking","appointments"]) {
    state.reads.length = 0;
    await page.goto(url(area, area==="clinic" ? "&clinicId=c1" : area==="staff" ? "&tab=receptionists" : area==="booking" ? "&clinic=c1&branch=b1&doctor=d1" : ""));
    await expect(page.getByTestId("dropdown-actor")).toContainText('"id":"sa"');
    if (area==="clinic") {
      await page.getByTestId("button-edit-clinic").click();
      await expect.poll(() => state.reads.some(r => r.path==="/api/public/registration-options" && r.status===200)).toBe(true);
    } else if (["doctors","patients"].includes(area)) {
      await page.getByTestId(`button-add-${area}`).click();
      await expect.poll(() => initial(state.reads, area==="doctors"?"/api/masters":"/api/clinics").some(r=>r.status===200)).toBe(true);
    } else if (area==="staff") {
      await page.getByTestId("button-add-staff").click();
      await expect.poll(() => state.reads.some(r => r.path.includes("assignment-options") && r.status===200)).toBe(true);
    } else if (area==="booking") {
      await expect.poll(() => initial(state.reads,"/api/patients").some(r=>r.status===200)).toBe(true);
      expect(state.reads.some(r=>r.path==="/api/doctors")).toBe(true);
    } else {
      await expect.poll(() => initial(state.reads,"/api/clinics").some(r=>r.status===200)).toBe(true);
      expect(await page.getByRole("dialog").count()).toBe(0);
      await page.getByTestId("button-toggle-advanced-filters").click();
      await trigger(page,"Clinic").click();
      await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
    }
    evidence[area] = state.reads.filter(r=>r.status===200).map(r=>r.path);
  }
  await info.attach("six-area-requests",{body:JSON.stringify(evidence),contentType:"application/json"});
});

for (const actor of ["patu",""]) {
  test(`${actor || "guest"}: public-safe initial options and parent-dependent loading`, async ({ page }) => {
    const state = await connect(page,actor);
    await page.goto(url("selectors",actor?"":"&guest=1"));
    await expect.poll(() => initial(state.reads,"/api/public/clinics").some(r=>r.status===200)).toBe(true);
    expect(state.reads.some(r => /^\/api\/(clinics|branches|doctors)(\/|$)/.test(r.path))).toBe(false);
    expect(initial(state.reads,"/api/public/branches")).toHaveLength(0);
    await trigger(page,actor?"Clinic options":"Clinic").click();
    await expect(page.getByRole("option",{name:"Lakeview Clinic",exact:true})).toBeVisible();
    await page.getByRole("option",{name:"Lakeview Clinic",exact:true}).click();
    await expect.poll(() => initial(state.reads,"/api/public/branches").some(r=>r.params.get("clinicId")==="c1" && r.status===200)).toBe(true);
  });
}
