import { test, expect, type Page } from "@playwright/test";
import { createFeatureHarness } from "../../../api-server/src/test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "../../../api-server/src/test-support/feature-fixtures.mjs";

let h: Awaited<ReturnType<typeof createFeatureHarness>>;
test.beforeAll(async () => {
  h = await createFeatureHarness({ administration: true, appointmentDetails: true });
  await seedFeatureFixtures(h.pg);
  // Use E.164 here: the full editor validates existing phone values too.
  await h.pg.query(`update patients set mobile='+919000000001', data=data || '{"code":"PAT-FICTIONAL","gender":"female","dateOfBirth":"2000-02-29"}'::jsonb where id='p1'`);
});
test.afterAll(async () => { await h?.close(); });

async function connect(page: Page, actor: string) {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname === "/api/auth/csrf") return route.fulfill({ json: { csrfToken: "isolated-patient-information" } });
    const body = ["GET", "HEAD"].includes(req.method()) ? undefined : req.postDataJSON();
    const result = await h.call(actor, req.method(), url.pathname.replace(/^\/api/, "") + url.search, body);
    return route.fulfill({ status: result.status, json: result.data });
  });
}
const listUrl = (suffix = "") => `/?mode=registration&registrationPage=patients&search=Ravi${suffix}`;

for (const actor of ["sa", "adm", "rec", "docu"]) {
  test(`${actor}: shared patient tabs and responsive profile preserve authority`, async ({ page }, testInfo) => {
    await connect(page, actor);
    await page.goto(listUrl());
    await page.getByTestId("button-expand-p1").click();
    const info = page.getByTestId("patient-info-p1");
    await expect(info.getByRole("tab", { name: "Profile", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(info.getByTestId("section-patient-basic")).toContainText("Age (calculated)");
    await expect(info.getByTestId("section-patient-basic")).toContainText("2000");
    await expect(info.getByTestId("section-patient-registration")).toContainText("PAT-FICTIONAL");
    if (actor === "docu") {
      await expect(page.getByTestId("button-add-patients")).toHaveCount(0);
      await expect(info.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
      await expect(info.getByRole("button", { name: /^Add / })).toHaveCount(0);
      await expect(info.getByTestId("section-patient-contact")).toContainText("—");
    } else {
      await expect(info.getByTestId("section-patient-contact").getByRole("button", { name: "Add email", exact: true })).toBeVisible();
    }
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(info.getByTestId("section-patient-emergency")).toBeVisible();
      const overflow = await info.evaluate(el => el.scrollWidth > el.clientWidth + 1);
      expect(overflow, `patient profile overflow at ${width}`).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`profile-${width}.png`), fullPage: true });
    }
    const profileTab = info.getByRole("tab", { name: "Profile", exact: true });
    await profileTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(info.getByRole("tab", { name: "Appointments", exact: true })).toBeFocused();
    await expect(info.getByTestId("panel-patient-appointments")).toContainText("REF-A1");
    await expect(info.getByTestId("panel-patient-appointments")).toContainText("Appointment visits only");
    await info.getByRole("tab", { name: "Activity", exact: true }).click();
    await expect(info.getByTestId("panel-patient-activity")).toContainText("Checked In");
    await info.getByRole("tab", { name: "Documents", exact: true }).click();
    await expect(info.getByTestId("panel-patient-documents")).toContainText("Upload Document");
    // Exact links must work even when ordinary search excludes the patient.
    await page.goto(listUrl("&search=NotThisPatient&open=p1"));
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByTestId("section-patient-basic")).toContainText("Ravi Kumar");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });
}

test("focused completion saves, refreshes both views and protects an unsaved draft", async ({ page }) => {
  await connect(page, "adm");
  await page.goto(listUrl());
  await page.getByTestId("button-expand-p1").click();
  const info = page.getByTestId("patient-info-p1");
  await info.getByTestId("section-patient-contact").getByRole("button", { name: "Add email", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("does not verify");
  await dialog.locator("#input-email").fill("fictional.patient@example.test");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("discard-confirm")).toBeVisible();
  await page.getByTestId("button-keep-editing").click();
  await expect(dialog.locator("#input-email")).toHaveValue("fictional.patient@example.test");
  await dialog.getByTestId("button-save").click();
  await expect(dialog).toHaveCount(0);
  await expect(info.getByTestId("section-patient-contact")).toContainText("fictional.patient@example.test");
  await page.getByTestId("button-patient-details-p1").click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("section-patient-contact")).toContainText("fictional.patient@example.test");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByTestId("button-expand-p1").click();
  await expect(info.getByTestId("section-patient-contact")).toContainText("fictional.patient@example.test");
  const record = await h.call("adm", "GET", "/patients/p1");
  expect(record.data.email).toBe("fictional.patient@example.test");
  expect(record.data.mobileVerified).not.toBe(true);
});

test("full patient edit can cancel, save, and reopen with persisted fictional data", async ({ page }) => {
  await connect(page, "adm");
  await page.goto(listUrl());
  await page.getByTestId("button-edit-p1").click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Edit Patient");
  await dialog.getByTestId("input-fullName").fill("Discarded Fictional Draft");
  await dialog.getByTestId("button-cancel").click();
  await expect(page.getByTestId("discard-confirm")).toBeVisible();
  await page.getByTestId("button-discard-changes").click();
  await expect(dialog).toHaveCount(0);
  await page.getByTestId("button-edit-p1").click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Ravi Kumar");
  await dialog.getByTestId("input-fullName").fill("Ravi Kumar Fictional Edit");
  await dialog.getByTestId("button-save").click();
  await expect(dialog).toHaveCount(0);
  await page.getByTestId("button-edit-p1").click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("input-fullName")).toHaveValue("Ravi Kumar Fictional Edit");
  const stored = await h.call("adm", "GET", "/patients/p1");
  expect(stored.data.fullName).toBe("Ravi Kumar Fictional Edit");
});

test("patient listing search, reset, selection and page navigation remain usable", async ({ page }) => {
  await h.pg.exec(`insert into patients(id,clinic_id,branch_id,data) select 'info-page-'||n,'c1','b1',jsonb_build_object('fullName','Fictional Page Patient '||n) from generate_series(1,25) n`);
  try {
    await connect(page, "sa");
    await page.goto(listUrl("&search=Ravi&status=inactive"));
    await expect(page.getByTestId("row-patients-p1")).toHaveCount(0);
    await expect(page.getByTestId("button-clear-all-filters")).toBeVisible();
    await page.getByTestId("button-clear-all-filters").click();
    await expect(page.getByTestId("row-patients-p1")).toBeVisible();
    await page.getByTestId("select-p1").check();
    await expect(page.getByTestId("text-selected-count")).toContainText("1 selected");
    await page.getByTestId("button-clear-selected").click();
    await expect(page.getByTestId("text-selected-count")).toHaveCount(0);
    await page.goto("/?mode=registration&registrationPage=patients&search=Fictional%20Page%20Patient");
    const pagination = page.locator('nav[aria-label="Pagination"]:visible').last();
    await expect(pagination.getByRole("button", { name: "2", exact: true })).toBeEnabled();
    await expect(page.locator('[data-testid^="row-patients-"]')).toHaveCount(20);
    await pagination.getByRole("button", { name: "2", exact: true }).click();
    await expect(page.locator('[data-testid^="row-patients-"]')).toHaveCount(5);
    expect(new URL(page.url()).searchParams.get("page")).toBe("2");
  } finally {
    await h.pg.exec("delete from patients where id like 'info-page-%'");
  }
});
