/**
 * Section C shared address rules. Address country (ISO "IN") is distinct from the
 * telephone calling code (+91). Saved international countries are never rewritten.
 */
export const DEFAULT_ADDRESS_COUNTRY = "IN";
export const DEFAULT_PHONE_COUNTRY = "IN";

/** Scope for state/city suggestions; empty country falls back to India for new entry. */
export function geoScope(values: { country?: unknown; state?: unknown }) {
  const country = typeof values.country === "string" && values.country.trim() ? values.country.trim() : DEFAULT_ADDRESS_COUNTRY;
  const state = typeof values.state === "string" ? values.state.trim() : "";
  return { country, state };
}

export function isIndia(country?: unknown) {
  const v = typeof country === "string" ? country.trim().toLowerCase() : "";
  return !v || v === "in" || v === "india";
}

/** India PIN: six digits, first digit 1–9. Other countries: up to 12 letters/digits/spaces/hyphens. */
export function validatePostalCode(value: unknown, country?: unknown): true | string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return true;
  if (isIndia(country)) return /^[1-9]\d{5}$/.test(v.replace(/\s/g, "")) ? true : "Enter a 6-digit PIN code";
  return /^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(v) ? true : "Enter a valid postal code";
}

/** Child fields to clear when a parent changes (country → state, city; state → city). */
export function dependentAddressFields(changed: "country" | "state"): string[] {
  return changed === "country" ? ["state", "city"] : ["city"];
}
