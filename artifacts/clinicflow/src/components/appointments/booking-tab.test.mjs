import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = f => readFileSync(new URL(f, import.meta.url), "utf8");
const actions = read("./ticket-actions.tsx"), rows = read("./AppointmentRows.tsx"), details = read("./AppointmentDetails.tsx"), tab = read("./AppointmentBookingTab.tsx");
test("row menu and ticket header share one ordered action model", () => {
  assert.match(actions, /\["download", "print", "email", "sms"\]/);
  assert.match(rows, /ticketActions\.menuItems\(a,blocked\)/);
  assert.match(tab, /ctl\.buttons\(a, blocked\)/);
  assert.doesNotMatch(rows, /Download A4 PDF/);
});
test("print opens popup synchronously before async preparation", () => {
  assert.ok(actions.indexOf("window.open") < actions.indexOf("await freshTicketHtml", actions.indexOf("async function print")));
});
test("booking tab: three tabs, merged consultation, drafts cleared on authorization loss, SMS fail-closed", () => {
  for (const t of ["booking", "details", "history"]) assert.match(details, new RegExp(`value="${t}"`));
  assert.doesNotMatch(details, /value="consultation"/);
  assert.match(details, /value="details"[\s\S]*section-detail-consultation/);
  assert.match(details, /clearBookingDraft/);
  assert.match(actions, /preview!\.eligible/);
  assert.match(tab, /expectedRevision: draft\.baseRevision/);
});

test("history distinguishes authorized loading, failure, missing data, genuine empty and recorded events", () => {
  assert.match(details, /history=\{authorized\.data\?\.history\}/);
  assert.match(details, /historyError \?[\s\S]*historyLoading \?[\s\S]*!history \?[\s\S]*history\.length === 0 \?/);
  assert.match(details, /<EmptyState icon=\{<History[^]*?title="Nothing to show\."/);
  for (const heading of ["Date &amp; time", "Event", "Status", "Reason"]) assert.ok(details.includes(`>${heading}</TableHead>`), heading);
  assert.match(details, /history\.map\(\(event, index\)/);
  assert.match(details, /timestamp\(event\.occurredAt\)/);
  assert.match(details, /statusText\(event\.status\)/);
  assert.doesNotMatch(details, /history\.filter|occurredAt:|No history recorded\./);
});

test("row context removes only surrounding repetition and preserves hidden and standalone information", () => {
  assert.match(details, /rowContext \?[^]*?<CopyReference reference=\{a\.reference\}[^]*?: <header/);
  assert.match(rows, /rowContext supplementaryDetails/);
  assert.match(rows, /hiddenCols\.filter\(k=>!\["reference","createdAt"\]\.includes\(k\)\)/);
  assert.match(rows, /sessionScoped\?\["date","location","doctor"\]/);
  assert.match(rows, /k==="token"\?<strong className="appt-token"/);
  assert.match(rows, /<OverflowText as="strong" value=\{a\.patientName\}/);
  assert.match(tab, /<VisitTicket compact/);
  assert.match(tab, /section-detail-booking-layout/);
});
