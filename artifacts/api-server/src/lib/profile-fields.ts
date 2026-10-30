import { assert } from "./http";
import { isValidPhoneNumber } from "libphonenumber-js/max";

export const addressKeys = ["address", "country", "state", "city", "pincode"];
export const profileKeys: Record<string, string[]> = {
  patients: ["dateOfBirth", "age", "gender", "mobile", "email", ...addressKeys, "emergencyContactName", "emergencyContactPhone"],
  doctors: ["dateOfBirth", "gender", "mobile", ...addressKeys, "photoUrl", "about", "specializationId", "qualificationIds", "languages", "registrationNumber", "experienceYears", "consultationFee"],
  users: ["mobile", ...addressKeys, "photoUrl"],
};
export const missingProfileValue = (value: unknown) => value == null || typeof value === "string" && !value.trim() || Array.isArray(value) && !value.length;
const comparable = (value: unknown) => missingProfileValue(value) ? null : value;
export function assertProfileBaseline(current: any, values: any, baseline: any, patientDemographics = false) {
  if (patientDemographics && (Object.hasOwn(values, "dateOfBirth") || Object.hasOwn(values, "age"))) {
    assert(Object.hasOwn(baseline, "dateOfBirth") && Object.hasOwn(baseline, "age"), 400,
      "Both date of birth and approximate age baselines are required");
  }
  for (const key of Object.keys(values)) {
    assert(Object.hasOwn(baseline, key), 400, "A saved field baseline is required");
  }
  // DOB and approximate age are one demographic choice; do not save an estimate
  // against a DOB entered by another editor while this form was open.
  for (const key of Object.keys(baseline)) {
    assert(JSON.stringify(comparable(current[key])) === JSON.stringify(comparable(baseline[key])), 409,
      "This profile field changed. Close and reopen the editor to review the current value.");
  }
}
export function validateProfileValues(body: any, old?: any, now = new Date()) {
  delete body.ageReferenceDate; // Reference dates are server-owned, never backfilled from client claims.
  for (const key of ["mobile", "emergencyContactPhone"]) if (body[key])
    assert(typeof body[key] === "string" && /^\+[1-9]\d{7,14}$/.test(body[key]) && isValidPhoneNumber(body[key]), 400, "Enter a valid phone number with country code");
  if (body.emergencyContactName) assert(/^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]{1,99}$/u.test(body.emergencyContactName), 400, "Enter a valid emergency contact name");
  if (body.photoUrl) {
    let url: URL | undefined;
    try { url = new URL(body.photoUrl); } catch {}
    assert(url && ["https:", "http:"].includes(url.protocol), 400, "Enter a valid photo URL");
  }
  if (body.pincode && ["IN", "India"].includes(body.country || old?.country || "IN"))
    assert(/^[1-9]\d{5}$/.test(body.pincode), 400, "Enter a valid six-digit PIN code");
  if (body.dateOfBirth) {
    const value = body.dateOfBirth;
    const date = new Date(`${value}T00:00:00Z`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value &&
      value <= now.toISOString().slice(0, 10), 400, "Enter a valid date of birth that is not in the future.");
  }
  if (body.gender) assert(["female", "male", "other", "preferNotToSay"].includes(body.gender), 400, "Choose a valid gender");
  if (Object.hasOwn(body, "age")) {
    assert(Number.isInteger(body.age) && body.age >= 0 && body.age <= 130, 400, "Enter an approximate age from 0 to 130");
    // Do not invent a reference date when an unchanged legacy estimate is resubmitted.
    if (!body.dateOfBirth && (!old?.dateOfBirth || body.dateOfBirth === null) && body.age !== old?.age)
      body.ageReferenceDate = now.toISOString().slice(0, 10);
  }
}
