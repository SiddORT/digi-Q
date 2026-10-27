import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

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
  source: "online", bookingMobile: "+14155550222",
  privatePatient: { fullName: "Alexandria Verylongpatientname Example-Surname", code: "P-001", gender: "female",
    dateOfBirth: "1990-03-14", mobile: "+14155550111", email: "alex@example.invalid", canEdit: false },
  notes: "Long fictional notes with wrapped lines.\n" + "Retain all information without clipping. ".repeat(12),
  checkedInAt: null, completedAt: null,
  history: Array.from({ length: 24 }, (_, i) => ({ action: i ? "requeue" : "book", status: i ? "waiting" : "booked", occurredAt: "2030-06-01T10:00:00Z", reason: `Event ${i}: ` + "A long fictional reason with complete information. ".repeat(5), actorState: i % 2 ? "named" : "unknown", actorDisplayName: i % 2 ? "Long Fictional Receptionist Name" : null, actorRecordedRole: i % 2 ? "receptionist" : null })),
};
const second = { ...first, id: "appointment-2", patientName: "Morgan Sample", reference: "BOOKING-SECOND", token: "A-02", tokenNumber: 2, notes: "", history: [], status: "completed", checkedInAt: "2030-06-14T09:00:00Z", completedAt: "2030-06-14T09:15:00Z" };
type State = { appointment: typeof first; failAppointment?: boolean; failStatus?: number; failQr?: boolean; failQueue?: boolean; delay?: number; reads: number };

test("patient editor opens a fresh authorized profile and saves demographics without moving registration or visit contact", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  const patient = { id: first.patientId, fullName: first.patientName, code: first.patientCode, gender: "female",
    dateOfBirth: "1990-03-14", mobile: first.privatePatient.mobile, email: first.privatePatient.email,
    clinicId: first.clinicId, branchId: first.branchId, status: "active" };
  const state = await mount(page, "", false, { appointment: { ...first, privatePatient: { ...first.privatePatient, canEdit: true } } });
  await page.route("**/api/patients/patient-1", async route => {
    if (route.request().method() === "PATCH") {
      submitted = route.request().postDataJSON();
      Object.assign(patient, submitted);
    }
    await route.fulfill({ json: patient });
  });
  await tab(page, "Details").click();
  await page.getByTestId("button-edit-patient-profile").click();
  await expect(page.getByRole("dialog", { name: "Edit Patient" })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("Clinic and status");
  await page.locator("#input-fullName").fill("Fictional Updated Patient");
  await page.getByRole("dialog").getByRole("button", { name: /save/i }).click();
  await expect.poll(() => submitted).toBeDefined();
  expect(submitted?.fullName).toBe("Fictional Updated Patient");
  expect(submitted).not.toHaveProperty("clinicId");
  expect(submitted).not.toHaveProperty("branchId");
  expect(submitted).not.toHaveProperty("status");
  expect(state.appointment.bookingMobile).toBe("+14155550222");
});

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
    else if (path === "/api/auth/status") body = { authenticated: true, role: "superAdmin" };
    else if (path === "/api/me") body = { user: { id: "fixture-admin", fullName: "Fictional Administrator", email: "fixture@example.invalid", role: surface === "application" ? "superAdmin" : "clinicAdmin", timezone: "UTC" }, needsOnboarding: false };
    else if (path === "/api/appointments") body = { items: [state.appointment, second], total: 2, page: 1, pageSize: 100 };
    else if (path === "/api/appointments/appointment-1" || path === "/api/appointments/appointment-2") {
      state.reads++;
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      status = state.failAppointment ? state.failStatus || 503 : 200;
      body = state.failAppointment ? { message: "Fixture details unavailable" } : path.endsWith("appointment-2") ? second : state.appointment;
    } else if (path.endsWith("/qr")) {
      status = state.failQr ? 503 : 200;
      body = state.failQr ? { message: "Fixture QR unavailable" } : { appointmentId: "appointment-1", checkInUrl: qrUrl, payload: "private-fixture" };
    } else if (path === "/api/live-ticket-links") {
      body = {url:"https://tickets.example.invalid/live-ticket#"+"b".repeat(64),expiresAt:"2030-06-17T00:00:00Z"};
    } else if (path === "/api/queue") {
      status = state.failQueue ? 503 : 200;
      body = state.failQueue ? { message: "Fixture status unavailable" } : { entries: [], presence: { status: "onBreak" }, ownEntry: { patientsAhead: 2, estimatedWaitMinutes: null, estimate:{state:"paused",basis:"remainingQueue",asOf:new Date().toISOString(),patientsAhead:2,waitMinutes:null,suggestedArrival:null,beyondSessionEnd:false,guidance:"Doctor is on break. Arrival guidance resumes when availability is confirmed."} } };
    } else if (surface === "application" && path === "/api/settings") body = { timezone: "UTC" };
    else if (surface === "application" && /\/(directory|clinics|branches|doctors|permissions|verification)/.test(path)) body = { items: [], total: 0, hasMore: false };
    else { status = 501; body = { message: `Unmocked fixture request ${path}` }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(surface === "application" ? "/application.html" : `/?mode=details${surface ? `&surface=${surface}` : ""}${linked ? "&appointment=appointment-2" : ""}`);
  return state;
}
const details = (page: Page) => page.getByTestId("appointment-details");
const tab = (page: Page, name: string) => details(page).getByRole("tab", { name, exact: true });

