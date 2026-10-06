/**
 * Semantic width for an editor field. The shared field grid maps each kind to track spans so a
 * field is sized by its content (a PIN or number never takes half a dialog) while date/time
 * pickers keep enough room for the typed value plus the picker button.
 *  xs: short numbers, durations
 *  sm: dates, times, choices
 *  md: names, emails, single lookups, location text
 *  lg: multi-select lookups, street address, phones (country code + number)
 *  full: long text, switches, checkboxes, explanatory blocks
 */
export type FieldWidth = "xs" | "sm" | "md" | "lg" | "full";
export function fieldWidth(field: { key: string; type?: string; resource?: string }): FieldWidth {
  const { key, type, resource } = field;
  if (type === "checkbox" && key.startsWith("inherit")) return "md"; // B14: sits beside its email/phone field
  if (type === "textarea" || type === "checkbox") return "full";
  if (key === "status") return "sm";
  if (key === "address" || type === "tel") return "lg";
  if (resource) return key.endsWith("Ids") ? "lg" : "md";
  if (key === "pincode" || key === "tokenPrefix") return "xs";
  if (type === "number" || type === "duration") return "xs";
  if (type === "tel") return "lg"; // composite: country code + local number needs two tracks
  if (type === "date" || type === "time" || type === "select" || key === "age") return "sm";
  if (type === "session" || key === "timezone" || type === "array") return "md";
  return "md";
}
export const fieldWidthClass = (field: { key: string; type?: string; resource?: string }) => `field-cell fw-${fieldWidth(field)}`;
