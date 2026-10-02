import { test, expect, type Page, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";

const qrUrl = "https://tickets.example.invalid/check-in/signed-private-fixture";
const guestSecret = "a".repeat(64);
const date = "2030-06-14";
const guest = {
  id: "guest-1", status: "confirmed", fullName: "Guest Patient", clinicName: "Fixture Clinic",
  branchName: "Fixture Branch", branchAddress: "21 Test Street", doctorName: "Dr Fixture",
  date, sessionId: "session-1", startTime: "09:00", endTime: "12:00", timezone: "UTC",
  token: "G-12", reason: null, appointmentId: "appointment-1", reference: "GUEST-123",
  appointmentStatus: "booked", revision: 1, checkInUrl: qrUrl,
};
const appointment = {
  id: "appointment-1", patientId: "patient-1", doctorId: "doctor-1", clinicId: "clinic-1",
  branchId: "branch-1", date, sessionId: "session-1", source: "patient",
  patientName: "Account Patient", clinicName: "Fixture Clinic", branchName: "Fixture Branch",
  branchAddress: "21 Test Street", doctorName: "Dr Fixture", startTime: "09:00",
  endTime: "12:00", timezone: "UTC", token: "A-12", reference: "ACCOUNT-123",
  revision: 1, status: "booked", allowedActions: [], history: [], createdAt: "2030-06-01T10:00:00Z",
};
const availability = [{
  sessionId: "session-1", doctorId: "doctor-1", clinicId: "clinic-1", branchId: "branch-1",
  date, available: true, startTime: "09:00", endTime: "12:00", timezone: "UTC",
  maxTokens: 30, bookedTokens: 1, remainingTokens: 29,
}];
type Mode = "guest" | "appointment";
type Reply = { status?: number; body?: unknown };
type Fixtures = {
  calls: string[];
  guestReads: number;
  appointmentReads: number;
  qrReads: number;
  mutateGuest: (index: number) => Reply;
  mutateAppointment: (index: number) => Reply;
  mutateQr: (index: number) => Reply;
};
function fixture(): Fixtures {
  return {
    calls: [], guestReads: 0, appointmentReads: 0, qrReads: 0,
    mutateGuest: () => ({ body: guest }),
    mutateAppointment: () => ({ body: appointment }),
    mutateQr: () => ({ body: { appointmentId: appointment.id, payload: "signed", checkInUrl: qrUrl } }),
  };
}
async function mount(page: Page, mode: Mode, f: Fixtures, recovered = false) {
  // All API calls are trapped on the browser boundary; no backend or credentials are contacted.
  await page.route("**/api/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    f.calls.push(`${req.method()} ${path}`);
    let reply: Reply;
    if (path === "/api/auth/csrf") {
      reply = { body: { csrfToken: "isolated-ticket-fixture-csrf" } };
    } else if (path === "/api/public/guest-receipt" && req.method() === "POST") {
      const body = req.postDataJSON();
      expect(body.receiptSecret).toBe(guestSecret);
      reply = f.mutateGuest(++f.guestReads);
    } else if (path === "/api/public/guest-requests" && req.method() === "POST") {
      const body = req.postDataJSON();
      expect(body.qrReference).toBe("fixture-qr");
      expect(body.receiptSecret).toMatch(/^[a-f0-9]{64}$/);
      reply = { body: guest };
    } else if (path === "/api/public/availability/sessions") {
      reply = { body: availability };
    } else if (path === `/api/appointments/${appointment.id}` && req.method() === "GET") {
      reply = f.mutateAppointment(++f.appointmentReads);
    } else if (path === `/api/appointments/${appointment.id}/qr` && req.method() === "GET") {
      reply = f.mutateQr(++f.qrReads);
    } else if (path === "/api/me") {
      reply = { body: { clerkId: "fixture-only", user: { role: "patient" }, needsOnboarding: false } };
    } else if (path === "/api/queue") {
      reply = { body: { doctorId: "doctor-1", branchId: "branch-1", date, entries: [] } };
    } else {
      reply = { status: 501, body: { message: `Unmocked API request: ${req.method()} ${path}` } };
    }
    await route.fulfill({ status: reply.status ?? 200, contentType: "application/json", body: JSON.stringify(reply.body) });
  });
  if (mode === "guest" && recovered) {
    await page.addInitScript(({ key, secret }) => {
      sessionStorage.setItem(key, JSON.stringify({
        qrReference: "fixture-qr", branchId: "branch-1", doctorId: "doctor-1",
        date: "2030-06-14", sessionId: "session-1", fullName: "Guest Patient",
        requestId: "recover-id", receiptSecret: secret,
      }));
      sessionStorage.setItem(`${key}:committed`, "recover-id");
    }, { key: "clinicflow-guest:fixture-qr", secret: guestSecret });
  }
  await page.goto(`/?mode=${mode}`);
  await expect(page.getByTestId(mode === "guest" ? "guest-ticket" : "appointment-ticket")).toBeVisible();
  await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
}
async function decode(page: Page, uri: string) {
  return page.evaluate((data) => window.decodeTicketQr(data), uri);
}
async function verifyScreen(page: Page, expected: { name: string; status: string; token: string; date?: string }) {
  const ticket = page.getByRole("article", { name: "Visit ticket" });
  await expect(ticket.locator(".vt-head-brand img")).toBeVisible();
  await expect(ticket.locator(".vt-head-brand")).toContainText("Visit ticket");
  await expect(ticket.locator(".vt-name")).toHaveText(expected.name);
  await expect(ticket.getByTestId("ticket-status")).toHaveText(expected.status);
  await expect(ticket.getByTestId("ticket-waiting-number")).toHaveText(expected.token);
  if (expected.date) await expect(ticket.locator("dd")).toContainText([expected.date]);
  await expect(ticket.getByText("09:00 – 12:00 (UTC)")).toBeVisible();
  const source = await ticket.getByAltText("Personal visit QR").getAttribute("src");
  expect(source).toMatch(/^data:image\/png;base64,/);
  expect(await decode(page, source!)).toBe(qrUrl);
  const logo = ticket.locator(".vt-head-brand img");
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1529, 778]);
}
async function download(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByTestId("button-download-ticket").click();
  const item = await event;
  expect(item.suggestedFilename()).toMatch(/^clinicflow-ticket-.*\.html$/);
  return readFile(await item.path(), "utf8");
}
async function verifyHtml(page: Page, html: string, expected: { name: string; status: string; token: string; date?: string }) {
  const dom = new DOMParserShim(html);
  expect(html).toContain("DigiQ Doctors");
  expect(html).toContain(`>${expected.name}</h2>`);
  expect(html).toContain(`>${expected.status}</strong>`);
  expect(html).toContain(`class="n">${expected.token}</div>`);
  if (expected.date) expect(html).toContain(expected.date);
  expect(html).toContain("09:00 – 12:00 (UTC)");
  expect(html).not.toMatch(/<script\b|<link\b|<iframe\b/i);
  const image = dom.image();
  expect(image).toMatch(/^data:image\/png;base64,/);
  expect(await decode(page, image!)).toBe(qrUrl);
  expect(dom.logo()).toMatch(/^data:image\/png;base64,/);
  // Loading the exported document without a network proves the embedded image works offline.
  const offline = await page.context().newPage();
  try {
    await offline.context().setOffline(true);
    await offline.setContent(html);
    await expect(offline.getByAltText("Personal visit QR")).toBeVisible();
    expect(await offline.getByAltText("Personal visit QR").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await offline.getByAltText("DigiQ Doctors logo").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect.poll(() => offline.getByAltText("DigiQ Doctors logo").evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1529, 778]);
  } finally {
    await offline.context().setOffline(false);
    await offline.close();
  }
}
class DOMParserShim {
  constructor(private html: string) {}
  image() { return this.html.match(/<img class="qr" src="([^"]+)" alt="Personal visit QR">/)?.[1] ?? null; }
  logo() { return this.html.match(/<img src="([^"]+)" alt="DigiQ Doctors logo"/)?.[1] ?? null; }
}
async function interceptPrint(page: Page, blocked = false) {
  await page.evaluate((deny) => {
    const native = window.open.bind(window);
    const parent = window as Window & { printCount?: number; printImages?: { complete: boolean; naturalWidth: number; src: string; alt: string }[][] };
    parent.printCount = 0;
    parent.printImages = [];
    window.open = (...args) => {
      if (deny) return null;
      // Open in the original click stack to preserve popup permission. Override only
      // the child print method synchronously; never accept/dismiss native dialogs.
      const child = native(...args);
      if (child) child.print = () => {
        parent.printImages!.push(Array.from(child.document.images as HTMLCollectionOf<HTMLImageElement>, (img: HTMLImageElement) => ({
          complete: img.complete, naturalWidth: img.naturalWidth, src: img.src, alt: img.alt,
        })));
        parent.printCount!++;
      };
      return child;
    };
  }, blocked);
}
async function print(page: Page, inspect?: (popup: Page) => Promise<void>) {
  const event = page.waitForEvent("popup");
  await page.getByTestId("button-print-ticket").click();
  const popup = await event;
  await expect.poll(() => page.evaluate(() => (window as Window & { printCount?: number }).printCount)).toBe(1);
  const images = await page.evaluate(() => (window as Window & { printImages?: { complete: boolean; naturalWidth: number; src: string; alt: string }[][] }).printImages);
  expect(images).toHaveLength(1);
  expect(images![0]).toHaveLength(2);
  const logo = images![0].find(img => img.alt === "DigiQ Doctors logo");
  const qr = images![0].find(img => img.alt === "Personal visit QR");
  expect(logo?.src).toMatch(/^data:image\/png;base64,/);
  expect(logo?.complete).toBe(true);
  expect(logo?.naturalWidth).toBeGreaterThan(0);
  expect(qr?.complete).toBe(true);
  expect(qr?.naturalWidth).toBeGreaterThan(0);
  expect(await decode(page, qr!.src)).toBe(qrUrl);
  const html = await popup.content();
  try {
    if (inspect) await inspect(popup);
  } finally {
    await popup.close();
  }
  return html;
}
function assertFreshOrder(f: Fixtures, mode: Mode) {
  const path = mode === "guest" ? "/api/public/guest-receipt" : `/api/appointments/${appointment.id}`;
  const calls = f.calls.filter(c => c.endsWith(path) || c.endsWith(`${path}/qr`));
  if (mode === "guest") {
    expect(calls.slice(0, 2)).toEqual([`POST ${path}`, `POST ${path}`]);
  } else {
    // A successful export also triggers a background query refetch after the
    // confirmation read; inspect the ordered contiguous preparation sequence.
    expect(calls.slice(0, 3)).toEqual([`GET ${path}`, `GET ${path}/qr`, `GET ${path}`]);
  }
}

