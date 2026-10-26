import { db } from "@workspace/db";
import { sendAuthEmail, EmailRejectionError } from "./auth-email";
import { resolvedIntegration } from "./integration-vault";
import { resolvedTemplate } from "./notification-template-store";
import { renderNotification, substitute, validEventContent, smsTemplateContent, type TemplateRecipient } from "./notification-templates";
import { notificationSmsConfig, smsPayload, sendNotificationSms, type SmsOutcome } from "./notification-sms-transport";
import { type SecurityEvent } from "./security-template-definitions";
import { assert, HttpError } from "./http";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { missingVisitVariables } from "./notification-template-values";
import { logger } from "./logger";

export type ChannelOutcome = { status: SmsOutcome | "disabled" | "unavailable" | "not_requested"; destination?: string };
export type SecurityOutcomes = { email?: ChannelOutcome; sms?: ChannelOutcome };
export function eligibleStaffMobile(value: unknown) {
  try {const phone = parsePhoneNumberFromString(String(value || ""),"IN");return phone?.isValid() ? phone.number : undefined;}
  catch {return undefined;}
}
export function maskedDestination(value: string) {
  if (value.includes("@")) { const [name, domain] = value.split("@"); return `${name.slice(0,1)}***@${domain}`; }
  return `***${value.slice(-4)}`;
}
export function emailFailure(error: any): SmsOutcome {
  return ["EMAIL_UNCONFIGURED","EMAIL_PRE_DISPATCH_FAILED"].includes(error?.code) ? "pre_dispatch_failed" :
    error?.code === "EMAIL_REJECTED" ? "provider_rejected" : "delivery_unknown";
}
export function securityEmailDiagnostic(error: any, prepared: boolean) {
  if(error?.code === "SECURITY_DELIVERY_DISABLED") return "disabled";
  if(!prepared) return "preparation_failed";
  if(error instanceof EmailRejectionError) return error.diagnostic;
  const categories: Record<string,string> = {
    EMAIL_REJECTED:"provider_rejected",
    EMAIL_UNCONFIGURED:"configuration_unavailable", EMAIL_PRE_DISPATCH_FAILED:"pre_dispatch_failed",
  };
  return categories[error?.code] || "delivery_unknown";
}
/** Classification/ownership stays independent of activation and operational gates. */
export async function requireSecurityDelivery(event: SecurityEvent | "patient_login_otp", recipient: TemplateRecipient,
  channel: "email" | "sms", conn: any = db) {
  const template = await resolvedTemplate(event,undefined,conn,recipient,channel);
  if (!template.content.enabled) throw new HttpError(503,
    "Delivery for this action is unavailable. Verification is still required; contact the System Admin.", "SECURITY_DELIVERY_DISABLED");
  return template;
}
export async function securityEmail(event: SecurityEvent, recipient: TemplateRecipient, to: string,
  values: Record<string,string>, send = sendAuthEmail, conn: any = db): Promise<ChannelOutcome> {
  const destination = maskedDestination(to);
  let prepared = false;
  try {
    const template = await resolvedTemplate(event,undefined,conn,recipient,"email");
    if (!template.content.enabled) return {status:"disabled",destination};
    assert(validEventContent(event,template.content),503,"Security email template is invalid");
    if (event === "doctor_setup" || event === "staff_setup")
      assert(/\{\{\s*setup_link\s*\}\}/.test(template.content.body),503,"Setup link is required");
    assert(!missingVisitVariables([template.content.subject, template.content.body, template.content.prefix, template.content.footer], values).length,
      503,"Required security template values are missing");
    const rendered = renderNotification(template.content,values,{event});
    await requireSecurityDelivery(event,recipient,"email",conn);
    prepared = true;
    await send(to,rendered.subject,rendered.text,undefined,rendered,[],undefined,
      async () => { await requireSecurityDelivery(event,recipient,"email",conn); });
    return {status:"provider_accepted",destination};
  } catch(error: any) {
    logger.warn({event,channel:"email",category:securityEmailDiagnostic(error,prepared)},"Security email unsuccessful");
    return {status:error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : prepared ? emailFailure(error) : "pre_dispatch_failed",destination};
  }
}
/** No notification history: security bodies, codes, links and destinations are never recorded there. */
export async function securitySms(event: SecurityEvent, recipient: TemplateRecipient, mobile: string | undefined,
  values: Record<string,string>, send = sendNotificationSms, conn: any = db): Promise<ChannelOutcome> {
  if (!mobile) return {status:"not_requested"};
  const destination = maskedDestination(mobile);
  let env: NodeJS.ProcessEnv, content: ReturnType<typeof smsTemplateContent.parse>, message: string;
  try {
    await requireSecurityDelivery(event,recipient,"sms",conn);
    assert(/^\+[1-9]\d{6,14}$/.test(mobile),400,"Invalid mobile");
    env = (await resolvedIntegration("notificationSms",conn)).env;
    const cfg = notificationSmsConfig(env);
    const template = await resolvedTemplate(event,undefined,conn,recipient,"sms");
    // New security SMS must be reviewed/published, even when a generic provider does not require DLT.
    assert(template.wordingPublished,503,"Publish approved security SMS content first");
    content = smsTemplateContent.parse(template.content);
    assert(validEventContent(event,content) && !/\{\{\s*setup_link\s*\}\}/.test(content.body),503,"Invalid security SMS");
    assert(!missingVisitVariables([content.body], values).length,503,"Required security template values are missing");
    message = substitute(content.body,values);
    smsPayload(cfg,mobile,message,content);
  } catch(error: any) { return {status:error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : "unavailable",destination}; }
  try {
    await requireSecurityDelivery(event,recipient,"sms",conn);
  } catch(error: any) { return {status:error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : "unavailable",destination}; }
  try { return {status:await send(env,mobile,message,content),destination}; }
  catch { return {status:"delivery_unknown",destination}; }
}
