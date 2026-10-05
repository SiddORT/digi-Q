import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("appointment columns follow the approved default order and distinguish token, session and booking time", () => {
  const s = r("./AppointmentRows.tsx");
  const order = ["serial", "date", "patient", "token", "location", "doctor", "createdAt", "status", "reference"].map(k => s.indexOf(`{key:"${k}"`));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), String(order));
  assert.match(s, /defaultHidden:\["reference"\]/);
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
