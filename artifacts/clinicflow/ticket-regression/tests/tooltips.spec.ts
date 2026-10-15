import { test, expect, type Page } from "@playwright/test";

async function mount(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ json: {
    items: [{ id: "request-1", fullName: "Fictional Guest With A Long Name For Clipping Checks", email: "guest@example.invalid",
      mobile: "+12025550123", doctorName: "Fictional Doctor", date: "2030-06-14", branchName: "Fictional Clinic",
      timezone: "UTC", startTime: "09:00", endTime: "12:00", status: "pending" }],
    total: 1, page: 1,
  } }));
  await page.goto("/?mode=tooltips");
  await expect(page.getByTestId("long-value")).toHaveAttribute("tabindex", "0");
}
for (const width of [1280, 820, 390]) {
  test(`clipping, focus, Escape, disabled explanation and visible request data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mount(page);
    const long = page.getByTestId("long-value");
    await long.focus();
    await expect(page.locator(".ov-pop")).toHaveCount(1);
    await expect(long).toHaveAttribute("aria-describedby", /.+/);
    await long.press("Escape");
    await expect(page.locator(".ov-pop")).toHaveCount(0);
    await page.getByTestId("short-value").hover();
    await expect(page.locator(".ov-pop")).toHaveCount(0);
    await expect(page.getByTestId("short-value")).toHaveAttribute("tabindex", "-1");
    await page.getByTestId("two-line-value").focus();
    await expect(page.locator(".ov-pop")).toHaveCount(1);
    await page.getByRole("button", { name: "About wait calculation" }).focus();
    await expect(page.locator(".ov-pop")).toHaveCount(0);
    await expect(page.locator(".helptip-bubble")).toContainText("patients ahead");
    await page.getByTestId("helptip-disabled-wrapper").focus();
    await expect(page.locator(".helptip-bubble")).toHaveCount(1);
    await expect(page.locator(".helptip-bubble")).toContainText("unavailable");
    await page.keyboard.press("Escape");
    await expect(page.locator(".helptip-bubble")).toHaveCount(0);
    const guest = page.locator(".guest-request-main");
    await expect(guest).toContainText("guest@example.invalid");
    await expect(guest).toContainText("+12025550123");
    await expect(guest).toContainText("Fictional Doctor");
    await expect(guest.locator("[title],.helptip")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
test("touch toggles clipped text, dismisses outside, and replaces pinned help", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await mount(page);
  const long = page.getByTestId("long-value");
  await long.tap();
  await expect(page.locator(".ov-pop")).toHaveCount(1);
  await long.tap();
  await expect(page.locator(".ov-pop")).toHaveCount(0);
  await long.tap();
  await page.getByTestId("outside-control").tap();
  await expect(page.locator(".ov-pop")).toHaveCount(0);
  await page.getByRole("button", { name: "About activation" }).tap();
  await expect(page.locator(".cm-info-content")).toHaveCount(1);
  await long.tap();
  await expect(page.locator(".cm-info-content")).toHaveCount(0);
  await expect(page.locator(".ov-pop")).toHaveCount(1);
  await page.getByTestId("short-value").tap();
  await expect(page.locator(".ov-pop")).toHaveCount(0);
  await context.close();
});
