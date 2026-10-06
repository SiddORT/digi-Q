import { validatePersonName, validatePhone } from "./validators.ts";

/** Secondary patient fields shown under "More details". */
export const PATIENT_SECONDARY = ["address", "country", "state", "city", "pincode", "emergencyContactName", "emergencyContactPhone"];

/** Validates secondary fields from form values regardless of whether their controls are mounted or collapsed. */
export function secondaryFieldErrors(values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = typeof values.emergencyContactName === "string" ? values.emergencyContactName.trim() : "";
  const phone = typeof values.emergencyContactPhone === "string" ? values.emergencyContactPhone.trim() : "";
  if (name) { const e = validatePersonName(name); if (e) errors.emergencyContactName = e; }
  if (phone) { const e = validatePhone(phone); if (e) errors.emergencyContactPhone = e; }
  return errors;
}

/** Submit gate: returns false (and never calls save) when any secondary field is invalid, reporting errors for expand + focus. */
export function gatePatientSubmit(values: Record<string, unknown>, save: () => void, report: (errors: Record<string, string>) => void): boolean {
  const errors = secondaryFieldErrors(values);
  if (Object.keys(errors).length) { report(errors); return false; }
  save();
  return true;
}