for (const width of [1024, 1440, 820, 390]) {
  test(`ticket layering in the complete application at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 640 });
    const state = await mount(page, "application");
    Object.assign(state.appointment, {
      canEditBooking: true, bookingMobile: "+919876543210",
      notes: "UnbrokenLongNote".repeat(60) + "\n" + "Full readable notes.\n".repeat(40),
    });
    await page.getByTestId("button-expand-appointment-appointment-1").click();
    await expect(page.getByAltText("Personal visit QR")).toBeVisible();
    await page.getByTestId("appointment-ticket").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const geometry = await page.getByTestId("section-detail-booking-layout").evaluate(el => {
      const box = (selector: string) => {
        const r = el.querySelector(selector)!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
      };
      const scroll = el.closest(".appt-table")!;
      const header = scroll.querySelector("thead th")!;
      return {
        booking: box('[data-testid="section-detail-booking"]'),
        ticket: box('[data-testid="section-detail-ticket"]'),
        card: box(".vt"), info: box('[data-testid="ticket-information"]'),
        columns: getComputedStyle(el.querySelector(".appt-booking-cards")!).gridTemplateColumns,
        header: { position: getComputedStyle(header).position, background: getComputedStyle(header).backgroundColor },
        scroll: { height: scroll.clientHeight, width: scroll.clientWidth, total: scroll.scrollWidth },
      };
    });
    await testInfo.attach("initial-geometry", { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
    await page.screenshot({ path: `generated-artifacts/appointment-layering/${width}-corrected.png` });
    expect(Math.abs(geometry.card.x - geometry.info.x)).toBeLessThan(1);
    expect(Math.abs(geometry.card.width - geometry.info.width)).toBeLessThan(1);
    expect(geometry.info.y - geometry.ticket.bottom).toBeGreaterThanOrEqual(0);
    expect(geometry.info.y - geometry.ticket.bottom).toBeLessThanOrEqual(16);
    if (width >= 1024) {
      expect(Math.abs(geometry.ticket.y - geometry.booking.y)).toBeLessThan(1);
      expect(geometry.ticket.x).toBeGreaterThan(geometry.booking.x);
      expect(geometry.info.bottom).toBeLessThan(geometry.booking.bottom);
    } else {
      expect(geometry.ticket.y).toBeGreaterThanOrEqual(geometry.booking.bottom);
    }
    const notes = page.getByTestId("text-detail-notes");
    expect(await notes.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(notes).toHaveCSS("font-size", "14px");
    if (width > 640) {
      await expect(page.locator(".appt-table>table>thead>tr>th.col-patient")).toHaveCSS("position", "sticky");
      // Constrain the actual listing scrollport, not a simplified ticket fixture.
      // ListingRegion currently grows naturally; this also covers nested consumers
      // with a height limit, matching the reported short UAT listing viewport.
      await page.locator(".appt-table").evaluate(el => { (el as HTMLElement).style.maxHeight = "360px"; });
      await positionDirections(page);
    } else {
      await page.getByTestId("button-get-directions").scrollIntoViewIfNeeded();
    }
    const directions = page.getByTestId("button-get-directions");
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await directions.evaluate(el => (el as HTMLElement).focus({ preventScroll: true }));
    await expect(page.locator(".helptip-bubble")).toHaveText("Get Directions");
    const tooltip = await boundedHelpGeometry(page);
    expect(tooltip.inside).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".helptip-bubble")).toHaveCount(0);
    const point = (await directions.boundingBox())!;
    await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
    await expect(page.locator(".helptip-bubble")).toHaveText("Get Directions");
    await page.locator(".helptip-bubble").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    await page.screenshot({ path: `generated-artifacts/appointment-layering/${width}-help.png` });
    if (width > 640) {
      // A real scroll dismisses even focused help; reopening behind headings is
      // prohibited. Hit-testing proves the header, not the ticket, receives input.
      await page.locator(".appt-table").evaluate(el => { el.scrollTop += 100; });
      await expect(page.locator(".helptip-bubble")).toHaveCount(0);
      const layers = await page.locator(".appt-table").evaluate(el => {
        const head = el.querySelector(":scope >table>thead")!, r = head.querySelector("th.col-patient")!.getBoundingClientRect();
        const view = el.getBoundingClientRect();
        const hits = [];
        for (let x = view.left + 8; x < view.right - 8; x += 20) {
          const hit = document.elementFromPoint(x, r.top + r.height / 2);
          hits.push({ ok: !!hit?.closest("th"), hit: hit?.tagName, cls: hit?.className, x });
        }
        return {
          hits, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft,
          // Pinned/select cells retain their approved white surface; other
          // headings retain pale blue. Both must be fully opaque, never a wash.
          opaque: [...head.querySelectorAll("th")].every(th => {
            const color = getComputedStyle(th).backgroundColor;
            return /^rgb\(/.test(color) || /,\s*1\)$/.test(color);
          }),
          header: r.toJSON(), ticket: el.querySelector(".vt")!.getBoundingClientRect().toJSON(),
        };
      });
      expect(layers.hits.every(hit => hit.ok)).toBe(true);
      expect(layers.opaque).toBe(true);
      expect(layers.scrollTop).toBeGreaterThan(0);
      await page.screenshot({ path: `generated-artifacts/appointment-layering/${width}-scrolled.png` });
      await positionDirections(page);
      await directions.evaluate(el => { (el as HTMLElement).blur(); });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await directions.evaluate(el => (el as HTMLElement).focus({ preventScroll: true }));
      await expect(page.locator(".helptip-bubble")).toBeVisible();
      const horizontal = await page.locator(".appt-table").evaluate(el => {
        el.scrollLeft = el.scrollLeft ? 0 : el.scrollWidth;
        return el.scrollWidth > el.clientWidth;
      });
      if (width < 1440) expect(horizontal).toBe(true);
      if (horizontal) await expect(page.locator(".helptip-bubble")).toHaveCount(0);
      else await page.keyboard.press("Escape"); // The wide default view fits without horizontal scrolling.
      await page.screenshot({ path: `generated-artifacts/appointment-layering/${width}-horizontal.png` });
      await testInfo.attach("scroll-layers", { body: JSON.stringify(layers, null, 2), contentType: "application/json" });
      await mkdir("generated-artifacts/appointment-layering", { recursive: true });
      await writeFile(`generated-artifacts/appointment-layering/${width}-geometry.json`, JSON.stringify({ geometry, tooltip, layers }, null, 2));
      await page.locator(".appt-table").evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    }
    // Protected tabs remain operable, and portal dialogs/menus still escape the
    // expansion's local stacking context.
    await tab(page, "Details").click();
    await expect(page.getByTestId("button-copy-reference")).toBeVisible();
    await tab(page, "History").click();
    await expect(page.getByRole("table", { name: "Appointment history" })).toBeVisible();
    await tab(page, "Booking").click();
    await page.getByTestId("button-edit-booking").click();
    await expect(page.getByRole("dialog", { name: "Edit Booking Details" })).toBeVisible();
    await page.screenshot({ path: `generated-artifacts/appointment-layering/${width}-editor.png` });
    await page.getByTestId("button-cancel-booking").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("section-detail-ticket-column").screenshot({ path: `generated-artifacts/appointment-layering/${width}-ticket-and-status.png` });
    await page.getByTestId("menu-appointment-1").click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-expand-appointment-appointment-2").click();
    await expect(page.getByTestId("text-detail-ticket-unavailable")).toBeVisible();
    await expect(page.getByTestId("ticket-information")).toHaveCount(0);
  });
}

/** Reveal the anchor just below opaque sticky headings without Playwright's
 * auto-scroll changing the reproduction or hiding a horizontal overlap. */
async function positionDirections(page: Page) {
  await page.locator(".appt-table").evaluate(el => {
    el.scrollLeft = 0;
    const anchor = el.querySelector('[data-testid="button-get-directions"]')!.getBoundingClientRect();
    const head = el.querySelector(":scope >table>thead>tr>th.col-patient")!.getBoundingClientRect();
    el.scrollTop += anchor.top - head.bottom - 10;
  });
}

async function boundedHelpGeometry(page: Page) {
  return page.locator(".helptip-bubble").evaluate(el => {
    const tip = el.getBoundingClientRect();
    const region = document.querySelector("[data-tooltip-boundary]")!.getBoundingClientRect();
    const scroll = document.querySelector(".appt-table")!.getBoundingClientRect();
    const head = document.querySelector(".appt-table>table>thead>tr>th.col-patient")!;
    const top = getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().bottom : 0;
    return { tip: tip.toJSON(), region: region.toJSON(), scroll: scroll.toJSON(), top,
      inside: tip.top >= Math.max(0, region.top, scroll.top, top) && tip.bottom <= Math.min(innerHeight, region.bottom, scroll.bottom) && tip.left >= Math.max(0, region.left, scroll.left) && tip.right <= Math.min(innerWidth, region.right, scroll.right) };
  });
}

for (const width of [1366, 820, 390]) {
  test(`actual application tree retains appointment composition at ${width}px`, async ({ page }) => {
    test.setTimeout(30000);
    await page.setViewportSize({ width, height: 900 });
    await mount(page, "application");
    await page.getByTestId("button-expand-appointment-appointment-1").click();
    await expect(tab(page, "Booking")).toBeVisible();
    await expect(page.getByTestId("button-copy-reference")).toHaveCount(0);
    const ticket = (await page.getByTestId("section-detail-ticket").boundingBox())!;
    const info = (await page.getByTestId("ticket-information").boundingBox())!;
    expect(Math.abs(ticket.x - info.x)).toBeLessThan(1);
    expect(info.y - ticket.y - ticket.height).toBeLessThanOrEqual(16);
    await tab(page, "Details").click();
    await page.getByTestId("button-copy-reference").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.reference);
    await tab(page, "History").click();
    await expect(page.getByRole("table", { name: "Appointment history" }).locator("tbody tr")).toHaveCount(24);
    await page.screenshot({ path: `generated-artifacts/appointment-tabs/application-${width}-history.png`, fullPage: true });
  });
}

for (const width of [1366, 820, 390]) {
  test(`shared tab styles and heading treatment remain standard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page, "rows");
    await page.getByTestId("button-expand-appointment-appointment-1").click();
    const styleOf = (node: Element) => {
      const s = getComputedStyle(node);
      return Object.fromEntries(["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "color", "backgroundColor", "padding", "borderRadius", "minHeight", "gap", "outlineStyle", "outlineWidth", "outlineColor"].map(key => [key, s[key as keyof CSSStyleDeclaration]]));
    };
    for (const name of ["Booking", "Details", "History"]) {
      const shared = page.getByTestId("standard-tabs").getByRole("tab", { name, exact: true });
      const actual = tab(page, name);
      // Compare active, inactive, keyboard focus and icon geometry in the real cascade.
      await shared.click();
      await actual.click();
      await actual.evaluate(el => (el as HTMLElement).blur());
      await expect(actual).toHaveCSS("background-color", "rgb(233, 241, 255)");
      await expect(shared).toHaveCSS("background-color", "rgb(233, 241, 255)");
      expect(await actual.evaluate(styleOf)).toEqual(await shared.evaluate(styleOf));
      const inactiveName = name === "Booking" ? "Details" : "Booking";
      await expect(tab(page, inactiveName)).toHaveCSS("color", "rgb(86, 101, 125)");
      expect(await tab(page, inactiveName).evaluate(styleOf)).toEqual(await page.getByTestId("standard-tabs").getByRole("tab", { name: inactiveName, exact: true }).evaluate(styleOf));
      await page.keyboard.press("Tab");
      await actual.focus();
      const actualFocus = await actual.evaluate(styleOf);
      await shared.focus();
      expect(actualFocus).toEqual(await shared.evaluate(styleOf));
      expect(await actual.locator("svg").evaluate(el => el.getBoundingClientRect().width)).toBe(18);
    }
    await tab(page, "History").click();
    const head = page.getByRole("table", { name: "Appointment history" }).getByRole("columnheader").first();
    if (width > 1024) {
      const main = page.locator(".appt-table > table > thead > tr > th").first();
      expect(await head.evaluate(styleOf)).toEqual(await main.evaluate(styleOf));
    }
    await expect(head).toBeVisible();
    expect(await head.evaluate(el => getComputedStyle(el).position)).toBe("static");
    const geometry = await head.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
    expect(geometry.width).toBeGreaterThan(width <= 600 ? 20 : 50);
    expect(geometry.height).toBeGreaterThan(20);
    if (width <= 600) await expect(page.getByRole("table", { name: "Appointment history" }).locator('td[data-label="Date & time"]').first()).toBeVisible();
  });
}

