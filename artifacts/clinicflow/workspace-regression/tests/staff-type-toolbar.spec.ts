import { test, expect, type BrowserContext } from "@playwright/test";

// Browser-only regression: every API response is fictional and intercepted.
// Backend authorization is validated separately by API integration tests.
const clinic = { id: "c1", name: "Fictional Clinic c1", adminId: "fixture-clinic-admin", managingAdminId: "fixture-clinic-admin" };
const branch = { id: "b1", name: "Fictional Branch b1", clinicId: "c1", status: "active" };
const staff = [
  { id: "fixture-clinic-admin", fullName: "Fictional Clinic Admin", email: "clinic.admin@example.test", role: "clinicAdmin", status: "active", clinicIds: ["c1"], clinicNames: [clinic.name], branchIds: [], branchNames: [] },
  { id: "fixture-receptionist", fullName: "Fictional Receptionist", email: "receptionist@example.test", role: "receptionist", status: "active", clinicIds: ["c1"], clinicNames: [clinic.name], branchIds: ["b1"], branchNames: [branch.name], managingAdminId: "fixture-clinic-admin", managingAdminName: "Fictional Clinic Admin", invitationStatus: "sent" },
  { id: "fixture-doctor", fullName: "Fictional Doctor", email: "doctor@example.test", role: "doctor", status: "active", clinicIds: ["c1"], clinicNames: [clinic.name], branchIds: ["b1"], branchNames: [branch.name] },
];

