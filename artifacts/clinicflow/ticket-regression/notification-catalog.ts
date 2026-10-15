// Public metadata only; no templates, recipient identities or provider secrets.
export const eventSections = [
  "booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "patient_login_otp",
  "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp", "doctor_setup", "staff_setup", "password_setup_complete",
].map((id, order) => ({
  id, order, label: id === "onboarding" ? "Clinic Onboarding" : id.replaceAll("_", " ").replace(/\b\w/g, s => s.toUpperCase()),
  clinicApplicable: order < 6,
  explanation: order < 6 ? "" : "Required authentication and security messages are managed at System Default and cannot be disabled by a clinic.",
}));
