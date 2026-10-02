import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isPatientBookingConfirmation } from "./patient-booking-notice.ts";

test("saved reservations qualify, without assuming message delivery", () => {
  assert.equal(isPatientBookingConfirmation({ status: "waiting" }), true);
  assert.equal(isPatientBookingConfirmation({ status: "booked" }), true);
});
test("cancelled, completed, absent and consultation records never appear as booking confirmations", () => {
  for (const status of ["cancelled", "completed", "noShow", "checkedIn", "called", "inConsultation", "unknown"]) {
    assert.equal(isPatientBookingConfirmation({ status }), false);
  }
  assert.equal(isPatientBookingConfirmation({ status: "waiting", checkedInAt: "2026-10-01T10:00:00Z" }), false);
  assert.equal(isPatientBookingConfirmation({ status: "waiting", consultationStartedAt: "2026-10-01T10:00:00Z" }), false);
});
test("portal notices are patient-only, persisted-query-backed, and link to authorized appointment details", () => {
  const source = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  assert.match(source, /role==="patient"&&<PatientBookingNotices/);
  const notices = source.slice(source.indexOf("function PatientBookingNotices("), source.indexOf("function Appointments("));
  assert.match(notices, /api\.useListAppointments/);
  assert.match(notices, /refetchInterval:30000,refetchOnWindowFocus:true/);
  assert.match(notices, /\/patient\/appointments\?view=all&search=/);
  assert.doesNotMatch(notices, /localStorage|sessionStorage|confirmationEmail|patientId:/);
  assert.match(source, /notifySuccess\("Booking confirmed"\)/);
});