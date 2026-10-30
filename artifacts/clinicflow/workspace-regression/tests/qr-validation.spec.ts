import { test, expect, chromium, type Page } from "@playwright/test";
import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Every staff matrix case uses the real password form, native cookie and /me.
// Only explicitly labelled camera/error/lifecycle cases intercept responses.
const password = "Fictional-Qr-Password-123";
async function login(page: Page, id = "rec", role = "receptionist", destination = "/receptionist/queue?mode=app") {
  await page.context().clearCookies();
  await page.goto(`/sign-in?mode=app&redirect=${encodeURIComponent(destination)}`);
  await page.getByTestId("input-staff-email").fill(`${id}@test.invalid`);
  await page.getByTestId("input-staff-password").fill(password);
  await page.getByTestId("button-staff-login").click();
  await expect.poll(async () => (await page.evaluate(async () => (await fetch("/api/me")).json())).user?.role).toBe(role);
  await expect(page.getByTestId("button-profile-menu")).toBeVisible();
}
async function state(page: Page, value = "waiting") {
  const response = await page.request.get(`/__qr-evidence/state/${value}`);
  expect(response.status()).toBe(200);
  return (await response.json()).payload as string;
}
async function snapshot(page: Page) { return (await page.request.get("/__qr-evidence/snapshot")).json(); }
async function post(page: Page, path: string, data: unknown) {
  return page.evaluate(async ({ path, data }) => {
    const r = await fetch(`/api${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return { status: r.status, data: await r.json() };
  }, { path, data });
}
async function paste(page: Page, payload: string) {
  await page.getByTestId("button-scan-paste").click();
  await page.getByTestId("input-qr-paste").fill(payload);
  await page.getByTestId("button-qr-paste-validate").click();
}
async function open(page: Page, entry = "profile", beforeActivate?: () => Promise<void>) {
  if (entry === "queue") {
    const choice = page.getByRole("region", { name: "Choose operational location" });
    if (await choice.isVisible()) await choice.getByRole("button", { name: /Lakeview Main/ }).click();
    // section with aria-label is a region only when browsers expose its name.
    const choose = page.getByRole("button", { name: "Lakeview Main · Lakeview Clinic", exact: true });
    if (await choose.isVisible()) await choose.click();
    // Admin/clinic-admin queue routes can be the session list; open its real session first.
    const validate = page.getByTestId("button-validate-qr");
    if (!(await validate.isVisible())) await page.getByRole("link", { name: "Open", exact: true }).first().click();
    await page.getByTestId("button-validate-qr").click();
  } else if (entry === "search") {
    await page.getByRole("button", { name: "Search workspace (Control or Command K)" }).click();
    await page.getByTestId("quick-action-check-in").click();
  } else {
    await page.getByTestId("button-profile-menu").click();
    await page.getByTestId("menu-check-in").scrollIntoViewIfNeeded();
    await beforeActivate?.();
    await page.getByTestId("menu-check-in").click();
  }
  await expect(page.getByRole("dialog", { name: "Validate Appointment QR" })).toBeVisible();
}
const dialog = (page: Page) => page.getByRole("dialog", { name: "Validate Appointment QR" });
async function close(page: Page) { await dialog(page).getByTestId("button-dialog-close").click(); await expect(dialog(page)).toBeHidden(); }

test.beforeEach(async ({ page }) => { expect((await page.request.get("/__qr-evidence/reset")).ok()).toBe(true); });

for (const [id, role, root] of [["sa", "superAdmin", "admin"], ["adm", "clinicAdmin", "admin"], ["docu", "doctor", "doctor"], ["rec", "receptionist", "receptionist"]]) {
  test(`${role}: queue, workspace search and profile entries use one read-only compact dialog`, async ({ page }) => {
    const payload = await state(page);
    await login(page, id, role, `/${root}/queue?mode=app`);
    const before = await snapshot(page);
    for (const entry of ["queue", "search", "profile"]) {
      await open(page, entry);
      // The queue helper may first navigate from overview into its session.
      // Assert preservation of the actual scanner origin, not the earlier overview.
      const url = page.url();
      await expect(dialog(page).getByTestId("button-dialog-close")).toHaveCount(1);
      const box = await dialog(page).boundingBox();
      expect(box!.width).toBeLessThanOrEqual(480);
      await paste(page, payload);
      await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
      await expect(dialog(page)).toContainText("Ravi Kumar");
      await expect(dialog(page).getByRole("button", { name: "Check In — Enter Consultation" })).toBeEnabled();
      expect(await snapshot(page)).toEqual(before);
      await close(page);
      expect(page.url()).toBe(url);
      const trigger = entry === "queue" ? page.getByTestId("button-validate-qr")
        : entry === "search" ? page.getByRole("button", { name: "Search workspace (Control or Command K)" }) : page.getByTestId("button-profile-menu");
      await expect(trigger).toBeFocused();
    }
  });
}

test("phone printed link retains its signed payload across real staff sign-in", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  const payload = await state(page);
  await page.goto(`/check-in?mode=app&payload=${encodeURIComponent(payload)}`);
  await expect(page).toHaveURL(/sign-in\?redirect=/);
  expect(new URL(page.url()).searchParams.get("redirect")).toContain(`payload=${encodeURIComponent(payload)}`);
  await page.getByTestId("input-staff-email").fill("rec@test.invalid");
  await page.getByTestId("input-staff-password").fill(password);
  await page.getByTestId("button-staff-login").click();
  await expect(page.getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
  expect((await page.evaluate(async () => (await fetch("/api/me")).json())).user.role).toBe("receptionist");
  expect(new URL(page.url()).searchParams.get("payload")).toBe(payload);
  expect((await snapshot(page)).rows[0].status).toBe("waiting");
});

test("all four verified staff roles can open the printed ticket destination without mutation", async ({ page }) => {
  const payload = await state(page);
  const before = await snapshot(page);
  for (const [id, role, root] of [["sa", "superAdmin", "admin"], ["adm", "clinicAdmin", "admin"], ["docu", "doctor", "doctor"], ["rec", "receptionist", "receptionist"]]) {
    await login(page, id, role, `/${root}/appointments?mode=app`);
    await page.goto(`/check-in?mode=app&payload=${encodeURIComponent(payload)}`);
    await expect(page.getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Check In — Enter Consultation" })).toBeEnabled();
    expect(await snapshot(page)).toEqual(before);
  }
});

test("real HTTP signed, tampered, unknown, role/scope, date, status and queue rules are read-only", async ({ page }) => {
  const payload = await state(page);
  await page.goto("/sign-in?mode=app");
  expect((await post(page, "/appointment-qr/resolve", { payload })).status).toBe(401);
  await login(page, "sa", "superAdmin", "/admin/appointments?mode=app");
  for (const [input, code] of [[payload, 200], ["not-a-ticket", 400], [payload.slice(0, -2) + "AA", 400],
    [(await (await page.request.get("/__qr-evidence/unknown")).json()).payload, 404]] as const) {
    const before = await snapshot(page);
    expect((await post(page, "/appointment-qr/resolve", { payload: input })).status).toBe(code);
    expect(await snapshot(page)).toEqual(before);
  }
  for (const status of ["tomorrow", "cancelled", "completed", "noShow", "blocked", "inConsultation"]) {
    const code = await state(page, status), before = await snapshot(page);
    const result = await post(page, "/appointment-qr/resolve", { payload: code });
    expect(result.status).toBe(["blocked", "inConsultation"].includes(status) ? 200 : 409);
    if (result.status === 200) expect(result.data.eligible).toBe(false);
    expect(await snapshot(page)).toEqual(before);
    if (status !== "inConsultation") expect((await post(page, "/appointment-qr/check-in", { payload: code })).status).toBe(409);
    expect(await snapshot(page)).toEqual(before);
  }
  const scoped = await state(page);
  await login(page, "rec3", "receptionist", "/receptionist/appointments?mode=app");
  expect((await post(page, "/appointment-qr/resolve", { payload: scoped })).status).toBe(403);
  const session = (await (await page.request.get("/__qr-evidence/patient-session")).json()).token;
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "digiq_session", value: session, domain: "127.0.0.1", path: "/api", httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/check-in?mode=app&payload=${encodeURIComponent(scoped)}`);
  await expect(page.getByRole("heading", { name: "Staff Access Required" })).toBeVisible();
  const patient = await post(page, "/appointment-qr/resolve", { payload: scoped });
  expect(patient.status).toBe(403);
  expect(JSON.stringify(patient.data)).not.toContain("Ravi");
  await page.goto("/patient/appointments?mode=app");
  await expect(page.getByTestId("button-profile-menu")).toBeVisible();
  await page.getByTestId("button-profile-menu").click();
  await expect(page.getByTestId("menu-check-in")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search workspace (Control or Command K)" }).click();
  await expect(page.getByTestId("quick-action-check-in")).toHaveCount(0);
});

test("real booking generates a compatible ticket; only explicit check-in mutates, repeat is idempotent", async ({ page }) => {
  await login(page);
  const created = await post(page, "/appointments", { patientId: "p1", doctorId: "d1", clinicId: "c1", branchId: "b1",
    date: new Date().toISOString().slice(0, 10), source: "phone", bookingMobile: "+919000000001" });
  expect(created.status).toBe(201);
  const qr = await page.evaluate(async id => (await fetch(`/api/appointments/${id}/qr`)).json(), created.data.id);
  const before = await snapshot(page);
  await open(page);
  await paste(page, qr.checkInUrl);
  await expect(page.getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole("button", { name: "Check In — Enter Consultation" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Checked in", exact: true })).toBeVisible();
  const after = await snapshot(page);
  expect(after.rows[0].status).toBe("inConsultation");
  const repeat = await post(page, "/appointment-qr/check-in", { payload: qr.payload });
  expect(repeat.data.alreadyCheckedIn).toBe(true);
  expect(await snapshot(page)).toEqual(after);
  await page.getByTestId("button-qr-scan-another").click();
  await paste(page, qr.payload);
  await expect(dialog(page)).toContainText("Consultation has already started");
  await expect(page.getByRole("button", { name: "Check In — Enter Consultation" })).toHaveCount(0);
});

test("actual PNG decoding, invalid image and pasted failures, retry and repeated scanning", async ({ page }) => {
  const payload = await state(page);
  await login(page);
  const before = await snapshot(page);
  await open(page);
  await page.getByTestId("button-scan-file").click();
  await page.locator('.qr-upload input').setInputFiles({ name: "ticket.png", mimeType: "image/png",
    buffer: await QRCode.toBuffer(`http://127.0.0.1:43720/check-in?payload=${encodeURIComponent(payload)}`, { width: 500 }) });
  await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await page.getByTestId("button-qr-scan-another").click();
  await page.locator('.qr-upload input').setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(dialog(page)).toContainText("This image could not be opened");
  await paste(page, "https://untrusted.invalid/check-in?payload=anything");
  await expect(dialog(page)).toContainText("not from this clinic workspace");
  await paste(page, "invalid");
  await expect(dialog(page)).toContainText("QR not verified");
  await expect(dialog(page)).toContainText("invalid or has been altered");
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect(dialog(page)).toContainText("QR not verified");
  await page.getByTestId("button-qr-scan-another").click();
  await paste(page, payload);
  await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
});

test("camera denied, unsupported native detector fallback, actual video-frame decoding and track cleanup", async ({ page }) => {
  const payload = await state(page), image = await QRCode.toDataURL(payload, { width: 600 });
  await page.addInitScript(({ image }) => {
    (window as any).BarcodeDetector = class { constructor() { throw new Error("Unsupported format"); } };
    (window as any).__streams = [];
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      const img = new Image(); img.src = image; await img.decode();
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 600;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const stream = canvas.captureStream(10); (window as any).__streams.push(stream); return stream;
    } });
  }, { image });
  await login(page);
  await open(page);
  await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === "ended")))).toBe(true);
  await close(page);
  await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) }));
  await open(page);
  await expect(dialog(page)).toContainText("Could not access the camera");
  await expect(page.getByTestId("button-scan-file")).toHaveAttribute("aria-pressed", "true");
  await paste(page, payload);
  await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
});

