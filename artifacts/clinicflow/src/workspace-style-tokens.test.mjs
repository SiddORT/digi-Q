import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Use the existing Vite PostCSS dependency; no browser or new package required.
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve("vite/package.json"));
const postcss = viteRequire("postcss");
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const index = postcss.parse(read("./index.css"));
const compact = postcss.parse(read("./compact-workspace.css"));
const finalStandards = index.nodes.find((node) =>
  node.type === "atrule" && node.name === "media" && node.params === "screen");
assert.ok(finalStandards, "explicit standards must remain screen-only");

function declaration(root, selector, property) {
  let result;
  root.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    rule.walkDecls(property, (decl) => { result = decl.value; });
  });
  assert.notEqual(result, undefined, `${selector}: missing ${property}`);
  return result;
}
function token(name) {
  return declaration(index, ":root", name);
}
function final(selector, property, value) {
  assert.equal(declaration(finalStandards, selector, property), value, `${selector}: ${property}`);
}

test("CSS parses and explicit v3 central tokens have exactly the approved values", () => {
  assert.ok(compact.nodes.length);
  for (const [name, value] of Object.entries({
    "--dq-blue": "#1552B0", "--dq-cyan": "#0E8FB3",
    "--dq-bg": "#F3F7FC", "--dq-surface": "#FFFFFF",
    "--type-page": "24px", "--type-section": "20px", "--type-body": "14px",
    "--type-label": "13px", "--type-table": "13px", "--type-table-heading": "12px",
    "--radius-control": "8px", "--radius-card": "12px",
    "--radius-dialog": "14px", "--radius-badge": "6px",
    "--workspace-width": "1540px", "--sidebar-width": "216px", "--sidebar-width-collapsed": "64px",
    "--font-heading": "'Manrope', sans-serif", "--font-body": "'DM Sans', sans-serif",
  })) {
    assert.equal(token(name), value, name);
    let definitions = 0;
    index.walkDecls(name, () => definitions++);
    assert.equal(definitions, 1, `${name} must have one source`);
  }
  [4, 8, 12, 16, 20, 24, 32, 40, 48].forEach((size, i) =>
    assert.equal(token(`--space-${i + 1}`), `${size}px`));
});

test("workspace typography overrides legacy layers and dashboard selectors", () => {
  for (const [selector, name] of [
    [".workspace .page-heading h1", "--type-page"],
    [".workspace .panel-heading h2", "--type-section"],
    [".workspace .care-card h2", "--type-section"],
    [".workspace .stat-card > strong", "--type-page"],
    [".workspace .session-queue .sq-banner strong", "--type-page"],
    [".workspace .page-heading p", "--type-body"],
    [".workspace .panel-heading p", "--type-body"],
    [".workspace .form-field-label", "--type-label"],
    [".workspace .form-field-help", "--type-label"],
    [".workspace .form-field-error", "--type-label"],
    [".workspace td", "--type-table"], [".workspace td strong", "--type-table"],
    [".workspace td small", "--type-table"], [".workspace th", "--type-table-heading"],
    [".workspace td::before", "--type-table-heading"],
    [".app-dialog .app-dialog-title", "--type-section"],
    [".app-dialog .app-dialog-desc", "--type-body"],
    [".searchable-select-options [cmdk-item]", "--type-body"],
  ]) final(selector, "font-size", `var(${name})`);
  compact.walkDecls("font-size", (decl) =>
    assert.match(decl.value, /^var\(--type-[\w-]+\)$/, "compact typography must use the central scale"));
});

test("workspace dimensions, approved spacing and role-specific radii are consumed", () => {
  for (const [selector, prop, value] of [
    [".workspace .content", "max-width", "var(--workspace-width)"],
    [".workspace .content", "padding", "var(--space-4) var(--space-5)"],
    [".workspace .sidebar", "width", "var(--sidebar-width)"],
    [".workspace .form-grid", "gap", "var(--space-4)"],
    [".workspace .stat-card", "padding", "var(--space-5)"],
    [".workspace .panel-heading", "padding", "var(--space-5)"],
    [".workspace .panel", "border-radius", "var(--radius-card)"],
    [".workspace .button", "border-radius", "var(--radius-control)"],
    [".workspace .badge", "border-radius", "var(--radius-badge)"],
    [".workspace .modal", "border-radius", "var(--radius-dialog)"],
    [".searchable-select-popup", "border-radius", "var(--radius-control)"],
    [".app-dialog.app-dialog", "border-radius", "var(--radius-dialog)"],
    [".workspace .password-input > input", "padding-right", "var(--space-9)"],
    [".app-dialog .password-input > input", "padding-right", "var(--space-9)"],
  ]) final(selector, prop, value);
  const theme = index.nodes.find((node) => node.type === "atrule" && node.name === "theme");
  const values = Object.fromEntries(theme.nodes.filter((n) => n.type === "decl").map((n) => [n.prop, n.value]));
  assert.equal(values["--color-primary"], "var(--dq-blue)");
  assert.equal(values["--color-accent"], "var(--dq-cyan)");
  assert.equal(values["--radius-lg"], "var(--radius-control)");
});

