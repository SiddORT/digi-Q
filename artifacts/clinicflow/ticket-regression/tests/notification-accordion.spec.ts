import { test, expect, type Page } from "@playwright/test";

const events = ["booking", "reminder"];
const rows = events.flatMap(event => ["email", "sms"].flatMap(channel => ["patient", "doctor"].map(recipient => ({
  event, channel, recipient, enabled: channel === "email", ready: recipient === "patient",
  source: "default", revision: 1, blockedReasons: recipient === "doctor" ? ["Provider unavailable"] : [],
  timing: event === "reminder" ? "Before the session starts" : "",
}))));
const content = { subject: "Visit", prefix: "", body: "Your visit wording", footer: "", logoUrl: "", enabled: true };

async function setup(page: Page) {
  const writes: { path: string; body: any }[] = [];
  // Never let fixture traffic reach any real API.
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") {
      writes.push({ path, body: request.postDataJSON() });
      if (path.endsWith("/event-controls")) {
        return route.fulfill({ json: {
          scopeName: "Platform defaults", gateDescription: "", notificationsEnabled: true,
          items: rows.map(row => row.event === request.postDataJSON().event && row.channel === request.postDataJSON().channel && row.recipient === request.postDataJSON().recipient
            ? { ...row, enabled: request.postDataJSON().enabled, revision: 2 } : row),
        } });
      }
    }
    if (path.endsWith("/event-controls")) return route.fulfill({ json: {
      scopeName: url.searchParams.get("clinicId") ? "Fixture Clinic" : "Platform defaults",
      gateDescription: "", notificationsEnabled: true, items: rows,
    } });
    if (path.endsWith("/notification-settings")) return route.fulfill({ json: {
      revision: 1, canActivate: true, inherited: true,
      scopeName: url.searchParams.get("clinicId") ? "Fixture Clinic" : "Platform defaults",
      notificationsEnabled: true, items: rows,
    } });
    if (path.endsWith("/templates")) return route.fulfill({ json: {
      scopeName: "Fixture Clinic", variables: [], items: events.map(event => ({
        event, recipient: url.searchParams.get("recipient") || "patient", title: event, source: "default",
        revision: 1, delivery: "active", content, draft: null, previewSubject: "Visit", previewBody: content.body,
      })),
    } });
    if (path.endsWith("/me")) return route.fulfill({ json: { user: { id: "template-fixture", role: "superAdmin" } } });
    if (path.endsWith("/auth/csrf")) return route.fulfill({ json: { csrfToken: "synthetic-fixture-csrf" } });
    if (path.endsWith("/clinics")) return route.fulfill({ json: { items: [
      { id: "clinic-a", name: "Fixture Clinic" }, { id: "clinic-b", name: "Second Clinic" },
    ], total: 2, page: 1 } });
    if (/\/clinics\/clinic-/.test(path)) return route.fulfill({ json: { id: path.split("/").pop(), name: "Fixture Clinic" } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto("/?mode=templates");
  await expect(page.getByTestId("button-event-booking")).toBeVisible();
  return writes;
}

test("headings start collapsed; keyboard and independent expansion do not write", async ({ page }) => {
  const writes = await setup(page);
  const booking = page.getByTestId("button-event-booking"), reminder = page.getByTestId("button-event-reminder");
  await expect(booking).toHaveAttribute("aria-expanded", "false");
  await expect(reminder).toContainText("Before the session starts");
  await expect(page.getByTestId("card-template-email-booking-patient")).not.toBeVisible();
  await booking.focus();
  await booking.press("Enter");
  await expect(booking).toHaveAttribute("aria-expanded", "true");
  await booking.press("ArrowDown");
  await expect(reminder).toBeFocused();
  await reminder.press("Space");
  await expect(reminder).toHaveAttribute("aria-expanded", "true");
  await expect(booking).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Provider unavailable").first()).toBeVisible();
  await booking.click();
  await expect(booking).toHaveAttribute("aria-expanded", "false");
  await expect(reminder).toHaveAttribute("aria-expanded", "true");
  expect(writes).toEqual([]);
});

test("search and filters open matching rows; clearing filters and changing scope reset expansion", async ({ page }) => {
  await setup(page);
  const search = page.getByTestId("input-search-events");
  await search.fill("wording");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("button-event-reminder")).toHaveAttribute("aria-expanded", "true");
  await page.getByTestId("select-filter-channel").selectOption("sms");
  await expect(page.getByTestId("card-template-sms-booking-patient")).toBeVisible();
  await expect(page.getByTestId("card-template-email-booking-patient")).toHaveCount(0);
  await page.getByTestId("select-filter-recipient").selectOption("doctor");
  await page.getByTestId("select-filter-status").selectOption("off");
  await expect(page.locator(".cm-row")).toHaveCount(2);
  await search.fill("nothing matches");
  await expect(page.getByTestId("state-empty")).toBeVisible();
  await search.fill("");
  for (const filter of ["channel", "recipient", "status"]) await page.getByTestId(`select-filter-${filter}`).selectOption("");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("button-event-booking").click();
  await page.getByRole("button", { name: "Scope (optional)", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await expect(page.getByTestId("chip-scope")).toHaveText("Clinic");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
});

test("expanded wording actions retain edit guards and keep activation on the same page without writing", async ({ page }) => {
  const writes = await setup(page);
  await page.getByTestId("button-event-booking").click();
  await page.getByTestId("button-edit-email-booking-patient").click();
  await page.getByTestId("input-body").fill("Unsaved wording");
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Discard unsaved changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep Editing", exact: true }).click();
  await expect(page.getByTestId("input-body")).toHaveValue("Unsaved wording");
  await page.getByTestId("details-advanced").getByText("Advanced", { exact: true }).click();
  await page.getByTestId("button-save-draft").click();
  await expect(page.getByRole("heading", { name: "Save Draft?" })).toBeVisible();
  await page.getByTestId("button-confirm-cancel").click();
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByTestId("button-discard-editor").click();
  await expect(page.getByTestId("switch-email-booking-patient")).toBeVisible();
  await expect(page.getByTestId("link-activation-settings")).toHaveCount(0);
  expect(writes).toEqual([]);
});

for (const width of [1280, 820, 390]) {
  test(`readable headings, focus and expanded rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    const heading = page.getByTestId("button-event-reminder");
    await heading.focus();
    expect(await heading.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
    await heading.press("Enter");
    await expect(page.getByTestId("button-edit-sms-reminder-doctor")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await heading.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  });
}
