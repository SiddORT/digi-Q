import { test, expect, type Page } from "@playwright/test";

const qrUrl = "https://tickets.example.invalid/check-in/private-detail-fixture";
const first = {
  id: "appointment-1", patientId: "patient-1", patientCode: "P-001",
  patientName: "Alexandria Verylongpatientname Example-Surname",
  doctorId: "doctor-1", doctorName: "Dr Rowan Verylongdoctorname Example",
  clinicId: "clinic-1", clinicName: "Fictional Clinic Group", branchId: "branch-1",
  branchName: "Fictional Northside Location", branchAddress: "21 Fictional Street, Example City",
  date: "2030-06-14", startTime: "09:00", endTime: "12:00", timezone: "UTC",
  sessionId: "session-1", token: "A-01", tokenNumber: 1, reference: "BOOKING-11111111-2222-3333-4444-555555555555",
  status: "booked", revision: 1, allowedActions: [], createdAt: "2030-06-01T10:00:00Z",
  notes: "Long fictional notes with wrapped lines.\n" + "Retain all information without clipping. ".repeat(12),
  checkedInAt: null, completedAt: null,
  history: Array.from({ length: 24 }, (_, i) => ({ action: i ? "requeue" : "book", status: i ? "waiting" : "booked", occurredAt: "2030-06-01T10:00:00Z", reason: `Event ${i}: ` + "A long fictional reason with complete information. ".repeat(5) })),
};
const second = { ...first, id: "appointment-2", patientName: "Morgan Sample", reference: "BOOKING-SECOND", token: "A-02", tokenNumber: 2, notes: "", history: [], status: "completed", checkedInAt: "2030-06-14T09:00:00Z", completedAt: "2030-06-14T09:15:00Z" };
type State = { appointment: typeof first; failAppointment?: boolean; failStatus?: number; failQr?: boolean; failQueue?: boolean; delay?: number; reads: number };
for (const mode of ["shift", "requeue"] as const) {
  test(`row ${mode} opens the shared review and submits the exact reviewed position`, async ({page}) => {
    const state=await mount(page,"rows");
    Object.assign(state.appointment,{status:mode==="shift"?"waiting":"noShow",allowedActions:[mode],canReschedule:mode==="shift"});
    let submitted:any;
    await page.route("**/api/appointments/appointment-1/movement",route=>route.fulfill({json:{
      appointment:state.appointment,queueVersion:"reviewed-queue",currentPosition:mode==="shift"?1:0,pendingCount:2,positions:mode==="shift"?[2]:[1,2,3],
    }}));
    await page.route("**/api/appointments/appointment-1/actions",async route=>{
      submitted=route.request().postDataJSON();
      Object.assign(state.appointment,{status:"waiting",revision:2});
      await route.fulfill({json:state.appointment});
    });
    await page.getByRole("button",{name:"Refresh fixture"}).click();
    await page.getByTestId("menu-appointment-1").click();
    await page.getByTestId(`action-${mode}-appointment-1`).click();
    await expect(page.getByTestId(`form-${mode}`)).toBeVisible();
    await page.getByTestId("radio-position-2").check();
    await page.getByTestId("input-movement-reason").fill("Fictional reviewed movement");
    await page.getByTestId("check-confirm-movement").check();
    await page.getByRole("button",{name:mode==="shift"?"Confirm Shift Time":"Confirm Re-enter",exact:true}).click();
    await expect(page.getByTestId(`form-${mode}`)).not.toBeVisible();
    expect(submitted).toMatchObject({action:mode,expectedRevision:1,expectedQueueVersion:"reviewed-queue",position:2,reason:"Fictional reviewed movement"});
  });
}
async function mount(page: Page, surface = "", linked = false, initial: Partial<State> = {}) {
  const state: State = { appointment: structuredClone(first), reads: 0, ...initial };
  await page.addInitScript(() => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copied = value; }, readText: async () => copied } });
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    let status = 200;
    if (path === "/api/public/website-config") body = { publicOrigin: "https://tickets.example.invalid" };
    else if (path === "/api/auth/csrf") body = {csrfToken:"fictional-browser-csrf"};
    else if (path === "/api/me") body = { user: { id: "fixture-admin", role: "clinicAdmin" }, needsOnboarding: false };
    else if (path === "/api/appointments") body = { items: [state.appointment, second], total: 2, page: 1, pageSize: 100 };
    else if (path === "/api/appointments/appointment-1" || path === "/api/appointments/appointment-2") {
      state.reads++;
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      status = state.failAppointment ? state.failStatus || 503 : 200;
      body = state.failAppointment ? { message: "Fixture details unavailable" } : path.endsWith("appointment-2") ? second : state.appointment;
    } else if (path.endsWith("/qr")) {
      status = state.failQr ? 503 : 200;
      body = state.failQr ? { message: "Fixture QR unavailable" } : { appointmentId: "appointment-1", checkInUrl: qrUrl, payload: "private-fixture" };
    } else if (path === "/api/queue") {
      status = state.failQueue ? 503 : 200;
      body = state.failQueue ? { message: "Fixture status unavailable" } : { entries: [], presence: { status: "onBreak" }, ownEntry: { patientsAhead: 2, estimatedWaitMinutes: 20 } };
    } else { status = 501; body = { message: `Unmocked fixture request ${path}` }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`/?mode=details${surface ? `&surface=${surface}` : ""}${linked ? "&appointment=appointment-2" : ""}`);
  return state;
}
const details = (page: Page) => page.getByTestId("appointment-details");
const tab = (page: Page, name: string) => details(page).getByRole("tab", { name, exact: true });

