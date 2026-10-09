import { assert } from "./http";
import { isValidPhoneNumber } from "libphonenumber-js/max";

/** Creation-only policy. Never apply retrospectively to clinic editing or optional patient contacts. */
export function validateRegistrationContacts(input: any) {
  assert(input.branches?.length, 400, "Add at least one clinic location");
  for (const branch of input.branches) {
    assert(input.clinic.slug && branch.slug, 400, "Choose public URLs for the clinic and each location");
    const email = branch.inheritEmail !== false ? input.clinic.email : branch.email;
    const phone = branch.inheritPhone !== false ? input.clinic.phone : branch.phone;
    assert(typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), 400, "Each location needs a valid effective email; provide the inherited group email or an explicit location email.");
    assert(typeof phone === "string" && /^\+[1-9]\d{7,14}$/.test(phone.trim()) && isValidPhoneNumber(phone.trim()), 400, "Each location needs a valid effective phone with country code; provide the inherited group phone or an explicit location phone.");
    assert(Array.isArray(branch.openingHours) && branch.openingHours.length > 0, 400, "Each new location requires at least one valid open interval.");
  }
}
