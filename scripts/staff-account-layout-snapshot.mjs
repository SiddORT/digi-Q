// Focused rendered confirmation of the two browser-reported regressions.
// Fictional API responses only. No account saves or live message requests.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const output = "generated-artifacts/staff-accounts";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
const results = [];
try {
  for (const width of [1366, 1024, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width === 390 });
    const page = await context.newPage();
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      assert.equal(route.request().method(), "GET", "snapshot must not save accounts or send messages");
      const role = "superAdmin";
      const result = path === "/api/auth/status" ? { authenticated: true, role }
        : path === "/api/auth/csrf" ? { csrfToken: "fictional-layout-csrf" }
        : path === "/api/me" ? { userId: "fictional-layout-admin", user: { id: "fictional-layout-admin", role, fullName: "Fictional Administrator", email: "fictional@test.invalid" }, needsOnboarding: false, permissions: {} }
        : path.endsWith("/completion") ? { result: null }
        : path.endsWith("/registration-options") ? { categories: [], specialities: [], qualifications: [] }
        : path.endsWith("/slug-availability") ? { available: true }
        : path.endsWith("/website-config") ? { origin: "https://fictional.test.invalid", available: true }
        : { items: [], pagination: { total: 0 } };
      await route.fulfill({ json: result });
    });
    await page.goto("http://127.0.0.1:43720/?mode=onboarding");
    await page.getByTestId("registration-next").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator(".registration-layout.admin-single > main").evaluate(el => ({
      width: el.getBoundingClientRect().width,
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      columns: getComputedStyle(el.parentElement).gridTemplateColumns,
    }));
    assert(geometry.width >= (width >= 1024 ? 800 : width - 90), JSON.stringify(geometry));
    assert(geometry.documentWidth <= width + 1, JSON.stringify(geometry));
    const password = page.getByTestId("registration-password");
    await password.fill("Fictional-Layout-Pass42!");
    const checks = await page.locator(".password-checklist").first().locator("li[data-met=true]").count();
    assert.equal(checks, 3, "uncontrolled RHF password checklist must update as typed");
    await password.fill("");
    assert.equal(await page.locator(".password-checklist").first().locator("li[data-met=true]").count(), 0);
    const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    assert(!stored.includes("Fictional-Layout-Pass42!"), "password must never enter browser storage");
    await page.screenshot({ path: `${output}/admin-${width}.png` });
    results.push({ ...geometry, matchingChecklistRules: checks, touch: width === 390 });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/layout.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
