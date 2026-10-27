/** Native Chromium zoom, not CSS zoom/reflow. Requires workspace fixture :43720.
 * All data is fictional and every non-GET request is blocked. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const dir = "generated-artifacts/tabs/current/native-zoom";
const extension = resolve(dir, "extension");
await mkdir(extension, { recursive: true });
await writeFile(`${extension}/manifest.json`, JSON.stringify({
  manifest_version: 3, name: "Tab zoom evidence", version: "1.0",
  permissions: ["tabs"], background: { service_worker: "worker.js" },
}));
await writeFile(`${extension}/worker.js`, "chrome.runtime.onInstalled.addListener(()=>{});");
const context = await chromium.launchPersistentContext("", {
  executablePath: "/repl/tools/bin/chromium", headless: true, viewport: null,
  ignoreDefaultArgs: ["--disable-extensions"],
  args: ["--no-sandbox", "--window-size=1024,640", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const page = context.pages()[0] || await context.newPage();
  await page.route(/https:\/\/fonts\./, route => route.abort());
  await page.route("**/api/**", route => {
    assert.equal(route.request().method(), "GET", "Writes not authorized");
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === "/api/notifications" ? { items: [], unread: 0 }
      : path === "/api/settings" ? { timezone: "Asia/Kolkata", timeFormat: "24h" }
      : path === "/api/public/website-config" ? { publicOrigin: "https://example.invalid" }
      : { items: [], total: 0, page: 1, pageSize: 25 } });
  });
  const origin = "http://127.0.0.1:43720";
  await page.goto(`${origin}/?mode=tabs`);
  await page.getByRole("heading", { name: /Tab presentation fixtures/ }).waitFor();
  const before = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, devicePixelRatio }));
  const zoom = await worker.evaluate(async origin => {
    const tab = (await chrome.tabs.query({})).find(t => t.url?.startsWith(origin));
    if (!tab?.id) throw Error("Evidence tab unavailable");
    await chrome.tabs.setZoom(tab.id, 2);
    return chrome.tabs.getZoom(tab.id);
  }, origin);
  const after = await page.evaluate(() => ({ innerWidth, innerHeight, outerWidth, devicePixelRatio }));
  assert.equal(zoom, 2);
  assert.equal(after.outerWidth, before.outerWidth);
  assert(after.innerWidth <= before.innerWidth / 2 + 1);
  const measurements = [];
  for (const strip of await page.locator(".dq-tabs:visible").all()) {
    await strip.scrollIntoViewIfNeeded();
    const measure = await strip.evaluate(el => ({
      label: el.getAttribute("aria-label"), width: el.clientWidth, scroll: el.scrollWidth,
      bad: [...el.querySelectorAll(":scope > .dq-tab")].filter(tab => {
        const box = tab.getBoundingClientRect();
        return tab.scrollWidth > tab.clientWidth + 1 || box.height < 44;
      }).map(tab => tab.textContent),
    }));
    assert.deepEqual(measure.bad, []);
    assert(measure.width <= after.innerWidth);
    measurements.push(measure);
  }
  const selector = page.getByRole("group", { name: "Appointment layout" });
  await selector.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(selector.getByRole("button", { name: "Calendar", exact: true })).toHaveAttribute("aria-pressed", "true");
  const cdp = await context.newCDPSession(page);
  async function capture(name) {
    const image = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: false });
    await writeFile(`${dir}/${name}.png`, Buffer.from(image.data, "base64"));
  }
  await capture("view-selector-200-percent");
  const long = page.getByRole("tablist", { name: "Long labels", exact: true });
  await long.getByRole("tab").first().focus(); await page.keyboard.press("End");
  await expect(long.getByRole("tab").last()).toBeFocused();
  await expect(long.getByRole("tab").last()).toBeInViewport();
  await capture("overflow-focus-200-percent");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await writeFile(`${dir}/geometry.json`, JSON.stringify({
    zoom, before, after, method: "chrome.tabs.setZoom(2), same physical window, no CSS zoom or viewport emulation", measurements,
  }, null, 2));
  console.log(JSON.stringify({ zoom, before, after, strips: measurements.length }));
} finally { await context.close(); }
