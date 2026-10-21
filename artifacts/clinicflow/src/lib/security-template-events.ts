import { eventVariables } from "@workspace/api-zod/notification-variable-contract";
export const SECURITY_EVENTS = ["clinic_registration_otp","patient_email_otp","registration_mobile_otp","doctor_setup","staff_setup","password_setup_complete"] as const;
export const requiredSecurityEvent = (event:string) => event === "patient_login_otp" || (SECURITY_EVENTS as readonly string[]).includes(event);
export function securityTemplateTarget(event:string,recipient:string,channel:string) {
  if (event === "clinic_registration_otp") return recipient === "clinicAdmin" && channel === "email";
  if (event === "patient_email_otp") return recipient === "patient" && channel === "email";
  if (event === "registration_mobile_otp") return ["patient","clinicAdmin"].includes(recipient) && channel === "sms";
  if (event === "doctor_setup") return recipient === "doctor";
  return ["clinicAdmin","receptionist","superAdmin",...(event === "password_setup_complete" ? ["doctor"] : [])].includes(recipient);
}
export function securityTemplateVariables(event:string) {
  return eventVariables(event);
}
