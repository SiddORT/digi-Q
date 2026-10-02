import test from "node:test";
import assert from "node:assert/strict";
import { CreateClinicBody, UpdateClinicSettingsBody, RegisterClinicBody, OnboardClinicAdminBody, GetReportsQueryParams } from "../../../lib/api-zod/src/generated/api.ts";
import { ResendClinicRegistrationBody, ResendClinicRegistrationResponse, CreateAppointmentResponse, GetGuestReceiptResponse } from "../../../lib/api-zod/src/generated/api.ts";
import { GetAuthStatusResponse, GetQueueQueryParams, ListGuestRequestsQueryParams } from "../../../lib/api-zod/src/generated/api.ts";

test("auth status requires no CSRF token and queue preserves omitted pagination", () => {
  assert.equal(GetAuthStatusResponse.safeParse({ role: null, staffPasswordVerified: false, requiresStaffPassword: false }).success, true);
  const query = GetQueueQueryParams.parse({ doctorId: "doctor", branchId: "branch", date: new Date("2026-10-02T00:00:00Z") });
  assert.equal(query.page, undefined);
  assert.equal(query.pageSize, undefined);
});
test("guest listing search and sort match the server allowlist", () => {
  assert.equal(ListGuestRequestsQueryParams.parse({}).sort, "-createdAt");
  for (const sort of ["createdAt", "-createdAt", "fullName", "-fullName", "date", "-date"]) {
    assert.equal(ListGuestRequestsQueryParams.parse({ sort, search: "Guest" }).sort, sort);
  }
  assert.equal(ListGuestRequestsQueryParams.safeParse({ sort: "status" }).success, false);
  assert.equal(ListGuestRequestsQueryParams.safeParse({ search: "x".repeat(201) }).success, false);
});

test("registration resend contract retains the stable challenge reference", () => {
  const reference = { challengeId: "same-challenge-reference" };
  assert.deepEqual(ResendClinicRegistrationBody.parse(reference), reference);
  assert.deepEqual(ResendClinicRegistrationResponse.parse(reference), reference);
  assert.equal(ResendClinicRegistrationBody.safeParse({}).success, false);
});
test("confirmation email outcomes are optional and never claim inbox delivery", () => {
  for (const schema of [CreateAppointmentResponse._def.right.shape.confirmationEmail, GetGuestReceiptResponse.shape.confirmationEmail]) {
    assert.equal(schema.safeParse(undefined).success, true);
    for (const value of ["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]) assert.equal(schema.parse(value), value);
    assert.equal(schema.safeParse("delivered").success, false);
  }
});

test("all parent preference entry points retain the approved enums", () => {
  const formats = { dateFormat: "MM/DD/YYYY", timeFormat: "24h" };
  assert.deepEqual(UpdateClinicSettingsBody.parse({ clinic: formats }).clinic, formats);
  assert.equal(CreateClinicBody.parse({ name: "Clinic", address: "", ...formats }).dateFormat, formats.dateFormat);
  assert.equal(OnboardClinicAdminBody.parse({ admin: { fullName: "Admin", email: "admin@example.test" }, clinic: { name: "Clinic", address: "", ...formats } }).clinic.timeFormat, "24h");
  assert.equal(RegisterClinicBody.parse({ fullName: "Admin", password: "Secret123", clinic: { name: "Clinic", ...formats }, branches: [{ name: "Location", address: "" }] }).clinic.dateFormat, formats.dateFormat);
});
test("report query retains supported search/sort and rejects unsupported sort", () => {
  const result = GetReportsQueryParams.parse({ search: "Clinic", sort: "-averageConsultationMinutes" });
  assert.equal(result.search, "Clinic");
  assert.equal(result.sort, "-averageConsultationMinutes");
  assert.equal(GetReportsQueryParams.safeParse({ sort: "-createdAt" }).success, false);
  assert.equal(GetReportsQueryParams.safeParse({ search: "x".repeat(201) }).success, false);
});
test("invalid and null formats fail; omission does not reset a stored setting", () => {
  for (const invalid of ["locale", "", null, 24]) {
    assert.equal(UpdateClinicSettingsBody.safeParse({ clinic: { dateFormat: invalid } }).success, false);
    assert.equal(UpdateClinicSettingsBody.safeParse({ clinic: { timeFormat: invalid } }).success, false);
    assert.equal(OnboardClinicAdminBody.safeParse({ admin: { fullName: "Admin", email: "admin@example.test" }, clinic: { name: "Clinic", address: "", timeFormat: invalid } }).success, false);
  }
  assert.deepEqual(UpdateClinicSettingsBody.parse({ clinic: { name: "Rename" } }).clinic, { name: "Rename" });
});