import { test, expect, type Page, type Route } from "@playwright/test";
import { readFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
async function verifyScreen(page: Page, expected: { name: string; status: string; token: string; date?: string; session?: string }) {
  const ticket = page.getByRole("article", { name: "Visit ticket" });
  await expect(ticket.locator(".vt-head-brand img")).toBeVisible();
  await expect(ticket.locator(".vt-head-brand")).toContainText("Visit Ticket");
  await expect(ticket.locator(".vt-name")).toHaveText(expected.name);
  await expect(ticket.getByTestId("ticket-status")).toHaveText(expected.status);
  await expect(ticket.getByTestId("ticket-waiting-number")).toHaveText(expected.token);
  await expect(ticket.locator(".vt-visit strong")).toContainText(expected.date ?? "14 Jun 2030");
  await expect(ticket.getByText(expected.session ?? "9:00 AM – 12:00 PM (UTC)", { exact: false })).toBeVisible();
  const source = await ticket.getByAltText("Personal visit QR").getAttribute("src");
  expect(source).toMatch(/^data:image\/png;base64,/);
  expect(await decode(page, source!)).toBe(qrUrl);
  const logo = ticket.locator(".vt-head-brand img");
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1529, 778]);
}
async function download(page: Page, format: "ticket" | "a4" = "ticket") {
  const event = page.waitForEvent("download");
  await page.getByTestId(format === "a4" ? "button-download-ticket-a4" : "button-download-ticket").click();
  const item = await event;
  expect(item.suggestedFilename()).toMatch(/^clinicflow-ticket-.*\.pdf$/);
  return readPdf(await item.path());
}
type Pdf = { bytes: Buffer; pages: number; images: string[]; width: number; height: number; dimensions: { width: number; height: number }[] };
/** Inspect the actual downloaded bytes, not source markup or the pre-export canvas. */
async function readPdf(file: string): Promise<Pdf> {
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(bytes.subarray(-1024).toString("latin1")).toContain("%%EOF");
  const info = execFileSync("pdfinfo", [file], { encoding: "utf8" });
  const pages = Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
  const size = /Page size:\s+([\d.]+) x ([\d.]+) pts/.exec(info);
  expect(size, info).not.toBeNull();
  const pageInfo = execFileSync("pdfinfo", ["-f", "1", "-l", String(pages), file], { encoding: "utf8" });
  const dimensions = Array.from(pageInfo.matchAll(/Page\s+\d+ size:\s+([\d.]+) x ([\d.]+) pts/g),
    match => ({ width: Number(match[1]) * 25.4 / 72, height: Number(match[2]) * 25.4 / 72 }));
  expect(dimensions).toHaveLength(pages);
  const imageInfo = execFileSync("pdfimages", ["-list", file], { encoding: "utf8" });
  // JPEG/JPEG2000 can look similar while damaging the QR edges; keep exports lossless.
  expect(imageInfo).not.toMatch(/\b(jpeg|jpx|jp2)\b/i);
  const dir = await mkdtemp(join(tmpdir(), "ticket-pdf-"));
  try {
    execFileSync("pdftoppm", ["-r", "300", "-png", file, join(dir, "p")]);
    const names = (await readdir(dir)).filter(n => n.endsWith(".png")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const images = await Promise.all(names.map(async n => `data:image/png;base64,${(await readFile(join(dir, n))).toString("base64")}`));
    expect(images).toHaveLength(pages);
    return { bytes, pages, images, dimensions, width: Number(size![1]) * 25.4 / 72, height: Number(size![2]) * 25.4 / 72 };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
/** The rendered PDF page must carry a scannable private QR (decoded in the harness page via jsQR). */
async function verifyPdf(page: Page, pdf: Pdf, pages = 1, format: "ticket" | "a4" = "ticket") {
  expect(pdf.pages).toBe(pages);
  expect(pdf.width).toBeCloseTo(format === "a4" ? 210 : 105, 1);
  if (format === "a4") expect(pdf.height).toBeCloseTo(297, 1);
  else {
    expect(pdf.height).toBeGreaterThan(80);
    expect(pdf.height).toBeLessThan(400);
  }
  expect(pdf.bytes.length).toBeGreaterThan(10_000);
  expect(pdf.bytes.length).toBeLessThan(750_000 * pages);
  for (const image of pdf.images) expect(await decode(page, image)).toBe(qrUrl);
}
async function verifyHtml(page: Page, html: string, expected: { name: string; status: string; token: string; date?: string; session?: string }) {
  const dom = new DOMParserShim(html);
  expect(html).toContain("DigiQ Doctors");
  expect(html).toContain(`class="p">${expected.name}</p>`);
  expect(html).toContain(`class="s">${expected.status}</span>`);
  expect(html).toContain(`class="n">${expected.token}</p>`);
  expect(html).toContain(expected.date ?? "14 Jun 2030");
  expect(html).toContain(expected.session ?? "9:00 AM – 12:00 PM (UTC)");
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
  image() { return this.html.match(/<img src="([^"]+)" alt="Personal visit QR">/)?.[1] ?? null; }
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
  for (const format of ["ticket", "a4"] as const) {
    test(`${mode} ${format} PDF preserves long Unicode content and stays compact`, async ({ page }, testInfo) => {
      const f = fixture();
      // Fictional, deterministic and deliberately mixed with HTML-sensitive characters.
      // Accented Latin and Greek use the fixture browser's bundled system fonts.
      const name = "Zoë Élise García — Δοκιμή & <Fictional> " + "LongUnbrokenPatientName".repeat(3);
      const fields = {
        clinicName: "Clinique Lumière — Fictional Healthcare Centre",
        branchName: "North Campus — Département Ω",
        branchAddress: "123 Fictional Avenue, Building Étoile, Floor 12, " + "LongAddressSegment".repeat(3),
        doctorName: "Dr Renée Müller — Ω",
      };
      f.mutateGuest = () => ({ body: { ...guest, ...fields, fullName: name } });
      f.mutateAppointment = () => ({ body: { ...appointment, ...fields, patientName: name } });
      await mount(page, mode, f, true);
      f.calls.length = 0;
      const pdf = await download(page, format);
      assertFreshOrder(f, mode);
      await verifyPdf(page, pdf, 1, format);
      await testInfo.attach("export.pdf", { body: pdf.bytes, contentType: "application/pdf" });
      await testInfo.attach("pdf-metrics.json", {
        body: JSON.stringify({ bytes: pdf.bytes.length, pages: pdf.pages, widthMm: pdf.width, heightMm: pdf.height }),
        contentType: "application/json",
      });
      // Rasterised exports contain no searchable text. Compare the rendered PDF,
      // including the final address/doctor/footer, to a visually reviewed reference.
      // Tight tolerance catches missing glyphs, clipping, blank pages and scaling changes.
      expect(Buffer.from(pdf.images[0].split(",")[1], "base64")).toMatchSnapshot(
        `${mode}-${format}-unicode.png`, { maxDiffPixels: 100, threshold: 0.1 },
      );
    });
  }
  for (const kind of ["download", "print"] as const) {
    test(`${mode} recovery/current export: ${kind} embeds fresh details and signed QR`, async ({ page }) => {
      const f = fixture();
      if (mode === "guest") f.mutateGuest = n => ({ body: n === 1 ? guest : { ...guest, fullName: "Current Guest", token: "G-99", revision: 2 } });
      else f.mutateAppointment = n => ({ body: n === 1 ? appointment : { ...appointment, patientName: "Current Account", token: "A-99", revision: 2 } });
      await mount(page, mode, f, true);
      const old = { name: mode === "guest" ? guest.fullName : appointment.patientName, status: "Booked", token: mode === "guest" ? guest.token : appointment.token };
      await verifyScreen(page, old);
      const current = { name: mode === "guest" ? "Current Guest" : "Current Account", status: "Booked", token: mode === "guest" ? "G-99" : "A-99", date: "14 Jun 2030" };
      if (kind === "print") await interceptPrint(page);
      f.calls.length = 0;
      if (kind === "download") { const pdf = await download(page); assertFreshOrder(f, mode); await verifyPdf(page, pdf); return; }
      const html = await print(page);
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
    await verifyPdf(page, await download(page));
    assertFreshOrder(f, mode);
    await interceptPrint(page);
    await expect(page.getByTestId("button-print-ticket")).toBeEnabled();
    f.calls.length = 0;
    const printed = await print(page);
    expect(printed).toContain("Cancelled");
    expect(printed).toContain("21 Jun 2030");
    expect(printed).toContain("2:00 PM – 4:00 PM");
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

test("different clinics retain their own date and clock preferences on screen and in exported tickets", async ({ page }) => {
  const european = fixture();
  european.mutateAppointment = () => ({ body: { ...appointment, clinicName: "European Format Clinic", dateFormat: "DD/MM/YYYY", timeFormat: "24h" } });
  await mount(page, "appointment", european);
  const europeanExpected = { name: "Account Patient", status: "Booked", token: "A-12", date: "14/06/2030", session: "09:00 – 12:00 (UTC)" };
  await verifyScreen(page, europeanExpected);

  const other = await page.context().newPage();
  try {
    const american = fixture();
    american.mutateGuest = () => ({ body: { ...guest, clinicName: "American Format Clinic", dateFormat: "MM/DD/YYYY", timeFormat: "12h" } });
    await mount(other, "guest", american, true);
    const americanExpected = { name: "Guest Patient", status: "Booked", token: "G-12", date: "06/14/2030", session: "9:00 AM – 12:00 PM (UTC)" };
    await verifyScreen(other, americanExpected);
    // Opening a second clinic must not replace the first record's preferences.
    await verifyScreen(page, europeanExpected);
    await verifyPdf(page, await download(page));
    await interceptPrint(other);
    await verifyHtml(other, await print(other), americanExpected);
  } finally {
    await other.close();
  }
});

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
  // The fixture QR context configures DD/MM/YYYY; type the visible clinic format.
  await page.getByTestId("input-guest-date").fill("14/06/2030");
  await expect(page.getByTestId("input-guest-date")).toHaveValue("14/06/2030");
  await expect(page.getByTestId("input-guest-date")).not.toHaveAttribute("aria-invalid", "true");
  await page.getByTestId("button-guest-continue-visit").click();
  await page.getByTestId("input-guest-name").fill("Walk-in Guest");
  await page.getByTestId("input-guest-permission").check();
  await page.getByTestId("button-guest-continue-patient").click();
  await expect(page.getByTestId("button-submit-guest")).toBeEnabled();
  await page.getByTestId("button-submit-guest").click();
  await expect(page.getByTestId("guest-ticket")).toBeVisible();
  await verifyScreen(page, { name: "Walk-in Guest", token: "G-12", status: "Booked" });
  const saved = await page.evaluate(() => [sessionStorage.getItem("clinicflow-guest:fixture-qr"), sessionStorage.getItem("clinicflow-guest:fixture-qr:committed")]);
  expect(JSON.parse(saved[0]!).requestId).toBe(saved[1]);
  expect(f.calls).toContain("POST /api/public/guest-requests");
  await verifyPdf(page, await download(page));
  expect(f.calls.slice(-2)).toEqual(["POST /api/public/guest-receipt", "POST /api/public/guest-receipt"]);
});

async function assertExportNotClipped(page: Page) {
  const dimensions = await page.evaluate(() => {
    const body = document.querySelector(".b")!;
    const h2 = body.querySelector(".p")!;
    const table = body.querySelector("dl")!;
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
    if (kind === "download") { await verifyPdf(page, await download(page)); return; }
    const html = await print(page, async popup => {
      await popup.setViewportSize({ width: 320, height: 800 });
      await assertExportNotClipped(popup);
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("VeryLongUnbrokenPatientName");
  });
  }
}

// Intentionally not ID-sorted: the PDF must retain selection order.
const bulkAppointments = [3, 1, 2].map(n => ({
  ...appointment, id: `appointment-${n}`, patientId: `patient-${n}`,
  patientName: ["Fictional Alice Cedar", "Fictional Bruno Maple", "Fictional Cara Willow"][n - 1],
  reference: `BULK-00${n}`, token: `B-${n}0`,
  checkInUrl: `https://tickets.example.invalid/check-in/signed-bulk-${n}`,
}));
type QrFailure = "outage" | "unavailable" | "mismatch";
async function mountBulk(page: Page, state: { failure?: QrFailure } = {}) {
  const calls: string[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    const a = bulkAppointments.find(a => path === `/api/appointments/${a.id}` || path === `/api/appointments/${a.id}/qr`);
    if (route.request().method() !== "GET" || !a) {
      await route.fulfill({ status: 501, json: { message: `Unmocked ${path}` } });
      throw new Error(`Unmocked bulk API request: ${path}`);
    }
    const isQr = path.endsWith("/qr");
    // Fail the middle ticket only, after a good ticket has already been prepared.
    if (isQr && a.id === bulkAppointments[1].id && state.failure === "outage") {
      await route.fulfill({ status: 503, json: { message: "Fictional QR outage" } });
      return;
    }
    await route.fulfill({ json: isQr ? {
      appointmentId: a.id === bulkAppointments[1].id && state.failure === "mismatch" ? bulkAppointments[0].id : a.id,
      payload: "fictional-signed",
      checkInUrl: a.id === bulkAppointments[1].id && state.failure === "unavailable" ? "" : a.checkInUrl,
    } : a });
  });
  await page.goto("/?mode=bulk");
  await expect(page.getByTestId("text-bulk-count")).toHaveText("3 selected");
  return calls;
}
const bulkCalls = bulkAppointments.flatMap(a => [`/api/appointments/${a.id}`, `/api/appointments/${a.id}/qr`]);
async function clickBulkDownload(page: Page) {
  await page.getByTestId("menu-bulk-more").click();
  await page.getByRole("menuitem", { name: "Download Tickets PDF" }).click();
}
async function verifyBulkPdf(page: Page, pdf: Pdf) {
  expect(pdf.pages).toBe(bulkAppointments.length);
  expect(pdf.bytes.length).toBeGreaterThan(10_000 * bulkAppointments.length);
  expect(pdf.bytes.length).toBeLessThan(750_000 * bulkAppointments.length);
  for (const [i, a] of bulkAppointments.entries()) {
    expect(pdf.dimensions[i].width).toBeCloseTo(105, 1);
    expect(pdf.dimensions[i].height).toBeGreaterThan(80);
    expect(pdf.dimensions[i].height).toBeLessThan(400);
    expect(await decode(page, pdf.images[i])).toBe(a.checkInUrl);
    // PDF text is rasterised. Per-patient visual references assert the patient,
    // reference and token on the very same page whose QR was just decoded.
    expect(Buffer.from(pdf.images[i].split(",")[1], "base64")).toMatchSnapshot(
      `bulk-${a.id}.png`, { maxDiffPixels: 100, threshold: 0.1 },
    );
  }
}
for (const kind of ["download", "print"] as const) {
  test(`bulk ${kind} preserves selected patients, page order, logos and distinct private QRs`, async ({ page }) => {
    const calls = await mountBulk(page);
    let html = "";
    if (kind === "download") {
      // A second export verifies order remains stable across repeated actions.
      for (let attempt = 0; attempt < 2; attempt++) {
        calls.length = 0;
        const event = page.waitForEvent("download");
        await clickBulkDownload(page);
        const item = await event;
        expect(item.suggestedFilename()).toBe("private-appointment-tickets.pdf");
        await verifyBulkPdf(page, await readPdf(await item.path()));
        expect(calls).toEqual(bulkCalls);
      }
      return;
    } else {
      await interceptPrint(page);
      const event = page.waitForEvent("popup");
      await page.getByRole("button", { name: "Print Tickets" }).click();
      const popup = await event;
      await expect.poll(() => page.evaluate(() => (window as Window & { printCount?: number }).printCount)).toBe(1);
      html = await popup.content();
      await popup.close();
    }
    expect(calls).toEqual(bulkCalls);
    expect(html).toContain("Private appointment ticket");
    expect(html).not.toMatch(/<script\b|<link\b|<iframe\b/i);
    const offline = await page.context().newPage();
    try {
      await offline.context().setOffline(true);
      await offline.setContent(html);
      await expect(offline.locator("section")).toHaveCount(bulkAppointments.length);
      for (const [i, a] of bulkAppointments.entries()) {
      const section = offline.locator("section").nth(i);
      await expect(section).toContainText(a.patientName);
      await expect(section).toContainText(a.reference);
      await expect(section).toContainText(a.token);
      for (const other of bulkAppointments.filter(other => other.id !== a.id)) await expect(section).not.toContainText(other.patientName);
      const logo = section.getByAltText("DigiQ Doctors logo");
      const qr = section.getByAltText("Private appointment QR");
      expect(await logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
      await expect.poll(() => logo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([1529, 778]);
      const src = await qr.getAttribute("src");
      expect(src).toMatch(/^data:image\/png;base64,/);
      expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      expect(await decode(page, src!)).toBe(a.checkInUrl);
      }
    } finally {
      await offline.context().setOffline(false);
      await offline.close();
    }
  });
}

for (const failure of ["outage", "unavailable", "mismatch"] as const) {
  test(`bulk PDF blocks all downloads on one ${failure} QR and retries the whole selection`, async ({ page }) => {
    const state: { failure?: QrFailure } = { failure };
    const calls = await mountBulk(page, state);
    const downloads: string[] = [];
    page.on("download", d => downloads.push(d.suggestedFilename()));
    await clickBulkDownload(page);
    await expect(page.getByRole("alert")).toContainText("No tickets exported");
    await expect(page.getByTestId("status-bulk-progress")).toHaveCount(0);
    await page.getByText("Review Failures and Skipped Appointments").click();
    await expect(page.getByRole("listitem")).toContainText("appointment-1: failed");
    expect(calls).toEqual(bulkCalls);
    expect(downloads).toEqual([]);

    // No stale/partial pages from the failed attempt may leak into the retry.
    state.failure = undefined;
    calls.length = 0;
    const event = page.waitForEvent("download");
    await clickBulkDownload(page);
    const item = await event;
    await verifyBulkPdf(page, await readPdf(await item.path()));
    expect(downloads).toEqual(["private-appointment-tickets.pdf"]);
    expect(calls).toEqual(bulkCalls);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}