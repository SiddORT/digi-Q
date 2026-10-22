import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { bookingDoctorMembership } from "./booking-doctor-membership.ts";

const context = { doctorId: "d1", clinicId: "g1", branchId: "b2", pending: false, error: false };
test("preserves selection while new scope loads, even with stale mismatching record", () => {
  assert.equal(bookingDoctorMembership({ ...context, pending: true, doctor: { clinicIds: ["g0"], branchIds: ["b0"] } }), "checking");
});
test("errors and incomplete metadata never prove invalid membership", () => {
  assert.equal(bookingDoctorMembership({ ...context, error: true, publicIds: [] }), "error");
  assert.equal(bookingDoctorMembership({ ...context, doctor: {} }), "error");
});
test("successful exact public selection proves inclusion or absence", () => {
  assert.equal(bookingDoctorMembership({ ...context, publicIds: ["d1"] }), "valid");
  assert.equal(bookingDoctorMembership({ ...context, publicIds: [] }), "invalid");
});
test("private getDoctor assignment lists prove cross-clinic validity without list pagination assumptions", () => {
  assert.equal(bookingDoctorMembership({ ...context, doctor: { clinicIds: ["g1"], branchIds: ["b1", "b2"] } }), "valid");
  assert.equal(bookingDoctorMembership({ ...context, doctor: { clinicIds: ["g1"], branchIds: ["b1"] } }), "invalid");
});
test("inactive doctor is not a bookable dependency", () => {
  assert.equal(bookingDoctorMembership({ ...context, doctor: { clinicIds: ["g1"], branchIds: ["b2"], status: "inactive" } }), "invalid");
});
test("booking gates membership/date validity and preserves fixed doctor identity when clearing dependent choices", () => {
  const source = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  const booking = source.slice(source.indexOf("function Booking("), source.indexOf("function Queue("));
  const gate = booking.match(/const canContinue=([^;]+);/)?.[1];
  assert.ok(gate, "Booking must have an explicit continue gate");
  for (const condition of ["discovery.ready", "dateValid", "!!date", "date>=visitToday", 'membership==="valid"']) {
    assert.ok(gate.split("&&").includes(condition), `Continue must require ${condition}`);
  }
  assert.match(booking, /DateFormatInput required value=\{date\} min=\{visitToday\|\|undefined\}/);
  assert.match(booking, /onValidityChange=\{setDateValid\}/);
  assert.doesNotMatch(booking, /setDoctor\(restrictedDoctorId\)|setDoctor\(context\?\.doctorId/);
  assert.match(booking, /membership==="invalid"&&!context\?\.doctorId&&!restrictedDoctorId/);
});