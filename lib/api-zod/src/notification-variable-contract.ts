/** Shared authoring/dispatch contract. No template wording or registration metadata. */
export const notificationVariables = ["clinic_name", "booking_link", "patient_name", "doctor_name",
  "appointment_details", "previous_details", "reference", "timezone", "clinic_contact",
  "recipient_name", "appointment_date", "session_start", "session_end", "previous_date",
  "previous_session_start", "previous_session_end", "queue_token", "token_number", "cancel_reason",
  "otp", "expiry_minutes", "setup_link", "role_name"] as const;

export function eventVariables(event: string): readonly string[] {
  if (["patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp"].includes(event))
    return ["otp", "expiry_minutes"];
  if (event === "password_setup_complete") return ["recipient_name", "role_name"];
  if (["doctor_setup", "staff_setup"].includes(event)) return ["recipient_name", "role_name", "setup_link", "expiry_minutes"];
  const clinic = ["clinic_name", "clinic_contact", "booking_link", "recipient_name"];
  if (event === "onboarding") return clinic;
  if (!["booking", "rescheduled", "cancelled", "completed", "reminder"].includes(event)) return [];
  return [...clinic, "patient_name", "doctor_name", "appointment_details", "reference", "timezone",
    "appointment_date", "session_start", "session_end", "queue_token", "token_number",
    ...(event === "rescheduled" ? ["previous_details", "previous_date", "previous_session_start", "previous_session_end"] : []),
    ...(event === "cancelled" ? ["cancel_reason"] : [])];
}

export function accountRoleLabel(role: string): string {
  return ({doctor: "Doctor", clinicAdmin: "Clinic Admin", receptionist: "Receptionist", superAdmin: "Superadmin"} as Record<string, string>)[role] || "";
}
