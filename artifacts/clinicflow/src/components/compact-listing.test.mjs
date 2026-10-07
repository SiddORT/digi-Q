import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formatConfiguredTimestamp, formatTimestampParts } from "../lib/date-time.ts";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("./compact-listing.css");

test("long status tabs shrink within the toolbar and scroll without widening the document", () => {
  assert.match(css, /\.workspace \.filter-bar-status\{[^}]*flex:0 1 auto[^}]*min-width:0;max-width:100%/);
  assert.match(css, /\.workspace \.filter-bar-status \.sq-status-tabs\{[^}]*min-width:0;max-width:100%;overflow-x:auto/);
});

test("toolbar puts title left and status/search/filter/add on one wrapping row", () => {
  const controls = read("./ListingControls.tsx");
  assert.match(controls, /filter-bar-title/);
  assert.match(controls, /filter-bar-status/);
  const clinic = read("../clinic.tsx");
  assert.match(clinic, /<FilterBar activeCount=[^]*?advanced=\{<><SearchableSelect label="Status"/, "appointment count lives only in pagination (Section A)");
  assert.doesNotMatch(clinic, /status=\{<StatusTabs/, "appointment status is a drawer filter");
  assert.doesNotMatch(clinic, /<h2>Appointments<\/h2>/, "page h1 is the only Appointments heading");
  // Section A5: the report total appears once, in pagination, not again in the toolbar.
  assert.match(clinic, /<FilterBar label="Report Filters"/);
  assert.doesNotMatch(clinic, /<h2>Report<\/h2>/);
  assert.match(read("./queue/SessionQueue.tsx"), /<FilterBar status=\{<StatusTabs/);
  assert.doesNotMatch(read("./queue/SessionQueue.tsx"), /<h2>Queue<\/h2>/);
  for (const page of ["../Users.tsx", "../resources.tsx"]) assert.doesNotMatch(read(page), /FilterBar title=\{<><h2>/, `${page} has no duplicate list heading`);
  assert.match(read("../resources.tsx"), /listName=resource==="branches"\?"locations"/);
  for (const page of ["../Users.tsx", "../resources.tsx"]) {
    const src = read(page);
    // Section A rule is "no duplicated counts": a heading total is allowed only when pagination hides its total.
    if (/<FilterBar title=\{(?!<div className="staff-title-row">)/.test(src)) { assert.match(src, /<FilterBar title=\{headingCount\?/, `${page} heading count is opt-in`); assert.match(src, /hideTotal=\{headingCount\}/, `${page} suppresses the pagination total when the heading shows it`); }
    assert.doesNotMatch(src, / status=\{</, `${page} keeps record status filters out of the toolbar`);
    assert.match(src, /<SearchableSelect label="(Account )?Status"/, `${page} drafts status in the filter drawer`);
  }
  assert.match(css, /\.filter-bar-row\.has-title\{[^}]*flex-wrap:wrap/);
  assert.match(css, /@media\(max-width:767px\)\{[^]*\.filter-bar-title\{flex-basis:100%\}/);
});

test("sidebar collapse is desktop-only, persisted, and keeps accessible names", () => {
  const shell = read("../clinic.tsx");
  const nav = read("./WorkspaceNav.tsx");
  assert.match(shell, /localStorage\.getItem\(SIDEBAR_COLLAPSED_KEY\)/);
  assert.match(shell, /aria-label=\{collapsed\?"Expand navigation":"Collapse navigation"\}/);
  assert.match(nav, /title=\{collapsed \? navLabel\(p, role\) : undefined\}/);
  // Collapsed rules live only inside the desktop media query; labels are clipped, not display:none.
  const desktop = css.slice(css.indexOf("@media screen and (min-width:901px)"));
  assert.ok(css.indexOf(".sidebar-collapsed") > css.indexOf("@media screen and (min-width:901px)"));
  assert.match(desktop, /\.sidebar-collapsed \.wnav-label[^{]*\{position:absolute;width:1px;height:1px;[^}]*clip:rect/);
  assert.doesNotMatch(desktop, /\.wnav-label[^{]*\{display:none/);
  assert.match(css, /\.workspace \.sidebar-collapse-toggle\{display:none\}/);
});

test("rows are compact without shrinking table text", () => {
  const index = read("../index.css");
  assert.match(index, /\.workspace td \{ padding:8px var\(--space-3\); \}/);
  assert.match(read("../compact-workspace.css"), /\.workspace td\{padding:8px var\(--space-3\);font-size:var\(--type-table\)/);
  assert.match(css, /\.created-cell\{[^}]*white-space:nowrap/);
});

test("created timestamps are readable with honest short UTC fallback", () => {
  const value = "2026-03-04T09:05:00Z";
  assert.equal(formatConfiguredTimestamp(value), "04 Mar 2026, 9:05 AM UTC");
  assert.doesNotMatch(formatConfiguredTimestamp(value), /timezone unavailable|T09/);
  assert.deepEqual(formatTimestampParts(value), { date: "04 Mar 2026", time: "9:05 AM UTC", full: "04 Mar 2026, 9:05 AM UTC" });
  assert.equal(formatTimestampParts(value, "Asia/Kolkata").time, "2:35 PM");
  assert.equal(formatTimestampParts(null), null);
});

test("recovery is collapsed and bulk results are compact with visible failures", () => {
  const users = read("../Users.tsx");
  const listing = read("./AdminListing.tsx");
  assert.doesNotMatch(users + read("../resources.tsx"), /<details open/);
  assert.doesNotMatch(listing, /<details open/);
  assert.match(users, /recoveryOpen && role !== "doctor" && <AppDialog/);
  assert.doesNotMatch(users, /listing-disclosure/);
  assert.match(listing, /failed — view details/);
  assert.match(listing, /\[\.\.\.failed,\.\.\.items\.filter/);
  assert.match(users, /ResultSummary title="Invitations"/);
  assert.doesNotMatch(users, /badge inactive/, "status shown once, in the status column");
});

test("640–1024px keeps compact tables with internal scroll; cards only below 640", () => {
  const block = css.slice(css.indexOf("@media screen and (min-width:640px) and (max-width:1024px)"));
  assert.ok(block.length > 100, "tablet/laptop restoration block exists");
  for (const re of [/\.table-scroll\{overflow-x:auto/, /\.table-scroll table\{display:table;width:100%;min-width:760px\}/,
    /\.table-scroll thead\{display:table-header-group\}/, /\.table-scroll tr\{display:table-row/,
    /\.table-scroll td\{display:table-cell/, /\.table-scroll td::before\{content:none/,
    /\.table-scroll td\.col-actions,[^{]*\{width:132px/, /\.row-actions\{display:flex;flex-wrap:nowrap/]) assert.match(block, re);
  const admin = read("./admin-listing.css");
  assert.match(admin, /@media\(max-width:639px\)\{[^]*?\.admin-listing-table thead\{display:none\}/);
  assert.doesNotMatch(admin, /@media\(max-width:760px\)/);
  assert.match(admin, /@media\(max-width:1024px\) and \(pointer:coarse\)\{\n  \.admin-listing-table col\.col-actions/);
});

test("mobile drawer has an in-panel accessible close; scrim is not the named control", () => {
  const shell = read("../clinic.tsx");
  assert.match(shell, /<div className="sidebar-scrim" aria-hidden="true"/);
  assert.doesNotMatch(shell, /className="sidebar-scrim" aria-label/);
  assert.match(shell, /id="workspace-sidebar"[^]*?\{open&&<button type="button" className="sidebar-close" aria-label="Close navigation"/);
  assert.match(css, /@media \(max-width:900px\)\{\n  \.workspace \.sidebar-close\{display:flex;[^}]*width:44px;height:44px/);
});
