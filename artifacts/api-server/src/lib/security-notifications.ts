import { db } from "@workspace/db";
import { sendAuthEmail } from "./auth-email";
import { resolvedIntegration } from "./integration-vault";
import { resolvedTemplate } from "./notification-template-store";
import { renderNotification, substitute, validEventContent, smsTemplateContent, type TemplateRecipient } from "./notification-templates";
import { notificationSmsConfig, smsPayload, sendNotificationSms, type SmsOutcome } from "./notification-sms-transport";
import { type SecurityEvent } from "./security-template-definitions";
import { assert } from "./http";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export type ChannelOutcome = { status: SmsOutcome | "unavailable" | "not_requested"; destination?: string };
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
export async function securityEmail(event: SecurityEvent, recipient: TemplateRecipient, to: string,
  values: Record<string,string>, send = sendAuthEmail, conn: any = db): Promise<ChannelOutcome> {
  const destination = maskedDestination(to);
  let prepared = false;
  try {
    const template = await resolvedTemplate(event,undefined,conn,recipient,"email");
    assert(validEventContent(event,template.content),503,"Security email template is invalid");
    if (event === "doctor_setup" || event === "staff_setup")
      assert(/\{\{\s*setup_link\s*\}\}/.test(template.content.body),503,"Setup link is required");
    const rendered = renderNotification(template.content,values);
    prepared = true;
    await send(to,rendered.subject,rendered.text,undefined,rendered);
    return {status:"provider_accepted",destination};
  } catch(error) { return {status:prepared ? emailFailure(error) : "pre_dispatch_failed",destination}; }
}
/** No notification history: security bodies, codes, links and destinations are never recorded there. */
export async function securitySms(event: SecurityEvent, recipient: TemplateRecipient, mobile: string | undefined,
  values: Record<string,string>, send = sendNotificationSms, conn: any = db): Promise<ChannelOutcome> {
  if (!mobile) return {status:"not_requested"};
  const destination = maskedDestination(mobile);
  let env: NodeJS.ProcessEnv, content: ReturnType<typeof smsTemplateContent.parse>, message: string;
  try {
    assert(/^\+[1-9]\d{6,14}$/.test(mobile),400,"Invalid mobile");
    env = (await resolvedIntegration("notificationSms",conn)).env;
    const cfg = notificationSmsConfig(env);
    const template = await resolvedTemplate(event,undefined,conn,recipient,"sms");
    // New security SMS must be reviewed/published, even when a generic provider does not require DLT.
    assert(template.source !== "default",503,"Publish approved security SMS content first");
    content = smsTemplateContent.parse(template.content);
    assert(validEventContent(event,content) && !/\{\{\s*setup_link\s*\}\}/.test(content.body),503,"Invalid security SMS");
    message = substitute(content.body,values);
    smsPayload(cfg,mobile,message,content);
  } catch { return {status:"unavailable",destination}; }
  try { return {status:await send(env,mobile,message,content),destination}; }
  catch { return {status:"delivery_unknown",destination}; }
}
