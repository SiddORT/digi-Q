import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

// UI-only regression for clinic-owner registration email recovery on /register-clinic.
// Every /api/** request is intercepted before navigation; no real SMTP/SMS, secrets or DB writes.
const NAME = "Example Owner";
const EMAIL = "owner-browser@example.invalid";
const PASSWORD = "Fictional-Owner!2026";
const CHALLENGE = "abcdefghijklmnopqrstuvwx";
const CODE = "123456";
const CLOCK_START = new Date("2026-01-01T00:00:00Z");
const DESKTOP = { viewport: { width: 1366, height: 900 }, timezoneId: "UTC" } as const;
const RESEND_LABEL = /Resend in \d+s/;

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };
type Mock = { calls: Record<string, number>; unexpected: string[]; reply: Record<string, Reply> };

const startReply = (email: string, sms = "not_requested"): Reply => ({
  body: { challengeId: CHALLENGE, channels: { email: { status: email }, sms: { status: sms } } },
});

// Intercepts every /api/** request on the context. Must be called before any navigation.
async function interceptApi(context: BrowserContext, start: Reply): Promise<Mock> {
  const mock: Mock = {
    calls: {}, unexpected: [],
    reply: {
      "GET /auth/status": { status: 401, body: { error: "Sign in required", code: "SIGN_IN_REQUIRED" } },
      "GET /auth/csrf": { body: { csrfToken: "fictional-csrf-token" } },
      "POST /auth/register/start": start,
    },
  };
  await context.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname.replace(/^\/api/, "")}`;
    mock.calls[key] = (mock.calls[key] ?? 0) + 1;
    const reply = mock.reply[key];
    if (reply) {
      return route.fulfill({ status: reply.status ?? 200, contentType: "application/json", headers: reply.headers, body: JSON.stringify(reply.body ?? {}) });
    }
    if (request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    mock.unexpected.push(key);
    return route.abort("blockedbyclient");
  });
  return mock;
}

async function openRegistration(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  // Installed before load; time is advanced only by runFor so React's 1-second cooldown timers fire.
  await page.clock.install({ time: CLOCK_START });
  await page.goto("/register-clinic");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  return page;
}

async function submitDetails(page: Page) {
  await page.getByRole("textbox", { name: "Your Name" }).fill(NAME);
  await page.getByTestId("input-registration-email").fill(EMAIL);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Send verification code" }).click();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
}

async function advanceUntilResendEnabled(page: Page, maxSeconds = 95) {
  const resend = page.getByTestId("registration-resend-code");
  for (let second = 0; second < maxSeconds && (await resend.isDisabled()); second++) {
    await page.clock.runFor(1000);
    await page.waitForTimeout(30);
  }
  await expect(resend).toBeEnabled();
}

// Real click, then extra DOM clicks: a disabled/busy button must not produce further requests.
async function rapidClickResend(page: Page) {
  const resend = page.getByTestId("registration-resend-code");
  await resend.click();
  await resend.evaluate(el => { for (let i = 0; i < 4; i++) (el as HTMLButtonElement).click(); });
}

const codeInput = (page: Page) => page.getByRole("textbox", { name: "Required email verification code" });
const notice = (page: Page) => page.getByTestId("registration-email-delivery");
const toasts = (page: Page) => page.locator("[data-sonner-toast]");

async function expectNoLeaksOrSuccess(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/SMTP|sentinel/i);
  expect(body).not.toContain("accepted for sending");
  expect(body).not.toContain("latest verification email");
  await expect(toasts(page).filter({ hasText: /accepted for sending/i })).toHaveCount(0);
}

async function storageText(page: Page) {
  return page.evaluate(() => JSON.stringify({
    session: Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)]),
    local: Object.keys(localStorage).map(k => [k, localStorage.getItem(k)]),
  }));
}

test("owner email recovery: uncertain, rejected, delivery-failed, accepted, invalid code, 429, change email", async ({ browser }, info) => {
  test.setTimeout(240000);
  const context = await browser.newContext(DESKTOP);
  const mock = await interceptApi(context, startReply("delivery_unknown"));
  const page = await openRegistration(context);

  await test.step("start returns delivery_unknown: uncertain notice, cooldown, no success, details kept, no password", async () => {
    await submitDetails(page);
    await expect(notice(page)).toHaveAttribute("role", "alert");
    await expect(notice(page)).toContainText("We couldn’t confirm whether the email was sent");
    await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
    await expect(page.getByTestId("registration-resend-code")).toHaveText("Resend in 60s");
    await expect(toasts(page)).toHaveCount(0);
    const storage = await storageText(page);
    expect(storage).toContain(NAME);
    expect(storage).toContain(EMAIL);
    expect(storage).not.toContain(PASSWORD);
    expect(mock.calls["POST /auth/register/start"]).toBe(1);
    await page.screenshot({ path: info.outputPath("01-initial-delivery-unknown.png"), fullPage: true });
  });

  await test.step("resend 503 REGISTRATION_EMAIL_REJECTED: plain action copy, code kept, one request, cooldown", async () => {
    await advanceUntilResendEnabled(page);
    await codeInput(page).fill(CODE);
    mock.reply["POST /auth/registration/resend"] = { status: 503, body: { code: "REGISTRATION_EMAIL_REJECTED", error: "private SMTP sentinel" } };
    await rapidClickResend(page);
    await expect(page.getByRole("alert").filter({ hasText: "We couldn’t send a new verification email" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Your previous code is unchanged" })).toBeVisible();
    await expect(codeInput(page)).toHaveValue(CODE);
    await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
    expect(mock.calls["POST /auth/registration/resend"]).toBe(1);
    await expectNoLeaksOrSuccess(page);
    await page.screenshot({ path: info.outputPath("02-resend-rejected.png"), fullPage: true });
  });

  await test.step("resend 503 EMAIL_DELIVERY_FAILED: uncertainty copy, no success, code kept", async () => {
    await advanceUntilResendEnabled(page);
    mock.reply["POST /auth/registration/resend"] = { status: 503, body: { code: "EMAIL_DELIVERY_FAILED", error: "private SMTP sentinel" } };
    await rapidClickResend(page);
    await expect(page.getByRole("alert").filter({ hasText: "We couldn’t confirm whether a new email was sent" })).toBeVisible();
    await expect(codeInput(page)).toHaveValue(CODE);
    await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
    expect(mock.calls["POST /auth/registration/resend"]).toBe(2);
    await expectNoLeaksOrSuccess(page);
  });

  await test.step("resend 200 provider_accepted: code cleared, latest-code instruction, acceptance toast, one request", async () => {
    await advanceUntilResendEnabled(page);
    mock.reply["POST /auth/registration/resend"] = { body: { challengeId: CHALLENGE, channels: { email: { status: "provider_accepted" } } } };
    await rapidClickResend(page);
    await expect(page.getByRole("status").filter({ hasText: "Use the code in the latest verification email. Earlier codes no longer work." })).toBeVisible();
    await expect(toasts(page).filter({ hasText: "Verification email accepted for sending" })).toBeVisible();
    await expect(codeInput(page)).toHaveValue("");
    await expect(page.getByTestId("registration-resend-code")).toBeDisabled();
    expect(mock.calls["POST /auth/registration/resend"]).toBe(3);
    await page.screenshot({ path: info.outputPath("03-resend-accepted.png"), fullPage: true });
  });

  await test.step("verify 400 INVALID_VERIFICATION: recovery copy, six digits submitted", async () => {
    mock.reply["POST /auth/register/verify"] = { status: 400, body: { code: "INVALID_VERIFICATION", error: "private verification sentinel" } };
    await codeInput(page).fill("654321");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "The code is incorrect or has expired." })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Use Resend code when the timer ends, or choose Change email to restart." })).toBeVisible();
    expect(mock.calls["POST /auth/register/verify"]).toBe(1);
    expect(await page.locator("body").innerText()).not.toMatch(/sentinel/i);
    await page.screenshot({ path: info.outputPath("04-verify-invalid.png"), fullPage: true });
  });

  await test.step("resend 429 Retry-After: 90 blocks requests and waits 90s", async () => {
    await advanceUntilResendEnabled(page);
    mock.reply["POST /auth/registration/resend"] = { status: 429, headers: { "Retry-After": "90" }, body: { code: "RATE_LIMITED", error: "Too many requests" } };
    await rapidClickResend(page);
    await expect(page.getByRole("alert").filter({ hasText: "Too many requests. Try again in 90 seconds." })).toBeVisible();
    const submit = page.getByRole("button", { name: /Try again in \d+s/ });
    await expect(submit).toBeDisabled();
    await expect(page.getByTestId("registration-resend-code")).toHaveText(/Resend in (8\d|90)s/);
    await submit.click({ force: true }).catch(() => undefined);
    await page.getByTestId("registration-resend-code").click({ force: true }).catch(() => undefined);
    expect(mock.calls["POST /auth/registration/resend"]).toBe(4);
    expect(mock.calls["POST /auth/register/verify"]).toBe(1);
    await page.screenshot({ path: info.outputPath("05-rate-limited.png"), fullPage: true });
    await advanceUntilResendEnabled(page, 100);
    expect(mock.calls["POST /auth/registration/resend"]).toBe(4);
  });

  await test.step("Change email retains name/email, clears password and code, adds no screens", async () => {
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your Name" })).toHaveValue(NAME);
    await expect(page.getByTestId("input-registration-email")).toHaveValue(EMAIL);
    await expect(page.getByRole("textbox", { name: "Password", exact: true })).toHaveValue("");
    await expect(codeInput(page)).toHaveCount(0);
    await expect(page.getByTestId("registration-resend-code")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send verification code" })).toBeVisible();
    expect(await storageText(page)).not.toContain(PASSWORD);
    expect(mock.unexpected).toEqual([]);
    await page.screenshot({ path: info.outputPath("06-change-email.png"), fullPage: true });
  });
  await context.close();
});

test("initial provider_rejected shows actionable notice without success", async ({ browser }, info) => {
  const context = await browser.newContext(DESKTOP);
  const mock = await interceptApi(context, startReply("provider_rejected"));
  const page = await openRegistration(context);
  await submitDetails(page);
  await expect(notice(page)).toContainText("We couldn’t send your verification email. Use Resend code when the timer ends");
  await expect(page.getByRole("alert").filter({ hasText: "Required email verification is not complete" })).toBeVisible();
  await expectNoLeaksOrSuccess(page);
  expect(mock.unexpected).toEqual([]);
  await page.screenshot({ path: info.outputPath("07-initial-provider-rejected.png"), fullPage: true });
  await context.close();
});

test("initial provider_accepted shows acceptance wording; resend delivery_unknown emits no success", async ({ browser }, info) => {
  const context = await browser.newContext(DESKTOP);
  const mock = await interceptApi(context, startReply("provider_accepted"));
  const page = await openRegistration(context);
  await submitDetails(page);
  await expect(page.getByRole("status").filter({ hasText: "Your verification email was accepted for sending. Enter the code when it arrives" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Required email verification is not complete" })).toHaveCount(0);
  await expect(toasts(page)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("08-initial-provider-accepted.png"), fullPage: true });

  await advanceUntilResendEnabled(page);
  mock.reply["POST /auth/registration/resend"] = { body: { challengeId: CHALLENGE, channels: { email: { status: "delivery_unknown" } } } };
  await rapidClickResend(page);
  await expect(notice(page)).toContainText("We couldn’t confirm whether the email was sent");
  await expectNoLeaksOrSuccess(page);
  expect(mock.calls["POST /auth/registration/resend"]).toBe(1);
  expect(mock.unexpected).toEqual([]);
  await page.screenshot({ path: info.outputPath("09-resend-200-delivery-unknown.png"), fullPage: true });
  await context.close();
});
