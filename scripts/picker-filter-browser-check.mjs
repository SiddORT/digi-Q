// Focused, fictional-only browser regression for ClinicFlow picker/filter work.
// Every /api/** request is intercepted before navigation; no live API/account
// data, booking, email, publishing, or workflow restart is used.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const out = "screenshots/picker-filter-check";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "UTC", serviceWorkers: "block" });
const page = await context.newPage();
page.setDefaultTimeout(4500);
const apiRequests = [], apiWrites = [], checks = [], errors = [];
let publicAnonymous = false;
const clinic = { id: "fx-clinic", name: "Fictional Clinic", slug: "fictional", status: "active", timezone: "UTC", dateFormat: "DD/MM/YYYY", timeFormat: "24h" };
const branch = { id: "fx-branch", clinicId: clinic.id, clinicName: clinic.name, name: "Fictional Branch", city: "Example City", timezone: "UTC", status: "active" };
const doctor = { id: "fx-doctor", name: "Dr Fictional", fullName: "Dr Fictional", clinicId: clinic.id, branchId: branch.id, status: "active" };
const list = (data, total = data.length, pageSize = 20) => ({ data, items: data, total, page: 1, pageSize });
const patients = Array.from({ length: 25 }, (_, i) => ({ id: `fx-p-${i + 1}`, fullName: `Fixture Patient ${i + 1}`, mobile: `555-${1000 + i}`, email: `patient${i + 1}@example.invalid`, status: "active", createdAt: "2026-10-01T00:00:00Z" }));
const report = { from: "2026-10-05", to: "2026-10-05", groupBy: "date", rows: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
const qr = { clinicId: clinic.id, clinicName: "Fictional Northside Clinic", branchId: branch.id, branchName: branch.name, branchTimezone: "UTC", doctorId: doctor.id, doctorName: doctor.fullName, dateFormat: "DD MMM YYYY", timeFormat: "24h" };

await context.route("**/api/**", async route => {
  const req = route.request(), path = new URL(req.url()).pathname.replace(/^\/api/, "");
  apiRequests.push({ method: req.method(), path, url: req.url() });
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (req.method() !== "GET") { apiWrites.push({ method: req.method(), path }); return json({ success: true, source: "fictional-interceptor" }); }
  if (path === "/auth/status") return json({ authenticated: !publicAnonymous, role: publicAnonymous ? null : "superAdmin", staffPasswordVerified: true, requiresStaffPassword: false });
  if (path === "/auth/csrf") return json({ csrfToken: "fictional-interceptor-token" });
  if (path === "/me") return json({ user: { id: "fx-admin", fullName: "Fictional Admin", email: "admin@example.invalid", role: "superAdmin", status: "active" }, needsOnboarding: false, clinicIds: [clinic.id], branchIds: [branch.id], assignments: [], doctorId: doctor.id });
  if (path === "/settings" || path === "/clinic-settings") return json({ timezone: "UTC", dateFormat: "DD/MM/YYYY", timeFormat: "24h", sessionTimeoutMinutes: 60 });
  if (path === `/clinics/${clinic.id}`) return json(clinic);
  if (path === "/clinics") return json(list([clinic]));
  if (path === `/branches/${branch.id}`) return json(branch);
  if (path === "/branches") return json(list([branch]));
  if (path === "/doctors") return json(list([doctor]));
  if (path === "/appointments") return json({ ...list([]), statusCounts: {} });
  if (path === "/reports") return json(report);
  if (path === "/reports/trends") return json({ points: [] });
  if (path === "/patients") return json(list(patients, 31, 25));
  if (path === "/saved-views" || path === "/notifications") return json(list([]));
  if (path === "/schedules") return json(list([]));
  if (path === "/session-contexts" || path === "/public/availability/sessions") return json([]);
  if (path === "/public/qr/fx-public") return json(qr);
  if (path === "/queue") return json({ entries: [], ownEntry: null, total: 0, entriesTotal: 0, currentToken: null, nextToken: null, waiting: 0, completed: 0, updatedAt: "2026-10-05T00:00:00Z" });
  if (path.startsWith("/public/")) return json({ data: [], items: [], total: 0, clinic, branches: [branch], doctors: [doctor] });
  return json(list([]));
});

const shot = async name => { await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
const go = async path => { await page.goto(origin + path, { waitUntil: "domcontentloaded", timeout: 12000 }); await page.locator("main").waitFor({ state: "visible", timeout: 7000 }).catch(() => {}); await page.waitForTimeout(350); };
const check = async (name, fn) => {
  const item = { name, status: "pass" };
  try { item.details = await fn(); } catch (e) { item.status = "fail"; item.error = String(e.message).slice(0, 1800); errors.push(item); }
  checks.push(item); console.log(`${item.status.toUpperCase()} ${name}${item.error ? `: ${item.error}` : ""}`); return item;
};

try {
  await check("Appointments drafts, calendar leap day, invalid/inverted blocks, reset", async () => {
    await go("/admin/appointments");
    await page.getByTestId("button-toggle-advanced-filters").click();
    const drawer = page.getByRole("dialog", { name: "Filters" });
    const before = new URL(page.url()).search;
    await page.getByTestId("select-appointment-status").click();
    await page.getByRole("option", { name: "Waiting" }).click();
    await page.getByTestId("select-appointment-range").click();
    await page.getByRole("option", { name: "All Visits" }).click();
    expect(new URL(page.url()).search).toBe(before);
    await drawer.getByRole("button", { name: "Open calendar" }).first().click();
    await shot("appointments-calendar-desktop");
    await page.getByTestId("button-picker-view-toggle").click();
    await page.getByTestId("button-picker-view-toggle").click();
    await page.getByTestId("button-picker-year-2024").click();
    await page.getByTestId("button-picker-month-2").click();
    await page.getByTestId("button-picker-day-2024-02-29").click();
    await expect(page.getByRole("textbox", { name: /From Open calendar/ })).toHaveValue("29 Feb 2024");
    await page.getByRole("textbox", { name: /To Open calendar/ }).fill("29 Feb 2024");
    await page.getByRole("textbox", { name: /To Open calendar/ }).fill("29 Feb 2023");
    await expect(drawer.getByRole("alert").first()).toBeVisible();
    await page.getByTestId("button-close-filters").click();
    await expect(drawer).toBeVisible();
    await page.getByRole("textbox", { name: /To Open calendar/ }).fill("28 Feb 2024");
    await page.getByTestId("button-close-filters").click();
    await expect(drawer).toBeVisible();
    await shot("appointments-invalid-range-desktop");
    await page.getByTestId("button-clear-filters-panel").click();
    await page.getByTestId("button-toggle-advanced-filters").click();
    await expect(page.getByTestId("select-appointment-status")).toHaveAttribute("aria-label", "Status: All");
    await page.getByTestId("button-clear-filters-panel").click();
    await page.getByTestId("button-toggle-advanced-filters").click();
    await page.getByRole("button", { name: "Open calendar" }).first().click();
    const focusedDay = page.getByTestId("button-picker-day-2026-10-05");
    await focusedDay.waitFor({ state: "visible" });
    await page.waitForTimeout(150);
    await focusedDay.focus();
    await page.waitForTimeout(100);
    await expect(focusedDay).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Choose date" })).toHaveCount(0);
    await expect(drawer).toBeVisible();
    return { draftUrlBeforeApply: before, committedUrlAfterApply: null, leapDate: "29 Feb 2024", escape: "focused day closes picker, preserves parent" };
  });

  await check("Appointments Apply commits status/range; Patients pageSize=25 parses from URL", async () => {
    await page.getByTestId("select-appointment-status").click();
    await page.getByRole("option", { name: "Waiting" }).click();
    await page.getByTestId("select-appointment-range").click();
    await page.getByRole("option", { name: "All Visits" }).click();
    await page.getByRole("button", { name: "Clinic", exact: true }).click();
    await page.getByRole("option", { name: "Fictional Clinic" }).click();
    await page.getByRole("button", { name: "Location", exact: true }).click();
    await page.getByRole("option", { name: "Fictional Branch" }).click();
    await page.getByRole("button", { name: "Doctor", exact: true }).click();
    await page.getByRole("option", { name: "Dr Fictional" }).click();
    expect(new URL(page.url()).searchParams.has("clinic")).toBe(false);
    await page.getByTestId("button-close-filters").click();
    await expect.poll(() => page.url()).toContain("status=waiting");
    await expect.poll(() => page.url()).toContain("view=all");
    await expect.poll(() => page.url()).toContain("clinic=fx-clinic");
    await expect.poll(() => page.url()).toContain("branch=fx-branch");
    await expect.poll(() => page.url()).toContain("doctor=fx-doctor");
    const committed = page.url();
    await go("/admin/patients?pageSize=25");
    await expect(page.getByRole("button", { name: /Rows per Page/ })).toHaveAttribute("aria-label", "Rows per Page: 25");
    await expect(page.getByText("Showing 1–25 of 31")).toBeVisible();
    await shot("patients-page-size-25");
    return { committedAppointmentsUrl: committed, resourcesUrl: page.url(), pageSize: "25", fixtureRows: 25 };
  });

  await check("Reports draft dates/scope, inversion guard and reset", async () => {
    await go("/admin/reports");
    await page.getByTestId("button-toggle-advanced-filters").click();
    const drawer = page.getByRole("dialog", { name: "Report Filters" });
    const before = page.url();
    await page.getByTestId("input-report-from").fill("04 Oct 2026");
    await page.getByTestId("input-report-to").fill("04 Oct 2026");
    await expect(page.getByText("05 Oct 2026").first()).toBeVisible();
    await page.getByTestId("input-report-to").fill("03 Oct 2026");
    await expect(page.getByTestId("text-report-range-error")).toBeVisible();
    await page.getByTestId("button-close-filters").click();
    await expect(drawer).toBeVisible();
    await shot("reports-invalid-range-desktop");
    await page.getByTestId("button-clear-filters-panel").click();
    await page.getByTestId("button-toggle-advanced-filters").click();
    await expect(page.getByTestId("input-report-from")).toHaveValue("05 Oct 2026");
    await expect(page.getByTestId("input-report-to")).toHaveValue("05 Oct 2026");
    return { appliedUrlBeforeReset: before, resetFrom: "05 Oct 2026", resetTo: "05 Oct 2026", invalidRangeBlocked: true };
  });

  await check("Schedule time exact-minute entry/list and invalid closing bound blocks save", async () => {
    await go("/admin/availability");
    await page.getByTestId("button-add-availability").click();
    await page.getByRole("button", { name: /Clinic Group/ }).click();
    await page.getByRole("option", { name: "Fictional Clinic" }).click();
    const start = page.getByRole("textbox", { name: "Start Time" });
    await start.fill("09:07");
    await expect(start).toHaveValue("09:07");
    await page.getByTestId("input-time-picker").first().click();
    await expect(page.getByTestId("button-picker-time-0907")).toBeVisible();
    await page.getByTestId("button-picker-time-0907").click();
    await page.getByRole("textbox", { name: "End Time" }).fill("09:00");
    await expect(page.getByText("Closing time must follow opening time.")).toBeVisible();
    await page.getByTestId("button-save").click();
    await expect(page.getByRole("dialog", { name: "Add Schedule" })).toBeVisible();
    await shot("schedule-time-invalid");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Discard Changes", exact: true }).click();
    return { clinicPreference: "24h", rawExactMinuteAccepted: "09:07", exactMinutePickerOption: true, invalidEndBlocked: true };
  });

  await check("Session Queue invalid date pauses session/queue queries", async () => {
    await go("/admin/queue");
    const before = apiRequests.filter(x => x.path === "/session-contexts" || x.path === "/queue").length;
    await page.getByTestId("input-queue-date").fill("31 Feb 2026");
    await expect(page.getByTestId("text-queue-date-invalid")).toBeVisible();
    await page.waitForTimeout(500);
    const after = apiRequests.filter(x => x.path === "/session-contexts" || x.path === "/queue").length;
    await shot("queue-invalid-date");
    return { before, after, noNewSessionOrQueueQuery: before === after };
  });

  await check("Public guest booking date picker renders from fictional QR context", async () => {
    publicAnonymous = true;
    await go("/book/fx-public");
    await expect(page.getByTestId("text-booking-clinic")).toContainText("Fictional Northside Clinic");
    await page.getByTestId("input-guest-date-picker").click();
    await expect(page.getByRole("dialog", { name: "Choose date" })).toBeVisible();
    await shot("public-guest-calendar");
    await expect(page.getByTestId("button-submit-guest")).toBeDisabled();
    return { route: "/book/fx-public", clinic: "Fictional Northside Clinic", noPatientOrBookingSubmitted: true };
  });

  await check("Mobile 390px Appointments and Reports drawers and nested date picker", async () => {
    publicAnonymous = false;
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/admin/appointments");
    await page.getByTestId("button-toggle-advanced-filters").click();
    await shot("appointments-drawer-390");
    await page.getByRole("dialog", { name: "Filters" }).getByRole("button", { name: "Open calendar" }).first().click();
    await shot("appointments-calendar-390");
    const apptOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await go("/admin/reports");
    await page.getByTestId("button-toggle-advanced-filters").click();
    await shot("reports-drawer-390");
    await page.getByTestId("input-report-from-picker").click();
    await shot("reports-calendar-390");
    const reportOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(apptOverflow).toBeLessThanOrEqual(1);
    expect(reportOverflow).toBeLessThanOrEqual(1);
    return { viewport: "390x844", appointmentsHorizontalOverflow: apptOverflow, reportsHorizontalOverflow: reportOverflow };
  });
} finally {
  const summary = { startedAt: new Date().toISOString(), fixtureOnly: true, apiRequests, interceptedWrites: apiWrites, checks, errors, screenshots: out };
  await writeFile(`${out}/results.json`, JSON.stringify(summary, null, 2));
  await context.close(); await browser.close();
}
