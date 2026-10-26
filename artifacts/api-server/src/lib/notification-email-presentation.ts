import { emailAction, emailCard, emailShell, emailText, otpEmailPanel, visitEmailCard, type EmailContext } from "./email-presentation";

const actions: Record<string, string> = { setup_link: "Set up your password", sign_in_link: "Sign in", booking_link: "Open clinic booking" };
const labels: Record<string, string> = {
  booking: "Booking confirmation", onboarding: "Clinic onboarding", rescheduled: "Appointment rescheduled",
  cancelled: "Appointment cancelled", completed: "Visit completed", reminder: "Appointment reminder",
  patient_login_otp: "Login verification", clinic_registration_otp: "Clinic registration verification",
  patient_email_otp: "Email verification", staff_email_otp: "Staff email verification",
  registration_mobile_otp: "Mobile verification", staff_mobile_otp: "Staff mobile verification",
  doctor_setup: "Account setup", staff_setup: "Account setup", password_setup_complete: "Account security",
};

/** Walk the authored tokens, never a substituted string. Values are inert text.
 * Composite legacy summaries remain complete, without attempting to parse prose. */
export function notificationEmailHtml(content: { body: string; footer: string; logoUrl: string },
  subject: string, values: Record<string, string>, context: EmailContext = {}) {
  let otpShown = false;
  const render = (source: string) => {
    const parts: string[] = [];
    let offset = 0;
    for (const match of source.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
      parts.push(emailText(source.slice(offset, match.index)));
      const key = match[1], value = values[key] ?? `[${key.replaceAll("_", " ")}]`;
      let punctuationLength = 0;
      if (key === "otp" && /^\d{6}$/.test(value)) {
        // Keep authored sentence punctuation beside the code, not stranded at
        // the beginning of the next paragraph. It is outside the copyable code.
        const punctuation = /^[.,;:!?]/.exec(source.slice(match.index! + match[0].length))?.[0] || "";
        punctuationLength = punctuation.length;
        parts.push(otpEmailPanel(value, values.expiry_minutes, punctuation)); otpShown = true;
      } else if (key === "appointment_details") {
        parts.push(context.visit ? visitEmailCard(context.visit, content.body) : emailCard(emailText(value)));
      } else if (key === "previous_details") {
        parts.push(emailCard(emailText(value), "PREVIOUS VISIT"));
      } else if (actions[key]) {
        parts.push(emailAction(value, actions[key]));
      } else if (key === "clinic_contact") {
        parts.push(value.trim() ? `<div style="margin-top:22px;color:#53647b;font-size:13px"><strong style="color:#101d42">Clinic contact</strong><div style="margin-top:6px">${emailText(value)}</div></div>` : "");
      } else {
        parts.push(`<strong style="color:#101d42">${emailText(value)}</strong>`);
      }
      offset = match.index! + match[0].length + punctuationLength;
    }
    parts.push(emailText(source.slice(offset)));
    return parts.join("");
  };
  const body = render(content.body), footer = render(content.footer);
  return emailShell(subject, body, {
    label: labels[context.event || ""] || (otpShown ? "OTP verification" : undefined),
    logoUrl: content.logoUrl.startsWith("/api/branding/logos/") ? "cid:clinic-logo" : content.logoUrl,
    logoAlt: `${values.clinic_name || "Clinic"} logo`,
    footerHtml: footer || undefined, security: otpShown,
    greeting: otpShown && !/^\s*(?:hello|hi|dear)\b/i.test(content.body) ? "Hello," : undefined,
    // The shell owns the fixed support destination; no editable security URL.
    helpHtml: otpShown || /\{\{\s*clinic_contact\s*\}\}/.test(content.body) ? undefined
      : values.clinic_contact?.trim() ? emailText(values.clinic_contact) : undefined,
  });
}
