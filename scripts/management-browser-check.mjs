// Local fallback for the remote browser worker. All API traffic is intercepted.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(6000);
const failures = [], passed = [], writes = [], crashes = [];
let role = "superAdmin", templateConflict = false, integrationConflict = false, integrationSource = "environment";
let custom = { revision: 1, roles: [{ id: "limited", name: "Limited desk", baseRole: "receptionist", denied: ["appointments:delete"] }], bindings: [{ userId: "desk", roleId: "limited", clinicId: "c" }] };
const list = { data: [], items: [], total: 0, page: 1, pageSize: 20 };
const clinic = { id: "c", name: "Fixture Clinic", adminId: "fixture", status: "active", timezone: "UTC", slug: "fixture" };
const events = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"];
const templates = new Map();
function catalog(url) {
  const recipient = url.searchParams.get("recipient") || "patient";
  return { scopeName: "Fixture Clinic", variables: ["clinic_name", "patient_name"], items: events.filter(e => e !== "onboarding" || recipient === "clinicAdmin").map(event => {
    const saved = templates.get(`${recipient}:${event}`);
    const content = { enabled: recipient === "patient" || event === "onboarding", subject: "Visit update", body: "Hello {{patient_name}}", prefix: "", footer: "Contact {{clinic_name}}", logoUrl: "" };
    return { event, recipient, title: event, revision: saved?.revision || 0, source: saved?.source || "default", content: saved?.content || content, draft: saved?.draft, previewSubject: "Visit update", previewBody: "Hello Patient", delivery: "Production worker" };
  }) };
}
page.on("pageerror", e => crashes.push(e.message));
await context.route("**/api/**", async route => {
  const req = route.request(), url = new URL(req.url()), path = url.pathname.replace(/^\/api/, "");
  const json = data => route.fulfill({ json: data });
  if (path === "/auth/status") return json({ authenticated: true, role, staffPasswordVerified: true, requiresStaffPassword: false });
  if (path === "/auth/csrf") return json({ csrfToken: "fictional-test-token" });
  if (path === "/me") return json({ user: { id: "fixture", fullName: "Fixture Admin", email: "fixture@example.invalid", role, status: "active" }, needsOnboarding: false, clinicIds: ["c"], branchIds: [], assignments: [], doctorId: null });
  if (req.method() !== "GET") {
    const data = req.postDataJSON(); writes.push({ path, data });
    if (path === "/management/custom-roles") { custom = { ...data, revision: custom.revision + 1 }; return json(custom); }
    if (path === "/settings/integrations") {
      if (integrationConflict) return route.fulfill({ status: 409, json: { error: "Settings changed", code: "INTEGRATION_CONFLICT" } });
      integrationSource = data.mode;
      return json({ success: true });
    }
    if (path === "/management/templates") {
      if (templateConflict) return route.fulfill({ status: 409, json: { error: "Template changed" } });
      templates.set(`${data.recipient}:${data.event}`, { revision: data.revision + 1, source: data.mode === "publish" ? "clinic" : "default", content: data.mode === "publish" ? data.content : undefined, draft: data.mode === "draft" ? data.content : undefined });
      url.searchParams.set("recipient", data.recipient);
      return json(catalog(url));
    }
    if (path.endsWith("/check")) return json({ provider: path.split("/").at(-2), source: "environment", checkedAt: new Date().toISOString(), checks: [{ name: "Authentication", status: "passed", message: "Fixture verified" }, { name: "Delivery", status: "not_verified", message: "No message sent" }] });
    if (path.endsWith("/test-email")) return json({ status: "provider_accepted", message: "Fixture provider accepted" });
    return json({ success: true });
  }
  if (path === "/management/permissions") return json({ revision: 1, roles: ["clinicAdmin", "doctor", "receptionist"], modules: ["appointments", "patients"], actions: ["read", "create", "update", "delete"], denied: [] });
  if (path === "/management/custom-roles") return json(custom);
  if (path === "/management/system-users") return json({ ...list, total: 1, data: [{ id: "desk", fullName: "Fixture Desk", email: "desk@example.invalid", role: "receptionist", status: "active", clinics: [{ id: "c", name: clinic.name }] }] });
  if (path === "/management/templates") return json(catalog(url));
  if (path === "/settings/integrations") return json({ editable: true, smtp: { ready: true, source: integrationSource, revision: integrationSource === "database" ? "fixture-revision" : null, keys: ["SMTP_HOST","SMTP_PORT","SMTP_USER","SMTP_PASSWORD","SMTP_FROM"].map(key => ({ key, status: "configured" })) }, sms: { ready: false, source: "environment", revision: null, keys: ["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_MESSAGING_SERVICE_SID"].map(key => ({ key, status: "missing" })) } });
  if (path === "/settings/integrations/storage") return json({ provider: "object", source: "environment", publicPath: "/media", configured: true });
  if (path === "/clinics") return json({ ...list, data: [clinic], items: [clinic], total: 1 });
  if (path === "/clinics/c") return json(clinic);
  if (path === "/settings" || path === "/clinic-settings") return json({ timezone: "UTC", notificationsEnabled: false, dateFormat: "DD/MM/YYYY", timeFormat: "24h", sessionTimeoutMinutes: 60, countries: [], currencies: [] });
  if (path === "/dashboard") return json({ stats: [], counts: {}, todayAppointments: 0, waiting: 0, completed: 0, averageWait: 0, recentAppointments: [], recentActivity: [], trend: [] });
  if (path === "/reports") return json({ ...list, summary: {}, rows: [], groups: [] });
  return json(list);
});
async function check(name, fn) {
  if (process.env.CHECK_FILTER && !new RegExp(process.env.CHECK_FILTER).test(name)) return;
  role = "superAdmin"; templateConflict = false; integrationConflict = false;
  try { await fn(); passed.push(name); console.log("PASS", name); }
  catch (e) { failures.push({ name, message: e.message.slice(0, 700), body: (await page.locator("body").innerText()).slice(-3200) }); console.log("FAIL", name, e.message.slice(0, 220)); }
}
async function go(path) { await page.goto(origin + path); await page.waitForTimeout(400); }
async function select(testId, text) { await page.getByTestId(testId).click(); await page.getByRole("option", { name: text, exact: true }).click(); }
await mkdir("screenshots/management-acceptance", { recursive: true });
try {
  await check("Role deletion requires acknowledging existing bindings and persists both removals", async () => {
    await go("/admin/permissions");
    await page.getByRole("button", { name: "Delete Limited desk" }).click();
    await expect(page.getByTestId("button-confirm-delete-role")).toBeDisabled();
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page.getByTestId("button-confirm-delete-role").click();
    await page.getByTestId("button-save-custom-roles").click();
    await page.getByTestId("button-confirm-custom-roles").click();
    await expect.poll(() => custom.roles.length).toBe(0);
    if (custom.bindings.length) throw Error("Bindings were retained");
  });
  await check("Template recipient draft and publication payload, revision conflict preserves edits", async () => {
    await go("/admin/templates");
    await page.getByLabel("Recipient", { exact: true }).click();
    await page.getByRole("option", { name: "Doctor", exact: true }).click();
    await page.getByTestId("input-enabled").check();
    await page.getByTestId("input-subject").fill("Doctor fixture notice");
    await page.getByTestId("button-save-draft").click();
    await page.getByTestId("button-confirm-save").click();
    await expect.poll(() => writes.some(w => w.data?.mode === "draft" && w.data.recipient === "doctor" && w.data.content.enabled)).toBe(true);
    await page.getByTestId("button-publish").click();
    await page.getByTestId("button-confirm-save").click();
    await expect.poll(() => writes.some(w => w.data?.mode === "publish" && w.data.recipient === "doctor")).toBe(true);
    await page.getByTestId("input-subject").fill("Retained on conflict");
    templateConflict = true;
    await page.getByTestId("button-publish").click();
    await page.getByTestId("button-confirm-save").click();
    await expect(page.getByTestId("state-conflict")).toBeVisible();
    await expect(page.getByTestId("input-subject")).toHaveValue("Retained on conflict");
    await page.screenshot({ path: "screenshots/management-acceptance/template-conflict.png" });
  });
  await check("Integration provider controls and explicit test-send confirmation", async () => {
    await go("/admin/integrations");
    await page.screenshot({ path: "screenshots/management-acceptance/integrations-desktop.png" });
    await expect(page.getByTestId("select-provider")).toHaveValue("smtp");
    const input = page.locator('input[type="email"]');
    await input.fill("test@example.invalid");
    await expect(page.getByRole("button", { name: "Send test email", exact: true })).toBeDisabled();
    await page.getByLabel(/Yes, send a real email/).check();
    await page.getByRole("button", { name: "Send test email", exact: true }).click();
    await expect.poll(() => writes.some(w => w.path.endsWith("/test-email"))).toBe(true);
    await page.getByTestId("button-check-smtp").click();
    await expect(page.getByTestId("list-check-smtp")).toContainText("Not verified");
    await page.getByRole("button", { name: "Configure SMTP", exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByTestId("select-service").selectOption("sms");
    await expect(page.getByTestId("select-provider")).toHaveValue("twilio");
    await page.getByRole("button", { name: "Configure Twilio", exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByTestId("button-check-sms").click();
    await expect(page.getByTestId("list-check-sms")).toBeVisible();
    await page.getByTestId("select-service").selectOption("storage");
    await expect(page.getByTestId("panel-storage")).toContainText("cannot be edited here");
    await page.getByTestId("button-check-storage").click();
    await expect(page.getByTestId("list-check-storage")).toBeVisible();
  });
  await check("All visible administration sidebar destinations render without JavaScript crashes", async () => {
    const pages = ["dashboard","clinics","branches","users","patients","masters","appointments","queue","reports","settings","audit","qrs","book","availability","exceptions","demo","templates","permissions","integrations","system-users"];
    for (const path of pages) {
      const before = crashes.length; await go(`/admin/${path}`); console.log("Checking page", path);
      if (crashes.length !== before) throw Error(`${path}: ${crashes.at(-1)} (check fixture shape before attributing to app)`);
      await expect(page.locator(".workspace")).toBeVisible();
      await expect(page.getByText("Something went wrong", { exact: true })).toHaveCount(0);
      const create = page.getByRole("button", { name: /^(Add|New|Create) / }).first();
      if (await create.count() && await create.isEnabled()) {
        await create.click();
        if (await page.getByRole("dialog").count()) {
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.screenshot({ path: `screenshots/management-acceptance/${path}-dialog.png` });
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
      }
    }
  });
  await check("Integration save preserves fields on conflict, clears password and confirms environment restore", async () => {
    await go("/admin/integrations");
    await page.getByRole("button", { name: "Configure SMTP", exact: true }).click();
    await page.getByLabel("SMTP server", { exact: true }).fill("smtp.example.invalid");
    await page.getByLabel("Confirm your current Super Admin password").fill("fictional-password");
    integrationConflict = true;
    await page.getByRole("button", { name: "Save configuration", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Configuration was not saved");
    await expect(page.getByLabel("SMTP server", { exact: true })).toHaveValue("smtp.example.invalid");
    await expect(page.getByLabel("Confirm your current Super Admin password")).toHaveValue("");
    integrationConflict = false;
    await page.getByLabel("Confirm your current Super Admin password").fill("fictional-password");
    await page.getByRole("button", { name: "Save configuration", exact: true }).click();
    await expect(page.getByTestId("status-integration-smtp")).toContainText("encrypted website settings");
    await page.getByRole("button", { name: "Configure SMTP", exact: true }).click();
    await expect(page.getByLabel("SMTP server", { exact: true })).toHaveValue("");
    await page.getByLabel("Use server environment instead").check();
    await expect(page.getByRole("button", { name: "Save configuration", exact: true })).toBeDisabled();
    await page.getByLabel("I understand and want to use server configuration.").check();
    await page.getByLabel("Confirm your current Super Admin password").fill("fictional-password");
    await page.getByRole("button", { name: "Save configuration", exact: true }).click();
    await expect(page.getByTestId("status-integration-smtp")).toContainText("server environment");
    const restoration = writes.findLast(w => w.path === "/settings/integrations");
    if (Object.keys(restoration.data.values).length || restoration.data.mode !== "environment") throw Error("Environment restore contract mismatch");
  });
  await check("Clinic Admin cannot open platform-only management pages", async () => {
    role = "clinicAdmin";
    for (const path of ["permissions", "integrations", "system-users"]) {
      await go(`/admin/${path}`); await expect(page).toHaveURL(/\/admin\/dashboard$/);
    }
  });
  await check("Clinic Admin templates require an owned clinic scope", async () => {
    role = "clinicAdmin";
    await go("/admin/templates");
    await expect(page.getByTestId("state-select-clinic")).toBeVisible();
    await page.getByLabel(/^Clinic group/).click();
    await page.getByRole("option", { name: clinic.name, exact: true }).click();
    await expect(page.getByTestId("input-subject")).toBeVisible();
    await page.getByTestId("input-subject").fill("Scoped clinic notice");
    await page.getByTestId("button-save-draft").click();
    await page.getByTestId("button-confirm-save").click();
    await expect.poll(() => writes.some(w => w.data?.clinicId === "c" && w.data.mode === "draft")).toBe(true);
    await page.screenshot({ path: "screenshots/management-acceptance/clinic-admin-templates.png" });
  });
  await check("Template mobile content has no page-level horizontal overflow", async () => {
    role = "superAdmin"; templateConflict = false;
    await page.setViewportSize({ width: 390, height: 844 }); await go("/admin/templates");
    await expect(page.getByTestId("input-subject")).toBeVisible();
    const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (widths[0] > widths[1] + 1) throw Error(`Overflow ${widths.join("/")}`);
    await page.screenshot({ path: "screenshots/management-acceptance/templates-mobile.png" });
  });
} finally {
  await writeFile("screenshots/management-acceptance/results.json", JSON.stringify({ passed, failures, crashes, writes }, null, 2));
  await writeFile(`screenshots/management-acceptance/results-${Date.now()}.json`, JSON.stringify({ passed, failures, crashes }, null, 2));
  await browser.close();
}
if (failures.length) process.exitCode = 1;