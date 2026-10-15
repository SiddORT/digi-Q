import { test, expect, type Page } from "@playwright/test";

// Stateful fictional API only. Real persistence and authorization are covered
// separately against disposable PostgreSQL and native staff sessions.
async function setup(page: Page, role = "superAdmin") {
  const writes: any[] = [];
  const state = { fail: 0, revoke: false, delay: 0, staleReadback: false };
  const scopes = new Map<string, any>();
  const scope = (id: string) => {
    if (!scopes.has(id)) scopes.set(id, {
      revision: 1, notificationsEnabled: true, inherited: true,
      scopeName: id ? "Fixture Clinic — North and Central Multispeciality Care Group" : "Platform defaults", canActivate: role === "superAdmin",
      items: [
        { channel: "email", event: "booking", recipient: "patient", revision: 1, enabled: true, source: id ? "platform" : "default", ready: true, blockedReasons: [], timing: "On booking confirmation; not a promise of consultation time." },
        { channel: "email", event: "booking", recipient: "doctor", revision: 1, enabled: false, source: "default", ready: false, blockedReasons: ["Provider unavailable"], timing: "" },
        ...(role === "superAdmin" ? [
          { channel: "sms", event: "booking", recipient: "patient", revision: 1, enabled: false, source: "default", ready: false, blockedReasons: ["Publish a valid DLT Template ID"], timing: "" },
          { channel: "sms", event: "patient_login_otp", recipient: "patient", revision: 1, enabled: true, required: true, source: "default", ready: false, blockedReasons: ["Security provider not ready"], timing: "" },
        ] : []),
      ], templates: new Map(),
    });
    return scopes.get(id)!;
  };
  const template = (s: any, channel: string, recipient: string, event: string) => {
    const key = `${channel}|${recipient}|${event}`;
    if (!s.templates.has(key)) s.templates.set(key, {
      event, recipient, title: event, revision: 1, source: "default", delivery: "active", draft: null,
      content: { subject: "Visit", prefix: "", body: "Your visit wording", footer: "", logoUrl: "", enabled: true },
      previewSubject: "Visit", previewBody: "Your visit wording",
    });
    return s.templates.get(key);
  };
  const catalog = (s: any, channel: string, recipient: string) => ({
    scopeName: s.scopeName, variables: ["clinic_name"],
    items: ["booking", "patient_login_otp"].map(ev => template(s, channel, recipient, ev)),
  });
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path.endsWith("/auth/csrf")) return route.fulfill({ json: { csrfToken: "fictional-csrf" } });
    if (path.endsWith("/me/notification-settings")) return route.fulfill({ json: {
      clinics: [{ id: "clinic-a", name: "Fixture Clinic" }], activeClinicId: "clinic-a", canManage: true, items: [], revision: 1,
    } });
    if (path.endsWith("/me")) return route.fulfill({ json: { user: { id: "template-fixture", role } } });
    const body = request.method() === "GET" ? undefined : request.postDataJSON();
    const s = scope(body?.clinicId || url.searchParams.get("clinicId") || "");
    if (body) {
      writes.push({ path, body });
      if (state.delay) await new Promise(r => setTimeout(r, state.delay));
      if (state.fail) return route.fulfill({ status: state.fail, json: { error: state.fail === 409 ? "Changed elsewhere" : "Not authorized or unavailable" } });
    }
    if (path.endsWith("/notification-settings")) {
      if (body) {
        if (body.revision !== s.revision || body.changes.some((change: any) =>
          !s.items.some((row: any) => row.channel === change.channel && row.event === change.event && row.recipient === change.recipient && row.revision === change.revision && !row.required))) {
          return route.fulfill({ status: 409, json: { error: "Changed elsewhere" } });
        }
        // Validate the whole batch before applying any changes, like the server transaction.
        for (const change of body.changes) {
          const row = s.items.find((r: any) => r.channel === change.channel && r.event === change.event && r.recipient === change.recipient);
          row.enabled = change.enabled; row.revision++; row.source = body.clinicId ? "clinic" : "platform";
          const t = template(s, change.channel, change.recipient, change.event);
          t.content.enabled = change.enabled; t.revision++;
        }
        if (body.notificationsEnabled !== undefined) { s.notificationsEnabled = body.notificationsEnabled; s.inherited = false; }
        s.revision++;
      }
      const { templates: _, ...data } = s;
      if (!body && writes.length && state.staleReadback) return route.fulfill({ json: {
        ...data, items: data.items.map((row: any) => row.event === "booking" ? { ...row, enabled: false } : row),
      } });
      return route.fulfill({ json: { ...data, canActivate: !state.revoke && s.canActivate } });
    }
    if (path.endsWith("/event-controls")) {
      const row = s.items.find((r: any) => r.channel === body.channel && r.event === body.event && r.recipient === body.recipient);
      row.enabled = body.enabled; row.revision++; row.source = body.clinicId ? "clinic" : "platform";
      const t = template(s, body.channel, body.recipient, body.event);
      t.content.enabled = body.enabled; t.revision++;
      return route.fulfill({ json: { ...s, templates: undefined } });
    }
    if (path.endsWith("/templates")) {
      const channel = body?.channel || url.searchParams.get("channel") || "email";
      const recipient = body?.recipient || url.searchParams.get("recipient") || "patient";
      if (body) {
        const t = template(s, channel, recipient, body.event);
        if (body.mode === "draft") t.draft = body.content;
        else { t.content = body.content; t.draft = null; }
        t.revision++;
      }
      return route.fulfill({ json: catalog(s, channel, recipient) });
    }
    if (path.endsWith("/clinics")) return route.fulfill({ json: { items: [{ id: "clinic-a", name: "Fixture Clinic" }], total: 1, page: 1 } });
    if (path.endsWith("/clinics/clinic-a")) return route.fulfill({ json: { id: "clinic-a", name: "Fixture Clinic" } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto(`/?mode=templates&role=${role}`);
  if (["superAdmin", "clinicAdmin"].includes(role)) await expect(page.getByTestId("checkbox-clinic-gate")).toBeVisible();
  return { state, writes, scope, template };
}

const booking = async (page: Page) => { await page.getByTestId("button-event-booking").click(); };
const confirm = (page: Page) => page.getByTestId("confirm-dialog-confirm").click();
const saved = (page: Page) => expect(page.getByTestId("status-management-save")).toBeVisible();

for (const role of ["superAdmin", "clinicAdmin"]) test(`compact layout and visible switches: ${role}`, async ({ page }, testInfo) => {
  await setup(page, role);
  await page.setViewportSize({ width: 1366, height: 768 });
  const header = await page.getByTestId("button-event-booking").boundingBox();
  expect(header!.y).toBeLessThan(role === "superAdmin" ? 240 : 280);
  expect(header!.height).toBeLessThanOrEqual(48);
  const gate = page.getByTestId("checkbox-clinic-gate");
  expect(await gate.evaluate(el => el.tagName)).toBe("BUTTON");
  expect(await gate.evaluate(el => getComputedStyle(el).borderRadius)).toBe("999px");
  expect(await gate.evaluate(el => {
    const track = el.getBoundingClientRect(), thumb = el.firstElementChild!.getBoundingClientRect();
    return thumb.left >= track.left && thumb.right <= track.right;
  })).toBe(true);
  await expect(page.getByTestId("switch-group-booking")).toBeEnabled({ enabled: role === "superAdmin" });
  await page.screenshot({ path: testInfo.outputPath(`${role}-laptop.png`), fullPage: true });
  console.log(role, header, await page.getByTestId("notification-scope").boundingBox());
});

test("gate and row confirmations cancel without writes; security is locked; saves persist independently after reload", async ({ page }) => {
  const { writes } = await setup(page);
  await booking(page);
  const row = page.getByTestId("switch-email-booking-patient"), gate = page.getByTestId("checkbox-clinic-gate");
  await row.click();
  await expect(gate).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(0); await expect(row).toBeChecked();
  await gate.click(); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(0); await expect(gate).toBeChecked();
  await gate.click(); await confirm(page); await saved(page);
  await expect(row).toBeChecked(); await expect(gate).not.toBeChecked();
  await expect(page.getByTestId("text-gate-source")).toContainText("blocked even when a template");
  await page.getByTestId("button-event-patient_login_otp").click();
  await expect(page.getByTestId("switch-sms-patient_login_otp-patient")).toBeDisabled();
  await expect(page.getByTestId("switch-sms-patient_login_otp-patient")).toBeChecked();
  await row.click(); await confirm(page); await saved(page);
  await page.reload(); await booking(page);
  await expect(row).not.toBeChecked(); await expect(gate).not.toBeChecked();
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toMatchObject({ notificationsEnabled: false, changes: [], revision: 1, confirmed: true });
  expect(writes[1].body).toMatchObject({ channel: "email", event: "booking", recipient: "patient", revision: 1, enabled: false, confirmed: true });
});

test("clinic scope shares inherited gate, rows and editor; pending actions lock scope and prevent double writes", async ({ page }) => {
  const { state, writes } = await setup(page);
  await page.getByRole("button", { name: "Scope (optional)", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await expect(page.getByTestId("chip-scope")).toHaveText("Clinic");
  await expect(page.getByTestId("text-gate-source")).toContainText("Inherited platform value");
  await booking(page);
  await expect(page.getByTestId("card-template-email-booking-patient")).toContainText("Inherited platform value");
  state.delay = 700;
  await page.getByTestId("switch-email-booking-patient").click();
  await expect(page.getByTestId("notification-scope").locator('button[aria-haspopup="dialog"]')).toBeDisabled();
  await confirm(page);
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  await saved(page);
  expect(writes).toHaveLength(1); expect(writes[0].body.clinicId).toBe("clinic-a");
  await page.getByTestId("button-edit-email-booking-patient").click();
  await expect(page.getByTestId("row-enabled")).toContainText("Currently off");
  await expect(page.getByTestId("email-templates").getByRole("button", { name: "Scope (optional)" })).toHaveCount(0);
});

test("conflicts and failures never show success; permission changes during confirmation do not write", async ({ page }) => {
  const { state, writes } = await setup(page);
  await booking(page);
  const row = page.getByTestId("switch-email-booking-patient");
  state.fail = 409; await row.click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  await expect(page.getByTestId("status-management-save")).toHaveCount(0);
  await expect(row).toBeChecked();
  state.fail = 500; await row.click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  state.fail = 0; await row.click(); state.revoke = true; await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("permissions changed");
  expect(writes).toHaveLength(2);
});

test("wording draft and publication keep activation; activation keeps saved draft and invalid variables block publish", async ({ page }) => {
  const { writes, scope, template } = await setup(page);
  await booking(page);
  await page.getByTestId("button-edit-email-booking-patient").click();
  await page.getByTestId("input-body").fill("Unpublished {{clinic_name}}");
  await page.getByTestId("details-advanced").getByText("Advanced", { exact: true }).click();
  await page.getByTestId("button-save-draft").click(); await page.getByTestId("button-confirm-save").click();
  await expect(page.getByTestId("status-save")).toHaveText("Draft saved.");
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByTestId("switch-email-booking-patient").click(); await confirm(page); await saved(page);
  expect(template(scope(""), "email", "patient", "booking").draft.body).toBe("Unpublished {{clinic_name}}");
  await page.getByTestId("button-edit-email-booking-patient").click();
  await expect(page.getByTestId("input-body")).toHaveValue("Unpublished {{clinic_name}}");
  await page.getByTestId("input-body").fill("Changed wording");
  // Scope is outside a modal, so ordinary users cannot interact through it.
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  await page.getByTestId("button-publish").click(); await page.getByTestId("button-confirm-save").click();
  await expect(page.getByTestId("status-save")).toHaveText("Template published.");
  expect(writes.at(-1).body.content.enabled).toBe(false);
  await page.getByTestId("input-body").fill("{{unknown_variable}}");
  await expect(page.getByTestId("button-publish")).toBeDisabled();
});

test("email staff and optional SMS switches remain independent, including activation while gate is off", async ({ page }) => {
  const { writes } = await setup(page);
  await booking(page);
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  await page.getByTestId("switch-email-booking-doctor").click(); await confirm(page); await saved(page);
  await page.getByTestId("switch-sms-booking-patient").click(); await confirm(page); await saved(page);
  await page.reload(); await booking(page);
  await expect(page.getByTestId("switch-email-booking-patient")).toBeChecked();
  await expect(page.getByTestId("switch-email-booking-doctor")).toBeChecked();
  await expect(page.getByTestId("switch-sms-booking-patient")).toBeChecked();
  await expect(page.getByTestId("checkbox-clinic-gate")).not.toBeChecked();
  expect(writes.map(w => w.body.recipient)).toEqual([undefined, "doctor", "patient"]);
  expect(writes.map(w => w.body.channel)).toEqual([undefined, "email", "sms"]);
});

test("an inherited value changed during confirmation is reread without overwriting it", async ({ page }) => {
  const { scope, writes } = await setup(page);
  await booking(page);
  await page.getByTestId("switch-email-booking-patient").click();
  scope("").items[0].enabled = false;
  await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("changed during confirmation");
  expect(writes).toHaveLength(0);
  await expect(page.getByTestId("switch-email-booking-patient")).not.toBeChecked();
});

test("Clinic Admin can save clinic gate and edit email only, with locked event activation", async ({ page }) => {
  const { writes } = await setup(page, "clinicAdmin");
  await booking(page);
  await expect(page.getByTestId("switch-email-booking-patient")).toBeDisabled();
  await expect(page.getByTestId("switch-sms-booking-patient")).toHaveCount(0);
  await expect(page.getByTestId("select-filter-recipient").locator('option[value=superAdmin]')).toHaveCount(0);
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  expect(writes[0].body).toMatchObject({ clinicId: "clinic-a", changes: [] });
  await page.getByTestId("button-edit-email-booking-patient").click();
  await expect(page.getByTestId("input-body")).toBeVisible();
  await expect(page.getByTestId("email-templates").getByTestId("select-notification-scope")).toHaveCount(0);
});

test("ordinary roles never mount editable notification management", async ({ page }) => {
  for (const role of ["doctor", "receptionist", "patient"]) {
    const { writes } = await setup(page, role);
    await expect(page.getByRole("alert")).toContainText("not authorized");
    await expect(page.getByRole("switch")).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await page.unrouteAll();
  }
});

test("group uses full unfiltered catalog, one atomic write, preserves inheritance, drafts and gate through reload", async ({ page }) => {
  const { scope, template, writes } = await setup(page);
  const s = scope("");
  template(s, "email", "doctor", "booking").draft = { body: "Saved unpublished wording" };
  await expect(page.getByTestId("status-event-booking")).toHaveText("Custom");
  await expect(page.getByTestId("switch-group-patient_login_otp")).toHaveCount(0);
  await expect(page.getByTestId("status-event-patient_login_otp")).toHaveText("Required");
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  await page.getByTestId("select-filter-channel").selectOption("email");
  await page.getByTestId("select-filter-recipient").selectOption("doctor");
  await page.getByTestId("select-filter-status").selectOption("off");
  await page.getByTestId("input-search-events").fill("booking");
  await expect(page.locator(".cm-row")).toHaveCount(1);
  await page.getByTestId("switch-group-booking").click();
  await expect(page.getByRole("dialog")).toContainText("All 3 optional channel/recipient options");
  await expect(page.getByRole("dialog")).toContainText("even those hidden by filters");
  await expect(page.getByRole("dialog")).toContainText("overall gate stays off");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(1);
  await expect(page.getByTestId("status-event-booking")).toHaveText("Custom");
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  expect(writes).toHaveLength(2);
  expect(writes[1].path).toMatch(/notification-settings$/);
  expect(writes[1].body).not.toHaveProperty("notificationsEnabled");
  expect(writes[1].body.changes).toHaveLength(2);
  expect(s.items.filter((row: any) => row.event === "booking").every((row: any) => row.enabled)).toBe(true);
  expect(s.items[0].source).toBe("default"); // Already-enabled option did not become an override.
  expect(template(s, "email", "doctor", "booking").draft.body).toBe("Saved unpublished wording");
  expect(s.inherited).toBe(false); // Explicit gate remains off.
  await page.reload();
  await expect(page.getByTestId("status-event-booking")).toHaveText("Enabled");
  await expect(page.getByTestId("checkbox-clinic-gate")).not.toBeChecked();
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  expect(writes[2].body.changes).toHaveLength(3);
  await expect(page.getByTestId("status-event-booking")).toHaveText("Disabled");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  await expect(page.getByTestId("status-event-booking")).toHaveText("Enabled");
  expect(s.items.find((row: any) => row.required).enabled).toBe(true);
});

test("group stale catalog, permission loss, batch failures and repeated actions never claim success", async ({ page }) => {
  const { scope, state, writes } = await setup(page);
  const group = page.getByTestId("switch-group-booking");
  await group.click();
  scope("").items[1].revision++;
  await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("Nothing was saved");
  expect(writes).toHaveLength(0);
  await group.click(); state.revoke = true; await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("permissions changed");
  expect(writes).toHaveLength(0);
  state.revoke = false; await page.reload();
  state.fail = 409; await group.click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  await expect(page.getByTestId("status-event-booking")).toHaveText("Custom");
  await expect(page.getByTestId("status-management-save")).toHaveCount(0);
  state.fail = 500; await group.click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  await expect(page.getByTestId("status-event-booking")).toHaveText("Custom");
  state.fail = 0; state.delay = 600;
  await group.click();
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  await expect(page.getByTestId("notification-scope").locator('button[aria-haspopup="dialog"]')).toBeDisabled();
  await group.evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
  await confirm(page);
  await saved(page);
  expect(writes).toHaveLength(3); // Two failed transactions and one successful transaction.
  expect(writes.at(-1).body).not.toHaveProperty("clinicId");
});

test("group detects a row revision conflict after confirmation and rolls back the full batch", async ({ page }) => {
  const { scope, state } = await setup(page);
  state.delay = 700;
  await page.getByTestId("switch-group-booking").click();
  const request = page.waitForRequest(req => req.method() !== "GET" && req.url().endsWith("/notification-settings"));
  await confirm(page);
  // The request is already in flight, after the confirmation recheck.
  await request;
  scope("").items[2].revision++;
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  expect(scope("").items[1].enabled).toBe(false);
  expect(scope("").items[0].enabled).toBe(true);
  await expect(page.getByTestId("status-management-save")).toHaveCount(0);
});

test("an unconfirmed saved view never reports group success", async ({ page }) => {
  const { state } = await setup(page);
  state.staleReadback = true;
  await page.getByTestId("switch-group-booking").click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("saved state could not be confirmed");
  await expect(page.getByTestId("status-management-save")).toHaveCount(0);
  state.staleReadback = false; await page.reload();
  await expect(page.getByTestId("status-event-booking")).toHaveText("Enabled");
});

for (const width of [1366, 820, 390]) test(`information, independent accordion and responsive long scope at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page);
  await page.getByRole("button", { name: "Scope (optional)", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  const info = page.getByRole("button", { name: "About Booking", exact: true });
  await info.hover();
  await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
  await page.mouse.move(0, 0);
  await info.focus();
  await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
  await info.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await info.dispatchEvent("click"); // Also works when touch has no hover or focus.
  await expect(page.getByRole("tooltip")).toContainText("Custom means mixed");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await info.press("Escape");
  await page.getByTestId("button-event-booking").focus();
  await page.getByTestId("button-event-booking").press("Enter");
  await expect(page.getByTestId("switch-email-booking-patient")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await page.getByTestId("checkbox-clinic-gate").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  if (width < 768) {
    const scopeName = await page.locator(".cm-scope-name").boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(scopeName!.y + scopeName!.height);
  }
  await page.screenshot({ path: testInfo.outputPath(`notifications-${width}.png`), fullPage: true });
});

test("touch users can open and dismiss event information without expanding the event", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await setup(page);
    const info = page.getByRole("button", { name: "About Booking", exact: true });
    await info.tap();
    await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
    await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
    await info.tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  } finally { await context.close(); }
});
