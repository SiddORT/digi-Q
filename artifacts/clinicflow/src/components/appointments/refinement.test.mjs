import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const r = p => readFileSync(new URL(p, import.meta.url), "utf8");

test("visit range presets, stepping and calendar grid are string-date based (timezone-safe)", () => {
  const s = r("../../lib/visit-range.ts");
  for (const k of ["today", "tomorrow", "week", "next7", "month", "nextMonth", "last30", "all", "custom"]) assert.match(s, new RegExp(`key: "${k}"`));
  assert.match(s, /Date\.UTC/); assert.doesNotMatch(s, /new Date\(\)/);
  const p = r("./VisitRangePicker.tsx");
  assert.match(p, /button-range-apply/); assert.match(p, /button-range-cancel/); assert.match(p, /Previous period/); assert.match(p, /aria-label="Year"/);
});

test("range picker lives in the list header; calendar uses server counts with drilldown", () => {
  const c = r("../../clinic.tsx");
  assert.match(c, /meta=\{<><div className="appt-mode"[\s\S]*?<VisitRangePicker/);
  const cal = r("./AppointmentCalendar.tsx");
  assert.match(cal, /useGetAppointmentCalendar/); assert.doesNotMatch(cal, /useListAppointments/);
  assert.match(c, /onDrill=\{d=>\{setFrom\(d\);setTo\(d\)/);
});

test("status column hidden by default with accessible status symbol; drawer ticket collapsed", () => {
  const rows = r("./AppointmentRows.tsx");
  assert.match(rows, /defaultHidden:\["reference","status"\]/);
  assert.match(rows, /aria-label=\{`Status: \$\{statusLabel/); assert.match(rows, /onFocus=\{\(\)=>setShow\(true\)\}/);
  const d = r("./AppointmentDetails.tsx");
  assert.match(d, /ticketOpen \|\| !canShowAppointmentTicket/); assert.match(d, /appt-detail-cols/);
});

test("bulk toolbar is compact, page-scoped, no bulk check-in, PDF and email via shared helpers", () => {
  const b = r("./BulkAppointments.tsx");
  assert.match(b, /this page only/); assert.match(b, /menu-bulk-more/); assert.match(b, /\.pdf"/);
  assert.doesNotMatch(b, /action:"checkIn"|action:"complete"/);
  const e = r("./TicketEmailDialog.tsx");
  assert.match(e, /getTicketEmailPreview/); assert.match(e, /requestIds\.current\.get/); assert.match(e, /Resend Same Request/);
  assert.doesNotMatch(e, /setTimeout|setInterval/);
  assert.match(r("../RowMenu.tsx"), /dismissTooltips\(\)/);
  assert.match(r("../AdminListing.tsx"), /bulk-compact/);
});