test("history waits for the authorized record rather than treating a list projection as empty", async ({ page }) => {
  await mount(page, "projection", false, { delay: 1800 });
  await tab(page, "History").click();
  await expect(details(page)).toContainText("Loading history…");
  await expect(details(page)).not.toContainText("Nothing to show.");
  await expect(page.getByRole("table", { name: "Appointment history" })).toBeVisible();
});

test("missing private history is unavailable, not empty; a real initial waiting event is retained and formatted", async ({ page }) => {
  const state = await mount(page);
  Object.assign(state.appointment, { history: undefined });
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await tab(page, "History").click();
  await expect(details(page)).toContainText("History unavailable.");
  await expect(details(page)).not.toContainText("Nothing to show.");
  Object.assign(state.appointment, { dateFormat: "DD/MM/YYYY", timeFormat: "24h", status: "completed", history: [{ status: "waiting", occurredAt: "2030-06-01T10:00:00Z" }] });
  await page.getByRole("button", { name: "Retry History" }).click();
  const row = page.getByRole("table", { name: "Appointment history" }).locator("tbody tr");
  await expect(row).toHaveCount(1);
  await expect(row.getByRole("cell")).toHaveText(["01/06/2030, 10:00", "Status recorded", "Waiting", "—"]);
  await expect(details(page)).not.toContainText("Nothing to show.");
});

for (const surface of ["rows", "today"]) {
  test(`${surface}: hidden row values stay in Details without duplicating Booking metadata`, async ({ page }) => {
    const table = surface === "today" ? "appointments-session" : "appointments";
    await page.addInitScript(table => localStorage.setItem(`digiq-columns:fixture-admin:clinicAdmin:${table}`, JSON.stringify({
      order: [], hidden: ["patient", "token", "date", "location", "doctor", "reference", "createdAt"], pinned: null, touched: true,
    })), table);
    await mount(page, surface);
    await page.getByTestId("button-expand-appointment-appointment-1").click();
    await expect(page.getByTestId("appointment-summary")).toHaveCount(0);
    await expect(page.getByTestId("text-detail-booked")).toBeVisible();
    await expect(page.getByTestId("button-copy-reference")).toBeVisible();
    await tab(page, "Details").click();
    const extra = page.locator('dl[aria-label="Hidden columns"]');
    for (const value of [first.patientName, first.patientCode, first.token, first.clinicName, first.branchName, first.doctorName]) await expect(extra).toContainText(value);
    await expect(extra).not.toContainText(first.reference);
    await expect(extra).not.toContainText("Booked At");
    await expect(page.getByTestId("section-detail-consultation")).toBeVisible();
  });
}

test("history reasons wrap unbroken text while statuses come from each recorded event", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mount(page, "rows");
  state.appointment.history = [{ action: "cancel", status: "cancelled", occurredAt: "2030-06-01T10:00:00Z", reason: "Unbroken".repeat(80) }];
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await tab(page, "History").click();
  const table = page.getByRole("table", { name: "Appointment history" });
  await expect(table.getByRole("columnheader")).toHaveText(["Date & time", "Event", "Status", "Reason"]);
  await expect(table.locator("tbody tr")).toContainText("Cancelled");
  await expect(table.locator("tbody tr")).not.toContainText("Booked");
  const bounds = await table.evaluate(el => {
    const reason = el.querySelector("tbody td:last-child")!;
    return { width: el.getBoundingClientRect().width, viewport: innerWidth, scroll: reason.scrollWidth, cell: reason.clientWidth };
  });
  expect(bounds.width).toBeLessThan(bounds.viewport);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.cell + 1);
});