test("late camera detection, image decoding and server replies cannot overwrite a new mode or reopened dialog", async ({ page }) => {
  const payload = await state(page);
  await page.addInitScript(() => {
    (window as any).__detect = null; (window as any).__streams = [];
    (window as any).BarcodeDetector = class {
      detect() { return new Promise(resolve => { (window as any).__detect = resolve; }); }
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 100;
      canvas.getContext("2d")!.fillRect(0, 0, 100, 100);
      const stream = canvas.captureStream(10); (window as any).__streams.push(stream); return stream;
    } });
  });
  await login(page); await open(page);
  await expect.poll(() => page.evaluate(() => !!(window as any).__detect)).toBe(true);
  await page.getByTestId("button-scan-paste").click();
  await page.evaluate(payload => (window as any).__detect([{ rawValue: payload }]), payload);
  await expect(page.getByTestId("input-qr-paste")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__streams.every((s: MediaStream) => s.getTracks().every(t => t.readyState === "ended")))).toBe(true);
  // Artificially delay a real decoded Image's load callback past the mode switch.
  await page.evaluate(() => {
    const Original = window.Image;
    (window as any).Image = class extends Original {
      set onload(handler: any) { super.onload = handler ? function (this: any, e: any) { (window as any).__imageDone = () => handler.call(this, e); } : null; }
    };
  });
  await page.getByTestId("button-scan-file").click();
  await page.locator('.qr-upload input').setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: await QRCode.toBuffer(payload) });
  await expect.poll(() => page.evaluate(() => !!(window as any).__imageDone)).toBe(true);
  await page.getByTestId("button-scan-paste").click();
  await page.evaluate(() => (window as any).__imageDone());
  await expect(page.getByTestId("input-qr-paste")).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/appointment-qr/resolve", async route => { await gate; await route.continue(); });
  await paste(page, payload);
  await expect(dialog(page)).toContainText("Verifying appointment");
  await close(page); await open(page); await page.getByTestId("button-scan-paste").click();
  release();
  await expect(page.getByTestId("input-qr-paste")).toBeVisible();
  await expect(page.getByRole("heading", { name: "QR verified", exact: true })).toHaveCount(0);
});