for (const mode of ["guest", "appointment"] as const) {
  for (const kind of ["download", "print"] as const) {
    test(`${mode} recovery/current export: ${kind} embeds fresh details and signed QR`, async ({ page }) => {
      const f = fixture();
      if (mode === "guest") f.mutateGuest = n => ({ body: n === 1 ? guest : { ...guest, fullName: "Current Guest", token: "G-99", revision: 2 } });
      else f.mutateAppointment = n => ({ body: n === 1 ? appointment : { ...appointment, patientName: "Current Account", token: "A-99", revision: 2 } });
      await mount(page, mode, f, true);
      const old = { name: mode === "guest" ? guest.fullName : appointment.patientName, status: "Booked", token: mode === "guest" ? guest.token : appointment.token };
      await verifyScreen(page, old);
      const current = { name: mode === "guest" ? "Current Guest" : "Current Account", status: "Booked", token: mode === "guest" ? "G-99" : "A-99", date };
      if (kind === "print") await interceptPrint(page);
      f.calls.length = 0;
      const html = kind === "download" ? await download(page) : await print(page);
      assertFreshOrder(f, mode);
      await verifyHtml(page, html, current);
    });
  }

  for (const kind of ["download", "print"] as const) {
    test(`${mode} rejects changing revision during ${kind}`, async ({ page }) => {
      const f = fixture();
      if (mode === "guest") f.mutateGuest = n => ({ body: { ...guest, revision: n === 3 ? 3 : 2 } });
      else f.mutateAppointment = n => ({ body: { ...appointment, revision: n === 3 ? 3 : 2 } });
      await mount(page, mode, f, true);
      if (kind === "print") await interceptPrint(page);
      const downloads: string[] = [];
      page.on("download", d => downloads.push(d.suggestedFilename()));
      f.calls.length = 0;
      await page.getByTestId(`button-${kind}-ticket`).click();
      await expect(page.getByTestId("ticket-export-error")).toContainText(/changed while preparing/);
      assertFreshOrder(f, mode);
      expect(downloads).toEqual([]);
      if (kind === "print") expect(await page.evaluate(() => (window as Window & { printCount?: number }).printCount)).toBe(0);
    });
  }

  test(`${mode} cancelled and rescheduled details are current in both exports`, async ({ page }) => {
    const f = fixture();
    if (mode === "guest") f.mutateGuest = n => ({ body: n === 1 ? guest : { ...guest, appointmentStatus: "cancelled", date: "2030-06-21", startTime: "14:00", endTime: "16:00", token: "G-71", revision: 5 } });
    else f.mutateAppointment = n => ({ body: n === 1 ? appointment : { ...appointment, status: "cancelled", date: "2030-06-21", startTime: "14:00", endTime: "16:00", token: "A-71", revision: 5 } });
    await mount(page, mode, f, true);
    f.calls.length = 0;
    const exported = await download(page);
    expect(exported).toContain("Cancelled");
    expect(exported).toContain("2030-06-21");
    expect(exported).toContain("14:00 – 16:00");
    assertFreshOrder(f, mode);
    await interceptPrint(page);
    await expect(page.getByTestId("button-print-ticket")).toBeEnabled();
    f.calls.length = 0;
    const printed = await print(page);
    expect(printed).toContain("Cancelled");
    expect(printed).toContain("2030-06-21");
    expect(printed).toContain("14:00 – 16:00");
    assertFreshOrder(f, mode);
  });

  test(`${mode} API failure prevents export and blocked popup explains recovery`, async ({ page }) => {
    const f = fixture();
    await mount(page, mode, f, true);
    if (mode === "guest") f.mutateGuest = () => ({ status: 503, body: { message: "Fixture outage" } });
    else f.mutateAppointment = () => ({ status: 503, body: { message: "Fixture outage" } });
    f.calls.length = 0;
    await page.getByTestId("button-download-ticket").click();
    await expect(page.getByTestId("ticket-export-error")).toBeVisible();
    expect(f.calls.filter(c => c.endsWith(mode === "guest" ? "/api/public/guest-receipt" : "/api/appointments/appointment-1")).length).toBe(1);
    await interceptPrint(page, true);
    await page.getByTestId("button-print-ticket").click();
    await expect(page.getByTestId("ticket-export-error")).toContainText("Allow pop-ups");
  });

  test(`${mode} missing personal QR is not exported`, async ({ page }) => {
    const f = fixture();
    await mount(page, mode, f, true);
    if (mode === "guest") f.mutateGuest = () => ({ body: { ...guest, checkInUrl: null } });
    else f.mutateQr = () => ({ body: { appointmentId: appointment.id, payload: "", checkInUrl: "" } });
    await page.getByTestId("button-download-ticket").click();
    await expect(page.getByTestId("ticket-export-error")).toContainText(/QR.*not available|QR unavailable/);
  });
}

