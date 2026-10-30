import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=f=>readFileSync(new URL(f,import.meta.url),"utf8");
const clinic=read("../../clinic.tsx"),disc=read("./BookingDiscovery.tsx"),staged=read("./StagedBooking.tsx");
test("static context is separate from the editable group",()=>{
  assert.match(clinic,/data-testid="booking-context"/);
  assert.match(clinic,/className="form-grid cf-auto booking-visit-fields"/);
  const fields=clinic.slice(clinic.indexOf("booking-visit-fields"),clinic.indexOf("</div>",clinic.indexOf("booking-visit-fields")));
  assert.doesNotMatch(fields,/loc-fixed-note|text-booking-timezone/);
});
test("availability refresh and search remain available and Continue states its reason",()=>{
  assert.match(disc,/booking-availability-actions/);
  for(const id of["button-refresh-booking-availability","button-next-booking-date"])assert.ok(disc.includes(id),id);
  assert.match(clinic,/BookingScheduleSetup/);
  assert.match(staged,/text-booking-continue-reason/);
  assert.match(clinic,/blockedReason=\{canContinue\?undefined:continueBlockReason\}/);
});