test("native camera continues after unrelated QR; technical resolve/check-in failure retry stays explicit", async ({ page }) => {
  const payload = await state(page);
  await page.addInitScript(({ payload }) => {
    let calls = 0; (window as any).__detectCalls = 0;
    (window as any).BarcodeDetector = class { async detect() {
      (window as any).__detectCalls++;
      return [{ rawValue: ++calls === 1 ? "https://untrusted.invalid/book/not-appointment" : payload }];
    } };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 100;
      canvas.getContext("2d")!.fillRect(0, 0, 100, 100);
      return canvas.captureStream(10);
    } });
  }, { payload });
  await login(page);
  let resolveCalls = 0;
  await page.route("**/api/appointment-qr/resolve", route => ++resolveCalls === 1
    ? route.fulfill({ status: 503, json: { error: "private technical details" } }) : route.continue());
  await open(page);
  await expect(dialog(page)).toContainText("QR not verified");
  expect(await page.evaluate(() => (window as any).__detectCalls)).toBeGreaterThan(1);
  await expect(dialog(page)).not.toContainText("private technical details");
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
  let fail = true;
  await page.route("**/api/appointment-qr/check-in", async route => {
    if (fail) { await new Promise(r => setTimeout(r, 400)); await route.fulfill({ status: 503, json: { error: "private failure" } }); }
    else await route.continue();
  });
  const before = await snapshot(page);
  await page.getByRole("button", { name: "Check In — Enter Consultation" }).click();
  await expect(page.getByRole("button", { name: "Checking in…" })).toBeDisabled();
  await expect(dialog(page).getByTestId("button-dialog-close")).toBeDisabled();
  await expect(dialog(page)).toContainText("Check-in was not confirmed");
  expect(await snapshot(page)).toEqual(before);
  fail = false;
  await page.getByRole("button", { name: "Check In — Enter Consultation" }).click();
  await expect(dialog(page).getByRole("heading", { name: "Checked in", exact: true })).toBeVisible();
});

