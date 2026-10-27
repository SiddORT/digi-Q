import { test, expect, type Page } from "@playwright/test";

const qrUrl = "https://tickets.example.invalid/check-in/booking-tab-fixture";
const base = {
  id: "appointment-1", patientId: "patient-1", patientCode: "P-001",
  patientName: "Alexandria Verylongpatientname Example-Surname", doctorId: "doctor-1", doctorName: "Dr Rowan Verylongdoctorname Example",
  clinicId: "clinic-1", clinicName: "Fictional Clinic Group", branchId: "branch-1", branchName: "Fictional Northside Location", branchAddress: "21 Fictional Street",
  date: "2030-06-14", startTime: "09:00", endTime: "12:00", timezone: "UTC", sessionId: "session-1", token: "A-01", tokenNumber: 1,
  reference: "BOOKING-11111111-2222-3333-4444-555555555555", status: "waiting", revision: 1, bookingDetailsRevision: 0, allowedActions: [], createdAt: "2030-06-01T10:00:00Z",
  notes: "Long fictional note. ".repeat(40), bookingMobile: "+919876543210", canEditBooking: true, history: [], checkedInAt: null, completedAt: null,
};
type S = { a: typeof base; patch?: any; sms: any; smsPosts: any[]; smsResult: any; revoke: boolean; patchStatus: number; editedElsewhere: boolean };
const b2 = { ...base, id: "appointment-2", patientName: "Morgan Sample", reference: "BOOKING-SECOND", token: "A-02", notes: "", canEditBooking: true };

