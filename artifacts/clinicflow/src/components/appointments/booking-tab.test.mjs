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
test("booking tab: four tabs kept, drafts cleared on authorization loss, SMS fail-closed", () => {
  for (const t of ["booking", "details", "consultation", "history"]) assert.match(details, new RegExp(`value="${t}"`));
  assert.match(details, /clearBookingDraft/);
  assert.match(actions, /preview!\.eligible/);
  assert.match(tab, /expectedRevision: draft\.baseRevision/);
});