test("Details reference failure feedback stays usable without a ticket", async ({ page }) => {
  await mount(page, "rows");
  await page.getByTestId("button-expand-appointment-appointment-2").click();
  await expect(page.getByTestId("appointment-details").getByTestId("button-copy-reference")).toHaveCount(0);
  await tab(page, "Details").click();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("Denied")) } }));
  await page.getByTestId("button-copy-reference").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("section-detail-additional").getByRole("alert")).toContainText("Select the reference");
  await expect(page.getByTestId("text-detail-reference")).toHaveText(second.reference);
});

test.describe("touch reference access", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("directions help stays bounded on touch and keeps its location action", async ({ page }) => {
    const state = await mount(page, "application");
    state.appointment.notes = "";
    await page.getByTestId("button-expand-appointment-appointment-1").tap();
    const directions = page.getByTestId("button-get-directions");
    await directions.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      (window as any).fixtureDirections = [];
      window.open = ((url: string) => { (window as any).fixtureDirections.push(url); return null; }) as typeof window.open;
    });
    await directions.tap();
    await expect(page.locator(".helptip-bubble")).toHaveText("Get Directions");
    expect((await boundedHelpGeometry(page)).inside).toBe(true);
    expect(await page.evaluate(() => (window as any).fixtureDirections)).toEqual([expect.stringContaining("Fictional")]);
    await page.screenshot({ path: "generated-artifacts/appointment-layering/390-touch-help.png" });
    await page.evaluate(() => window.scrollBy(0, 80));
    await expect(page.locator(".helptip-bubble")).toHaveCount(0);
  });

  test("missing directions retain accessible touch and keyboard help", async ({ page }) => {
    const state = await mount(page, "application");
    state.appointment.branchAddress = "";
    await page.getByTestId("button-expand-appointment-appointment-1").tap();
    const wrapper = page.getByTestId("button-get-directions").locator("..");
    await wrapper.scrollIntoViewIfNeeded();
    await wrapper.tap();
    await expect(page.locator(".helptip-bubble")).toContainText("no saved address");
    expect((await boundedHelpGeometry(page)).inside).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".helptip-bubble")).toHaveCount(0);
    await wrapper.blur();
    await wrapper.focus();
    await expect(page.locator(".helptip-bubble")).toContainText("no saved address");
    await expect(wrapper).toHaveAttribute("aria-describedby", /.+/);
  });

  test("token explains Details copying and Details is accessible without hover", async ({ page }) => {
    await mount(page, "rows");
    await page.getByTestId("text-token-appointment-1").tap();
    await expect(page.locator(".helptip-bubble")).toContainText("Details");
    if (!await details(page).isVisible()) await page.getByTestId("button-expand-appointment-appointment-1").tap();
    await tab(page, "Details").tap();
    await page.getByTestId("button-copy-reference").tap();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.reference);
  });
});

