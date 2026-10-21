import { test, expect } from "@playwright/test";
import { gzipSync } from "node:zlib";

const options = (prefix: string, count = 10_000) => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}-${String(i).padStart(5, "0")}`, name: `Fictional ${prefix} ${String(i).padStart(5, "0")}`,
}));
const catalog = { categories: options("Category"), specialities: options("Speciality"), qualifications: options("Qualification") };
const body = JSON.stringify(catalog);
const baseline = process.env.CATALOG_BASELINE === "1";

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`catalog responsiveness ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // Never call a live API or seed a real catalog.
    await page.route("**/api/**", route => route.request().url().includes("/public/registration-options")
      ? route.fulfill({ contentType: "application/json", body }) : route.abort());
    const start = performance.now();
    await page.goto("/");
    await expect(page.getByText("Loading healthcare suggestions", { exact: false })).toBeHidden();
    await expect(page.getByTestId("clinic-metadata-fields")).toBeVisible();
    const initialMs = performance.now() - start;
    const openStart = performance.now();
    await page.getByRole("button", { name: "Category (optional)", exact: true }).click();
    await expect(page.getByRole("option", { name: "Fictional Category 00000" })).toBeVisible();
    const openMs = performance.now() - openStart;
    const renderedOptions = await page.getByRole("option").count();
    if (!baseline) expect(renderedOptions).toBeLessThanOrEqual(75);
    const searchStart = performance.now();
    await page.getByPlaceholder("Search category (optional)…").fill("09999");
    await expect(page.getByRole("option", { name: "Fictional Category 09999" })).toBeVisible();
    const searchMs = performance.now() - searchStart;
    await page.getByRole("option", { name: "Fictional Category 09999" }).click();
    await expect(page.getByTestId("draft")).toContainText("Category-09999");
    if (!baseline) {
      expect(openMs).toBeLessThan(1500);
      expect(searchMs).toBeLessThan(1000);
    }
    const specialityStart = performance.now();
    await page.getByRole("button", { name: "Specialities (optional)", exact: true }).click();
    if (!baseline) expect(await page.getByRole("option").count()).toBeLessThanOrEqual(75);
    await page.getByPlaceholder("Search specialities (optional)...").fill("09999");
    await expect(page.getByRole("option", { name: "Fictional Speciality 09999" })).toBeVisible();
    const specialitySearchMs = performance.now() - specialityStart;
    await page.getByRole("option", { name: "Fictional Speciality 09999" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Add custom speciality", exact: true }).click();
    await page.getByTestId("clinic-custom-speciality-0").fill("Fictional custom care");
    await expect(page.getByTestId("draft")).toContainText("Speciality-09999");
    await expect(page.getByTestId("draft")).toContainText("Fictional custom care");
    await expect(page.getByTestId("doctor")).toHaveText('{"specialization":"","qualifications":[]}');
    await page.getByRole("button", { name: "Doctor specialization", exact: true }).click();
    await page.getByPlaceholder("Search doctor specialization…").fill("09999");
    await page.getByRole("option", { name: "Fictional Speciality 09999" }).click();
    const metrics = { baseline, viewport, entriesPerCatalog: 10_000, payloadBytes: Buffer.byteLength(body), gzipBytes: gzipSync(body).length, initialMs, openMs, searchMs, specialitySearchMs, renderedOptions };
    console.log(JSON.stringify(metrics));
    await testInfo.attach("metrics.json", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  });
}

test("complete page traversal, keyboard navigation and labels survive search", async ({ page }) => {
  const smallCatalog = { categories: options("Category", 151), specialities: options("Speciality", 151), qualifications: [] };
  await page.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(smallCatalog) }));
  await page.goto("/?saved=1");
  await expect(page.getByText("Historical category", { exact: true })).toBeVisible();
  await expect(page.getByText("Historical speciality", { exact: true })).toBeVisible();
  await expect(page.getByText("Loading healthcare suggestions", { exact: false })).toBeHidden();
  await page.getByRole("button", { name: "Category (optional): Historical category" }).click();
  const found = new Set<string>();
  do {
    for (const name of await page.getByRole("option").allTextContents()) {
      if (name.startsWith("Fictional")) found.add(name);
    }
    if (await page.getByRole("button", { name: "Next options" }).isDisabled()) break;
    await page.getByRole("button", { name: "Next options" }).click();
    expect(await page.getByRole("option").count()).toBeLessThanOrEqual(75);
  } while (true);
  expect(found.size).toBe(151);
  await expect(page.getByRole("option", { name: "Historical category" })).toBeDisabled();
  await page.getByRole("button", { name: "Previous options" }).click();
  await page.getByPlaceholder("Search category (optional)…").fill("00150");
  await expect(page.getByRole("option", { name: "Fictional Category 00150" })).toBeVisible();
  await page.getByPlaceholder("Search category (optional)…").press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("draft")).toContainText("Category-00150");
  await page.getByRole("button", { name: "Category (optional): Fictional Category 00150" }).click();
  await page.getByPlaceholder("Search category (optional)…").fill("no match");
  await expect(page.getByText("No matching results.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Category (optional): Fictional Category 00150" })).toBeVisible();
  await page.getByRole("button", { name: "Specialities (optional): Historical speciality" }).click();
  await page.getByRole("option", { name: "Fictional Speciality 00000" }).click();
  found.clear();
  do {
    for (const name of await page.getByRole("option").allTextContents()) {
      if (name.startsWith("Fictional")) found.add(name.replace(" (selected)", ""));
    }
    if (await page.getByRole("button", { name: "Next options" }).isDisabled()) break;
    await page.getByRole("button", { name: "Next options" }).focus();
    await page.keyboard.press("Enter");
    expect(await page.getByRole("option").count()).toBeLessThanOrEqual(75);
  } while (true);
  expect(found.size).toBe(151);
  await expect(page.getByRole("option", { name: "Historical speciality" })).toBeDisabled();
  await page.getByPlaceholder("Search specialities (optional)...").fill("00150");
  await page.getByRole("option", { name: "Fictional Speciality 00150" }).click();
  await page.getByPlaceholder("Search specialities (optional)...").fill("no match");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("draft")).toContainText('"specialityIds":["historical-speciality","Speciality-00000","Speciality-00150"]');
  await expect(page.getByRole("button", { name: /Specialities \(optional\): Historical speciality, Fictional Speciality 00000, Fictional Speciality 00150/ })).toBeVisible();
});

for (const mode of ["empty", "error"]) {
  test(`${mode} catalog keeps custom entry available and retries`, async ({ page }) => {
    let requests = 0;
    await page.route("**/api/**", route => {
      requests++;
      return route.fulfill({ status: mode === "error" && requests === 1 ? 503 : 200,
        contentType: "application/json", body: JSON.stringify(requests === 1 ? { categories: [], specialities: [], qualifications: [] } : catalog) });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Category (optional)", exact: true }).click();
    await page.getByRole("option", { name: "Other — type your own category" }).click();
    await page.getByTestId("clinic-custom-category").fill("Fictional category");
    await page.getByRole("button", { name: "Add custom speciality", exact: true }).click();
    await page.getByTestId("clinic-custom-speciality-0").fill("Fictional care");
    await page.getByRole("button", { name: mode === "error" ? "Retry healthcare suggestions" : "Refresh healthcare suggestions" }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByTestId("clinic-custom-category")).toHaveValue("Fictional category");
    await expect(page.getByTestId("clinic-custom-speciality-0")).toHaveValue("Fictional care");
    await expect(page.getByText("Healthcare suggestions could not be loaded.", { exact: false })).toBeHidden();
  });
}
