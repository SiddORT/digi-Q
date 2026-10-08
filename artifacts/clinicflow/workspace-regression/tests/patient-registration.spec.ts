import { test, expect, type Page } from "@playwright/test";
// The same real-router, migrated PostgreSQL harness as backend integration tests.
// All data is disposable and fictional; no workspace credentials or database.
import { createFeatureHarness } from "../../../api-server/src/test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "../../../api-server/src/test-support/feature-fixtures.mjs";

let h: Awaited<ReturnType<typeof createFeatureHarness>>;
test.beforeAll(async () => { h = await createFeatureHarness({ administration: true }); await seedFeatureFixtures(h.pg); });
test.afterAll(async () => { await h?.close(); });

async function connect(page: Page, actor: string) {
  const posts: { path: string; body: any }[] = [];
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url());
    let body: any;
    if (!["GET", "HEAD"].includes(req.method())) {
      try { body = req.postDataJSON(); } catch { /* no JSON */ }
    }
    if (req.method() === "POST") posts.push({ path: url.pathname, body });
    if (url.pathname === "/api/auth/csrf") return route.fulfill({ json: { csrfToken: "isolated-registration" } });
    // Availability is a fixture prerequisite, not an appointment. Patient
    // creation/list/detail/documents/activity all execute the actual routers.
    if (url.pathname === "/api/public/availability/sessions") return route.fulfill({ json: [{
      sessionId: "registration-session", startTime: "09:00", endTime: "23:59", timezone: "UTC",
      available: true, remainingTokens: 10, maxTokens: 10, queueMode: "mixed",
    }] });
    if (url.pathname === "/api/appointments") {
      expect(req.method()).toBe("GET");
      const { rows } = await h.pg.query("select count(*)::int n from appointments where patient_id=$1", [url.searchParams.get("patientId")]);
      expect(rows[0].n).toBe(0);
      return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 25 } });
    }
    const result = await h.call(actor, req.method(), url.pathname.replace(/^\/api/, "") + url.search, body);
    return route.fulfill({ status: result.status, json: result.data });
  });
  return posts;
}

const listUrl = (query = "") => `/?mode=registration&registrationPage=patients${query}`;
async function noVisits(id: string) {
  expect((await h.pg.query("select count(*)::int n from appointments where patient_id=$1", [id])).rows[0].n).toBe(0);
}

for (const actor of ["sa", "adm", "rec"]) {
  test(`${actor}: standalone zero-appointment registration, saved context, fresh reader roles and reload`, async ({ page, browser }, testInfo) => {
    const posts = await connect(page, actor);
    await page.goto(listUrl("&clinicId=c1&branchId=b1"));
    await page.getByTestId("button-add-patients").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("input-fullName").fill(`Browser Registration ${actor}`);
    await dialog.getByTestId("button-save").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("notice-patient-registered")).toContainText(`Browser Registration ${actor}`);
    expect(posts.find(p => p.path === "/api/patients")?.body).toMatchObject({ clinicId: "c1", branchId: "b1" });
    const result = await h.call(actor, "GET", `/patients?search=Browser%20Registration%20${actor}`);
    expect(result.status).toBe(200);
    const id = result.data.items[0].id;
    await noVisits(id);
    await expect(page.getByTestId(`row-patients-${id}`)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId(`row-patients-${id}`)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("patient-list.png"), fullPage: true });
    await page.getByTestId(`button-patient-details-${id}`).click();
    await expect(page.getByRole("dialog")).toContainText(`Browser Registration ${actor}`);
    await page.screenshot({ path: testInfo.outputPath("patient-details.png"), fullPage: true });
    for (const reader of ["sa", "adm", "rec", "docu"]) {
      const context = await browser.newContext();
      try {
        const next = await context.newPage();
        await connect(next, reader);
        await next.goto(listUrl(`&search=Browser%20Registration%20${actor}&clinicId=c1&branchId=b1`));
        await expect(next.getByTestId(`row-patients-${id}`)).toBeVisible();
        if (reader === "docu") {
          await expect(next.getByTestId("button-add-patients")).toHaveCount(0);
          await expect(next.getByTestId(`button-edit-${id}`)).toHaveCount(0);
        }
        await next.getByTestId(`button-patient-details-${id}`).click();
        await expect(next.getByRole("dialog")).toContainText(`Browser Registration ${actor}`);
        await expect(next.getByTestId("panel-patient-timeline")).toContainText("No appointments");
        await next.getByTestId("tab-patient-documents").click();
        await expect(next.getByTestId("panel-patient-documents")).not.toContainText("could not");
      } finally { await context.close(); }
    }
  });
}