// Measure the shared cell, not a tab's own padding: every state must end at
// the same boundary, including failures that never mount AppointmentDetails.
async function expectExpansionBoundary(page: Page, id: string, final = false) {
  const expansion = page.getByTestId(`expansion-appointment-${id}`);
  const geometry = await expansion.locator(":scope > td").evaluate(cell => {
    const box = cell.getBoundingClientRect();
    const style = getComputedStyle(cell);
    const children = [...cell.children].filter(el => el.getClientRects().length);
    const contentBottom = Math.max(...children.map(el => el.getBoundingClientRect().bottom));
    const following = cell.parentElement!.nextElementSibling;
    return {
      clearance: box.bottom - contentBottom - parseFloat(style.borderBottomWidth),
      padding: parseFloat(style.paddingBottom),
      expectedPadding: parseFloat(style.getPropertyValue("--space-6")),
      border: style.borderBottomWidth,
      borderStyle: style.borderBottomStyle,
      borderColor: style.borderBottomColor,
      following: following?.classList.contains("appt-row") ?? false,
      overlap: following ? box.bottom - following.getBoundingClientRect().top : 0,
      last: cell.parentElement === cell.closest("tbody")!.lastElementChild,
    };
  });
  expect(geometry.padding).toBe(geometry.expectedPadding);
  expect(geometry.clearance).toBeGreaterThanOrEqual(geometry.expectedPadding - 1);
  expect(geometry.clearance).toBeLessThanOrEqual(geometry.expectedPadding + 1);
  expect(geometry.border).toBe("1px");
  expect(geometry.borderStyle).toBe("solid");
  expect(geometry.borderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.following).toBe(!final);
  expect(geometry.last).toBe(final);
  expect(geometry.overlap).toBeLessThanOrEqual(1);
  // The expansion remains a single spanning cell, never a spacer row.
  await expect(expansion.locator(":scope > td")).toHaveCount(1);
  await expect(page.locator(".appt-table > table > tbody > tr")).toHaveCount(3);
}

