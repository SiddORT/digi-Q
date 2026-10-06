import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");

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
