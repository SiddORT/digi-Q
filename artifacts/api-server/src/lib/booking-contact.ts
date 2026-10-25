import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { assert } from "./http";

/** Booking contact is a visit snapshot, never account proof or a delivery target. */
export function bookingMobile(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  assert(/^\+[1-9][0-9]{7,14}$/.test(raw), 400, "Enter a valid international mobile number for this booking");
  const phone = parsePhoneNumberFromString(raw);
  assert(phone && phone.isValid(), 400, "Enter a valid mobile number for this booking");
  return phone.number;
}
