import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("integration source radios keep intrinsic dimensions and adjacent labels", () => {
  const css = read("./integration-settings.css");
  assert.match(css, /fieldset>label:has\(>input\[type="radio"\]\)\{display:flex;align-items:center/);
  assert.match(css, /input\[type="radio"\]\{display:inline-block;width:18px;height:18px/);
});

test("sidebar no longer renders Recent for any role", () => {
  const s = read("./WorkspaceShell.tsx");
  assert.doesNotMatch(s, /<span>Recent<\/span>/);
  assert.doesNotMatch(s, /prefs\.recent/);
  assert.match(s, /Favorites/);
});
test("Editor uses shared FormActions with Cancel before Save", () => {
  const r = read("../resources.tsx");
  assert.match(r, /<FormActions onCancel=\{onCancel\}/);
  const f = read("./FormActions.tsx");
  assert.ok(f.indexOf("data-testid={cancelTestId}") < f.indexOf("data-testid={submitTestId}"));
  assert.match(f, /disabled=\{busy \|\| cancelDisabled\}/);
});
test("routine explanations are HelpTips; critical errors stay visible", () => {
  const r = read("../resources.tsx");
  assert.match(r, /HelpTip label="About patient status"/);
  assert.match(r, /HelpTip label="About clinics"/);
  assert.match(r, /role="alert" className="field-error">This session overlaps/);
});
test("content-sized compact fields are shared CSS", () => {
  const c = read("../compact-workspace.css");
  assert.match(c, /\.form-actions\{display:flex/);
  assert.match(c, /grid-template-columns:repeat\(12/);
  assert.match(read("../lib/field-width.ts"), /key === "address" \|\| type === "tel"/);
});

test("listing toolbars do not repeat the record count that pagination shows", () => {
  for (const f of ["../resources.tsx", "../Users.tsx", "./SystemUsers.tsx"]) assert.doesNotMatch(read(f), /listing-count">\{(query\.)?data\.total\}/, f);
  assert.doesNotMatch(read("../clinic.tsx"), /listing-count">\{q\.data\.total\}/);
  assert.match(read("./ListingControls.tsx"), /of\{" "\}/);
});
test("editor fields sit in a semantic-width grid", async () => {
  const { fieldWidth } = await import("../lib/field-width.ts").catch(() => ({}));
  const src = read("../lib/field-width.ts");
  assert.match(src, /type === "date" \|\| type === "time"/);
  const r = read("../resources.tsx");
  assert.match(r, /className="form-grid field-grid"/);
  assert.match(r, /className=\{fieldWidthClass\(field\)\}/);
  const c = read("../compact-workspace.css");
  assert.match(c, /container-type:inline-size/);
  assert.match(c, /\.fw-sm\{grid-column:span 3\}/);
  if (fieldWidth) { assert.equal(fieldWidth({ key: "maxTokens", type: "number" }), "xs"); assert.equal(fieldWidth({ key: "date", type: "date" }), "sm"); assert.equal(fieldWidth({ key: "about", type: "textarea" }), "full"); }
});
test("shared FormActions adopted by other form surfaces", () => {
  for (const f of ["../Users.tsx", "./ClinicSettings.tsx", "./appointments/TicketEmailDialog.tsx", "./schedule/WeeklyScheduleEditor.tsx"]) assert.match(read(f), /<FormActions /, f);
});
test("remaining Editor guidance is HelpTip; validation stays inline", () => {
  const r = read("../resources.tsx");
  for (const l of ["About session time", "About session scope", "About age", "About account protection", "About web address"]) assert.match(r, new RegExp(`label="${l}"`));
  assert.match(r, /info=\{helper\}/);
  assert.match(r, /This session extends outside a clinic opening interval/);
  assert.match(r, /role="alert" className="field-error">Closing time must follow opening time/);
});

test("custom form surfaces use the shared action footer", () => {
  const files = ["./EmailTemplates.tsx", "./CustomRoles.tsx", "./appointments/AppointmentRows.tsx", "./IntegrationSettings.tsx", "./IntegrationEditor.tsx", "./ClinicRegistrationWizard.tsx", "./ClinicSettings.tsx", "./schedule/WeeklyScheduleEditor.tsx"];
  for (const f of files) { const s = read(f); assert.match(s, /<FormActions /, f); assert.doesNotMatch(s, /<div className="form-footer">/, f); }
  assert.doesNotMatch(read("./ClinicRegistrationWizard.tsx"), /registration-footer/);
  for (const id of ["button-publish", "button-save-draft", "button-cancel", "button-reset", "button-confirm-save", "button-discard", "button-keep-editing"]) assert.match(read("./EmailTemplates.tsx"), new RegExp(id));
  assert.match(read("./ClinicRegistrationWizard.tsx"), /cancelTestId="registration-back"[^]*submitTestId="registration-next"/);
});
test("FormActions cancel can use the AppDialog guarded close (dirty confirm preserved)", () => {
  const f = read("./FormActions.tsx");
  assert.match(f, /useAppDialogClose\(\)/);
  assert.match(f, /cancelClosesDialog \? dialogClose/);
  assert.match(read("./ClinicSettings.tsx"), /cancelClosesDialog busy=\{save\.isPending\}/);
  assert.match(read("./IntegrationEditor.tsx"), /guardedClose \? guardedClose\(\) : onCancel\(\)/);
});
test("custom forms use shared content-sized track grids", () => {
  const c = read("../compact-workspace.css");
  assert.match(c, /:is\(\.editor-container,\.cf-form\) \.form-grid\.field-grid/);
  assert.match(c, /\.form-grid\.cf-auto,\.registration-card \.registration-fields\{grid-template-columns:repeat\(auto-fill/);
  assert.match(read("./IntegrationEditor.tsx"), /className="cf-form"><div className="form-grid field-grid">/);
  assert.match(read("./ClinicSessionSetup.tsx"), /form-grid cf-auto/);
});
test("integration warnings stay visible; routine copy is help", () => {
  const s = read("./IntegrationEditor.tsx");
  assert.match(s, /<p role="note">This removes the saved website configuration/);
  assert.match(s, /\{save\.isError && <p role="alert">/);
  assert.match(s, /HelpTip label="About stored values"/);
});

test("booking and guest booking share action alignment and auto-sized grids (layout only)", () => {
  const c = read("../clinic.tsx"), g = read("./GuestBooking.tsx");
  assert.equal((c.match(/form-footer form-actions/g) || []).length >= 3, true);
  assert.match(c, /form-actions-secondary"><button disabled=\{book\.isPending\} onClick=\{\(\)=>setStep\(1\)\}>Change Visit/);
  assert.match(c, /data-testid="button-confirm-booking"/);
  assert.match(g, /<div className="form-footer form-actions"><button className="button" data-testid="button-submit-guest"/);
  assert.equal((g.match(/form-grid cf-auto/g) || []).length, 2);
});

test("compound phone fields get full/double tracks and page footers never overlay fields", async () => {
  const c = read("../compact-workspace.css");
  assert.match(c, /\.registration-card \.registration-fields>:has\(\.phone-input\)/);
  assert.match(c, /\.form-grid\.cf-auto>:has\(\.phone-input\)/);
  assert.match(c, /\.form-footer\.form-actions\{position:static\}/);
  assert.match(c, /\.app-dialog-body \.form-footer\.form-actions\{position:sticky/);
  assert.match(c, /scroll-padding-bottom/);
  assert.match(read("../lib/field-width.ts"), /type === "tel"\) return "lg"/);
});
