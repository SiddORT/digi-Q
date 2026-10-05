import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("appointment columns follow the approved default order and distinguish token, session and booking time", () => {
  const s = r("./AppointmentRows.tsx");
  const order = ["serial", "date", "patient", "token", "location", "doctor", "createdAt", "status", "reference"].map(k => s.indexOf(`{key:"${k}"`));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), String(order));
  assert.match(s, /defaultHidden:\["reference","status"\]/);
  assert.match(s, /a\.patientCode/);
  assert.match(s, /serialOffset\+i\+1/);
  assert.match(s, /formatConfiguredTimestamp\(a\.createdAt/);
  assert.doesNotMatch(s, /<details className="row-menu"/);
  assert.match(s, /<RowMenu /);
});
test("row menu renders in a body portal and separates destructive actions", () => {
  const m = r("../RowMenu.tsx");
  assert.match(m, /createPortal\(/);
  assert.match(m, /document\.body/);
  assert.match(m, /position: "fixed"/);
  assert.match(m, /row-menu-sep/);
  assert.match(m, /e\.key === "Escape"/);
});
test("bulk check-in is still not offered", () => {
  assert.doesNotMatch(r("./BulkAppointments.tsx"), /checkIn["']\s*[:,]\s*["']Check In/);
});
test("tablet column floors and mobile action containment override legacy layouts", () => {
  const css = r("../uniformity.css");
  assert.match(css, /col-date\{width:150px;min-width:150px\}/);
  assert.match(css, /table-layout:auto;width:max-content;min-width:100%/);
  assert.match(css, /overflow-x:auto;padding-bottom:4px;gap:4px/);
});
test("screen ticket header owns actions without changing the exported document", () => {
  const ticket = r("../tickets/VisitTicket.tsx");
  const header = ticket.slice(ticket.indexOf('<header className="vt-head"'), ticket.indexOf('</header>'));
  assert.match(header, /button-download-ticket/);
  assert.match(header, /button-print-ticket/);
  assert.match(r("../tickets/visit-ticket.css"), /max-width:100vw!important/);
});

// ---- Compact action refinement contract ----
test("row actions: icon Details with tooltip, clinical Check In/Out keep text, no ticket button in the row", () => {
  const s = r("./AppointmentRows.tsx");
  assert.match(s, /<IconAction className="row-details" label=\{`Details for \$\{a\.patientName\}`\}/);
  assert.match(s, /\{primary==="complete"\?<LogOut size=\{14\}\/>:<LogIn size=\{14\}\/>\} \{label\(primary\)\}/);
  assert.doesNotMatch(s, /row-ticket|setTicket|<AppointmentTicket/);
  assert.match(s, /<span className="row-lead">\{cols\.toggle\(a\.id,a\.patientName\)\}/);
  assert.doesNotMatch(s.slice(s.indexOf('className="row-actions"')), /cols\.toggle\(/);
});
test("booking details own the complete ticket and QR section", () => {
  const d = r("./AppointmentDetails.tsx");
  for (const id of ["section-detail-patient", "section-detail-visit", "section-detail-provider", "section-detail-booking", "section-detail-ticket"]) assert.ok(d.includes(id), id);
  assert.match(d, /<AppointmentTicket id=\{a\.id\} \/>/);
  assert.match(d, /Ticket &amp; QR/);
  assert.match(r("../../clinic.tsx"), /<AppointmentTicket/, "immediate booking confirmation still shows the ticket");
});
test("shared IconAction keeps label as accessible name and tooltip, with disabled reasons", () => {
  const i = r("../IconAction.tsx");
  assert.match(i, /aria-label=\{label\}/);
  assert.match(i, /<HelpTip text=\{tip\}>/);
  assert.match(i, /disabledReason/);
  const t = r("../tickets/VisitTicket.tsx");
  assert.match(t, /testId="button-download-ticket"/);
  assert.match(t, /testId="button-print-ticket"/);
});
test("row menu flips, scrolls internally, tracks scrolling, portals into dialogs and never renders empty", () => {
  const m = r("../RowMenu.tsx");
  assert.match(m, /if \(!items\.length\) return null;/);
  assert.match(m, /closest<HTMLElement>\('\[role="dialog"\]'\)/);
  assert.match(m, /computeMenuPosition\(/);
  assert.match(m, /maxHeight/);
  assert.match(m, /addEventListener\("scroll", reflow, true\)/);
  assert.match(m, /trigger\.current\?\.focus\(\)/);
  assert.match(r("../uniformity.css"), /\.row-menu-portal\{[^}]*overflow-y:auto/);
});
test("actions column is reduced", () => {
  assert.match(r("../uniformity.css"), /\.appt-table :is\(th,td\)\.col-actions\{width:200px;min-width:200px\}/);
});
test("remaining scope: weekly session Edit uses IconAction; report export keeps its label with icon and tooltip", () => {
  assert.match(r("../schedule/WeeklyScheduleEditor.tsx"), /<IconAction label=\{`Edit details for \$\{label\}`\}/);
  const c = r("../../clinic.tsx");
  assert.match(c, /<HelpTip text=\{exporting\?"Export in progress\."[^]*?data-testid="button-report-export"[^]*?\{exporting\?"Exporting…":"Export CSV"\}/);
  assert.match(r("../queue/SessionQueue.tsx"), /<AppointmentRows/);
  assert.match(c, /<AppointmentRows appointments=\{q\.data\.recentAppointments\}/);
});