test("phone, tablet, short and wide desktop, 200% reflow: compact states, focus trap, Escape and page preservation", async ({ page }) => {
  test.setTimeout(180_000);
  const payload = await state(page);
  const tomorrow = await state(page, "tomorrow");
  await state(page, "waiting");
  // Controlled test-only camera: live blank stream and native detector returning no codes.
  await page.addInitScript(() => {
    (window as any).__qrDetectCalls = 0;
    (window as any).BarcodeDetector = class { async detect() { (window as any).__qrDetectCalls++; return []; } };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 100;
      canvas.getContext("2d")!.fillRect(0, 0, 100, 100);
      return canvas.captureStream(10);
    } });
    (window as any).__qrCamera = navigator.mediaDevices.getUserMedia;
    // Hold the real Image load callback so uploading is observable before decoding.
    const Original = window.Image;
    (window as any).Image = class extends Original {
      set onload(handler: any) {
        super.onload = handler ? function (this: any, e: any) {
          (window as any).__releaseQrImage = () => handler.call(this, e);
        } : null;
      }
    };
  });
  await login(page, "sa", "superAdmin", "/admin/appointments?mode=app&view=all&search=Ravi");
  await mkdir("generated-artifacts/qr-validation/screenshots", { recursive: true });
  const selection = page.getByRole("checkbox", { name: "Select all appointments on this page", exact: true });
  await expect(selection).toBeVisible();
  await selection.check();
  const qrImage = await QRCode.toBuffer(`http://127.0.0.1:43720/check-in?payload=${encodeURIComponent(payload)}`, { width: 500 });
  for (const [name, width, height] of [["phone", 390, 740], ["tablet", 768, 1024], ["short", 1280, 520], ["wide", 1920, 1080], ["zoom-200-reflow", 640, 360]] as const) {
    await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: (window as any).__qrCamera }));
    await page.setViewportSize({ width, height });
    const url = page.url(), before = await snapshot(page);
    await page.evaluate(() => window.scrollTo(0, 100));
    // A real user must be able to reach the launcher before opening its menu.
    // Do not count Playwright's prerequisite scroll-to-click as modal disruption.
    await page.getByTestId("button-profile-menu").scrollIntoViewIfNeeded();
    let y = 0;
    let heading: Awaited<ReturnType<ReturnType<Page["getByRole"]>["boundingBox"]>> = null;
    await open(page, "profile", async () => {
      // Measure at the actual QR action after its parent menu has opened.
      y = await page.evaluate(() => window.scrollY);
      heading = await page.getByRole("heading", { name: "Appointments", exact: true }).boundingBox();
    });
    await page.getByTestId("button-scan-paste").click();
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-empty.png` });
    await page.getByTestId("button-scan-camera").click();
    await expect(dialog(page).getByLabel("Camera preview for scanning the appointment QR code")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__qrDetectCalls)).toBeGreaterThan(0);
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-scanning.png` });
    // Clearly labelled camera-permission denial simulation.
    await page.getByTestId("button-scan-paste").click();
    await expect(page.getByTestId("button-scan-paste")).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true, value: () => Promise.reject(new DOMException("Denied", "NotAllowedError")),
    }));
    await page.getByTestId("button-scan-camera").click();
    await expect(dialog(page)).toContainText("Could not access the camera");
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-camera-denied.png` });
    await page.getByTestId("button-scan-file").click();
    const box = await dialog(page).boundingBox();
    expect(box!.width).toBeLessThanOrEqual(480); expect(box!.height).toBeLessThanOrEqual(height);
    expect(await page.locator(".qr-upload").evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".qr-upload input").setInputFiles({ name: "ticket.png", mimeType: "image/png", buffer: qrImage });
    await expect(dialog(page).getByText("Reading QR image…")).toBeVisible();
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-uploading.png` });
    let releaseResolve!: () => void;
    const resolveGate = new Promise<void>(r => { releaseResolve = r; });
    await page.route("**/api/appointment-qr/resolve", async route => { await resolveGate; await route.continue(); });
    await expect.poll(() => page.evaluate(() => !!(window as any).__releaseQrImage)).toBe(true);
    await page.evaluate(() => (window as any).__releaseQrImage());
    await expect(dialog(page)).toContainText("Verifying appointment");
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-loading.png` });
    releaseResolve();
    await expect(dialog(page).getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-verified.png` });
    await page.unrouteAll();
    await page.getByTestId("button-qr-scan-another").click();
    const deniedPayload = await state(page, "tomorrow");
    await paste(page, deniedPayload);
    await expect(dialog(page)).toContainText("QR not verified");
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-denied.png` });
    await page.getByTestId("button-qr-scan-another").click();
    // Clearly labelled technical-failure simulation; real HTTP denial is tested above.
    await state(page, "waiting");
    await page.route("**/api/appointment-qr/resolve", route => route.fulfill({ status: 503, json: { error: "controlled test failure" } }));
    await paste(page, payload);
    await expect(dialog(page)).toContainText("QR not verified");
    await page.screenshot({ path: `generated-artifacts/qr-validation/screenshots/${name}-failure.png` });
    await page.unrouteAll();
    await state(page, "waiting");
    await page.getByTestId("button-qr-scan-another").click();
    await page.getByTestId("button-scan-paste").click();
    for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); expect(await dialog(page).evaluate(e => e.contains(document.activeElement))).toBe(true); }
    await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("button-profile-menu")).toBeFocused();
    expect(page.url()).toBe(url);
    // Select-all changes its accessible label to "Deselect all" when checked;
    // preserve and assert the selected patient row rather than the control label.
    await expect(page.getByRole("checkbox", { name: /Ravi Kumar/ })).toBeChecked();
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    const afterHeading = await page.getByRole("heading", { name: "Appointments", exact: true }).boundingBox();
    // Responsive font rasterization can round fractions of a CSS pixel differently.
    for (const axis of ["x", "y", "width", "height"] as const) expect(afterHeading![axis]).toBeCloseTo(heading![axis], 0);
    // Scenario setup changes intentionally rewrite the fictional row; validation itself is read-only.
    expect((await snapshot(page)).rows[0].status).toBe("waiting");
  }
});

test("native Chromium 200% tab zoom preserves compact upload and verified result", async () => {
  const extension = resolve("generated-artifacts/qr-validation/zoom-extension");
  await mkdir(extension, { recursive: true });
  await mkdir("generated-artifacts/qr-validation/screenshots", { recursive: true });
  await writeFile(`${extension}/manifest.json`, JSON.stringify({ manifest_version: 3, name: "QR zoom evidence",
    version: "1.0", permissions: ["tabs"], background: { service_worker: "worker.js" } }));
  await writeFile(`${extension}/worker.js`, "chrome.runtime.onInstalled.addListener(()=>{});");
  const context = await chromium.launchPersistentContext("", {
    executablePath: "/repl/tools/bin/chromium", headless: true, viewport: null,
    baseURL: "http://127.0.0.1:43720",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox", "--window-size=1280,720", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const page = context.pages()[0] || await context.newPage();
    const payload = await state(page);
    await login(page, "sa", "superAdmin", "/admin/appointments?mode=app");
    await open(page); await page.getByTestId("button-scan-file").click();
    const ratio = await page.evaluate(() => devicePixelRatio);
    const zoom = await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find((t: any) => t.url?.startsWith("http://127.0.0.1:43720"));
      await chrome.tabs.setZoom(tab.id, 2);
      return chrome.tabs.getZoom(tab.id);
    });
    expect(zoom).toBe(2);
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(ratio * 2);
    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    // Tab zoom updates the DPR before the CSS dialog animation/layout settles.
    await expect.poll(async () => (await dialog(page).boundingBox())!.width).toBeLessThanOrEqual(size.width);
    await expect.poll(async () => (await dialog(page).boundingBox())!.height).toBeLessThanOrEqual(size.height);
    await page.screenshot({ path: "generated-artifacts/qr-validation/screenshots/native-200-upload.png" });
    await paste(page, payload);
    await expect(page.getByRole("heading", { name: "QR verified", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Check In — Enter Consultation" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Check In — Enter Consultation" })).toBeInViewport();
    await page.screenshot({ path: "generated-artifacts/qr-validation/screenshots/native-200-verified.png" });
    await page.keyboard.press("Escape"); await expect(dialog(page)).toBeHidden();
    await expect(page.getByTestId("button-profile-menu")).toBeFocused();
  } finally { await context.close(); }
});
