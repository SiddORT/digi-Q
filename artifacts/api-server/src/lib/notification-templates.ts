import { z } from "zod";
import { notificationEmailHtml } from "./notification-email-presentation";
import { automatedFooter, emailSupportText, type EmailContext } from "./email-presentation";
import { notificationVariables, eventVariables } from "@workspace/api-zod/notification-variable-contract";
import { appointmentNotificationTarget } from "./appointment-notification-scope";
import { securityEvents, isSecurityEvent, securityDefault, securityTitles, validSecurityContent } from "./security-template-definitions";
export { requiredEvent, isSecurityEvent } from "./security-template-definitions";

export const templateEvents = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "patient_login_otp", "staff_created_admin", "staff_welcome", ...securityEvents] as const;
export type TemplateEvent = typeof templateEvents[number];
export const templateRecipients = ["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"] as const;
export type TemplateRecipient = typeof templateRecipients[number];
export const defaultRecipient = (event: TemplateEvent): TemplateRecipient => event === "onboarding" || event === "clinic_registration_otp" || event === "staff_created_admin" ? "clinicAdmin" : event === "doctor_setup" ? "doctor" : ["staff_setup", "password_setup_complete", "staff_welcome", "staff_email_otp", "staff_mobile_otp"].includes(event) ? "receptionist" : "patient";
export const templateVariables = notificationVariables;
export function validTemplateTarget(event: TemplateEvent, recipient: TemplateRecipient, channel: "email" | "sms") {
  if (event === "staff_created_admin") return ["superAdmin", "clinicAdmin", "doctor"].includes(recipient);
  if (event === "staff_welcome") return ["clinicAdmin", "doctor", "receptionist"].includes(recipient);
  if (isSecurityEvent(event)) {
    if (event === "staff_email_otp" || event === "staff_mobile_otp")
      return recipient !== "patient" && channel === (event === "staff_email_otp" ? "email" : "sms");
    if (event === "clinic_registration_otp") return recipient === "clinicAdmin" && channel === "email";
    if (event === "patient_email_otp") return recipient === "patient" && channel === "email";
    if (event === "registration_mobile_otp") return ["patient", "clinicAdmin"].includes(recipient) && channel === "sms";
    if (event === "doctor_setup") return recipient === "doctor";
    return ["clinicAdmin", "receptionist", "superAdmin", ...(event === "password_setup_complete" ? ["doctor"] : [])].includes(recipient);
  }
  if (event === "patient_login_otp") return recipient === "patient" && channel === "sms";
  if (recipient === "superAdmin") return event === "onboarding";
  return event !== "onboarding" || recipient === "clinicAdmin";
}
export function variablesForTemplate(event: TemplateEvent): readonly string[] {
  return eventVariables(event);
}
export function validEventContent(event: TemplateEvent, content: { subject: string; body: string; prefix: string; footer: string; enabled?: boolean }) {
  const allowed = variablesForTemplate(event);
  const used = [content.subject, content.body, content.prefix, content.footer].flatMap(text =>
    [...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(match => match[1]));
  return used.every(variable => allowed.includes(variable)) &&
    (!isSecurityEvent(event) || validSecurityContent(event, content)) &&
    (event !== "patient_login_otp" || /\{\{\s*otp\s*\}\}/.test(content.body));
}
export const templateContent = z.object({
  enabled: z.boolean().default(true),
  subject: z.string().trim().min(1).max(180).refine(v => !/[\r\n]/.test(v), "Subject must be one line"),
  body: z.string().trim().min(1).max(8000),
  prefix: z.string().trim().max(60).refine(v => !/[\r\n]/.test(v), "Prefix must be one line"),
  footer: z.string().trim().max(500),
  logoUrl: z.string().max(1000).refine(value => {
    if (!value) return true;
    if (/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(value)) return true;
    try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
  }, "Use an HTTPS logo URL without credentials"),
}).strict().superRefine((value, ctx) => {
  for (const field of ["subject", "body", "prefix", "footer"] as const) {
    const remaining = value[field].replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (token, variable) => {
      if (!(templateVariables as readonly string[]).includes(variable))
        ctx.addIssue({ code: "custom", path: [field], message: `Unsupported variable: ${variable}` });
      return "";
    });
    if (/[{}]/.test(remaining)) ctx.addIssue({ code: "custom", path: [field], message: "Use supported variables in double braces" });
  }
});
export type TemplateContent = z.infer<typeof templateContent>;
export const smsTemplateContent = z.object({
  enabled: z.boolean().default(false), subject: z.string().min(1).max(180),
  body: z.string().min(1).max(1600).refine(v => !!v.trim(), "Message is required"), prefix: z.literal(""), footer: z.literal(""), logoUrl: z.literal(""),
  senderId: z.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default(""),
  dltEntityId: z.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default(""),
  dltTemplateId: z.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default(""),
}).strict().superRefine((value,ctx)=>{
  const remaining = value.body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_,variable)=>{
    if (!(templateVariables as readonly string[]).includes(variable)) ctx.addIssue({code:"custom",path:["body"],message:`Unsupported variable: ${variable}`});
    return "";
  });
  if (/[{}]/.test(remaining)) ctx.addIssue({code:"custom",path:["body"],message:"Use supported variables in double braces"});
});
export type SmsTemplateContent = z.infer<typeof smsTemplateContent>;
const templateSaveFields = {
  recipient: z.enum(templateRecipients).optional(),
  clinicId: z.string().min(1).max(100).optional(), event: z.enum(templateEvents),
  revision: z.number().int().min(0), mode: z.enum(["draft", "publish", "reset"]),
};
// Preserve legacy email callers while validating SMS exclusively as SMS.
// An untagged content union can report email-only key errors before the real SMS issue.
export const templateSave = z.preprocess(input => {
  if (input && typeof input === "object" && !Array.isArray(input) && !("channel" in input))
    return { ...input, channel: "email" };
  return input;
}, z.discriminatedUnion("channel", [
  z.object({ ...templateSaveFields, channel: z.literal("email"), content: templateContent.optional() }).strict(),
  z.object({ ...templateSaveFields, channel: z.literal("sms"), content: smsTemplateContent.optional() }).strict(),
])).refine(v => v.mode === "reset" || !!v.content, { message: "Template content is required" });
export const eventTitles: Record<TemplateEvent, string> = {
  staff_created_admin: "Staff account created",
  staff_welcome: "Staff welcome",
  ...securityTitles,
  booking: "Booking confirmation", onboarding: "Clinic onboarding", rescheduled: "Appointment rescheduled",
  cancelled: "Appointment cancelled", completed: "Thank you after your visit", reminder: "Appointment reminder",
  patient_login_otp: "Patient login OTP",
};
export const patientLoginSmsBody = "Your DigiQ Doctors login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.";
const bodies: Partial<Record<TemplateEvent, string>> = {
  booking: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n\n{{clinic_contact}}",
  onboarding: "Welcome to {{clinic_name}}.\n\nComplete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.\n\n{{clinic_contact}}",
  rescheduled: "Hello {{patient_name}},\n\nYour visit at {{clinic_name}} has been rescheduled.\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}\nReference: {{reference}}",
  cancelled: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} has been cancelled.\n{{appointment_details}}\nReference: {{reference}}\nContact the clinic if you need to book another visit.\n{{clinic_contact}}",
  completed: "Hello {{patient_name}},\n\nThank you for visiting {{clinic_name}}. Your visit is now complete.\nFor further assistance, contact your clinic.\n{{clinic_contact}}",
  reminder: "Hello {{patient_name}},\n\nA reminder of your upcoming session at {{clinic_name}}.\n{{appointment_details}}\nReference: {{reference}}\nQueue-based visits do not guarantee an exact consultation time.",
  patient_login_otp: "Your Digi-Q login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.",
};
export function defaultTemplate(event: TemplateEvent, recipient: TemplateRecipient = defaultRecipient(event)): TemplateContent {
  if (event === "staff_created_admin" || event === "staff_welcome") return {
    enabled: true, subject: event === "staff_welcome" ? "Welcome to Digi-Q" : "Digi-Q staff account saved",
    body: event === "staff_welcome"
      ? "Hello {{recipient_name}}, your Digi-Q {{role_name}} account is ready. {{clinic_name}} {{location_names}}\nSign in with your email and password: {{sign_in_link}}"
      : "Hello {{recipient_name}}, {{staff_name}}'s {{role_name}} account is saved. {{clinic_name}} {{location_names}}\nStaff sign-in: {{sign_in_link}}",
    prefix: "", footer: "", logoUrl: "",
  };
  if (isSecurityEvent(event)) return securityDefault(event);
  if (event === "patient_login_otp") return { enabled: true, subject: "Patient login OTP", body: bodies[event]!, prefix: "", footer: "", logoUrl: "" };
  if (event === "onboarding" && recipient === "superAdmin") return { enabled: true, subject: "Clinic registered — {{clinic_name}}", body: "Hello {{recipient_name}},\n\nA clinic has completed registration: {{clinic_name}}.\n{{clinic_contact}}", prefix: "", footer: "", logoUrl: "" };
  return { enabled: appointmentNotificationTarget(event, recipient) || recipient === defaultRecipient(event) || event === "booking" && recipient === "clinicAdmin", subject: `${eventTitles[event]} — {{clinic_name}}`, body: recipient === defaultRecipient(event) ? bodies[event]! : `Clinic notification: ${eventTitles[event]}\nPatient: {{patient_name}}\nDoctor: {{doctor_name}}\n{{appointment_details}}\nReference: {{reference}}\n{{clinic_contact}}`, prefix: "", logoUrl: "", footer: "This is an automated clinic message. Contact your clinic for assistance." };
}
export function substitute(text: string, values: Record<string, string>): string {
  // A single replacement pass: patient-supplied braces can never become another variable.
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key) => values[key] ?? `[${key.replaceAll("_", " ")}]`);
}
export function renderNotification(content: TemplateContent, values: Record<string, string>, context: EmailContext = {}) {
  const subject = [substitute(content.prefix, values), substitute(content.subject, values)].filter(Boolean).join(" ").replace(/[\r\n]+/g, " ");
  const body = substitute(content.body, values), footer = substitute(content.footer, values);
  const logoPath = content.logoUrl.startsWith("/api/branding/logos/") ? content.logoUrl : undefined;
  return { subject, logoPath, text: [body, emailSupportText, footer || automatedFooter].filter(Boolean).join("\n\n"),
    html: notificationEmailHtml(content, subject, values, context) };
}