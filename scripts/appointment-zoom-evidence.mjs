/** Native Chromium tab zoom; fictional, intercepted read-only appointment data.
 * Start the existing ticket-regression Vite fixture on 43719 before running. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const dir = "generated-artifacts/appointment-tabs/native-zoom";
const extension = resolve(dir, "extension");
await mkdir(extension, { recursive: true });
await writeFile(`${extension}/manifest.json`, JSON.stringify({
  manifest_version: 3, name: "Appointment zoom evidence", version: "1.0",
  permissions: ["tabs"], background: { service_worker: "worker.js" },
}));
await writeFile(`${extension}/worker.js`, "chrome.runtime.onInstalled.addListener(()=>{});");
const context = await chromium.launchPersistentContext("", {
  executablePath: "/repl/tools/bin/chromium", headless: true, viewport: null,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: ["--no-sandbox", "--window-size=1024,640", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const a = {
  id: "zoom-appointment", patientId: "fictional-patient", patientCode: "P-FICTIONAL",
  patientName: "Alexandria Verylongpatientname Example-Surname",
  doctorId: "fictional-doctor", doctorName: "Dr Rowan Verylongdoctorname Example",
  clinicId: "fictional-clinic", clinicName: "Fictional Clinic Group",
  branchId: "fictional-location", branchName: "Fictional Northside Location",
  branchAddress: "21 Fictional Street, Example City", date: "2030-06-14",
  startTime: "09:00", endTime: "12:00", timezone: "UTC", sessionId: "fictional-session",
  token: "A-01", reference: "BOOKING-FICTIONAL-LONG-REFERENCE-123456789",
  status: "waiting", revision: 1, allowedActions: [], createdAt: "2030-06-01T10:00:00Z",
  bookingMobile: "+919876543210", notes: "Fictional note with complete wrapped text. ".repeat(8),
  checkedInAt: null, completedAt: null,
  history: [
    { status: "waiting", occurredAt: "2030-06-01T10:00:00Z" },
    { action: "requeue", status: "waiting", occurredAt: "2030-06-14T09:00:00Z", reason: "A long fictional reason with full detail. ".repeat(8) },
  ],
};
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const page = context.pages()[0] || await context.newPage();
  await page.route(/https:\/\/fonts\./, route => route.abort());
  await page.route("**/api/**", async route => {
    assert.equal(route.request().method(), "GET", "No writes authorized");
    const path = new URL(route.request().url()).pathname;
    const json = path === "/api/public/website-config" ? { publicOrigin: "https://tickets.example.invalid" }
      : path === "/api/me" ? { user: { id: "fictional-actor", role: "clinicAdmin" }, needsOnboarding: false }
      : path === "/api/appointments" ? { items: [a], total: 1, page: 1, pageSize: 100 }
      : path === "/api/appointments/zoom-appointment" ? a
      : path.endsWith("/qr") ? { appointmentId: a.id, checkInUrl: "https://tickets.example.invalid/check-in/fictional-zoom", payload: "fictional" }
      : path === "/api/queue" ? { entries: [], presence: { status: "available" }, ownEntry: { patientsAhead: 1, estimatedWaitMinutes: 20 } }
      : undefined;
    assert.notEqual(json, undefined, `Unmocked read ${path}`);
    await route.fulfill({ json });
  });
  const origin = "http://127.0.0.1:43719";
  await page.goto(`${origin}/?mode=details&surface=rows`);
  await page.getByTestId(`button-expand-appointment-${a.id}`).click();
  await page.getByTestId("section-detail-booking").waitFor();
  const before = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, devicePixelRatio }));
  const zoom = await worker.evaluate(async origin => {
    const tab = (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(origin));
    if (!tab?.id) throw Error("Evidence tab unavailable");
    await chrome.tabs.setZoom(tab.id, 2);
    return chrome.tabs.getZoom(tab.id);
  }, origin);
  assert.equal(zoom, 2);
  const after = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, devicePixelRatio }));
  assert.equal(after.outerWidth, before.outerWidth);
  assert(after.innerWidth <= before.innerWidth / 2 + 1);
  const evidence = [];
  for (const name of ["Booking", "Details", "History"]) {
    const tab = page.getByTestId("appointment-details").getByRole("tab", { name, exact: true });
    await tab.click(); await tab.focus();
    await page.evaluate(() => document.fonts.ready);
    const detail = page.getByTestId("appointment-details");
    const geometry = await detail.evaluate(root => {
      const bounds = root.getBoundingClientRect();
      const bad = [];
      for (const el of root.querySelectorAll('[role="tab"],button,a,code,dd,th,td')) {
        if (!el.getClientRects().length) continue;
        const box = el.getBoundingClientRect();
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1) bad.push(el.tagName);
      }
      return { left: bounds.left, width: bounds.width, right: bounds.right, viewport: innerWidth, bad };
    });
    assert.deepEqual(geometry.bad, []);
    assert(geometry.left >= 0 && geometry.right <= after.innerWidth + 1);
    await detail.getByRole("tabpanel").scrollIntoViewIfNeeded();
    const cdp = await context.newCDPSession(page);
    const image = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: false });
    await writeFile(`${dir}/${name.toLowerCase()}-200-percent.png`, Buffer.from(image.data, "base64"));
    await cdp.detach();
    evidence.push({ tab: name, geometry });
  }
  const result = { zoom, before, after, method: "chrome.tabs.setZoom(2); same physical window; no CSS zoom or viewport emulation", evidence };
  await writeFile(`${dir}/geometry.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await context.close();
}
