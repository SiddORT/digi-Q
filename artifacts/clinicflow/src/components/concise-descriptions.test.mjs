import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const checklist = read("../../../../docs/concise-page-descriptions.md");
const app = read("../App.tsx");
const bundle = await build({
  stdin: {
    contents: 'export { ReportTemplates } from "./reports/ReportTemplates"; export { PageDescription } from "./PageDescription"; export { SavedViews, ColumnSettings } from "./ListingViewControls"; export { REPORT_TYPES } from "./reports/report-model";',
    resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/*", "react-dom", "react-dom/*"], loader: { ".css": "empty" },
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, mod, mod.exports);
const { ReportTemplates, PageDescription, SavedViews, ColumnSettings, REPORT_TYPES } = mod.exports;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const visible = html => html.replace(/<span[^>]*class="sr-only-helptip"[^>]*>[^]*?<\/span>/g, "");
const props = { onOpen() {}, onOpenUsage() {}, canUsage: true, saved: [], onOpenSaved() {}, onDeleteSaved() {}, onRetry() {} };

test("every registered role route and direct entry has an individual checklist row", () => {
  const definition = app.match(/const routes:[^]*?= \{([^]*?)\n\};/)[1];
  let count = 0;
  for (const [, role, pages] of definition.matchAll(/(\w+):\[([^\]]*)\]/g)) {
    for (const [, page] of pages.matchAll(/"([^"]+)"/g)) {
      assert.ok(checklist.includes(`| /${role}/${page} |`), `missing ${role}/${page}`);
      count++;
    }
    assert.ok(checklist.includes(`| /${role} |`), `missing ${role} root redirect`);
  }
  assert.ok(count >= 53, "must not accidentally inspect an empty route definition");
  for (const [, route] of app.matchAll(/<Route path="([^"]+)"/g)) {
    assert.ok(checklist.includes(`| ${route} |`), `missing direct route ${route}`);
  }
});

test("nested definitions, not just route groups, are accounted for", () => {
  const clinic = read("./ClinicSettings.tsx");
  const sections = clinic.match(/const sections = \[([^]*?)\] as const/)[1];
  for (const [, label] of sections.matchAll(/\["[^"]+","([^"]+)"\]/g)) assert.ok(checklist.includes(`Clinic > ${label}`), label);
  const formTabs = read("../lib/form-tabs.ts");
  for (const label of ["Schedule", "Timing & Break", "Capacity", "Queue Settings", "Personal & Contact", "Additional Details", "Personal", "Assignment"]) {
    assert.ok(formTabs.includes(`"${label}"`));
    assert.ok(checklist.includes(label), `missing editor tab ${label}`);
  }
  const wizard = read("./ClinicRegistrationWizard.tsx");
  for (const [, step] of wizard.match(/const steps = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)) {
    assert.ok(checklist.includes(`Registration > ${step}`), `missing registration step ${step}`);
  }
  for (const tab of ["Timeline", "Activity", "Documents"]) assert.ok(checklist.includes(`Patient details > ${tab}`));
  for (const type of REPORT_TYPES) assert.ok(checklist.includes(`Family > ${type.label}`), `missing family ${type.label}`);
});

test("Report Templates has the exact heading and only its requested default introduction", () => {
  const html = render(ReportTemplates, props), shown = visible(html);
  assert.match(shown, /<h1>Report Templates<\/h1>/);
  assert.match(shown, /Open a live report or reuse a saved configuration\./);
  assert.doesNotMatch(shown, /Each template opens Live Reports|Results always reflect|Set filters in Live Reports|Relative periods/);
  assert.match(html, /aria-label="About report templates"/);
  assert.match(html, /aria-label="About saved report configurations"/);
  assert.match(html, /Each template opens Live Reports/);
  assert.match(html, /Relative periods such as 7 Days are re-evaluated/);
  assert.match(shown, /data-testid="text-no-saved-configurations">No saved configurations yet\.<\/p>/);
});

test("all report links, saved data, ownership and distinct loading/error states survive", () => {
  const saved = [{ id: "own", name: "My monthly view", filters: { preset: "month" }, ownedByMe: true },
    { id: "shared", name: "Shared clinic view", filters: { preset: "7d" }, ownedByMe: false, shared: true }];
  const html = render(ReportTemplates, { ...props, saved });
  for (const type of REPORT_TYPES) assert.ok(html.includes(`data-testid="button-template-${type.id}"`));
  assert.match(html, /My monthly view/);
  assert.match(html, /Shared clinic view/);
  assert.match(html, /button-open-config-own/);
  assert.match(html, /button-open-config-shared/);
  assert.match(html, /button-delete-config-own/);
  assert.doesNotMatch(html, /button-delete-config-shared/);
  assert.match(html, /button-template-communication/);
  const restricted = render(ReportTemplates, { ...props, canUsage: false });
  assert.match(restricted, /Available to Super Admins and Clinic Admins/);
  assert.doesNotMatch(restricted, /button-template-communication/);
  assert.match(render(ReportTemplates, { ...props, savedLoading: true }), /role="status" class="skeleton">Loading saved configurations/);
  const failed = render(ReportTemplates, { ...props, savedError: true });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Retry Saved Templates/);
  assert.doesNotMatch(failed, /text-no-saved-configurations/);
});

test("supplementary help has one labeled icon, resolvable description and no native title", () => {
  const html = render(PageDescription, { text: "Choose a clinic.", help: "Review the session before booking.", label: "About choosing a clinic" });
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.match(html, /aria-label="About choosing a clinic"/);
  const id = html.match(/aria-describedby="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${id}" class="sr-only-helptip"`));
  assert.doesNotMatch(html, /\stitle=|<a\b/);
  assert.doesNotMatch(visible(html), /Review the session/);
  assert.doesNotMatch(render(PageDescription, { text: "No records yet." }), /<button/);
  const css = read("./page-description.css");
  assert.match(css, /white-space: normal/);
  assert.doesNotMatch(css, /line-clamp|text-overflow|display:\s*none|overflow:\s*hidden/);
});

test("shared drawer instructions remain available once, not stacked default paragraphs", () => {
  // Closed dialogs deliberately render no content; inspect their explicit composition,
  // then verify the composed description itself through the render test above.
  const source = read("./ListingViewControls.tsx");
  for (const text of ["Save and reuse your filters and column layout.", "Import older views from this device.", "Choose which columns to show."]) assert.ok(source.includes(text));
  assert.match(source, /help="Views keep filters, sort, page size and column layout/);
  assert.match(source, /Search text is never saved/);
  assert.doesNotMatch(visible(render(SavedViews, { views: [], canSave: false })), /Views keep/);
  assert.match(render(ColumnSettings, { columns: ["name"], layout: { order: [], hidden: [], pinned: null }, label: c => c, onChange() {}, onReset() {} }), /button-column-settings/);
  const empty = read("../resources.tsx").match(/export function Empty[^]*?\n/)[0];
  assert.match(empty, /data-testid="status-empty"/);
  assert.doesNotMatch(empty, /<p>|you'll find them here/, "do not repeat the empty heading with generic filler");
});

test("description icons retain existing hover/focus/touch and mutual-dismissal behavior", () => {
  const source = read("./HelpTip.tsx");
  assert.match(source, /onPointerEnter: \(e: ReactPointerEvent\) => \{ if \(e\.pointerType !== "touch"\) show\(\)/);
  assert.doesNotMatch(source, /onMouseEnter:/, "compatibility mouseenter after touch must not reopen help");
  assert.match(source, /onFocus=\{show\} onBlur=\{close\}/);
  assert.match(source, /e\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown", down\)/);
  assert.match(source, /const n = !pinned; dismissTooltips\(\); setPinned\(n\); setOpen\(n\)/);
  assert.match(source, /window\.addEventListener\(DISMISS_TOOLTIPS/);
  assert.match(read("./NotificationInfo.tsx"), /DISMISS_TOOLTIPS/);
});
