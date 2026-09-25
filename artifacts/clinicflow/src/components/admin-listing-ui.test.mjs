import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("listing layout reserves fixed selection and action columns without truncating names", () => {
  const css = read("./admin-listing.css");
  assert.match(css, /\.admin-listing-table table\{[^}]*table-layout:fixed/);
  assert.match(css, /\.admin-listing-table th\.col-select[^{}]*\{[^}]*min-width:44px/);
  assert.match(css, /\.admin-listing-table th\.col-actions[^{}]*\{[^}]*min-width:132px/);
  assert.match(css, /\.admin-record strong\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.admin-listing-table \.admin-record small[^{}]*\{[^}]*overflow:visible/);
  assert.doesNotMatch(css, /#13786f|#173332|#617471|#edf7f5/);
});

test("listing URL state and portal controls stay wired together", () => {
  const page = read("../resources.tsx");
  assert.match(page, /const urlSearch=useSearch\(\)/);
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /navigate\(`\$\{window\.location\.pathname\}/);
  assert.match(page, /query\.isPlaceholderData\?\[\]/);
  assert.match(page, /createPortal\(<div ref=\{menuRef\} className="admin-location-menu"/);
  assert.match(page, /<HelpTip text="Booking and display actions">/);
  assert.match(page, /resetPageOnSizeChange=\{false\}/);
});