for (const surface of ["rows", "today"]) {
  for (const [size, width, scale] of [
    ["desktop", 1366, 1], ["tablet", 768, 1], ["phone", 390, 1],
    // 1280 physical pixels at 200% browser zoom = 640 CSS pixels.
    ["200%-equivalent", 640, 2],
  ] as const) {
    test.describe(`${surface} ${size} expansion boundary`, () => {
      test.use({ viewport: { width, height: 900 }, deviceScaleFactor: scale });
      test("all tabs, short/empty final content, loading and errors share a finished edge", async ({ page }) => {
        const state = await mount(page, surface);
        const following = page.getByTestId("appointment-appointment-2");
        const compactHeight = (await following.boundingBox())!.height;
        const expand = page.getByTestId("button-expand-appointment-appointment-1");
        await expand.focus();
        await expect(expand).toBeFocused();
        expect(await expand.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
        state.delay = 800;
        await page.keyboard.press("Enter");
        await expect(page.getByRole("status", { name: "Loading details" })).toBeVisible();
        await expectExpansionBoundary(page, "appointment-1");
        await expect(tab(page, "Booking")).toBeVisible();
        state.delay = 0;
        for (const name of ["Booking", "Details", "History"]) {
          await tab(page, name).focus();
          await page.keyboard.press("Enter");
          await expect(tab(page, name)).toBeFocused();
          await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
          expect(await tab(page, name).evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
          await expectExpansionBoundary(page, "appointment-1");
        }
        await expect(page.getByRole("table", { name: "Appointment history" }).locator("tbody tr")).toHaveCount(24);
        // Match the reported tight ending with a single short history event,
        // as well as the long history above.
        state.appointment.history = [{ action: "book", status: "booked", occurredAt: "2030-06-01T10:00:00Z", reason: "" }];
        await page.getByRole("button", { name: "Refresh fixture" }).click();
        await expect(page.getByRole("table", { name: "Appointment history" }).locator("tbody tr")).toHaveCount(1);
        await expectExpansionBoundary(page, "appointment-1");
        await page.screenshot({ path: `generated-artifacts/appointment-boundary/${surface}-${size}-history.png`, fullPage: true });
        state.failAppointment = true;
        await page.getByRole("button", { name: "Refresh fixture" }).click();
        await expect(page.getByRole("button", { name: "Retry History" })).toBeVisible();
        await expectExpansionBoundary(page, "appointment-1");
        await expand.focus();
        await page.keyboard.press("Space");
        await expect(page.locator(".appt-expansion")).toHaveCount(0);
        await expect(page.locator(".appt-table > table > tbody > tr")).toHaveCount(2);
        // Clear the cached authorized record to exercise an initial failure,
        // rather than only the cached-data refresh failure above.
        await page.reload();
        await expand.click();
        await expect(page.getByRole("button", { name: "Retry Details", exact: true })).toBeVisible();
        await expectExpansionBoundary(page, "appointment-1");
        state.failAppointment = false;
        await page.getByRole("button", { name: "Retry Details", exact: true }).click();
        await tab(page, "Booking").click();
        await expect(page.getByTestId("button-copy-reference")).toHaveCount(0);
        await tab(page, "Details").click();
        await page.getByTestId("button-copy-reference").click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.reference);
        expect((await following.boundingBox())!.height).toBe(compactHeight);
        if (width > 640) {
          const alignment = await page.locator(".appt-table").evaluate(scroll => {
            const headers = [...scroll.querySelectorAll(":scope > table > thead > tr > th")];
            const cells = [...scroll.querySelectorAll(":scope > table > tbody > tr.appt-row:first-child > td")];
            const aligned = headers.every((head, index) => Math.abs(head.getBoundingClientRect().left - cells[index].getBoundingClientRect().left) < 1);
            scroll.scrollLeft = scroll.scrollWidth;
            return { aligned, scrollable: scroll.scrollWidth > scroll.clientWidth, scrolled: scroll.scrollLeft > 0 };
          });
          expect(alignment.aligned).toBe(true);
          if (alignment.scrollable) expect(alignment.scrolled).toBe(true);
          await page.locator(".appt-table").evaluate(el => { el.scrollLeft = 0; });
        }
        // Completed appointments intentionally have no ticket actions.
        await page.getByTestId("menu-appointment-1").click();
        await expect(page.getByRole("menu")).toBeVisible();
        await page.keyboard.press("Escape");
        await page.getByTestId("button-expand-appointment-appointment-2").click();
        for (const name of ["Booking", "Details", "History"]) {
          await tab(page, name).click();
          await expectExpansionBoundary(page, "appointment-2", true);
        }
        await expect(details(page)).toContainText("Nothing to show.");
        await page.screenshot({ path: `generated-artifacts/appointment-boundary/${surface}-${size}-final.png`, fullPage: true });
      });
    });
  }
}

test("history waits for the authorized record rather than treating a list projection as empty", async ({ page }) => {
  await mount(page, "projection", false, { delay: 1800 });
  await tab(page, "History").click();
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
  await expect(row.getByRole("cell")).toHaveText(["01/06/2030, 10:00", "Waiting", "Status recorded", "Not recorded"]);
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
    await expect(page.getByTestId("button-copy-reference")).toHaveCount(0);
    await tab(page, "Details").click();
    await expect(page.getByTestId("section-detail-additional")).toContainText("Booking reference");
    await expect(page.getByTestId("button-copy-reference")).toBeVisible();
    const extra = page.locator('dl[aria-label="Hidden columns"]');
    for (const value of [first.patientName, first.patientCode, first.token, first.clinicName, first.branchName, first.doctorName]) await expect(extra).toContainText(value);
    await expect(extra).not.toContainText(first.reference);
    await expect(extra).not.toContainText("Booked At");
    await expect(page.getByTestId("section-detail-visit")).toBeVisible();
  });
}