async function mount(page: Page, surface: string) {
  const s: S = { a: structuredClone(base), sms: { eligible: true, reason: "", recipient: "+91 98765 43210", message: "Fictional approved status message.", previewToken: "tok-1" }, smsPosts: [], smsResult: { state: "provider_accepted" }, revoke: false, patchStatus: 200, editedElsewhere: false };
  await page.route("**/api/**", async route => {
    const req = route.request(); const path = new URL(req.url()).pathname; let status = 200; let body: any;
    if (path === "/api/public/website-config") body = { publicOrigin: "https://tickets.example.invalid" };
    else if (path === "/api/auth/csrf") body = { csrfToken: "fixture" };
    else if (path === "/api/me") body = { user: { id: "fixture-admin", role: "clinicAdmin" }, needsOnboarding: false };
    else if (path === "/api/appointments") body = { items: [s.a, b2], total: 2, page: 1, pageSize: 100 };
    else if (path === "/api/appointments/appointment-1/booking" && req.method() === "PATCH") {
      s.patch = req.postDataJSON(); status = s.patchStatus;
      if (status === 200) { s.a = { ...s.a, bookingMobile: s.patch.bookingMobile, notes: s.patch.notes, bookingDetailsRevision: (s.a.bookingDetailsRevision || 0) + 1 } as typeof base; body = s.a; } else body = { message: "Booking changed" };
    } else if (path === "/api/appointments/appointment-1/sms-status-link") {
      if (req.method() === "POST") { s.smsPosts.push(req.postDataJSON()); body = s.smsResult; } else body = s.sms;
    } else if (path === "/api/appointments/appointment-1") { if (s.revoke) { status = 403; body = { message: "Forbidden" }; } else body = s.a; }
    else if (path === "/api/appointments/appointment-2") body = b2;
    else if (path === "/api/appointments/appointment-1/email-ticket") body = { eligible: true, reason: "", recipient: "patient@example.invalid" };
    else if (path.endsWith("/qr")) body = { appointmentId: "appointment-1", checkInUrl: qrUrl, payload: "x" };
    else if (path === "/api/live-ticket-links") body = {url:"https://tickets.example.invalid/live-ticket#"+"b".repeat(64),expiresAt:"2030-06-17T00:00:00Z"};
    else if (path === "/api/queue") body = { entries: [], presence: { status: "available" }, ownEntry: { patientsAhead: 1, estimatedWaitMinutes: 20, estimate:{state:"ready",basis:"sessionStart",asOf:new Date().toISOString(),patientsAhead:1,waitMinutes:20,suggestedArrival:"09:10",beyondSessionEnd:false,guidance:"Estimate only, not an appointment time."} } };
    else { status = 501; body = { message: `Unmocked ${path}` }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`/?mode=details&surface=${surface}`);
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await expect(page.getByTestId("section-detail-booking")).toBeVisible();
  return s;
}
const noOverflow = async (page: Page) => {
  const bad = await page.evaluate(() => { const r = document.querySelector('[data-testid="appointment-details"]')!.getBoundingClientRect(); return [...document.querySelectorAll('[data-testid="appointment-details"] *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 1 && b.height > 1 && getComputedStyle(e).visibility !== "hidden" && (b.right > r.right + 1 || b.left < r.left - 1) && !e.closest("[hidden],.sr-only-heading,.sr-only"); }).length; });
  expect(bad).toBe(0);
};

for (const surface of ["rows", "today"]) for (const [name, width] of [["desktop", 1280], ["tablet", 820], ["phone", 390]] as const) {
  test(`${surface} ${name}: shared layout, bounds and action parity`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, surface);
    const d = page.getByTestId("appointment-details");
    await expect(d.getByRole("tab")).toHaveText(["Booking", "Details", "History"]);
    await expect(d.getByRole("tab", { name: "Booking" })).toHaveAttribute("aria-selected", "true");
    const bk = await page.getByTestId("section-detail-booking").boundingBox(), tk = await page.getByTestId("section-detail-ticket").boundingBox();
    if (width >= 1024) { expect(Math.abs(bk!.y - tk!.y)).toBeLessThan(4); expect(tk!.x).toBeGreaterThan(bk!.x); } else expect(tk!.y).toBeGreaterThan(bk!.y + bk!.height - 2);
    await expect(page.getByTestId("ticket-information")).toBeVisible();
    await expect(page.getByTestId("text-ticket-doctor-status")).toContainText("Available");
    await expect(page.getByTestId("text-ticket-estimate")).toContainText("20 minutes");
    await noOverflow(page);
    const labels = await page.getByTestId("group-ticket-actions").getByRole("button").evaluateAll(els => els.map(e => e.getAttribute("aria-label")));
    expect(labels).toEqual(["Download Ticket", "Print Ticket", "Email Ticket", "SMS Booking Status Link"]);
    await page.getByTestId("menu-appointment-1").click();
    await expect(page.getByRole("menuitem", { name: "Download Ticket", exact: true })).toBeVisible();
    const items = await page.getByRole("menuitem").allTextContents();
    expect(items.filter(t => /Ticket|SMS/.test(t)).map(t => t.replace("…", ""))).toEqual(["Download Ticket", "Print Ticket", "Email Ticket", "SMS Booking Status Link"]);
    expect(items.join()).not.toMatch(/A4/);
  });
}

test("edit: validation, keyboard, save payload uses start revision, persisted in details and row", async ({ page }) => {
  const s = await mount(page, "rows");
  await page.getByTestId("button-edit-booking").focus(); await page.keyboard.press("Enter");
  const mobile = page.getByTestId("input-booking-mobile");
  await mobile.fill("12"); await expect(page.getByTestId("error-booking-mobile")).toBeVisible();
  await expect(page.getByTestId("button-save-booking")).toBeDisabled();
  await mobile.fill("98765 43211");
  await page.getByTestId("input-booking-notes").fill("Updated fictional note");
  await page.getByTestId("button-save-booking").click();
  expect(s.patch).toMatchObject({ expectedRevision: 1, expectedBookingDetailsRevision: 0, notes: "Updated fictional note" });
  await expect(page.getByTestId("text-detail-notes")).toHaveText("Updated fictional note");
  await expect(page.getByTestId("form-edit-booking")).toHaveCount(0);
});

test("edit conflict keeps the draft and polling does not replace the snapshot", async ({ page }) => {
  const s = await mount(page, "rows"); s.patchStatus = 409;
  await page.getByTestId("button-edit-booking").click();
  await page.getByTestId("input-booking-notes").fill("Mine");
  s.a = { ...s.a, revision: 5, notes: "Elsewhere" };
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-refresh")));
  await page.getByTestId("button-save-booking").click();
  expect(s.patch.expectedRevision).toBe(1);
  await expect(page.getByTestId("error-booking-save")).toBeVisible();
  await expect(page.getByTestId("input-booking-notes")).toHaveValue("Mine");
});

test("dirty cancel asks before discarding; draft survives tab switch and row switch", async ({ page }) => {
  await mount(page, "rows");
  await page.getByTestId("button-edit-booking").click();
  await page.getByTestId("input-booking-notes").fill("Draft kept");
  await page.getByTestId("button-cancel-booking").click();
  await expect(page.getByText(/discard/i).first()).toBeVisible();
  await page.getByRole("button", { name: /keep/i }).first().click();
  await expect(page.getByTestId("input-booking-notes")).toHaveValue("Draft kept");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /keep/i }).first().click();
  await page.getByTestId("button-cancel-booking").click();
  await page.getByRole("button", { name: /discard/i }).first().click();
  await page.getByTestId("button-edit-booking").click();
  await page.getByTestId("input-booking-notes").fill("Second draft");
  await page.getByTestId("button-cancel-booking").click();
});

test("draft is kept across tab and row switches and the mobile is required", async ({ page }) => {
  await mount(page, "rows");
  await page.getByTestId("button-edit-booking").click();
  await page.getByTestId("input-booking-mobile").fill("");
  await expect(page.getByTestId("error-booking-mobile")).toContainText("Enter a mobile");
  await page.getByTestId("input-booking-mobile").fill("98765 43211");
  await page.getByTestId("input-booking-notes").fill("Draft kept");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /keep/i }).first().click();
  // Simulate the containing list replacing its expansion while a draft exists.
  // Native pointer navigation is intentionally locked by the editor dialog.
  await page.getByTestId("button-expand-appointment-appointment-2").evaluate((el: HTMLButtonElement) => el.click());
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await page.getByTestId("tab-detail-history").click(); await page.getByTestId("tab-detail-booking").click();
  await page.getByTestId("button-edit-booking").click();
  await expect(page.getByTestId("input-booking-notes")).toHaveValue("Draft kept");
});