test("guest recovery API error warns and refresh can restore ticket", async ({ page }) => {
  const f = fixture();
  f.mutateGuest = n => n === 1
    ? { status: 503, body: { message: "Receipt temporarily unavailable" } }
    : { body: guest };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/csrf") {
      await route.fulfill({ json: { csrfToken: "isolated-ticket-fixture-csrf" } });
      return;
    }
    if (path === "/api/public/availability/sessions") {
      await route.fulfill({ json: availability });
      return;
    }
    if (path !== "/api/public/guest-receipt") throw new Error(`Unexpected call ${path}`);
    const reply = f.mutateGuest(++f.guestReads);
    await route.fulfill({ status: reply.status ?? 200, json: reply.body });
  });
  await page.addInitScript(secret => {
    sessionStorage.setItem("clinicflow-guest:fixture-qr", JSON.stringify({
      qrReference: "fixture-qr", branchId: "branch-1", doctorId: "doctor-1",
      date: "2030-06-14", fullName: "Guest Patient", requestId: "recovery", receiptSecret: secret,
    }));
    sessionStorage.setItem("clinicflow-guest:fixture-qr:committed", "recovery");
  }, guestSecret);
  await page.goto("/?mode=guest");
  await expect(page.getByRole("alert")).toContainText(["We could not refresh your ticket"]);
  await expect(page.getByTestId("guest-ticket")).toHaveCount(0);
  await page.getByTestId("button-refresh-guest").click();
  await expect(page.getByTestId("guest-ticket")).toBeVisible();
  expect(f.guestReads).toBe(2);
});

