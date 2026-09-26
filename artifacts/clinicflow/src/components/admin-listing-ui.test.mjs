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

test("clinic owners can find opening hours, doctor sessions and scoped audit", () => {
  const listing = read("../resources.tsx");
  const workspace = read("../clinic.tsx");
  const nav = read("./WorkspaceNav.tsx");
  assert.match(listing, /link-configure-clinic-\$\{row\.id\}/);
  assert.match(listing, /portal==="admin"/);
  assert.match(listing, /link-sessions-\$\{row\.id\}/);
  assert.match(listing, /notice-schedule-vs-opening-hours/);
  assert.match(listing, /notice-qr-readiness/);
  assert.match(workspace, /!\["masters","demo"\]\.includes\(p\)/);
  assert.match(nav, /kind: "link", page: "audit"/);
});

test("booking explains missing sessions instead of asking to reselect doctor", () => {
  const selector = read("./queue/SessionSelector.tsx");
  const booking = read("./GuestBooking.tsx");
  assert.match(selector, /selection\.sessions\.length===0/);
  assert.match(selector, /Opening hours alone do not create bookable sessions/);
  assert.match(selector, /item\.reason\|\|"unavailable"/);
  assert.match(booking, /status-no-doctor-sessions|selection\.sessions\.length>1/);
  assert.match(booking, /ask the clinic to configure its Weekly schedule/);
});