test("history reasons wrap unbroken text while statuses come from each recorded event", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await mount(page, "rows");
  state.appointment.history = [{ action: "cancel", status: "cancelled", occurredAt: "2030-06-01T10:00:00Z", reason: "Unbroken".repeat(80) }];
  await page.getByTestId("button-expand-appointment-appointment-1").click();
  await tab(page, "History").click();
  const table = page.getByRole("table", { name: "Appointment history" });
  await expect(table.getByRole("columnheader")).toHaveText(["Date & time", "Status", "Details / remarks", "Changed by"]);
  await expect(table.locator("tbody tr")).toContainText("Cancelled");
  await expect(table.locator("tbody tr")).not.toContainText("Booked");
  const bounds = await table.evaluate(el => {
    const reason = el.querySelector("tbody td:nth-child(3)")!;
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
    await expect(page.locator(".helptip-bubble")).toContainText("Details");
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
    await tab(page, "Details").click();
    await expect(page.getByTestId("text-detail-reference")).toHaveText(first.reference);
    await tab(page, "Booking").click();
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
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("Patients ahead");
  await expect(page.getByTestId("text-ticket-estimate")).toContainText("Doctor is on break");
  await tab(page, "Booking").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Details")).toBeFocused();
  await expect(tab(page, "Details")).toHaveAttribute("aria-selected", "true");
  await page.getByTestId("button-copy-reference").click();
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first.reference);
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
  await expect(page.getByRole("table", { name: "Appointment history" }).getByRole("columnheader")).toHaveText(["Date & time", "Status", "Details / remarks", "Changed by"]);
  await expect(page.getByTestId("section-detail-history")).toContainText("Event 23:");
  await page.keyboard.press("Home");
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
});

