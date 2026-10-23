// Source ownership guard: each audited property has ONE authoritative owner.
// See docs/ui/style-ownership-cleanup.md. Rendered parity is checked separately
// with scripts/control-cascade-evidence.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const rules = f => [...css(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ sel: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const declares = (f, selRe, prop) => rules(f).filter(r => selRe.test(r.sel) && new RegExp(`(^|[;\\s])${prop}\\s*:`).test(r.body));

test("1 list-header wrapping owned by responsive-action-group", () => {
  assert.equal(declares("compact-workspace.css", /\.lh-top$/, "flex-wrap").length, 0);
  assert.ok(declares("components/responsive-action-group.css", /\.lh-top$/, "flex-wrap").length >= 1);
  assert.match(css("components/responsive-action-group.css"), /\.rag-toggle\{display:inline-flex/);
});
test("2-4 form field layout, label, toggle, help owned by form-standard/compact-ui", () => {
  const sf = "components/shared-feedback.css";
  assert.equal(declares(sf, /^\.form-field$/, "display").length, 0);
  assert.equal(declares(sf, /form-field-label$/, "align-items").length, 0);
  assert.equal(declares(sf, /form-field-label$/, "gap").length, 0);
  assert.equal(declares(sf, /password-toggle$/, "height").length, 0);
  assert.equal(declares(sf, /password-toggle$/, "min-height").length, 0);
  for (const sel of [/^\.form-field-help$/, /^\.form-field-error$/])
    for (const p of ["font-size", "margin-top", "color"]) assert.equal(declares(sf, sel, p).length, 0, `${sel} ${p}`);
  assert.ok(declares("compact-ui.css", /password-toggle$/, "height").length >= 1);
});
test("5 dialog max-height and scroll padding", () => {
  assert.equal(declares("components/app-dialog.css", /^\.app-dialog$/, "max-height").length, 0);
  assert.ok(declares("form-standard.css", /^\.app-dialog$/, "max-height").length >= 1);
  assert.equal(declares("components/clinic-settings.css", /app-dialog-body$/, "scroll-padding-bottom").length, 0);
  assert.equal(declares("compact-workspace.css", /^\.app-dialog-body$/, "scroll-padding-bottom").length, 1);
});
test("6 appt-bulk spacing owned by compact-workspace", () => {
  const f = "components/appointments/visit-range.css";
  assert.equal(declares(f, /^\.workspace \.appt-bulk$/, "margin").length, 0);
  assert.equal(declares(f, /^\.workspace \.appt-bulk button$/, "padding").length, 0);
});
test("7 notification trigger / blocked list have no shadowed duplicates", () => {
  const trig = declares("components/communication.css", /^\.event-controls \.cm-event-trigger$/, "padding");
  assert.equal(trig.length, 1);
  assert.equal(declares("components/email-templates.css", /ec-blocked$/, "margin").length, 0);
  assert.equal(declares("components/email-templates.css", /ec-blocked$/, "padding-left").length, 0);
  assert.equal(declares("components/notification-page.css", /^\.event-controls \.cm-event-trigger$/, "width").length, 0);
  assert.equal(declares("components/communication.css", /^\.event-controls \.cm-row-actions$/, "gap").length, 0);
});
test("8 listing search flex declared once per selector", () => {
  const f = "components/uniformity.css";
  assert.equal(declares(f, /^\.workspace \.list-header \.lh-top \.lh-search$/, "flex").length, 2);
  const src = css(f);
  assert.ok(!src.includes("flex:1 1 360px") && !src.includes("flex:1 1 280px"));
});
test("9 et-form gap owned by form-standard", () => {
  assert.equal(declares("components/email-templates.css", /^\.et-form$/, "gap").length, 0);
  assert.ok(declares("form-standard.css", /^\.et-form$/, "gap").length === 1);
});
test("10 public-clinic-card padding declared once", () => {
  assert.equal(declares("components/clinic-registration.css", /^\.public-clinic-card$/, "padding").length, 1);
});
test("11 touch 44px pagination/select-clear declared once, important retained", () => {
  const s = css("index.css");
  assert.equal((s.match(/\.searchable-select-clear\{min-width:44px!important;min-height:44px!important\}/g) || []).length, 1);
  assert.equal((s.match(/\.pagination button,\.pagination select\{min-height:44px!important\}/g) || []).length, 1);
  assert.match(s, /@media\(max-width:767px\),\(pointer:coarse\)\{\.pagination button/);
});
test("12 editor-tab selected owned by form-standard; invalid and touch preserved", () => {
  assert.equal(declares("components/uniformity.css", /^\.editor-tab\.is-active$/, "color").length, 0);
  assert.equal(declares("form-standard.css", /^\.editor-tab\.is-active$/, "color").length, 1);
  assert.ok(declares("components/uniformity.css", /is-active\.is-invalid$/, "color").length >= 1);
  assert.match(css("components/uniformity.css"), /@media \(max-width:767px\)\{\.editor-tab\{min-height:var\(--control-lg\)\}/);
});
