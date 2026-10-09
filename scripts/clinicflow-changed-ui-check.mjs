// Fictional-interceptor-only regression for the changed ClinicFlow appointments UI.
// Fixture interception pattern follows scripts/uniform-layout-browser-check.mjs.
// All /api traffic is intercepted; no live auth, DB or email/provider writes occur.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("REPLIT_DEV_DOMAIN is required");
const out = process.env.CLINICFLOW_CHECK_OUTPUT || "screenshots/clinicflow-focused";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "UTC", acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(5000);
// Keep the real calendar/month navigation aligned with the fictional visits.
await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
const clinic = { id: "fx-clinic", name: "Fictional Clinic", timezone: "UTC" };
const appts = Array.from({ length: 4 }, (_, i) => ({
  id: `fx-appt-${i + 1}`, reference: `FX-REF-${i + 1}`, token: `F-${i + 1}`,
  patientCode: `PX-FX-${i + 1}`, patientName: ["Alex Fictional Patient", "Morgan Sample Patient", "Jordan Placeholder", "Casey Testperson"][i],
  patientPhone: "555-0101", patientEmail: i === 3 ? undefined : `person${i + 1}@example.invalid`,
  doctorId: "fx-doc", doctorName: "Dr. Sample Provider", clinicId: clinic.id, clinicName: clinic.name,
  branchId: "fx-branch", branchName: "Example Branch", branchAddress: "10 Fictional Way",
  date: "2026-10-03", startTime: ["09:00", "09:20", "09:40", "10:00"][i],
  endTime: ["09:20", "09:40", "10:00", "10:20"][i], timezone: "UTC",
  status: i === 2 ? "completed" : "booked", revision: 1,
  allowedActions: i === 2 ? [] : ["cancel"], createdAt: "2026-10-02T08:00:00Z",
  confirmationEmail: i === 0 ? "unavailable" : "provider_accepted",
}));
const writes = [], requests = [];
const list = data => ({ data, items: data, total: data.length, page: 1, pageSize: 20 });
const result = { fixtureOnly: true, screenshots: [], checks: [], interceptedWrites: writes, requests };
page.on("pageerror", e => result.checks.push({ name: "pageerror", status: "fail", error: e.message }));
await context.route("**/api/**", async route => {
  const req = route.request(), u = new URL(req.url()), p = u.pathname.replace(/^\/api/, "");
  requests.push({ method: req.method(), path: p, search: u.search });
  if (req.method() !== "GET") {
    writes.push({ path: p, body: req.postData() });
    return route.fulfill({ json: { success: true, state: p.endsWith("/email-ticket") ? "unknown" : undefined, provider: "fictional-interceptor" } });
  }
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (p === "/auth/status") return json({ authenticated: true, role: "superAdmin", staffPasswordVerified: true, requiresStaffPassword: false });
  if (p === "/auth/csrf") return json({ csrfToken: "fictional-csrf" });
  if (p === "/me") return json({ user: { id: "fx-superadmin", fullName: "Fictional Reviewer", email: "reviewer@example.invalid", role: "superAdmin", status: "active" }, needsOnboarding: false, clinicIds: [clinic.id], branchIds: ["fx-branch"], assignments: [], doctorId: "fx-doc" });
  if (p === `/clinics/${clinic.id}`) return json(clinic);
  if (p === "/appointments") return json(list(appts));
  if (p === "/appointments/calendar") return json({ total: 4, days: [{ date: "2026-10-03", total: 4, byStatus: { booked: 3, completed: 1 } }] });
  if (/^\/appointments\/fx-appt-\d+\/qr$/.test(p)) return json({ appointmentId: p.split("/")[2], checkInUrl: `https://example.invalid/check-in/${p.split("/")[2]}`, payload: "fictional-qr" });
  if (p === "/appointments/fx-appt-1/email-ticket") return json({ eligible: true, recipient: "person1@example.invalid" });
  if (p === "/appointments/fx-appt-2/email-ticket") return json({ eligible: true, recipient: "person2@example.invalid" });
  if (p === "/appointments/fx-appt-3/email-ticket") return json({ eligible: false, reason: "Completed appointments are not eligible." });
  if (p === "/appointments/fx-appt-4/email-ticket") return json({ eligible: false, reason: "No patient email address is on file." });
  if (/^\/appointments\/fx-appt-\d+$/.test(p)) return json(appts.find(a => a.id === p.split("/").at(-1)));
  if (p === "/session-contexts" || p === "/public/availability/sessions") return json([]);
  if (p === "/management/permissions") return json({ revision: 1, roles: [], modules: [], actions: [], denied: [] });
  if (p === "/management/custom-roles") return json({ revision: 1, roles: [], bindings: [] });
  return json(list([]));
});
const shot = async name => { const path = `${out}/${name}.png`; await page.screenshot({ path }); result.screenshots.push(path); };
const save = async () => writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
const savePdf = async (download, name, expectedPages) => {
  const path = `${out}/${name}`; await download.saveAs(path);
  const bytes = await readFile(path); expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const info = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]); expect(pages).toBe(expectedPages);
  result.checks.push({ name: `${name} PDF signature/page count`, status: "pass", bytes: bytes.length, pages });
  execFileSync("pdftoppm", ["-f", "1", "-l", "1", "-png", "-r", "90", path, `${out}/${name}-render`]);
  return path;
};
try {
  await page.goto(`${origin}/admin/appointments`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByTestId("appointment-fx-appt-1").waitFor();
  const header = page.getByTestId("list-header");
  await expect(header.getByRole("heading", { name: "Appointments" })).toBeVisible();
  await expect(header.getByRole("combobox", { name: "Search Appointments" })).toBeVisible();
  const exportButton = header.getByTestId("button-export-filtered-appointments");
  const bookButton = header.getByTestId("link-page-book-appointment");
  await expect(exportButton).toBeVisible();
  await expect(bookButton).toHaveAttribute("href", "/admin/book");
  const exportBox = await exportButton.boundingBox(), bookBox = await bookButton.boundingBox();
  expect(exportBox.x + exportBox.width).toBeLessThanOrEqual(bookBox.x);
  expect(Math.abs(exportBox.height - bookBox.height)).toBeLessThanOrEqual(1);
  await expect(header.getByTestId("list-header-subrow")).toHaveCount(0);
  const updated = page.getByRole("button", { name: "Last Updated", exact: true });
  await expect(updated).toBeVisible();
  await updated.focus();
  // The visual bubble is aria-hidden because the trigger's always-present
  // description supplies the same text to assistive technology.
  await expect(updated).toHaveAccessibleDescription(/^Updated /);
  await expect(page.locator('.helptip-bubble[role="tooltip"]')).toBeVisible();
  await expect(page.locator('.helptip-bubble[role="tooltip"]')).toContainText("Updated ");
  await shot("appointments-1280");
  // Dates are draft drawer filters now, not a VisitRangePicker in header meta.
  const committedUrl = page.url();
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByTestId("button-appointment-range-calendar").click();
  await page.getByTestId("button-range-day-2026-10-03").click();
  await page.getByTestId("button-range-day-2026-10-04").click();
  await page.getByTestId("button-range-cancel").click();
  await expect(page.getByTestId("input-appointment-from")).toHaveValue("");
  await expect(page.getByTestId("input-appointment-to")).toHaveValue("");
  expect(page.url()).toBe(committedUrl);
  await page.getByTestId("button-appointment-range-calendar").click();
  await page.getByTestId("button-range-day-2026-10-03").click();
  await page.getByTestId("button-range-day-2026-10-04").click();
  await page.getByTestId("button-range-apply").click();
  expect(page.url()).toBe(committedUrl, "picker Apply only changes the drawer draft");
  await page.getByTestId("button-dialog-close").click();
  expect(page.url()).toBe(committedUrl, "closing the drawer discards unapplied dates");
  await page.getByTestId("button-toggle-advanced-filters").click();
  await expect(page.getByTestId("input-appointment-from")).toHaveValue("");
  await page.getByTestId("button-appointment-range-calendar").click();
  await page.getByTestId("button-range-day-2026-10-03").click();
  await page.getByTestId("button-range-day-2026-10-04").click();
  await page.getByTestId("button-range-apply").click();
  await page.getByTestId("button-close-filters").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe("2026-10-03");
  await expect.poll(() => new URL(page.url()).searchParams.get("to")).toBe("2026-10-04");
  await page.getByTestId("button-mode-calendar").click();
  await expect(page.getByTestId("calendar-status-totals")).toContainText("4 visits");
  expect(requests.some(r => r.path === "/appointments/calendar" && r.search.includes("from=2026-10-01") && r.search.includes("to=2026-10-31"))).toBeTruthy();
  await shot("calendar-1280");
  await page.getByTestId("button-calendar-day-2026-10-03").click();
  await expect(page.getByTestId("panel-calendar-day")).toBeVisible();
  await expect(page.getByTestId("button-mode-calendar")).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("to")).toBe("2026-10-04", "drilldown must not rewrite list filters");
  await page.getByTestId("button-calendar-day-open-list").click();
  await expect(page.getByTestId("button-mode-list")).toHaveAttribute("aria-pressed", "true");
  expect(requests.some(r => r.path === "/appointments" && r.search.includes("from=2026-10-03") && r.search.includes("to=2026-10-03"))).toBeTruthy();
  await page.getByRole("checkbox", { name: "Select all appointments on this page" }).check();
  await expect(page.getByTestId("text-bulk-count")).toHaveText("4 selected");
  await expect(page.locator(".appt-bulk")).toContainText("this page only");
  await shot("bulk-toolbar-1280");
  await page.getByTestId("menu-bulk-more").click();
  const menuBox = await page.getByRole("menu").boundingBox();
  expect(menuBox.x).toBeGreaterThanOrEqual(0); expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(1280);
  await page.getByRole("menuitem", { name: "Email Tickets" }).click();
  await expect(page.getByTestId("text-email-disabled-fx-appt-3")).toContainText("Completed");
  await expect(page.getByTestId("text-email-disabled-fx-appt-4")).toContainText("No patient email");
  await expect(page.getByTestId("button-email-confirm")).toHaveText("Send 2 Emails");
  await shot("email-preview");
  await page.getByTestId("button-email-confirm").click();
  await expect(page.getByTestId("button-email-resend-fx-appt-1")).toBeVisible();
  const firstBody = JSON.parse(writes.find(w => w.path.endsWith("/fx-appt-1/email-ticket")).body);
  const retryResponse = page.waitForResponse(r => r.url().includes("/appointments/fx-appt-1/email-ticket") && r.request().method() === "POST");
  await page.getByTestId("button-email-resend-fx-appt-1").click();
  await retryResponse;
  const attempts = writes.filter(w => w.path.endsWith("/fx-appt-1/email-ticket")).map(w => JSON.parse(w.body));
  expect(attempts).toHaveLength(2); expect(attempts[1].requestId).toBe(firstBody.requestId);
  await page.getByTestId("button-dialog-close").click();
  // Bulk export is all-or-nothing: omit the completed visit explicitly rather
  // than expecting an export to silently skip one of the selected records.
  await page.getByTestId("appointment-fx-appt-3").getByRole("checkbox").uncheck();
  await expect(page.getByTestId("text-bulk-count")).toHaveText("3 selected");
  await page.getByTestId("menu-bulk-more").click();
  const bulkDownload = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download Tickets PDF" }).click();
  await savePdf(await bulkDownload, "bulk-tickets.pdf", 3);
  // appointment-details.spec.ts owns tab/entry-point coverage. This expansion
  // is only setup for the existing single-ticket export contract below.
  await page.getByTestId("button-expand-appointment-fx-appt-1").click();
  await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
  await expect(page.getByTestId("button-print-ticket")).toBeVisible();
  await expect(page.getByTestId("ticket-status")).toHaveAttribute("aria-label", "Booking Status: Booked");
  await shot("details-ticket-1280");
  const singleDownload = page.waitForEvent("download");
  await page.getByTestId("button-download-ticket").click();
  await savePdf(await singleDownload, "single-ticket.pdf", 1);
  await page.getByTestId("button-expand-appointment-fx-appt-1").click();
  await page.getByRole("button", { name: /Sort by visit date/ }).click();
  await expect(page.getByRole("button", { name: /latest first/ })).toBeVisible();
  await expect(page.getByTestId("text-status-fx-appt-1")).toHaveText("Booked");
  const desktopScroll = await page.locator(".table-scroll").evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
  // Run the remaining independent legacy checks before reporting geometry.
  // Keep the original no-overflow acceptance: a real layout failure must not
  // be hidden just because obsolete toolbar/dialog assertions were repaired.
  result.checks.push({ name: "desktop table fits without overflow, sort arrow and readable status", status: desktopScroll.scroll <= desktopScroll.client ? "pass" : "fail", desktopScroll, menuBox });
  for (const [width, height] of [[1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const metrics = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(metrics.document).toBeLessThanOrEqual(width);
    await shot(`appointments-${width}`);
    if (width === 390) {
      await page.getByTestId("menu-fx-appt-1").click();
      const b = await page.getByRole("menu").boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(width);
      expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(height);
      result.checks.push({ name: "390px More menu bounds", status: "pass", bounds: b });
      await page.keyboard.press("Escape");
    }
  }
  await page.goto(`${origin}/admin/staff`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await expect(page.getByTestId("list-header").getByRole("heading", { name: "Staff" })).toBeVisible();
  await page.getByTestId("button-toggle-advanced-filters").click();
  await page.getByRole("button", { name: "About account status", exact: true }).click();
  await expect(page.locator('.helptip-bubble[role="tooltip"]')).toBeVisible();
  await expect(page.locator('.helptip-bubble[role="tooltip"]')).toContainText("Account status and invitation status are separate.");
  result.checks.push({ name: "compact header actions/freshness, staff contextual help, date draft cancel/apply, calendar aggregate/drilldown, selection, email unknown/idempotent resend, single/bulk PDF", status: "pass" });
  expect(desktopScroll.scroll).toBeLessThanOrEqual(desktopScroll.client);
  expect(result.checks.filter(check => check.name === "pageerror")).toEqual([]);
} catch (e) {
  result.checks.push({ name: "focused UI check", status: "fail", error: String(e.stack || e).slice(0, 3000) });
  throw e;
} finally {
  result.fixtureNotes = [
    "All /api/** calls were intercepted with fictional identities, appointments, previews, QR data and synthetic unknown email results.",
    "Non-GET requests were intercepted; no live auth, backend data, email, deployment or provider writes.",
    "Print button visibility was checked; print dialog execution intentionally skipped.",
  ];
  await save();
  await context.close();
  await browser.close();
}