test("different appointment resets tabs and copy feedback; completed record and empty history remain usable", async ({ page }) => {
  await mount(page);
  await tab(page, "Details").click();
  await page.getByTestId("button-copy-reference").click();
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copied");
  await tab(page, "History").click();
  await page.getByRole("button", { name: "Second appointment" }).click();
  await expect(tab(page, "Booking")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("text-detail-ticket-unavailable")).toContainText("booking reference");
  await expect(page.getByTestId("appointment-ticket")).toHaveCount(0);
  await tab(page, "Details").click();
  await expect(page.getByTestId("text-detail-reference")).toHaveText(second.reference);
  await expect(page.getByTestId("button-copy-reference")).toHaveText("Copy");
  await page.getByTestId("button-copy-reference").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(second.reference);
  await tab(page, "History").click();
  await expect(details(page).getByRole("heading", { name: "Nothing to show.", exact: true })).toBeVisible();
  await expect(details(page).getByRole("table")).toHaveCount(0);
  await expect(details(page).getByRole("columnheader")).toHaveCount(0);
  await tab(page, "Details").click();
  await expect(page.getByTestId("text-detail-checked-in")).not.toHaveText("Not recorded");
  await expect(page.getByTestId("text-detail-completed")).not.toHaveText("Not recorded");
  await page.getByRole("button", { name: "First appointment" }).click();
  await tab(page, "Details").click();
  await expect(page.getByTestId("text-detail-reference")).toHaveText(first.reference);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>(resolve => {
      (window as unknown as { finishCopy: () => void }).finishCopy = resolve;
    }) } });
  });
  await page.getByTestId("button-copy-reference").click();
  await page.getByRole("button", { name: "Second appointment" }).click();
  await tab(page, "Details").click();
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
  await expect(page.getByTestId("section-detail-additional")).toContainText(first.reference);
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
  await expect(details(page)).toContainText("Waiting estimates unavailable while offline or stale.");
  state.failQr = false; state.failQueue = false;
  await page.getByTestId("button-retry-appointment-qr").click();
  await page.getByRole("button", { name: "Refresh fixture", exact: true }).click();
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
  await expect(page.getByTestId("button-open-live-ticket")).toBeVisible();
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
