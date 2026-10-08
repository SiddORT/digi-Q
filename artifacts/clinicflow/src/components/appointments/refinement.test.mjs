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
  assert.match(c, /onDrill=\{setCalDay\}/); // day drill opens the side panel; Open in list is explicit (system-standard.test.mjs)
});

test("status is a fixed readable column; token carries the booking reference tooltip", () => {
  const rows = r("./AppointmentRows.tsx");
  assert.match(rows, /defaultHidden:\["reference","createdAt"\]/);
  assert.doesNotMatch(rows, /\{key:"status"/);
  assert.match(rows, /<th key="status" className="col-status" scope="col">Status<\/th>/);
  assert.match(rows, /<HelpTip text=\{`Booking reference \$\{a\.reference\}/);
  const d = r("./AppointmentDetails.tsx");
  assert.match(d, /Tabs defaultValue="booking"/); assert.match(d, /appt-detail-cols/);
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

test("1200px acceptance: status follows token, Booking is default, hidden values stay in Details, scope filters exposed, PDF compressed", () => {
  const rows = readFileSync(new URL("./AppointmentRows.tsx", import.meta.url), "utf8");
  assert.match(rows, /label:"Token \/ Queue No\."/);
  assert.match(rows, /statusAfter=\["token","patient"\]/);
  const det = readFileSync(new URL("./AppointmentDetails.tsx", import.meta.url), "utf8");
  assert.match(det, /Tabs defaultValue="booking"/);
  assert.match(det, /<TabsContent value="details"[\s\S]*supplementaryDetails/);
  assert.match(rows, /supplementaryDetails=\{hiddenCols/);
  assert.doesNotMatch(det + rows, /ticketFirst/);
  const clinic = readFileSync(new URL("../../clinic.tsx", import.meta.url), "utf8");
  assert.match(clinic, /CareLookup kind="clinics" publicAccess=\{isPatient\}/);
  const pdf = readFileSync(new URL("../tickets/ticket-pdf.ts", import.meta.url), "utf8");
  assert.match(pdf, /compress: true/); assert.match(pdf, /"PNG",[^;]*"FAST"\)/);
});
