import { test, expect, type Page } from "@playwright/test";

async function displayMock(page: Page) {
  await page.route("**/api/**", route => route.fulfill({ status: 501, json: { error: "Unmocked fixture request" } }));
  await page.route("**/api/public/display/**", route => route.fulfill({ json: {
    clinic: { name: "Fictional Care" }, branch: { name: "Fictional Location", timezone: "UTC" }, sessions: [], date: "2030-06-14",
  } }));
}
for (const origin of ["https://care.example.invalid", "https://uat.example.invalid:8443"]) {
  test(`runtime ${origin}: alternate browser host does not affect completion, share, display or ticket QR`, async ({ page }) => {
    await displayMock(page);
    let requests = 0;
    await page.route("**/api/public/website-config", async route => {
      requests++;
      await route.fulfill({ json: { publicOrigin: `${origin}/` } });
    });
    await page.goto("/?mode=website");
    const booking = `${origin}/fictional-care/main-location?book=1`;
    await expect(page.getByTestId("canonical-booking-link")).toHaveText(booking);
    await expect(page.getByRole("link", { name: "Check Public Booking Page" })).toHaveAttribute("href", `${origin}/fictional-care`);
    await expect(page.locator(".registration-url").last()).toContainText(`${origin}/fictional-care/main-location`);
    await expect(page.getByTestId("public-booking-qr-url")).toHaveAttribute("href", booking);
    await expect(page.getByTestId("text-booking-url")).toHaveText(booking.replace("https://", ""));
    const qr = page.getByTestId("public-booking-qr");
    await expect(qr).toBeVisible();
    expect(await page.evaluate(uri => window.decodeTicketQr(uri!), await qr.getAttribute("src"))).toBe(booking);
    const displayQr = page.getByTestId("img-booking-qr").locator("img");
    await expect(displayQr).toBeVisible();
    expect(await page.evaluate(uri => window.decodeTicketQr(uri!), await displayQr.getAttribute("src"))).toBe(booking);
    const privateQr = page.getByAltText("Personal visit QR");
    await expect(privateQr).toBeVisible();
    expect(await page.evaluate(uri => window.decodeTicketQr(uri!), await privateQr.getAttribute("src"))).toBe(`${origin}/check-in?payload=v1.fictional.signature`);
    await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
    expect(requests).toBe(1);
    await page.screenshot({ path: `generated-artifacts/public-website-${origin.includes("uat") ? "uat" : "production"}.png`, fullPage: true });
  });
}
test("delayed shared configuration emits no QR or export before authority is known", async ({ page }) => {
  await displayMock(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route("**/api/public/website-config", async route => {
    requests++; await gate;
    await route.fulfill({ json: { publicOrigin: "https://care.example.invalid" } });
  });
  await page.goto("/?mode=website");
  await expect(page.getByTestId("canonical-booking-link")).toHaveText("");
  await expect(page.getByTestId("button-download-ticket")).toBeDisabled();
  await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
  await expect(page.getByTestId("public-booking-qr")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open Workspace" })).toBeVisible();
  expect(requests).toBe(1);
  release();
  await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
  expect(requests).toBe(1);
});
for (const config of [{}, { publicOrigin: "http://bad.example.invalid" }, { publicOrigin: "https://bad.example.invalid/path" }, null]) {
  test(`missing/invalid/unavailable config ${JSON.stringify(config)} is explicit and retryable`, async ({ page }) => {
    await displayMock(page);
    let healthy = false, requests = 0;
    await page.route("**/api/public/website-config", route => {
      requests++;
      return route.fulfill({ status: healthy || config ? 200 : 503, json: healthy ? { publicOrigin: "https://recovered.example.invalid" } : config || { error: "Unavailable" } });
    });
    await page.goto("/?mode=website");
    await expect(page.getByRole("button", { name: "Retry Public Links" }).first()).toBeVisible();
    await expect(page.getByTestId("button-download-ticket")).toBeDisabled();
    await expect(page.getByAltText("Personal visit QR")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Check Public Booking Page" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Workspace" })).toBeVisible();
    expect(requests).toBe(1);
    healthy = true;
    await page.getByRole("button", { name: "Retry Public Links" }).first().click();
    await expect(page.getByTestId("button-download-ticket")).toBeEnabled();
    await expect(page.getByTestId("canonical-booking-link")).toHaveText("https://recovered.example.invalid/fictional-care/main-location?book=1");
    expect(requests).toBe(2);
  });
}