test("appointment missing initial QR disables exports until API retry", async ({ page }) => {
  const f = fixture();
  f.mutateQr = n => n === 1
    ? { status: 503, body: { message: "QR service unavailable" } }
    : { body: { appointmentId: appointment.id, payload: "signed", checkInUrl: qrUrl } };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = path === "/api/appointments/appointment-1" ? f.mutateAppointment(++f.appointmentReads)
      : path === "/api/appointments/appointment-1/qr" ? f.mutateQr(++f.qrReads)
      : path === "/api/me" ? { body: { clerkId: "fixture", user: { role: "patient" }, needsOnboarding: false } }
      : path === "/api/queue" ? { body: { doctorId: "doctor-1", branchId: "branch-1", date } }
      : { status: 501, body: { message: `Unmocked ${path}` } };
    await route.fulfill({ status: reply.status ?? 200, json: reply.body });
  });
  await page.goto("/?mode=appointment");
  await expect(page.getByTestId("button-download-ticket")).toBeDisabled();
  await expect(page.getByTestId("button-retry-appointment-qr")).toBeVisible();
  await page.getByTestId("button-retry-appointment-qr").click();
  await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
  await verifyScreen(page, { name: "Account Patient", token: "A-12", status: "Booked" });
});

test("guest immediate creation commits recoverable receipt without account", async ({ page }) => {
  const f = fixture();
  await page.route("**/api/auth/csrf", route =>
    route.fulfill({ json: { csrfToken: "isolated-ticket-fixture-csrf" } }));
  await page.route("**/api/public/guest-requests", async route => {
    const request = route.request().postDataJSON();
    expect(request.receiptSecret).toMatch(/^[a-f0-9]{64}$/);
    expect(request.fullName).toBe("Walk-in Guest");
    f.calls.push("POST /api/public/guest-requests");
    await route.fulfill({ json: { ...guest, fullName: "Walk-in Guest" } });
  });
  await page.route("**/api/public/availability/sessions?**", route => route.fulfill({ json: availability }));
  await page.route("**/api/public/guest-receipt", route => {
    f.calls.push("POST /api/public/guest-receipt");
    return route.fulfill({ json: { ...guest, fullName: "Walk-in Guest" } });
  });
  await page.goto("/?mode=guest");
  await page.getByTestId("input-guest-date").fill(date);
  await page.getByTestId("input-guest-name").fill("Walk-in Guest");
  await page.getByTestId("input-guest-permission").check();
  await expect(page.getByTestId("button-submit-guest")).toBeEnabled();
  await page.getByTestId("button-submit-guest").click();
  await expect(page.getByTestId("guest-ticket")).toBeVisible();
  await verifyScreen(page, { name: "Walk-in Guest", token: "G-12", status: "Booked" });
  const saved = await page.evaluate(() => [sessionStorage.getItem("clinicflow-guest:fixture-qr"), sessionStorage.getItem("clinicflow-guest:fixture-qr:committed")]);
  expect(JSON.parse(saved[0]!).requestId).toBe(saved[1]);
  expect(f.calls).toContain("POST /api/public/guest-requests");
  const html = await download(page);
  expect(html).toContain("Walk-in Guest");
  expect(f.calls.slice(-2)).toEqual(["POST /api/public/guest-receipt", "POST /api/public/guest-receipt"]);
});

