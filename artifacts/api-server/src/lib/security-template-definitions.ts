import { eventVariables } from "@workspace/api-zod/notification-variable-contract";
/** Security events are platform-owned and bypass optional operational gates. */
export const securityEvents = ["clinic_registration_otp", "patient_email_otp", "registration_mobile_otp",
  "doctor_setup", "staff_setup", "password_setup_complete", "staff_email_otp", "staff_mobile_otp"] as const;
export type SecurityEvent = typeof securityEvents[number];
export const isSecurityEvent = (event: string): event is SecurityEvent =>
  (securityEvents as readonly string[]).includes(event);
export const requiredEvent = (event: string) => isSecurityEvent(event) || event === "patient_login_otp";
export const securityTitles: Record<SecurityEvent, string> = {
  staff_email_otp: "Staff email verification",
  staff_mobile_otp: "Staff mobile verification",
  clinic_registration_otp: "Clinic Admin registration verification",
  patient_email_otp: "Patient email verification",
  registration_mobile_otp: "Optional registration mobile verification",
  doctor_setup: "Doctor password setup",
  staff_setup: "Staff password setup",
  password_setup_complete: "Password setup completed",
};
export function securityVariables(event: SecurityEvent) {
  return eventVariables(event);
}
export function securityDefault(event: SecurityEvent, sms = false) {
  if (event === "staff_email_otp" || event === "staff_mobile_otp") return {
    enabled: true, subject: securityTitles[event],
    body: "Your Digi-Q verification code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share it.",
    prefix: "", footer: "", logoUrl: "",
  };
  const otp = event.endsWith("_otp");
  const body = otp ? `Your DigiQ ${event === "registration_mobile_otp" ? "mobile" : "email"} verification code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.`
    : event === "password_setup_complete" ? "Hello {{recipient_name}}, your DigiQ {{role_name}} password setup is complete. No password is included in this message. If you did not do this, contact your administrator."
    : sms ? "Hello {{recipient_name}}, your DigiQ {{role_name}} account is ready for setup. Use the secure link emailed to you. It expires in {{expiry_minutes}} minutes. No password is sent by SMS."
    : "Hello {{recipient_name}},\n\nSet up your DigiQ {{role_name}} password using this secure, single-use link:\n{{setup_link}}\n\nThis link expires in {{expiry_minutes}} minutes. We never send passwords. If you did not expect this invitation, contact your administrator.";
  const defaultBody = event === "clinic_registration_otp" ? "Your clinic administrator registration code is {{otp}}. It expires in {{expiry_minutes}} minutes. Verify your email to continue setting up your clinic. This is not a doctor invitation. If you did not start this registration, ignore this email." : body;
  const subject = event === "clinic_registration_otp" ? "Verify your DigiQ clinic registration" : securityTitles[event];
  return { enabled: true, subject: sms ? subject : subject.replaceAll("DigiQ", "Digi-Q"),
    body: sms ? defaultBody : defaultBody.replaceAll("DigiQ", "Digi-Q"), prefix: "", footer: "", logoUrl: "" };
}
export function validSecurityContent(event: SecurityEvent, content: {subject:string;body:string;prefix:string;footer:string;enabled?:boolean}) {
  const body = content.body;
  const required = event.endsWith("_otp") ? ["otp", "expiry_minutes"] :
    event === "password_setup_complete" ? [] : ["expiry_minutes"];
  if (!required.every(v => new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(body))) return false;
  // Security content cannot direct users to arbitrary URLs, addresses or HTML links.
  const literal = [content.subject, body, content.prefix, content.footer].join("\n").replace(/\{\{\s*[a-z_]+\s*\}\}/g, "");
  return !/(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|href\s*=|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9-]+\.[a-z]{2,}\b)/i.test(literal);
}