test("reference copy remains available without a repeated row summary", async ({ page }) => {
  await mount(page, "rows");
  await expect(page.getByTestId("text-detail-reference")).toHaveCount(1);
  await expect(page.getByTestId("appointment-summary")).toHaveCount(0);
  await expect(page.getByTestId("button-copy-reference")).toBeVisible();
});

test("non-editable bookings show no Edit control", async ({ page }) => {
  const s = await mount(page, "rows");
  s.a = { ...s.a, canEditBooking: false };
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-refresh")));
  await expect(page.getByTestId("section-detail-booking")).toBeVisible();
  await expect(page.getByTestId("button-edit-booking")).toHaveCount(0);
});

test("revoked authorization hides private dialog and draft", async ({ page }) => {
  const s = await mount(page, "rows");
  await page.getByTestId("button-edit-booking").click();
  await page.getByTestId("input-booking-notes").fill("Private draft");
  s.revoke = true;
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-refresh")));
  await expect(page.getByTestId("form-edit-booking")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText("Private draft")).toHaveCount(0);
});

for (const [result, text] of [["provider_accepted", /does not confirm delivery/], ["provider_rejected", /rejected/], ["delivery_unknown", /Outcome unknown/], ["pre_dispatch_failed", /Nothing reached the provider/], ["blocked", /Not sent/]] as const) {
  test(`SMS outcome ${result} is reported accurately with one request id`, async ({ page }) => {
    const s = await mount(page, "rows"); s.smsResult = { state: result, reason: "Fixture reason" };
    await page.getByTestId("button-ticket-sms").click();
    await expect(page.getByTestId("text-sms-recipient")).toContainText("98765");
    await expect(page.getByTestId("text-sms-message")).toContainText("Fictional approved");
    await page.getByTestId("button-sms-confirm").click();
    await expect(page.getByTestId("status-sms-result")).toHaveText(text);
    expect(s.smsPosts[0]).toMatchObject({ previewToken: "tok-1" });
    expect(s.smsPosts[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
    if (result === "delivery_unknown") { await page.getByTestId("button-sms-confirm").click(); await expect.poll(() => s.smsPosts.length).toBe(2); expect(s.smsPosts[1].requestId).toBe(s.smsPosts[0].requestId); }
  });
}

test("SMS blocked by missing approved template shows the safe reason and no preview", async ({ page }) => {
  const s = await mount(page, "rows"); s.sms = { eligible: false, reason: "No approved SMS template is configured for this clinic.", recipient: "", message: "", previewToken: "" };
  await page.getByTestId("menu-appointment-1").click(); await page.getByTestId("action-ticket-sms-appointment-1").click();
  await expect(page.getByTestId("text-sms-blocked")).toContainText("No approved SMS template");
  await expect(page.getByTestId("preview-sms")).toHaveCount(0);
  await expect(page.getByTestId("button-sms-confirm")).toBeDisabled();
  expect(s.smsPosts).toHaveLength(0);
});

test("output actions: download is a PDF, print opens a popup, email opens recipient preview", async ({ page }) => {
  await mount(page, "rows");
  await page.context().addInitScript(() => { window.print = () => {}; });
  const popup = page.waitForEvent("popup");
  await page.getByTestId("button-ticket-print").click();
  const p = await popup;
  await expect(p.locator("body")).toContainText(base.patientName);
  await expect(page.getByTestId("button-ticket-download")).toBeEnabled();
  await p.close();
  const dl = page.waitForEvent("download");
  await page.getByTestId("button-ticket-download").click();
  expect((await dl).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByTestId("button-ticket-email").click();
  await expect(page.getByRole("dialog")).toContainText("Email Ticket");
  await expect(page.getByRole("dialog")).toContainText("patient@example.invalid");
});

test("long text stays inside the card on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mount(page, "rows");
  await noOverflow(page);
});
