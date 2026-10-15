import { test, expect, type Page } from "@playwright/test";
import { eventSections } from "../notification-catalog";

// Stateful fictional API only. Real persistence and authorization are covered
// separately against disposable PostgreSQL and native staff sessions.
async function setup(page: Page, role = "superAdmin", clinicCount = 1, linked = "", longName = false) {
  const writes: any[] = [];
  const reads: string[] = [];
  const state = { fail: 0, revoke: false, delay: 0, readDelay: 0, staleReadback: false, readFail: false, empty: false };
  const clinics = [{ id: "clinic-a", name: longName ? "Fixture Clinic — North and Central Multispeciality Care Group With a Very Long Complete Name" : "Fixture Clinic" }, { id: "clinic-b", name: "Second Clinic" }].slice(0, clinicCount);
  const scopes = new Map<string, any>();
  const scope = (id: string) => {
    if (!scopes.has(id)) scopes.set(id, {
      revision: 1, notificationsEnabled: true, inherited: true,
      scopeName: id ? "Fixture Clinic — North and Central Multispeciality Care Group" : "System Default", canActivate: true,
      events: eventSections,
      items: [
        { channel: "email", event: "booking", recipient: "patient", revision: 1, enabled: true, source: id ? "platform" : "default", ready: true, blockedReasons: [], timing: "On booking confirmation; not a promise of consultation time." },
        { channel: "email", event: "booking", recipient: "doctor", revision: 1, enabled: false, source: "default", ready: false, blockedReasons: ["Provider unavailable"], timing: "" },
          { channel: "sms", event: "booking", recipient: "patient", canEdit: role === "superAdmin", revision: 1, enabled: false, source: "default", ready: false, blockedReasons: ["Publish a valid DLT Template ID"], timing: "" },
        ...(role === "superAdmin" && !id ? [
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
      clinics, activeClinicId: "clinic-a", canManage: true, items: [], revision: 1,
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
      if (!body) {
        reads.push(url.searchParams.get("clinicId") || "");
        if (state.readDelay) await new Promise(r => setTimeout(r, state.readDelay));
        if (state.readFail) return route.fulfill({ status: 500, json: { error: "Fictional recoverable error" } });
      }
      if (body) {
        if (body.revision !== s.revision || body.changes.some((change: any) =>
          !s.items.some((row: any) => row.channel === change.channel && row.event === change.event && row.recipient === change.recipient && row.revision === change.revision && row.canActivate !== false))) {
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
      return route.fulfill({ json: { ...data, items: state.empty ? [] : data.items, canActivate: !state.revoke && s.canActivate } });
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
    if (path.endsWith("/clinics")) {
      const search = url.searchParams.get("search")?.toLowerCase() || "";
      const items = clinics.filter(c => c.name.toLowerCase().includes(search));
      return route.fulfill({ json: { items, total: items.length, page: 1 } });
    }
    if (/\/clinics\/clinic-/.test(path)) return route.fulfill({ json: clinics.find(c => path.endsWith(c.id)) });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto(`/?mode=templates&role=${role}${linked}`);
  if (["superAdmin", "clinicAdmin"].includes(role)) await expect(page.getByTestId("checkbox-clinic-gate")).toBeVisible();
  return { state, writes, reads, scope, template, clinics };
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
  expect(header!.height).toBeGreaterThanOrEqual(44);
  const gate = page.getByTestId("checkbox-clinic-gate");
  expect(await gate.evaluate(el => el.tagName)).toBe("BUTTON");
  expect(await gate.evaluate(el => getComputedStyle(el).borderRadius)).toBe("999px");
  expect(await gate.evaluate(el => {
    const track = el.getBoundingClientRect(), thumb = el.firstElementChild!.getBoundingClientRect();
    return thumb.left >= track.left && thumb.right <= track.right;
  })).toBe(true);
  await expect(page.getByTestId("switch-group-booking")).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath(`${role}-laptop.png`), fullPage: true });
  console.log(role, header, await page.getByTestId("notification-scope").boundingBox());
});

test("gate and row confirmations cancel without writes; security is switchable; saves persist independently after reload", async ({ page }) => {
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
  await expect(page.getByTestId("text-gate-off")).toContainText("Clinics with explicit overrides may differ");
  await page.getByTestId("button-event-patient_login_otp").click();
  await expect(page.getByTestId("switch-sms-patient_login_otp-patient")).toBeEnabled();
  await expect(page.getByTestId("status-event-patient_login_otp")).toHaveText("All Enabled");
  await row.click(); await confirm(page); await saved(page);
  await page.reload(); await booking(page);
  await expect(row).not.toBeChecked(); await expect(gate).not.toBeChecked();
  expect(writes).toHaveLength(2);
  expect(writes[0].body).toMatchObject({ notificationsEnabled: false, changes: [], revision: 1, confirmed: true });
  expect(writes[1].body).toMatchObject({ revision: 2, changes: [{ channel: "email", event: "booking", recipient: "patient", revision: 1, enabled: false }], confirmed: true });
});
for (const width of [1366,390]) test(`security switches persist off/on with warnings and editor activation at ${width}px`,async({page},testInfo)=>{
  const {writes,scope,template}=await setup(page);
  await page.setViewportSize({width,height:844});
  const s=scope("");
  s.items.push({channel:"email",event:"doctor_setup",recipient:"doctor",required:true,canActivate:true,
    enabled:true,revision:1,source:"platform",ready:true,blockedReasons:[],timing:"Platform security delivery"});
  template(s,"sms","patient","patient_login_otp").draft={...template(s,"sms","patient","patient_login_otp").content,body:"Saved unpublished security wording"};
  await page.reload();
  await page.getByTestId("button-event-patient_login_otp").click();
  const row=page.getByTestId("switch-sms-patient_login_otp-patient");
  await expect(row).toBeChecked();
  await row.focus();await row.press("Space");
  await expect(page.getByRole("dialog")).toContainText("New SMS login codes will be unavailable");
  await expect(page.getByRole("dialog")).toContainText("Messages already dispatched cannot be recalled");
  await confirm(page);await saved(page);
  await expect(row).not.toBeChecked();
  await expect(page.getByTestId("card-template-sms-patient_login_otp-patient")).toContainText("Off");
  expect(s.notificationsEnabled).toBe(true);
  expect(s.items.find((r:any)=>r.event==="doctor_setup").enabled).toBe(true);
  await page.reload();await page.getByTestId("button-event-patient_login_otp").click();
  await expect(row).not.toBeChecked();
  await page.getByTestId("button-edit-sms-patient_login_otp-patient").click();
  await expect(page.getByTestId("text-activation-note")).toContainText("Currently off");
  await expect(page.getByTestId("input-body")).toHaveValue("Saved unpublished security wording");
  await page.screenshot({path:testInfo.outputPath(`security-editor-${width}.png`)});
  await page.getByTestId("button-cancel").click();
  await page.getByTestId("switch-group-patient_login_otp").click();
  await confirm(page);await saved(page);
  await expect(row).toBeChecked();
  expect(writes).toHaveLength(2);
  expect(writes.every(w=>w.body.notificationsEnabled===undefined)).toBe(true);
  await page.screenshot({path:testInfo.outputPath(`security-switches-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("clinic scope shares inherited gate, rows and editor; pending actions lock scope and prevent double writes", async ({ page }) => {
  const { state, writes } = await setup(page);
  await page.getByRole("button", { name: "Notification Clinic", exact: true }).click();
  await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await expect(page.getByTestId("notification-scope")).toContainText("Fixture Clinic");
  const gateHelp = page.getByRole("button", { name: "About Optional Delivery", exact: true });
  await gateHelp.focus();
  await expect(page.getByRole("tooltip")).toContainText("Inherited system value");
  await gateHelp.press("Escape");
  await booking(page);
  const rowHelp = page.getByRole("button", { name: "Activation Details: email to Patient", exact: true });
  await rowHelp.focus();
  await expect(page.getByRole("tooltip")).toContainText("Inherited system activation");
  await rowHelp.press("Escape");
  state.delay = 700;
  await page.getByTestId("switch-email-booking-patient").click();
  await expect(page.getByTestId("notification-scope").locator('button[aria-haspopup="dialog"]')).toBeDisabled();
  await confirm(page);
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  await saved(page);
  expect(writes).toHaveLength(1); expect(writes[0].body.clinicId).toBe("clinic-a");
  await page.getByTestId("button-edit-email-booking-patient").click();
  await expect(page.getByTestId("row-enabled")).toContainText("Currently off");
  await expect(page.getByTestId("email-templates").getByRole("button", { name: "Notification Clinic" })).toHaveCount(0);
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
  expect(writes.map(w => w.body.changes[0]?.recipient)).toEqual([undefined, "doctor", "patient"]);
  expect(writes.map(w => w.body.changes[0]?.channel)).toEqual([undefined, "email", "sms"]);
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

test("Clinic Admin can save owned clinic gate, groups, Email and SMS activation without SMS wording access", async ({ page }) => {
  const { writes } = await setup(page, "clinicAdmin");
  await booking(page);
  await expect(page.getByTestId("switch-email-booking-patient")).toBeEnabled();
  await expect(page.getByTestId("switch-sms-booking-patient")).toBeEnabled();
  await expect(page.getByTestId("button-edit-sms-booking-patient")).toHaveCount(0);
  await expect(page.getByTestId("text-preview-sms-booking-patient")).toHaveText("SMS wording managed by System Admin");
  await expect(page.getByTestId("select-filter-recipient").locator('option[value=superAdmin]')).toHaveCount(0);
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  expect(writes[0].body).toMatchObject({ clinicId: "clinic-a", changes: [] });
  await page.getByTestId("switch-email-booking-patient").click(); await confirm(page); await saved(page);
  await page.getByTestId("switch-sms-booking-patient").click(); await confirm(page); await saved(page);
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  expect(writes.every(w => w.body.clinicId === "clinic-a")).toBe(true);
  await expect(page.getByTestId("status-event-booking")).toHaveText("All Enabled");
  await page.reload(); await booking(page);
  await expect(page.getByTestId("switch-sms-booking-patient")).toBeChecked();
  await page.getByTestId("button-edit-email-booking-patient").click();
  await expect(page.getByTestId("input-body")).toBeVisible();
  await expect(page.getByTestId("email-templates").getByTestId("select-notification-scope")).toHaveCount(0);
});
test("canonical unfiltered sections persist across two clinics; platform security stays informational and role-safe",async({page})=>{
  const {writes}=await setup(page,"superAdmin",2);
  const ids=()=>page.locator(".cm-event").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-testid")));
  const expected=eventSections.map(e=>`group-event-${e.id}`);
  expect(await ids()).toEqual(expected);
  for(const name of ["Fixture Clinic","Second Clinic"]){
    await page.getByRole("button",{name:"Notification Clinic",exact:true}).click();
    await page.getByRole("option",{name,exact:true}).click();
    await expect(page.getByTestId("status-event-patient_login_otp")).toHaveText("Managed at System Default");
    expect(await ids()).toEqual(expected);
    await page.getByTestId("button-event-patient_login_otp").click();
    const section=page.getByTestId("group-event-patient_login_otp");
    await expect(section.getByRole("switch")).toHaveCount(0);
    await expect(section.locator(".cm-row")).toHaveCount(0);
  }
  await page.getByTestId("button-system-default-patient_login_otp").click();
  await expect(page.getByTestId("notification-scope")).toContainText("System Default");
  expect(writes).toEqual([]);
  await page.unrouteAll();
  await setup(page,"clinicAdmin");
  await page.getByTestId("button-event-patient_login_otp").click();
  await expect(page.getByTestId("note-managed-patient_login_otp")).toBeVisible();
  await expect(page.getByTestId("button-system-default-patient_login_otp")).toHaveCount(0);
  await expect(page.getByTestId("button-edit-sms-patient_login_otp-patient")).toHaveCount(0);
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
  await expect(page.getByTestId("status-event-booking")).toHaveText("Mixed");
  await expect(page.getByTestId("switch-group-patient_login_otp")).toBeEnabled();
  await expect(page.getByTestId("status-event-patient_login_otp")).toHaveText("All Enabled");
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  await page.getByTestId("select-filter-channel").selectOption("email");
  await page.getByTestId("select-filter-recipient").selectOption("doctor");
  await page.getByTestId("select-filter-status").selectOption("off");
  await page.getByTestId("input-search-events").fill("booking");
  await expect(page.locator(".cm-row")).toHaveCount(1);
  await page.getByTestId("switch-group-booking").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Enable Booking — All 3 Options?" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("All 3 authorized channel/recipient options");
  await expect(page.getByRole("dialog")).toContainText("even those hidden by filters");
  await expect(page.getByRole("dialog")).toContainText("overall gate stays off");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(1);
  await expect(page.getByTestId("status-event-booking")).toHaveText("Mixed");
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
  await expect(page.getByTestId("status-event-booking")).toHaveText("All Enabled");
  await expect(page.getByTestId("checkbox-clinic-gate")).not.toBeChecked();
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  expect(writes[2].body.changes).toHaveLength(3);
  await expect(page.getByTestId("status-event-booking")).toHaveText("All Disabled");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("switch-group-booking").click(); await confirm(page); await saved(page);
  await expect(page.getByTestId("status-event-booking")).toHaveText("All Enabled");
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
  await expect(page.getByTestId("status-event-booking")).toHaveText("Mixed");
  await expect(page.getByTestId("status-management-save")).toHaveCount(0);
  state.fail = 500; await group.click(); await confirm(page);
  await expect(page.getByTestId("status-management-error")).toContainText("not saved");
  await expect(page.getByTestId("status-event-booking")).toHaveText("Mixed");
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
  await expect(page.getByTestId("status-event-booking")).toHaveText("All Enabled");
});

for (const width of [1440, 1024, 768, 390]) test(`information, independent accordion and responsive long scope at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const { clinics } = await setup(page, "superAdmin", 1, "", true);
  await page.getByRole("button", { name: "Notification Clinic", exact: true }).click();
  await page.getByRole("option", { name: /Fixture Clinic/ }).click();
  const selectedName = page.getByTestId("notification-scope").locator(".ov-text");
  await expect(selectedName).toHaveText(clinics[0].name);
  expect(await selectedName.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  await selectedName.focus();
  await expect(page.getByRole("tooltip")).toContainText(clinics[0].name);
  await selectedName.press("Escape");
  const info = page.getByRole("button", { name: "About Booking", exact: true });
  await info.hover();
  await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
  await page.mouse.move(0, 0);
  await info.focus();
  await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
  await info.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await info.dispatchEvent("click"); // Also works when touch has no hover or focus.
  await expect(page.getByRole("tooltip")).toContainText("On booking confirmation");
  await expect(page.locator("#notification-group-guidance")).toHaveCount(1);
  await expect(page.locator("#notification-group-guidance")).toContainText("From Mixed, switch on to enable all");
  await expect(page.getByTestId("button-event-booking")).toHaveAttribute("aria-expanded", "false");
  await info.press("Escape");
  await page.getByTestId("button-event-booking").focus();
  await page.getByTestId("button-event-booking").press("Enter");
  await expect(page.getByTestId("switch-email-booking-patient")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await page.getByTestId("checkbox-clinic-gate").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  for (const id of ["input-search-events", "select-filter-channel", "select-filter-recipient", "select-filter-status"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("input-search-events")).toHaveAttribute("placeholder", "Search events or wording");
  for (const control of await page.locator('button.cm-switch').all()) {
    expect(await control.evaluate(el => {
      const track=el.getBoundingClientRect(),thumb=el.firstElementChild!.getBoundingClientRect();
      return getComputedStyle(el).borderRadius==="999px" && thumb.left>=track.left && thumb.right<=track.right && thumb.top>=track.top && thumb.bottom<=track.bottom;
    })).toBe(true);
  }
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toHaveCount(1);
  const icon = await info.locator("svg").boundingBox();
  expect(icon!.width).toBeGreaterThanOrEqual(18);
  const colour = await info.evaluate(el => getComputedStyle(el).color);
  expect(colour).not.toBe("rgba(0, 0, 0, 0)");
  await page.getByTestId("button-edit-email-booking-patient").click();
  for (const id of ["button-save-draft", "button-publish", "button-reset", "button-cancel"]) await expect(page.getByTestId(id)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`notification-drawer-${width}.png`), fullPage: true });
  await page.getByTestId("button-cancel").click();
  await page.screenshot({ path: testInfo.outputPath(`notifications-${width}.png`), fullPage: true });
});

test("touch users can reveal the full long clinic name in the scope options", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const { clinics } = await setup(page, "superAdmin", 1, "", true);
    await page.getByRole("button", { name: /Notification Clinic/ }).tap();
    const fullNameOption = page.getByRole("option", { name: clinics[0].name, exact: true });
    await expect(fullNameOption).toBeVisible();
    await expect(fullNameOption).toHaveText(clinics[0].name);
  } finally { await context.close(); }
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

test("System Default ignores old clinic links, stays searchable and returns without writes", async ({ page }) => {
  const { reads, writes } = await setup(page, "superAdmin", 2, "&clinicId=clinic-b&keep=1");
  const picker = page.getByRole("button", { name: "Notification Clinic", exact: true });
  await expect(page.getByTestId("notification-scope")).toContainText("System Default");
  await expect(page).not.toHaveURL(/clinicId/);
  await expect(page).toHaveURL(/keep=1/);
  expect(reads).toEqual([""]);
  await picker.click();
  const search = page.getByRole("combobox", { name: "Search options" });
  await search.fill("Second");
  await expect(page.getByRole("option", { name: /System Default/ })).toBeVisible();
  await page.getByRole("option", { name: "Second Clinic", exact: true }).click();
  await expect.poll(() => reads.at(-1)).toBe("clinic-b");
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeEnabled();
  await picker.click();
  await page.getByRole("option", { name: "System Default", exact: true }).click();
  await expect(page.getByTestId("notification-scope")).toContainText("System Default");
  expect(writes).toEqual([]);
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  expect(writes[0].body).not.toHaveProperty("clinicId");
});

test("single Clinic Admin hides the selector; multiple owned clinics never offer system scope", async ({ page }) => {
  await setup(page, "clinicAdmin");
  await expect(page.getByRole("button", { name: "Notification Clinic", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("notification-scope")).toContainText("Fixture Clinic");
  await page.unroute("**/api/**");
  const { writes } = await setup(page, "clinicAdmin", 2);
  await page.getByRole("button", { name: "Notification Clinic", exact: true }).click();
  await expect(page.getByRole("option", { name: "System Default", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Second Clinic", exact: true }).click();
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeEnabled();
  await page.getByTestId("checkbox-clinic-gate").click(); await confirm(page); await saved(page);
  expect(writes[0].body.clinicId).toBe("clinic-b");
});

test("scope loading locks stale actions and every write retains its exact selected target", async ({ page }) => {
  const { state, reads, writes } = await setup(page, "superAdmin", 2);
  state.readDelay = 700;
  const picker = page.getByRole("button", { name: "Notification Clinic", exact: true });
  await picker.click(); await page.getByRole("option", { name: "Fixture Clinic", exact: true }).click();
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  await expect(page.getByTestId("state-loading")).toBeVisible();
  await picker.click(); await page.getByRole("option", { name: "Second Clinic", exact: true }).click();
  await expect.poll(() => reads.includes("clinic-b")).toBe(true);
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeEnabled();
  await page.getByTestId("checkbox-clinic-gate").click();
  await expect(page.getByRole("dialog")).toContainText("Disable Overall Optional Delivery?");
  await confirm(page); await saved(page);
  expect(writes).toHaveLength(1);
  expect(writes[0].body.clinicId).toBe("clinic-b");
});

test("common gate warning appears once; distinct blockers, required treatment and full previews remain", async ({ page }) => {
  const { scope, template } = await setup(page);
  const s = scope("");
  s.notificationsEnabled = false;
  s.items.forEach((r: any) => { if (!r.required) r.blockedReasons.push("Platform default notification gate is off; clinics may have explicit overrides"); });
  s.items[0].blockedReasons.push("Recipient address unavailable");
  const message = "Long fictional wording ".repeat(40) + "Complete ending remains available.";
  template(s, "email", "patient", "booking").content.body = message;
  await page.reload(); await booking(page);
  await expect(page.getByTestId("text-gate-off")).toHaveCount(1);
  await expect(page.locator(".ec-blocked").getByText("Platform default notification gate is off; clinics may have explicit overrides", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("setup-email-booking-patient")).toContainText("Recipient address unavailable");
  await expect(page.getByTestId("card-template-email-booking-patient")).toContainText("On, Blocked");
  const preview = page.getByTestId("text-preview-email-booking-patient");
  await expect(preview).toHaveText(message);
  await preview.focus();
  await expect(page.getByRole("tooltip")).toContainText("Complete ending remains available.");
  await preview.press("Escape");
  await page.getByTestId("button-event-patient_login_otp").click();
  await expect(page.getByTestId("status-event-patient_login_otp")).toHaveText("All Enabled");
  await expect(page.getByTestId("group-event-patient_login_otp").getByRole("switch")).toHaveCount(2);
  await expect(page.getByTestId("button-edit-sms-patient_login_otp-patient")).toBeEnabled();
});

test("draft failure and conflict keep edits; close cancellation and discard remain separate", async ({ page }) => {
  const { state, writes } = await setup(page);
  await booking(page);
  await page.getByTestId("button-edit-email-booking-patient").click();
  const body = page.getByTestId("input-body");
  await body.fill("Fictional unsaved recovery wording");
  state.fail = 500;
  await page.getByTestId("button-save-draft").click(); await page.getByTestId("button-confirm-save").click();
  await expect(page.getByTestId("status-template-save-error")).toBeVisible();
  await expect(body).toHaveValue("Fictional unsaved recovery wording");
  state.fail = 409;
  await page.getByTestId("button-save-draft").click(); await page.getByTestId("button-confirm-save").click();
  await expect(page.getByTestId("state-conflict")).toBeVisible();
  await expect(body).toHaveValue("Fictional unsaved recovery wording");
  await expect(page.getByTestId("button-publish")).toBeDisabled();
  await page.getByTestId("button-cancel").click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Discard Unsaved Changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep Editing", exact: true }).click();
  await expect(body).toHaveValue("Fictional unsaved recovery wording");
  await page.getByTestId("button-cancel").click(); await page.getByTestId("button-discard-editor").click();
  await expect(body).toHaveCount(0);
  expect(writes).toHaveLength(2);
});

test("loading, recoverable errors, empty catalogs and no matches are distinct", async ({ page }) => {
  const { state } = await setup(page);
  await page.getByTestId("input-search-events").fill("no matching event or wording");
  await expect(page.getByTestId("state-empty")).toHaveText("No events match these filters.");
  await expect(page.getByTestId("button-clear-filters")).toBeVisible();
  await page.getByTestId("button-clear-filters").click();
  await expect(page.getByTestId("button-clear-filters")).toHaveCount(0);
  state.empty = true; await page.reload();
  await expect(page.getByTestId("button-event-booking")).toBeVisible();
  await page.getByTestId("button-event-booking").click();
  await expect(page.getByTestId("empty-event-booking")).toBeVisible();
  state.empty = false; state.readFail = true;
  await page.reload();
  await expect(page.getByTestId("state-error")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("checkbox-clinic-gate")).toBeDisabled();
  state.readFail = false; await page.getByTestId("button-retry").click();
  await expect(page.getByTestId("button-event-booking")).toBeVisible();
});
