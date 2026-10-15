import { z } from "zod";
import { visitVariables } from "./notification-template-values";
import { appointmentNotificationTarget } from "./appointment-notification-scope";
import { securityEvents, isSecurityEvent, securityVariables, securityDefault, securityTitles, validSecurityContent } from "./security-template-definitions";
export { requiredEvent, isSecurityEvent } from "./security-template-definitions";

export const templateEvents = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "patient_login_otp", ...securityEvents] as const;
export type TemplateEvent = typeof templateEvents[number];
export const templateRecipients = ["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"] as const;
export type TemplateRecipient = typeof templateRecipients[number];
export const defaultRecipient = (event: TemplateEvent): TemplateRecipient => event === "onboarding" || event === "clinic_registration_otp" ? "clinicAdmin" : event === "doctor_setup" ? "doctor" : event === "staff_setup" || event === "password_setup_complete" ? "receptionist" : "patient";
export const templateVariables = ["clinic_name", "booking_link", "patient_name", "doctor_name", "appointment_details", "previous_details", "reference", "timezone", "clinic_contact", ...visitVariables, "otp", "expiry_minutes", "setup_link", "role_name"] as const;
export function validTemplateTarget(event: TemplateEvent, recipient: TemplateRecipient, channel: "email" | "sms") {
  if (isSecurityEvent(event)) {
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
  if (isSecurityEvent(event)) return securityVariables(event);
  return event === "patient_login_otp" ? ["otp", "expiry_minutes"] : templateVariables.filter(v => !["otp","expiry_minutes","setup_link","role_name"].includes(v));
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
  body: z.string().trim().min(1).max(1600), prefix: z.literal(""), footer: z.literal(""), logoUrl: z.literal(""),
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
  ...securityTitles,
  booking: "Booking confirmation", onboarding: "Clinic onboarding", rescheduled: "Appointment rescheduled",
  cancelled: "Appointment cancelled", completed: "Thank you after your visit", reminder: "Appointment reminder",
  patient_login_otp: "Patient login OTP",
};
const bodies: Partial<Record<TemplateEvent, string>> = {
  booking: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n\n{{clinic_contact}}",
  onboarding: "Welcome to {{clinic_name}}.\n\nComplete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.\n\n{{clinic_contact}}",
  rescheduled: "Hello {{patient_name}},\n\nYour visit at {{clinic_name}} has been rescheduled.\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}\nReference: {{reference}}",
  cancelled: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} has been cancelled.\n{{appointment_details}}\nReference: {{reference}}\nContact the clinic if you need to book another visit.\n{{clinic_contact}}",
  completed: "Hello {{patient_name}},\n\nThank you for visiting {{clinic_name}}. Your visit is now complete.\nFor further assistance, contact your clinic.\n{{clinic_contact}}",
  reminder: "Hello {{patient_name}},\n\nA reminder of your upcoming session at {{clinic_name}}.\n{{appointment_details}}\nReference: {{reference}}\nQueue-based visits do not guarantee an exact consultation time.",
  patient_login_otp: "Your DigiQ Doctors login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.",
};
export function defaultTemplate(event: TemplateEvent, recipient: TemplateRecipient = defaultRecipient(event)): TemplateContent {
  if (isSecurityEvent(event)) return securityDefault(event);
  if (event === "patient_login_otp") return { enabled: true, subject: "Patient login OTP", body: bodies[event]!, prefix: "", footer: "", logoUrl: "" };
  if (event === "onboarding" && recipient === "superAdmin") return { enabled: true, subject: "Clinic registered — {{clinic_name}}", body: "Hello {{recipient_name}},\n\nA clinic has completed registration: {{clinic_name}}.\n{{clinic_contact}}", prefix: "", footer: "", logoUrl: "" };
  return { enabled: appointmentNotificationTarget(event, recipient) || recipient === defaultRecipient(event) || event === "booking" && recipient === "clinicAdmin", subject: `${eventTitles[event]} — {{clinic_name}}`, body: recipient === defaultRecipient(event) ? bodies[event]! : `Clinic notification: ${eventTitles[event]}\nPatient: {{patient_name}}\nDoctor: {{doctor_name}}\n{{appointment_details}}\nReference: {{reference}}\n{{clinic_contact}}`, prefix: "", logoUrl: "", footer: "This is an automated clinic message. Contact your clinic for assistance." };
}
export function substitute(text: string, values: Record<string, string>): string {
  // A single replacement pass: patient-supplied braces can never become another variable.
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key) => values[key] ?? `[${key.replaceAll("_", " ")}]`);
}
export function renderNotification(content: TemplateContent, values: Record<string, string>) {
  const subject = [substitute(content.prefix, values), substitute(content.subject, values)].filter(Boolean).join(" ").replace(/[\r\n]+/g, " ");
  const body = substitute(content.body, values), footer = substitute(content.footer, values);
  const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const logoPath = content.logoUrl.startsWith("/api/branding/logos/") ? content.logoUrl : undefined;
  return { subject, logoPath, text: [body, footer].filter(Boolean).join("\n\n"),
    html: `<!doctype html><html><body style="font:16px/1.6 Arial,sans-serif;color:#17243b"><main style="max-width:600px;margin:auto;padding:24px">${content.logoUrl ? `<img src="${escape(logoPath ? "cid:clinic-logo" : content.logoUrl)}" alt="${escape(values.clinic_name || "Clinic")} logo" style="max-width:180px;max-height:80px">` : ""}<h1 style="font-size:22px">${escape(subject)}</h1><div style="white-space:pre-wrap">${escape(body)}</div><p style="font-size:12px;color:#53647b;white-space:pre-wrap">${escape(footer)}</p></main></body></html>` };
}