async function mockApi(context: BrowserContext, identityId: string, role: string) {
  const requests: string[] = [];
  await context.route("**/api/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    requests.push(`${req.method()} ${path}${url.search}`);
    let data: any = { items: [], total: 0 };
    if (path === "/api/auth/csrf") data = { csrfToken: "fixture-staff-type-token" };
    else if (path === "/api/me" || path === "/api/auth/me") data = { user: { id: identityId, role, fullName: "Fixture Staff Actor" } };
    else if (path === "/api/users" && req.method() === "GET") {
      let items = staff.filter(row => row.role === url.searchParams.get("role") && row.clinicIds.includes("c1"));
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search")?.toLowerCase();
      if (status) items = items.filter(row => row.status === status);
      if (search) items = items.filter(row => row.fullName.toLowerCase().includes(search) || row.email.toLowerCase().includes(search));
      data = { items, total: items.length };
    } else if (path.startsWith("/api/users/")) {
      data = staff.find(row => row.id === path.split("/").pop()) || {};
    } else if (path === "/api/doctors") {
      let items = staff.filter(row => row.role === "doctor");
      const status = url.searchParams.get("status");
      if (status) items = items.filter(row => row.status === status);
      data = { items, total: items.length };
    } else if (path === "/api/staff-assignment-options") {
      data = { clinics: [clinic], branches: [branch], pagination: { clinics: { total: 1 }, branches: { total: 1 } } };
    } else if (path === "/api/clinics/c1") data = clinic;
    else if (path === "/api/branches") data = { items: [branch], total: 1 };
    else if (path === "/api/settings") data = {};
    else if (path === "/api/saved-views") data = { items: [], total: 0 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return requests;
}

test("embedded Staff Type toolbar, role-scoped reset, and mobile picker", async ({ browser }, testInfo) => {
  const superContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const superRequests = await mockApi(superContext, "fixture-super", "superAdmin");
  const superPage = await superContext.newPage();
  await superPage.goto("/?mode=staff&fixtureRole=superAdmin&fixtureUserId=fixture-super&fixedClinicId=c1", { waitUntil: "domcontentloaded" });
  await expect(superPage.getByRole("button", { name: "Staff Type: Clinic Admins" })).toBeVisible();
  await expect(superPage.getByTestId("row-staff-fixture-clinic-admin")).toContainText("Fictional Clinic Admin");
  await superPage.screenshot({ path: testInfo.outputPath("staff-type-desktop-admins.png") });

  await superPage.getByTestId("select-staff-type").click();
  await expect(superPage.getByRole("option", { name: "Clinic Admins" })).toBeVisible();
  await expect(superPage.getByRole("option", { name: "Doctors" })).toBeVisible();
  await expect(superPage.getByRole("option", { name: "Receptionists" })).toBeVisible();
  await superPage.getByRole("option", { name: "Receptionists" }).click();
  await expect(superPage.getByRole("button", { name: "Staff Type: Receptionists" })).toBeVisible();
  await expect(superPage.getByTestId("row-staff-fixture-receptionist")).toContainText("Fictional Receptionist");
  expect(superRequests.some(request => request.includes("/api/users?") && request.includes("clinicId=c1") && request.includes("role=receptionist"))).toBeTruthy();
  await superPage.screenshot({ path: testInfo.outputPath("staff-type-desktop-receptionists.png") });

  await superPage.getByTestId("button-edit-staff-fixture-receptionist").click();
  await expect(superPage.getByRole("dialog", { name: "Edit Receptionist" })).toContainText("Fictional Clinic c1");
  await expect(superPage.getByRole("dialog", { name: "Edit Receptionist" })).toContainText("Fictional Branch b1");
  await superPage.getByTestId("button-dialog-close").click();
  await superPage.reload({ waitUntil: "domcontentloaded" });
  await expect(superPage).toHaveURL(/tab=receptionists/);
  await expect(superPage.getByRole("button", { name: "Staff Type: Receptionists" })).toBeVisible();
  await expect(superPage.getByTestId("row-staff-fixture-receptionist")).toBeVisible();

  await superPage.getByRole("combobox", { name: "Search receptionists by name, email or mobile" }).fill("NoSuchFixtureMatch");
  await expect(superPage.getByRole("heading", { name: "No Matching Staff" })).toBeVisible();
  await superPage.keyboard.press("Escape");
  await superPage.getByTestId("button-toggle-advanced-filters").click();
  await superPage.getByTestId("select-staff-status").click();
  await superPage.getByRole("option", { name: /^Inactive/ }).click();
  await superPage.getByTestId("button-close-filters").click();
  await expect(superPage.getByTestId("chip-remove-adv:status")).toBeVisible();
  await expect(superPage.getByRole("heading", { name: "No Matching Staff" })).toBeVisible();
  await superPage.getByRole("button", { name: "Clear Filters" }).click();
  await expect(superPage.getByTestId("row-staff-fixture-receptionist")).toBeVisible();
  await expect(superPage.getByRole("button", { name: "Staff Type: Receptionists" })).toBeVisible();
  await expect(superPage.getByRole("combobox", { name: "Search receptionists by name, email or mobile" })).toHaveValue("");
  await expect(superPage.getByTestId("chip-remove-adv:status")).toHaveCount(0);

  await superPage.setViewportSize({ width: 390, height: 844 });
  await expect(superPage.getByTestId("select-staff-type")).toBeVisible();
  const picker = superPage.getByTestId("select-staff-type");
  await picker.click({ position: { x: 30, y: 26 } }); // avoid the nested clear-selection hit target
  await expect(superPage.getByRole("option", { name: "Clinic Admins" })).toBeVisible();
  await expect(superPage.getByRole("option", { name: "Doctors" })).toBeVisible();
  await expect(superPage.getByRole("option", { name: "Receptionists" })).toBeVisible();
  const widths = await superPage.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
  await superPage.screenshot({ path: testInfo.outputPath("staff-type-mobile-picker.png") });
  await superPage.keyboard.press("Escape");

  const clinicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await mockApi(clinicContext, "fixture-clinic-admin", "clinicAdmin");
  const clinicPage = await clinicContext.newPage();
  await clinicPage.goto("/?mode=staff&fixtureRole=clinicAdmin&fixtureUserId=fixture-clinic-admin&fixedClinicId=c1", { waitUntil: "domcontentloaded" });
  await expect(clinicPage.getByRole("button", { name: "Staff Type: Doctors" })).toBeVisible();
  await clinicPage.getByTestId("select-staff-type").click();
  await expect(clinicPage.getByRole("option", { name: "Doctors" })).toBeVisible();
  await expect(clinicPage.getByRole("option", { name: "Receptionists" })).toBeVisible();
  await expect(clinicPage.getByRole("option", { name: "Clinic Admins" })).toHaveCount(0);
  await clinicContext.close();

  const doctorContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await mockApi(doctorContext, "fixture-doctor", "doctor");
  const doctorPage = await doctorContext.newPage();
  await doctorPage.goto("/?mode=staff&fixtureRole=doctor&fixtureUserId=fixture-doctor&fixedClinicId=c1", { waitUntil: "domcontentloaded" });
  await expect(doctorPage.getByTestId("select-staff-type")).toHaveCount(0);
  await doctorPage.getByTestId("button-add-staff").click();
  await expect(doctorPage.getByTestId("text-add-staff-role").locator(".staff-assignment-label")).toHaveText("Role");
  await expect(doctorPage.getByTestId("text-add-staff-role").locator(".doctor-context-value")).toHaveText("Receptionist");
  await expect(doctorPage.getByTestId("select-add-staff-role")).toHaveCount(0);
  await expect(doctorPage.getByText("Clinic Admins", { exact: true })).toHaveCount(0);

  await doctorContext.close();
  await superContext.close();
});