test("saved patient remains directly discoverable under legitimate excluding search/status/date filters", async ({ page }) => {
  await connect(page, "sa");
  await page.goto(listUrl("&clinicId=c1&branchId=b1&search=Not%20Matching&status=inactive&to=2000-01-01"));
  await page.getByTestId("button-add-patients").click();
  await page.getByTestId("input-fullName").fill("Hidden By Legitimate Filters");
  await page.getByTestId("button-save").click();
  await expect(page.getByTestId("notice-patient-registered")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("search")).toBe("Not Matching");
  expect(new URL(page.url()).searchParams.get("status")).toBe("inactive");
  await page.getByTestId("button-open-registered-patient").click();
  await expect(page.getByRole("dialog")).toContainText("Hidden By Legitimate Filters");
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("Hidden By Legitimate Filters");
});

test("registration from a later page returns to page one without losing matching filters", async ({ page }) => {
  await h.pg.exec(`insert into patients(id,clinic_id,branch_id,data) select 'page-fixture-'||n,'c1','b1',jsonb_build_object('fullName','Pagination Patient '||n) from generate_series(1,25) n`);
  try {
    await connect(page, "rec");
    await page.goto(listUrl("&clinicId=c1&branchId=b1&status=active&search=Pagination&page=2"));
    await expect(page.getByTestId("button-add-patients")).toBeVisible();
    await page.getByTestId("button-add-patients").click();
    await page.getByTestId("input-fullName").fill("Pagination Newly Registered");
    await page.getByTestId("button-save").click();
    await expect(page.getByTestId("notice-patient-registered")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("page")).toBeNull();
    expect(new URL(page.url()).searchParams.get("status")).toBe("active");
    expect(new URL(page.url()).searchParams.get("search")).toBe("Pagination");
    const p = (await h.call("rec", "GET", "/patients?search=Pagination%20Newly")).data.items[0];
    await expect(page.getByTestId(`row-patients-${p.id}`)).toBeVisible();
    await noVisits(p.id);
  } finally { await h.pg.exec("delete from patients where id like 'page-fixture-%'"); }
});

for (const actor of ["sa", "adm", "rec"]) {
  test(`${actor}: inline booking registration commits without booking and survives navigation`, async ({ page }) => {
    const posts = await connect(page, actor);
    await page.goto(`/?mode=registration&registrationPage=booking&clinic=c1&branch=b1&doctor=d1&date=2030-01-01&source=phone`);
    await page.getByTestId("button-booking-continue-visit").click();
    await page.getByRole("button", { name: "Register a New Patient", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("input-fullName").fill(`Inline Registration ${actor}`);
    await dialog.getByTestId("button-save").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Patient registered and selected.", { exact: true })).toBeVisible();
    const result = await h.call(actor, "GET", `/patients?search=Inline%20Registration%20${actor}`);
    expect(result.status).toBe(200);
    const id = result.data.items[0].id;
    await noVisits(id);
    expect(posts.map(p => p.path)).not.toContain("/api/appointments");
    expect(posts.find(p => p.path === "/api/patients")?.body).toMatchObject({ clinicId: "c1", branchId: "b1" });
    await page.goto(listUrl(`&search=Inline%20Registration%20${actor}`));
    await expect(page.getByTestId(`row-patients-${id}`)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId(`row-patients-${id}`)).toBeVisible();
  });
}

test("multiple-location list context and workspace-pinned registration retain the chosen location", async ({ page }) => {
  await connect(page, "adm");
  await page.goto(listUrl("&clinicId=c2&branchId=b2"));
  await page.getByTestId("button-add-patients").click();
  await page.getByTestId("input-fullName").fill("Second Clinic Registration");
  await page.getByTestId("button-save").click();
  await expect(page.getByTestId("notice-patient-registered")).toBeVisible();
  const second = await h.call("adm", "GET", "/patients?search=Second%20Clinic%20Registration");
  expect(second.data.items[0]).toMatchObject({ clinicId: "c2", branchId: "b2" });
  await page.addInitScript(() => localStorage.setItem("dq.workspace.branch.adm", "b2"));
  await page.goto(listUrl("&pinned=1"));
  await page.getByTestId("button-add-patients").click();
  await page.getByTestId("input-fullName").fill("Pinned Clinic Registration");
  await page.getByTestId("button-save").click();
  await expect(page.getByTestId("notice-patient-registered")).toBeVisible();
  const pinned = await h.call("adm", "GET", "/patients?search=Pinned%20Clinic%20Registration");
  expect(pinned.data.items[0]).toMatchObject({ clinicId: "c2", branchId: "b2" });
  await noVisits(pinned.data.items[0].id);
  await page.goto("/?mode=registration&registrationPage=booking&pinned=1&clinic=c1&branch=b1&doctor=d1&date=2030-01-01");
  await page.getByTestId("button-booking-continue-visit").click();
  await page.getByRole("button", { name: "Register a New Patient", exact: true }).click();
  await page.getByTestId("input-fullName").fill("Pinned Inline Registration");
  await page.getByTestId("button-save").click();
  await expect(page.getByText("Patient registered and selected.", { exact: true })).toBeVisible();
  const inline = await h.call("adm", "GET", "/patients?search=Pinned%20Inline%20Registration");
  expect(inline.data.items[0]).toMatchObject({ clinicId: "c2", branchId: "b2" });
  await noVisits(inline.data.items[0].id);
});
