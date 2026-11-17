import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** Account mobiles only. Clinic/location phones may legitimately be landlines. */
export function accountMobileProblem(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Enter an account mobile number.";
  if (!/^\+[1-9]\d{7,14}$/.test(raw)) return "Choose a country and enter the complete mobile number.";
  const phone = parsePhoneNumberFromString(raw);
  if (!phone) return "Choose a country and enter a valid mobile number.";
  if (phone.countryCallingCode === "91" && !/^[6-9]\d{9}$/.test(raw.slice(3)))
    return "India mobiles require exactly 10 digits, starting with 6, 7, 8 or 9.";
  if (!phone.isValid() || !["MOBILE", "FIXED_LINE_OR_MOBILE"].includes(phone.getType() || ""))
    return "Enter a valid mobile number for the selected country.";
  if (phone.number !== raw) return "Enter the mobile without extra prefixes or digits.";
  return undefined;
}
