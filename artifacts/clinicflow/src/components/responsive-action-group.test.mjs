import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
const rag = read("./ResponsiveActionGroup.tsx").replace(/\/\*[^]*?\*\//g, ""), css = read("./responsive-action-group.css"), bar = read("./ListingControls.tsx");

test("secondary actions are mounted once, not portalled, and not menu items", () => {
  assert.doesNotMatch(rag, /createPortal|Portal|role="menu"|role="menuitem"/);
  assert.match(rag, /role="group"/);
  assert.match(rag, /aria-expanded=\{open\}/);
  assert.match(rag, /\{secondary\}/);
});
test("wide desktop inline, all widths below 1280 behind More, no second action row", () => {
  assert.match(css, /\.rag\{[^}]*flex-wrap:nowrap/);
  assert.match(css, /\.rag-secondary\{display:contents\}/);
  assert.match(css, /@media \(max-width:1279px\)\{[^]*\.rag-toggle\{display:inline-flex/);
  assert.match(css, /\.rag\[data-open="true"\] \.rag-secondary\{display:flex\}/);
});
test("FilterBar routes secondary through the group and keeps primary actions visible", () => {
  assert.match(bar, /<ResponsiveActionGroup secondary=\{secondary\}>\{actions\}<\/ResponsiveActionGroup>/);
  const clinic = read("../clinic.tsx"), users = read("../Users.tsx"), res = read("../resources.tsx"), sys = read("./SystemUsers.tsx");
  assert.match(clinic, /secondary=\{<><FilteredAppointmentExport[^]*?\{appointmentViews\}<\/>\} actions=\{<><Link className="button" href=\{`\/\$\{role\}\/book`\}/);
  assert.match(clinic, /secondary=\{<><HelpTip text=[^]*?<button className="button secondary small report-export" aria-label="Export all report results as CSV"[^]*?\{reportCols\.settings\}\{reportViews\}<\/>\}/);
  assert.match(users, /secondary=\{<>[^]*?Recovery<\/button>\}\{cols\.settings\}\{staffViews\}<\/>\} actions=/);
  assert.match(res, /secondary=\{<>\{resource==="patients"&&<PatientFilteredExport[^]*?\{viewControls\}<\/>\} actions=/);
  assert.match(sys, /secondary=\{<><Link[^>]*>Roles &amp; Permissions<\/Link>\{cols\.settings\}\{systemViews\}<\/>\}/);
});
