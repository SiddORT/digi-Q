import type { TemplateEvent, TemplateRecipient } from "./notification-templates";

// User-supplied DLT registration list. Only variable markers are translated;
// punctuation, spacing and wording outside the markers remain unchanged.
// Team registrations cover the owning admin, assigned doctor and scoped receptionist.
// Registration metadata is not activation: receptionist defaults remain off.
export const approvedAppointmentSms: ReadonlyArray<{
  event: TemplateEvent; recipients: readonly TemplateRecipient[]; dltTemplateId: string; body: string;
}> = [
  {
    event: "booking", recipients: ["patient"], dltTemplateId: "1777179180199333856",
    body: "Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} is confirmed for {{appointment_date}}. Queue No: {{token_number}}. Expected time: {{session_start}}. Please arrive 10 minutes before your expected time. - Digi-Q",
  },
  {
    event: "booking", recipients: ["clinicAdmin", "doctor", "receptionist"], dltTemplateId: "1777179180212222829",
    body: "New appointment booked on Digi-Q. Patient: {{patient_name}}. Doctor: Dr. {{doctor_name}}. Appointment: {{appointment_date}} at {{session_start}}. - Digi-Q",
  },
  {
    event: "cancelled", recipients: ["patient"], dltTemplateId: "1777179180230206932",
    body: "Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} on {{appointment_date}} at {{session_start}} (Queue No: {{token_number}}) has been cancelled. Reason: {{cancel_reason}}. Please contact the clinic if you need assistance. - Digi-Q",
  },
  {
    event: "cancelled", recipients: ["clinicAdmin", "doctor", "receptionist"], dltTemplateId: "1777179180247974768",
    body: "Appointment cancelled on Digi-Q. Patient: {{patient_name}}. Doctor: Dr. {{doctor_name}}. Appointment: {{appointment_date}} at {{session_start}}. Queue No: {{token_number}}. Reason: {{cancel_reason}}. - Digi-Q",
  },
  {
    event: "completed", recipients: ["patient"], dltTemplateId: "1777179180260833424",
    body: "Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} on {{appointment_date}} at {{session_start}} (Queue No: {{token_number}}) has been completed. Thank you for choosing Digi-Q. - Digi-Q",
  },
  {
    event: "completed", recipients: ["clinicAdmin", "doctor", "receptionist"], dltTemplateId: "1777179180271292281",
    body: "Appointment completed on Digi-Q. Patient: {{patient_name}}. Doctor: Dr. {{doctor_name}}. Appointment: {{appointment_date}} at {{session_start}}. Queue No: {{token_number}}. - Digi-Q",
  },
  {
    event: "reminder", recipients: ["patient"], dltTemplateId: "1777179180284769924",
    body: "Dear {{patient_name}}, reminder: your appointment with Dr. {{doctor_name}} is scheduled for {{appointment_date}} at {{session_start}}. Queue No: {{token_number}}. Please arrive 10 minutes before your appointment time. - Digi-Q",
  },
  {
    event: "rescheduled", recipients: ["patient"], dltTemplateId: "1777179180927080590",
    body: "Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} has been rescheduled to {{appointment_date}} at {{session_start}}. Queue No: {{token_number}}. Please arrive 10 minutes before your appointment time. - Digi-Q",
  },
];
