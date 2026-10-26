/** Shared authoring/dispatch contract. No template wording or registration metadata. */
export const notificationVariables = ["clinic_name", "booking_link", "patient_name", "doctor_name",
  "appointment_details", "previous_details", "reference", "timezone", "clinic_contact",
  "recipient_name", "appointment_date", "session_start", "session_end", "previous_date",
  "previous_session_start", "previous_session_end", "queue_token", "token_number", "cancel_reason",
  "otp", "expiry_minutes", "setup_link", "role_name", "staff_name", "location_names", "sign_in_link", "clinic_admin_name"] as const;

export function eventVariables(event: string): readonly string[] {
  if (event === "staff_created_admin" || event === "staff_welcome")
    return ["recipient_name", "staff_name", "role_name", "clinic_name", "location_names", "sign_in_link"];
  if (event === "staff_email_otp" || event === "staff_mobile_otp") return ["otp", "expiry_minutes"];
  if (["patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp"].includes(event))
    return ["otp", "expiry_minutes"];
  if (event === "password_setup_complete") return ["recipient_name", "role_name"];
  if (["doctor_setup", "staff_setup"].includes(event)) return ["recipient_name", "role_name", "setup_link", "expiry_minutes"];
  const clinic = ["clinic_name", "clinic_contact", "booking_link", "recipient_name"];
  if (event === "onboarding") return [...clinic, "clinic_admin_name"];
  if (!["booking", "rescheduled", "cancelled", "completed", "reminder"].includes(event)) return [];
  return [...clinic, "patient_name", "doctor_name", "appointment_details", "reference", "timezone",
    "appointment_date", "session_start", "session_end", "queue_token", "token_number",
    ...(event === "rescheduled" ? ["previous_details", "previous_date", "previous_session_start", "previous_session_end"] : []),
    ...(event === "cancelled" ? ["cancel_reason"] : [])];
}

export function accountRoleLabel(role: string): string {
  return ({doctor: "Doctor", clinicAdmin: "Clinic Admin", receptionist: "Receptionist", superAdmin: "Superadmin"} as Record<string, string>)[role] || "";
}

/** Authoring control metadata, independent of template wording and identifiers. */
export function notificationVariableField(name: string): { label: string; kind: "date" | "time" | "text" } {
  return {
    label: name.split("_").map(part => ["otp", "id", "url", "sms", "dlt", "api"].includes(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    kind: ["appointment_date", "previous_date"].includes(name) ? "date"
      : ["session_start", "session_end", "previous_session_start", "previous_session_end"].includes(name) ? "time" : "text",
  };
}
