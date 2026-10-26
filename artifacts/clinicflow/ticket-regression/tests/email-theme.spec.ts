import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

// Execute the real sending renderer, not a hand-authored HTML fixture.
const bundle = await build({
  stdin: { contents: 'export {renderNotification,defaultTemplate} from "./lib/notification-templates";',
    resolveDir: resolve(import.meta.dirname, "../../../api-server/src"), loader: "ts" },
  write: false, bundle: true, platform: "node", format: "esm",
});
const renderer = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

for (const width of [1280, 390]) test(`email HTML preview and independent Publish with fictional fixtures at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  let revision = 1;
  let content = { ...renderer.defaultTemplate("booking"), enabled: false, subject: "Fictional booking",
    body: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}", footer: "Saved fixture footer." };
  const values = { patient_name: "Example <Patient> {{otp}}", clinic_name: "Fictional Clinic",
    appointment_details: "Fictional Clinic · North\nDoctor: Dr Example\nDate: 26 Oct 2026\nSession: 09:00–12:00 (Asia/Kolkata)\nToken: Q-007", reference: "EX-0042" };
  const writes: any[] = [];
  const catalog = () => {
    const rendered = renderer.renderNotification(content, values, { event: "booking" });
    return { scopeName: "Platform defaults", variables: Object.keys(values), items: [{
      event: "booking", recipient: "patient", title: "Booking confirmation", revision, source: "platform", content,
      previewSubject: rendered.subject, previewBody: rendered.text, previewHtml: rendered.html, delivery: "Fictional only",
    }] };
  };
  await page.route("**/api/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname, body = req.method() === "GET" ? undefined : req.postDataJSON();
    if (path.endsWith("/auth/csrf")) return route.fulfill({ json: { csrfToken: "fictional" } });
    if (path.endsWith("/integrations")) return route.fulfill({ json: { smtp: { ready: false, keys: [] }, notificationSms: { ready: false, keys: [] } } });
    if (path.endsWith("/templates/preview")) {
      const r = renderer.renderNotification(body.content, body.values, { event: body.event });
      return route.fulfill({ headers: { "Cache-Control": "no-store" }, json: { status: "preview", message: "Nothing sent.", subject: r.subject, body: r.text, html: r.html } });
    }
    if (path.endsWith("/templates/test")) throw Error("Real test send must never be requested");
    if (path.endsWith("/templates")) {
      if (body) { writes.push(body); content = body.content; revision++; }
      return route.fulfill({ json: catalog() });
    }
    return route.fulfill({ json: {items:[],total:0} });
  });
  await page.goto("/?mode=sms-tests&channel=email");
  await expect(page.getByTestId("input-body")).toBeVisible();
  await page.getByTestId("details-advanced").getByText("Advanced", { exact: true }).click();
  for (const [key, value] of Object.entries(values)) await page.getByTestId(`input-test-value-${key}`).fill(value);
  await page.getByTestId("button-test-preview").click();
  const preview = page.getByTestId("panel-template-test").frameLocator('iframe[title="Rendered email preview"]');
  await expect(preview.locator("body")).toContainText("Example <Patient> {{otp}}");
  await expect(preview.locator("body")).toContainText("Dr Example");
  await expect(preview.getByRole("link", { name: "Get support" })).toHaveAttribute("href", "mailto:no-reply@digi-q.in");
  await expect(preview.locator("script")).toHaveCount(0);
  const iframe = page.getByTestId("panel-template-test").getByTestId("email-html-preview");
  await expect(iframe).toHaveAttribute("sandbox", "");
  await expect(iframe).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(iframe).toHaveAttribute("srcdoc", /default-src 'none'/);
  await page.getByTestId("panel-template-test").getByText("Plain-text view", { exact: true }).click();
  await expect(page.getByTestId("text-test-body")).toContainText("Example <Patient> {{otp}}");
  await page.screenshot({ path: testInfo.outputPath(`editor-email-${width}.png`), fullPage: true });

  // Optional invalid/unfilled test inputs must never prevent publishing wording.
  await page.getByTestId("input-test-value-patient_name").fill("");
  await page.getByTestId("input-body").fill("Updated wording {{patient_name}}");
  await expect(page.getByTestId("button-test-preview")).toBeDisabled();
  await page.getByTestId("button-publish").click();
  await page.getByTestId("button-confirm-save").click();
  await expect(page.getByTestId("status-save")).toHaveText("Template published.");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ mode: "publish", channel: "email", content: { enabled: false, body: "Updated wording {{patient_name}}" } });
});

test("rendered desktop/mobile examples and image-blocked branding remain readable without horizontal overflow", async ({ page }, testInfo) => {
  const visit = { introduction: "Your appointment is confirmed.", clinic: "Example & Partners", location: "North location",
    doctor: "Dr Example", date: "26 Oct 2026", start: "9:00 AM", end: "12:00 PM", timezone: "Asia/Kolkata",
    reference: "EX-0042", token: "A-01", contact: "reception@example.invalid",
    closing: "Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive." };
  const values = { clinic_name: visit.clinic, doctor_name: visit.doctor, patient_name: "Example Patient",
    reference: visit.reference, clinic_contact: visit.contact, appointment_details: "Complete fictional visit summary." };
  // Self-contained on a fresh checkout: generated evidence is not a test input.
  const examples: Record<string, string> = {
    booking: renderer.renderNotification(renderer.defaultTemplate("booking"), values, { event: "booking", visit }).html,
    otp: renderer.renderNotification(renderer.defaultTemplate("clinic_registration_otp"), { otp: "004281", expiry_minutes: "7" }, { event: "clinic_registration_otp" }).html,
    rescheduled: renderer.renderNotification(renderer.defaultTemplate("rescheduled"), { ...values, previous_details: "Previous visit: South location\nDoctor: Dr Previous\n25 Oct 2026, 2:00 PM–4:00 PM (Asia/Kolkata)" }, { event: "rescheduled", visit: { ...visit, introduction: "Visit details:" } }).html,
    onboarding: renderer.renderNotification(renderer.defaultTemplate("onboarding"), values, { event: "onboarding" }).html,
    "long-image-blocked": renderer.renderNotification({ ...renderer.defaultTemplate("booking"), logoUrl: "https://example.invalid/blocked-logo.png" }, { ...values, patient_name: "<UnusuallyLongName>".repeat(30) }, { event: "booking", visit }).html,
  };
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const name of ["booking", "otp", "rescheduled", "onboarding", "long-image-blocked"]) {
      await page.route("https://example.invalid/**", route => route.abort());
      await page.setContent(examples[name]);
      await expect(page.locator("body")).toContainText("Digi-Q");
      await expect(page.getByRole("link", { name: "Get support" })).toHaveAttribute("href", "mailto:no-reply@digi-q.in");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (name === "otp") {
        await expect(page.locator('[role="text"]')).toHaveAttribute("aria-label", "Verification code 004281");
        expect(await page.locator('[role="text"]').textContent()).toBe("004281");
        await expect(page.locator("body")).toContainText("7 minutes");
        await expect(page.locator("a")).toHaveCount(2);
        await expect(page.locator("a").nth(1)).toHaveAttribute("href", "mailto:no-reply@digi-q.in");
      }
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
  }
});
