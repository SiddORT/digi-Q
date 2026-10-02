import { z } from "zod";

export const templateEvents = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"] as const;
export type TemplateEvent = typeof templateEvents[number];
export const templateVariables = ["clinic_name", "patient_name", "doctor_name", "appointment_details", "previous_details", "reference", "timezone", "clinic_contact"] as const;
export const templateContent = z.object({
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
export const templateSave = z.object({
  clinicId: z.string().min(1).max(100).optional(), event: z.enum(templateEvents),
  revision: z.number().int().min(0), mode: z.enum(["draft", "publish", "reset"]),
  content: templateContent.optional(),
}).strict().refine(v => v.mode === "reset" || !!v.content, { message: "Template content is required" });
export const eventTitles: Record<TemplateEvent, string> = {
  booking: "Booking confirmation", onboarding: "Clinic onboarding", rescheduled: "Appointment rescheduled",
  cancelled: "Appointment cancelled", completed: "Thank you after your visit", reminder: "Appointment reminder",
};
const bodies: Record<TemplateEvent, string> = {
  booking: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n\n{{clinic_contact}}",
  onboarding: "Welcome to {{clinic_name}}.\n\nComplete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.\n\n{{clinic_contact}}",
  rescheduled: "Hello {{patient_name}},\n\nYour visit at {{clinic_name}} has been rescheduled.\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}\nReference: {{reference}}",
  cancelled: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} has been cancelled.\n{{appointment_details}}\nReference: {{reference}}\nContact the clinic if you need to book another visit.\n{{clinic_contact}}",
  completed: "Hello {{patient_name}},\n\nThank you for visiting {{clinic_name}}. Your visit is now complete.\nFor further assistance, contact your clinic.\n{{clinic_contact}}",
  reminder: "Hello {{patient_name}},\n\nA reminder of your upcoming session at {{clinic_name}}.\n{{appointment_details}}\nReference: {{reference}}\nQueue-based visits do not guarantee an exact consultation time.",
};
export function defaultTemplate(event: TemplateEvent): TemplateContent {
  return { subject: `${eventTitles[event]} — {{clinic_name}}`, body: bodies[event], prefix: "", logoUrl: "", footer: "This is an automated clinic message. Contact your clinic for assistance." };
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