for (const width of [1280, 820, 390]) {
  test(`visit date has no repeated context help; token and action guidance remain at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, "rows");
    const date = page.locator(".appointment-visit-date").first();
    await expect(date).toBeVisible();
    await expect(date.locator(".helptip,[title]")).toHaveCount(0);
    await expect(page.getByTestId("text-token-appointment-1")).toBeVisible();
    await page.getByTestId("text-token-appointment-1").focus();
    await expect(page.locator(".helptip-bubble")).toContainText("Booking reference");
    await page.keyboard.press("Escape");
    await expect(page.locator(".helptip-bubble")).toHaveCount(0);
  });
}

for (const surface of ["rows", "linked", "calendar"]) {
  test(`${surface}: a denied exact-ID refresh immediately hides cached details and QR`, async ({ page }) => {
    const state = await mount(page, surface === "linked" ? "rows" : surface);
    if (surface === "linked") {
      await page.route("**/api/appointments", route => route.fulfill({ json: { items: [second], total: 1 } }));
      await page.goto("/?mode=details&surface=rows&appointment=appointment-1");
    } else if (surface === "rows") {
      await page.getByTestId("button-expand-appointment-appointment-1").click();
    } else {
      await page.getByTestId("calendar-day-visit-appointment-1").locator("summary").click();
    }
    await expect(page.getByTestId("text-detail-reference")).toHaveText(first.reference);
    if (surface === "rows") await expect(page.getByTestId("text-patient-appointment-1")).toHaveText(first.patientName);
    await expect(page.getByAltText("Personal visit QR")).toBeVisible();
    state.failAppointment = true; state.failStatus = 403;
    await page.getByRole("button", { name: "Refresh fixture" }).click();
    await expect(details(page)).toHaveCount(0);
    await expect(page.getByTestId("text-detail-patient")).toHaveCount(0);
    await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
    await expect(page.getByTestId("text-detail-reference")).toHaveCount(0);
    await expect(page.getByRole("button", { name: surface === "linked" ? "Retry" : "Retry Details", exact: true })).toBeVisible();
    // A later successful permission check starts a newly authorized view on Booking.
    state.failAppointment = false;
    await page.getByRole("button", { name: surface === "linked" ? "Retry" : "Retry Details", exact: true }).click();
    await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  });
}

for (const selected of ["Details", "History"]) {
  test(`calendar access stays checked on ${selected}, with all cached identifiers hidden after denial`, async ({ page }) => {
    await page.clock.install();
    const state = await mount(page, "calendar");
    const visit = page.getByTestId("calendar-day-visit-appointment-1");
    await visit.locator("summary").click();
    await expect(page.getByAltText("Personal visit QR")).toBeVisible();
    await tab(page, selected).click();
    await expect(tab(page, selected)).toHaveAttribute("aria-selected", "true");
    const before = state.reads;
    state.failAppointment = true; state.failStatus = 403;
    // Exercise the ordinary refresh timer, not fixture-wide invalidation.
    await page.clock.fastForward(31000);
    await expect.poll(() => state.reads).toBeGreaterThan(before);
    await expect(details(page)).toHaveCount(0);
    await expect(visit).toContainText("Appointment unavailable");
    for (const privateText of [first.patientName, first.patientCode, first.token, first.reference, first.notes, "Event 23:"]) {
      await expect(visit).not.toContainText(privateText);
    }
    await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
    await expect(visit.getByRole("button", { name: "Retry Details", exact: true })).toBeVisible();
    await visit.locator("summary").click();
    await expect(visit.locator("summary")).not.toContainText(first.patientName);
    await expect(visit.locator("summary")).not.toContainText(first.patientCode);
  });
}

test("Booking default, keyboard sections, all fields, history and fresh refresh stability", async ({ page }) => {
  const state = await mount(page);
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  await expect(details(page).getByRole("tabpanel", { name: "Booking", exact: true })).toBeVisible();
  await expect(page.getByTestId("section-detail-additional")).not.toBeVisible();
  await expect(page.getByTestId("section-detail-history")).not.toBeVisible();
  await expect(page.getByText("Appointment History", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("2 patients ahead");
  await page.getByTestId("button-copy-reference").click();
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.reference);
  await tab(page, "Booking").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Details")).toBeFocused();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("text-detail-patient-code")).toContainText(first.patientCode);
  for (const text of [first.branchName, first.clinicName, first.doctorName]) await expect(page.getByTestId("appointment-summary")).toContainText(text);
  await expect(page.getByTestId("section-detail-additional")).not.toContainText(first.patientName);
  await expect(page.getByTestId("section-detail-additional")).not.toContainText(first.doctorName);
  await expect(page.getByTestId("text-detail-reference")).toHaveText(first.reference);
  state.appointment.patientName = "Updated Fictional Name";
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await expect(page.getByTestId("text-detail-patient")).toContainText("Updated Fictional Name");
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("text-detail-checked-in")).toHaveText("Not recorded");
  await expect(details(page)).toContainText("not arrival at the clinic");
  await tab(page, "Details").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "History")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tab(page, "History")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table", { name: "Appointment history" }).locator("tbody tr")).toHaveCount(24);
  await expect(page.getByRole("table", { name: "Appointment history" }).getByRole("columnheader")).toHaveText(["Date & time", "Event", "Status", "Reason"]);
  await expect(page.getByTestId("section-detail-history")).toContainText("Event 23:");
  await page.keyboard.press("Home");
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
});

test("different appointment resets tabs and copy feedback; completed record and empty history remain usable", async ({ page }) => {
  await mount(page);
  await page.getByTestId("button-copy-reference").click();
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copied");
  await tab(page, "History").click();
  await page.getByRole("button", { name: "Second appointment" }).click();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("text-detail-reference")).toHaveText(second.reference);
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copy");
  await expect(page.getByTestId("text-detail-ticket-unavailable")).toContainText("booking reference");
  await expect(page.getByTestId("appointment-ticket")).toHaveCount(0);
  await tab(page, "History").click();
  await expect(details(page).getByRole("heading", { name: "Nothing to show.", exact: true })).toBeVisible();
  await expect(details(page).getByRole("table")).toHaveCount(0);
  await expect(details(page).getByRole("columnheader")).toHaveCount(0);
  await tab(page, "Details").click();
  await expect(page.getByTestId("text-detail-checked-in")).not.toHaveText("Not recorded");
  await expect(page.getByTestId("text-detail-completed")).not.toHaveText("Not recorded");
  await page.getByRole("button", { name: "First appointment" }).click();
  await expect(page.getByTestId("text-detail-reference")).toHaveText(first.reference);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>(resolve => {
      (window as unknown as { finishCopy: () => void }).finishCopy = resolve;
    }) } });
  });
  await page.getByTestId("button-copy-reference").click();
  await page.getByRole("button", { name: "Second appointment" }).click();
  await expect(page.getByTestId("text-detail-reference")).toHaveText(second.reference);
  await page.evaluate(() => (window as unknown as { finishCopy: () => void }).finishCopy());
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copy");
});

test("row, off-page link and calendar share tabs; hidden columns live only in Details; close/reopen starts Booking", async ({ page }) => {
  await mount(page, "rows");
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('dl[aria-label="Hidden columns"]')).not.toBeVisible();
  await tab(page, "Details").click();
  await expect(page.getByRole("list", { name: "Hidden columns" })).toHaveCount(0);
  await expect(page.locator('dl[aria-label="Hidden columns"]')).toHaveCount(0);
  await expect(page.getByTestId("button-copy-reference")).toBeVisible();
  await expect(page.getByTestId("section-detail-additional")).not.toContainText(first.reference);
  await expect(page.getByTestId("section-detail-additional")).not.toContainText(first.patientName);
  await expect(page.getByTestId("appointment-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  // Remove the second record from the listing so the linked entry uses its exact-id endpoint.
  await page.route("**/api/appointments", route => route.fulfill({ json: { items: [first], total: 1 } }));
  await page.goto("/?mode=details&surface=rows&appointment=appointment-2");
  await expect(page.getByTestId("linked-visit")).toBeVisible();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  await tab(page, "History").click();
  await expect(details(page)).toContainText("Nothing to show.");
  await expect(page.getByTestId("appointment-summary")).toContainText(second.patientName);
  await mount(page, "calendar");
  await page.getByTestId("calendar-day-visit-appointment-1").locator("summary").click();
  await tab(page, "Details").click();
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("calendar-day-visit-appointment-1").locator("summary").click();
  await page.getByTestId("calendar-day-visit-appointment-1").locator("summary").click();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
});

test("loading, QR and queue retry states remain accessible; detail refresh errors preserve chosen tab", async ({ page }) => {
  const state = await mount(page, "rows");
  state.delay = 700;
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await expect(page.getByRole("status", { name: "Loading details" })).toBeVisible();
  await expect(details(page)).toBeVisible();
  await tab(page, "History").click();
  state.failAppointment = true;
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await expect(page.getByRole("button", { name: "Retry Details" })).toBeVisible();
  await expect(tab(page, "History")).toHaveAttribute("aria-selected", "true");
  await expect(details(page)).not.toContainText("Nothing to show.");
  await expect(details(page).getByRole("table", { name: "Appointment history" })).toHaveCount(0);
  await expect(details(page).getByRole("button", { name: "Retry History" })).toBeVisible();
  state.failAppointment = false; state.failQr = true; state.failQueue = true; state.delay = 0;
  await page.getByRole("button", { name: "Retry Details" }).click();
  await tab(page, "Booking").click();
  await page.getByRole("button", { name: "Refresh fixture" }).click();
  await expect(page.getByTestId("button-retry-appointment-qr")).toBeVisible();
  await expect(details(page)).toContainText("No estimate is shown.");
  state.failQr = false; state.failQueue = false;
  await page.getByTestId("button-retry-appointment-qr").click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByAltText("Personal visit QR")).toBeVisible();
  await expect(page.getByTestId("text-ticket-estimate")).toBeVisible();
});

test("QR, status URLs, print/download and switching tabs cannot bypass fresh export checks", async ({ page }) => {
  const state = await mount(page);
  const download = page.getByTestId("button-ticket-download");
  await expect(download).toBeEnabled();
  const image = page.getByAltText("Personal visit QR");
  await expect(image).toBeVisible();
  expect(await page.evaluate(uri => window.decodeTicketQr(uri!), await image.getAttribute("src"))).toBe(qrUrl);
  await expect(page.getByTestId("link-ticket-patient-live")).toHaveAttribute("href", /\/patient\/queue\?appointment=appointment-1$/);
  const downloaded = page.waitForEvent("download");
  await download.click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
  await page.evaluate(() => { (window as unknown as { fixturePrinted: boolean }).fixturePrinted = false; window.print = () => { (window as unknown as { fixturePrinted: boolean }).fixturePrinted = true; }; });
  // Printing uses a popup; install its print stub before document generation.
  await page.context().addInitScript(() => { window.print = () => {}; });
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("button-ticket-print").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("body")).toContainText(first.patientName);
  await expect(popup.getByAltText("Personal visit QR")).toBeVisible();
  await popup.close();
  await page.context().setOffline(true);
  await expect(download).toBeDisabled();
  await tab(page, "Details").click(); await tab(page, "Booking").click();
  await expect(download).toBeDisabled();
  await page.context().setOffline(false);
  await expect(download).toBeEnabled();
  state.appointment = { ...state.appointment, status: "completed" };
  await download.click();
  await expect(details(page).getByRole("alert")).toContainText("Completed visits");
});

for (const width of [1920, 1366, 1024, 768, 390]) {
  test(`tabs and long content/control bounds fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 640 : 844 });
    await mount(page, "rows");
    await page.getByTestId("button-expand-appointment-appointment-1").click();
    await expect(page.getByTestId("button-ticket-download")).toBeEnabled();
    for (const name of ["Booking", "Details", "History"]) {
      await tab(page, name).click();
      await expect(details(page).getByRole("tabpanel")).toBeVisible();
      const failures = await details(page).evaluate(root => {
        const bounds = root.getBoundingClientRect();
        const failures: string[] = [];
        for (const node of root.querySelectorAll<HTMLElement>('[role="tab"],button,a,code,h3,dd,th,td')) {
          if (!node.getClientRects().length) continue;
          const box = node.getBoundingClientRect();
          if (box.left < bounds.left - 1 || box.right > bounds.right + 1) failures.push(`${node.tagName}: outside detail bounds`);
          // pre-wrap deliberately lets trailing spaces hang at line ends. Measure
          // actual words, not whitespace or SVG/control descendants.
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const text = walker.currentNode;
            const range = document.createRange();
            for (const match of (text.textContent || "").matchAll(/\S+/g)) {
              range.setStart(text, match.index!); range.setEnd(text, match.index! + match[0].length);
              for (const rect of range.getClientRects()) {
                if (rect.width && (rect.left < box.left - 2 || rect.right > box.right + 2)) failures.push(`${node.tagName}.${node.className}: text outside control (${match[0]})`);
              }
            }
          }
        }
        if (bounds.right > innerWidth + 1) failures.push("Details outside viewport");
        return failures;
      });
      expect(failures).toEqual([]);
      await page.screenshot({ path: `generated-artifacts/appointment-tabs/${width}-${name.toLowerCase()}.png`, fullPage: true });
    }
  });
}