test("section 4 approved recommendations are central and reach rows and portaled surfaces", () => {
  assert.equal(token("--text-disabled"), "#7A889E");
  assert.equal(token("--surface-hover"), "#EEF4FB");
  assert.equal(token("--shadow-dropdown"), "0 4px 12px rgba(23,42,74,0.12)");
  assert.equal(token("--shadow-dialog"), "0 12px 32px rgba(23,42,74,0.18)");
  final(".workspace tr:hover td", "background", "var(--surface-hover)");
  final(".workspace tr:hover td.col-actions", "background", "var(--surface-hover)");
  final(".workspace button:disabled", "color", "var(--text-disabled)");
  final(".searchable-select-popup", "box-shadow", "var(--shadow-dropdown)");
  final(".workspace .row-menu-list", "box-shadow", "var(--shadow-dropdown)");
  final(".app-dialog.app-dialog", "box-shadow", "var(--shadow-dialog)");
});

test("explicit standards do not target ticket/QR geometry, auth or brand images", () => {
  finalStandards.walkRules((rule) => {
    assert.doesNotMatch(rule.selector, /ticket|receipt|qr-card|qr-grid|\.brand|\.auth-|\.hero/);
    let parent = rule.parent;
    while (parent && parent !== finalStandards) {
      assert.notEqual(parent.name, "layer", "standards must outrank legacy layered rules");
      parent = parent.parent;
    }
  });
  assert.equal(declaration(index, ".qr-card.compact img", "width"), "160px");
  assert.ok(read("./index.css").includes(".qr-card img{width:180px;max-width:100%}"));
  assert.equal(declaration(compact, ".workspace .status-switch-track", "width"), "32px");
  assert.equal(declaration(compact, ".workspace .status-switch-track", "height"), "18px");
  assert.ok(read("./compact-workspace.css").includes("(pointer:coarse)"));
});

test("mobile form breakpoint and drawer overrides use approved dimensions without shrinking desktop headings", () => {
  const mobile = index.nodes.find((node) =>
    node.type === "atrule" && node.params === "screen and (max-width: 639px)");
  assert.equal(declaration(mobile, ".workspace .form-grid", "grid-template-columns"), "1fr");
  assert.equal(declaration(mobile, ".app-dialog .form-grid", "grid-template-columns"), "1fr");
  assert.equal(declaration(mobile, ".workspace .content", "padding"), "var(--space-4)");
  mobile.walkDecls("font-size", () => assert.fail("mobile must not invent a smaller type scale"));
  const drawer = index.nodes.find((node) =>
    node.type === "atrule" && node.params === "screen and (max-width: 900px)");
  assert.equal(declaration(drawer, ".workspace .workspace-main", "width"), "100%");
  assert.equal(declaration(drawer, ".workspace .workspace-main", "margin-left"), "0");
});

test("weekly schedule capacity wraps within its listing cell without clipping details", () => {
  const resource = read("./resources.tsx");
  assert.ok(resource.includes('capacity:"Capacity"'), "selector follows the real column label");
  assert.ok(resource.includes('data-label={columnLabel(c)}'), "resource table exposes the column label");
  assert.ok(resource.includes('className="cap-chip"'), "capacity renderer keeps the existing hook");
  const chip = '.workspace .admin-listing-table td[data-label="Capacity"] .cap-chip';
  final(chip, "flex-wrap", "wrap");
  final(chip, "min-width", "0");
  final(chip, "max-width", "100%");
  final(chip, "overflow-wrap", "anywhere");
  final(`${chip} .cell-sub`, "flex-basis", "100%");
  final(`${chip} .cell-sub`, "overflow", "visible");
  final(`${chip} .cell-sub`, "-webkit-line-clamp", "unset");
});