async function assertExportNotClipped(page: Page) {
  const dimensions = await page.evaluate(() => {
    const body = document.querySelector(".b")!;
    const h2 = body.querySelector("h2")!;
    const table = body.querySelector("table")!;
    return {
      viewport: innerWidth, document: document.documentElement.scrollWidth,
      name: { scroll: h2.scrollWidth, width: h2.clientWidth },
      table: { scroll: table.scrollWidth, width: table.clientWidth },
      tableRight: table.getBoundingClientRect().right,
      bodyRight: body.getBoundingClientRect().right,
    };
  });
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.name.scroll).toBeLessThanOrEqual(dimensions.name.width);
  expect(dimensions.table.scroll).toBeLessThanOrEqual(dimensions.table.width);
  expect(dimensions.tableRight).toBeLessThanOrEqual(dimensions.bodyRight);
}

for (const mode of ["guest", "appointment"] as const) {
  for (const kind of ["download", "print"] as const) {
  test(`${mode} hostile long name stays readable in narrow ${kind} HTML`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const f = fixture();
    const name = `<script>alert("x")</script>` + "VeryLongUnbrokenPatientName".repeat(5);
    if (mode === "guest") f.mutateGuest = () => ({ body: { ...guest, fullName: name } });
    else f.mutateAppointment = () => ({ body: { ...appointment, patientName: name } });
    await mount(page, mode, f, true);
    await expect(page.getByTestId(mode === "guest" ? "guest-ticket" : "appointment-ticket").locator(".vt-name")).toHaveText(name);
    const width = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(width.body).toBeLessThanOrEqual(width.viewport);
    if (kind === "print") await interceptPrint(page);
    const html = kind === "download" ? await download(page) : await print(page, async popup => {
      await popup.setViewportSize({ width: 320, height: 800 });
      await assertExportNotClipped(popup);
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("VeryLongUnbrokenPatientName");
    if (kind === "download") {
      const offline = await page.context().newPage();
      await offline.setViewportSize({ width: 320, height: 800 });
      try {
        await offline.setContent(html);
        await assertExportNotClipped(offline);
      } finally {
        await offline.close();
      }
    }
  });
  }
}

for (const kind of ["download", "print"] as const) {
  test(`bulk ${kind} embeds the complete logo and private QR`, async ({ page }) => {
    const f = fixture();
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      f.calls.push(path);
      const reply = path === "/api/appointments/appointment-1"
        ? f.mutateAppointment(++f.appointmentReads)
        : path === "/api/appointments/appointment-1/qr"
          ? f.mutateQr(++f.qrReads)
          : { status: 501, body: { message: `Unmocked ${path}` } };
      await route.fulfill({ status: reply.status ?? 200, json: reply.body });
    });
    await page.goto("/?mode=bulk");
    let html: string;
    if (kind === "download") {
      const event = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download QR tickets" }).click();
      const item = await event;
      expect(item.suggestedFilename()).toBe("private-appointment-tickets.html");
      html = await readFile(await item.path(), "utf8");
    } else {
      await interceptPrint(page);
      const event = page.waitForEvent("popup");
      await page.getByRole("button", { name: "Print QR tickets" }).click();
      const popup = await event;
      await expect.poll(() => page.evaluate(() => (window as Window & { printCount?: number }).printCount)).toBe(1);
      html = await popup.content();
      await popup.close();
    }
    expect(f.calls).toEqual(["/api/appointments/appointment-1", "/api/appointments/appointment-1/qr"]);
    expect(html).toContain("Private appointment ticket");
    expect(html).toContain("Account Patient");
    expect(html).not.toMatch(/<script\b|<link\b|<iframe\b/i);
    const offline = await page.context().newPage();
    try {
      await offline.context().setOffline(true);
      await offline.setContent(html);
      const logo = offline.getByAltText("DigiQ Doctors logo");
      const qr = offline.getByAltText("Private appointment QR");
      expect(await logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
      await expect.poll(() => logo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1529, 778]);
      const src = await qr.getAttribute("src");
      expect(src).toMatch(/^data:image\/png;base64,/);
      expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await decode(page, src!)).toBe(qrUrl);
    } finally {
      await offline.context().setOffline(false);
      await offline.close();
    }
  });
}