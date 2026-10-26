import { emailBrand, automatedFooter, emailSupportText, emailShell, emailText, emailAction } from "./email-presentation";

/** Caller-owned text remains independent of visual markup. */
export function systemEmailTemplate(subject: string, body: string, action?: { url: string; label: string }): { text: string; html: string } {
  return {
    text: `${emailBrand}\n\n${subject}\n\n${body}\n\n${emailSupportText}\n\n${automatedFooter}`,
    html: emailShell(subject, `<div style="white-space:pre-wrap">${action
      ? emailText(body).replace(emailText(action.url), () => emailAction(action.url, action.label))
      : emailText(body)}</div>`),
  };
}
