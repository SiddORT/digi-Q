import { db, settings } from "@workspace/db";
import type { SmsDiagnostic } from "./notification-sms-diagnostics";
import { eq, sql } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { dispatchNotificationTest } from "./notification-test-dispatch";
import { assert } from "./http";
import { authorizedTemplateScope, resolvedTemplate, type Channel } from "./notification-template-store";
import { templateEvents, templateRecipients, templateContent, smsTemplateContent, renderNotification, substitute, type SmsTemplateContent } from "./notification-templates";
import { integrationSettings, resolvedIntegration } from "./integration-vault";
import { notificationSmsConfig, sendNotificationSms, notificationSmsReadiness, smsMetadataReady, type SmsOutcome } from "./notification-sms-transport";
import { smtpConfig, validEmailAddress } from "./integration-config";
import { sendAuthEmail } from "./auth-email";
import { getSettings } from "./store";
import { DEMO_FIXTURE } from "./demo-policy";
import { validTemplateTarget, validEventContent } from "./notification-templates";
import { requiredEvent, isSecurityEvent } from "./security-template-definitions";
import { accountRoleLabel } from "@workspace/api-zod/notification-variable-contract";

export const eventControlInput = z.object({
  channel:z.enum(["email","sms"]),event:z.enum(templateEvents),recipient:z.enum(templateRecipients),
  clinicId:z.string().min(1).max(100).optional(),revision:z.number().int().min(0),
  enabled:z.boolean(),confirmed:z.literal(true),
}).strict();
export async function eventControls(user:any,clinicId?:string) {
  assert(user.role==="superAdmin"&&!user.demo&&user.demoFixture!==DEMO_FIXTURE,403,"Real Superadmin access required");
  const clinic=await authorizedTemplateScope(user,clinicId);
  return deliveryControlCatalog(db,clinicId,clinic);
}
/** Internal shared policy projection. Callers must authorize scope before using it. */
export async function deliveryControlCatalog(conn:any,clinicId?:string,clinic?:any) {
   const readiness=await integrationSettings(conn);
  const gate=(await getSettings(conn,clinicId)).notificationsEnabled;
   let smsConfig: ReturnType<typeof notificationSmsConfig> | undefined;
   try {smsConfig=notificationSmsConfig((await resolvedIntegration("notificationSms",conn)).env);}catch{/* missing configuration shown below */}
  const items=[];
  for(const channel of ["email","sms"] as const) for(const recipient of templateRecipients) for(const event of templateEvents) {
     if(!validTemplateTarget(event,recipient,channel)||requiredEvent(event)&&clinicId)continue;
    const template=await resolvedTemplate(event,clinicId,conn,recipient,channel);
    const reasons:string[]=[];
    if (event === "booking_status_link" && (!template.wordingPublished || !(template.content as SmsTemplateContent).dltTemplateId))
      reasons.push("Publish the approved manual booking-status link wording and its own registration before use");
    if(!(channel==="sms"?readiness.notificationSms:readiness.smtp).ready)reasons.push(`Configure ${channel==="sms"?"SMS API":"SMTP"} on the ${channel==="sms"?"SMS":"Email"} page`);
     if(channel==="sms"&&!requiredEvent(event)&&readiness.notificationSms.notificationsEnabled===false)reasons.push("SMS notifications are disabled in Communication Settings");
     if(channel==="email"&&!requiredEvent(event)&&readiness.smtp.notificationsEnabled===false)reasons.push("Email notifications are disabled in Communication Settings");
     if(channel==="sms"&&isSecurityEvent(event)&&!template.wordingPublished)reasons.push("Publish approved security SMS wording before use");
    const sms=template.content as SmsTemplateContent;
    if(channel==="sms"&&smsConfig&&!smsMetadataReady(smsConfig,sms))reasons.push(smsConfig.provider==="keepInTouch"?"Publish a DLT Template ID for this event; Keep in Touch uses Sender ID but no Entity ID":"Configure Sender and Entity IDs, and publish a DLT Template ID for this event");
     if(gate===false&&!requiredEvent(event))reasons.push(clinicId?"Clinic notification gate is off":"Platform default notification gate is off; clinics may have explicit overrides");
    if(!template.content.enabled)reasons.push("Published activation is off");
     items.push({channel,event,recipient,required:requiredEvent(event),revision:template.local.revision,enabled:template.content.enabled,source:template.source,ready:reasons.length===0,blockedReasons:reasons,
       timing:event==="booking_status_link"?"Manual only, after staff previews the eligible patient recipient and approved message and explicitly confirms. Never sent by automatic booking events.":
        requiredEvent(event)?"Platform security message sent on its authentication action when enabled at System Default. Optional Delivery does not apply. Disabling verification or setup delivery can prevent that action; SMS setup advisories do not replace the emailed link.":
        event==="staff_created_admin"?"After the staff account commits, only to the creating administrator's matching verified contact. Failed creation sends no notice.":
        event==="staff_welcome"?"Once per new account and channel, after that contact is verified. Email verification never authorizes SMS, or the reverse. Past skips are not replayed.":
        event==="reminder"?"One hour before the session start in the session timezone; not an exact consultation time":
        event==="onboarding"?(recipient==="superAdmin"?"After clinic registration commits, to active System Admins":"After clinic registration commits, to the owning Clinic Admin"):"After the corresponding visit change commits; current contact and membership rechecked"});
  }
  return {scopeName:clinic?.name||"Platform defaults",notificationsEnabled:gate,
    gateDescription:clinicId?`Clinic notification gate is ${gate?"on":"off"}. This page never changes it.`:"Platform defaults are inherited only when a clinic has no published override. Each clinic's notification gate still applies.",items};
}
export const eventTestInput=z.object({
  channel:z.enum(["email","sms"]),event:z.enum(templateEvents),recipientGroup:z.enum(templateRecipients),
  clinicId:z.string().min(1).max(100).optional(),revision:z.number().int().min(0),
  content:z.union([templateContent,smsTemplateContent]),
  values:z.record(z.string(),z.string().max(1500)),recipient:z.string().max(254).optional(),
  confirmed:z.boolean().optional(),requestId:z.string().uuid().optional(),
}).strict();
export const outcomeMessages:Record<SmsOutcome,string>={
  provider_accepted:"The provider accepted the message. Handset or inbox delivery is not confirmed.",
  provider_rejected:"The provider explicitly rejected the message. Check configuration and recipient.",
  pre_dispatch_failed:"The message was not dispatched. Check channel configuration and required template fields.",
  delivery_unknown:"Dispatch outcome is uncertain. Do not automatically resend; verify with the provider first.",
};
export async function prepareTemplateTest(user:any,input:unknown) {
  assert(user.role==="superAdmin"&&!user.demo&&user.demoFixture!==DEMO_FIXTURE,403,"Real Superadmin access required");
  const body=eventTestInput.parse(input);
  await authorizedTemplateScope(user,body.clinicId);
  assert(validTemplateTarget(body.event,body.recipientGroup,body.channel),400,"Invalid event recipient or channel");
   assert(!requiredEvent(body.event)||!body.clinicId,400,"Security messages are platform-scoped");
  const effective=await resolvedTemplate(body.event,body.clinicId,db,body.recipientGroup,body.channel);
  assert(effective.local.revision===body.revision,409,"Template changed. Refresh before testing.");
  const content=(body.channel==="sms"?smsTemplateContent:templateContent).parse(body.content);
   assert(validEventContent(body.event,content),400,"Use this event's supported variables, including required code and expiry placeholders.");
   if(isSecurityEvent(body.event)) {
     assert(body.channel!=="email" || !["doctor_setup","staff_setup"].includes(body.event) || /\{\{\s*setup_link\s*\}\}/.test(content.body),400,"Setup email must include {{setup_link}}");
     assert(body.channel!=="sms" || !/\{\{\s*setup_link\s*\}\}/.test(content.body),400,"SMS cannot include setup links");
   }
  const texts=body.channel==="sms"?[content.body]:[content.subject,content.body,content.prefix,content.footer];
  const used=new Set(texts.flatMap(text=>[...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(m=>m[1])));
  assert(Object.keys(body.values).length===used.size&&Object.keys(body.values).every(k=>used.has(k))&&[...used].every(k=>k==="clinic_contact"||body.values[k]?.trim()),400,"Provide exactly the placeholders used by this template (clinic contact is optional)");
   // Security previews/tests use only fictional values, never caller-provided credentials.
   const sample = {otp:"123456",expiry_minutes:"10",setup_link:"https://example.invalid/set-password?token=fictional-preview-only",recipient_name:"Example Recipient",role_name:accountRoleLabel(body.recipientGroup)};
   const values = requiredEvent(body.event) ? sample : body.values;
    const rendered=body.channel==="sms"?{subject:"",text:substitute(content.body,values)}:renderNotification(content,values,{event:body.event});
  assert(rendered.text.length<=(body.channel==="sms"?1600:24000),400,"Rendered message is too long");
  return {body,content,rendered};
}
/** A durable actor/request claim makes double submits and ambiguous HTTP retries non-dispatching.
 * Only sanitized outcome is stored; never recipient, values, rendered text or credential data. */
export async function testTemplate(user:any,prepared:Awaited<ReturnType<typeof prepareTemplateTest>>,
  smsSend=sendNotificationSms,emailSend=sendAuthEmail) {
  const {body,content,rendered}=prepared;
   assert(!requiredEvent(body.event),400,"Security templates support fictional previews only. Verify real authentication delivery only with separate authorization.");
  assert(body.confirmed===true&&body.requestId,400,"Confirm one real test send and provide a request ID");
  assert(body.recipient && (body.channel==="sms"?/^\+[1-9]\d{6,14}$/.test(body.recipient):validEmailAddress(body.recipient)),400,"Enter one valid explicit recipient");
  let diagnostic: SmsDiagnostic | undefined;
  const status=await dispatchNotificationTest(user.id,{
    channel:body.channel,event:body.event,recipientGroup:body.recipientGroup,clinicId:body.clinicId,
    recipient:body.recipient!,subject:rendered.subject,message:rendered.text,confirmed:true,requestId:body.requestId!,
    templateId:`${body.channel}:${body.event}:${body.recipientGroup}`,templateRevision:body.revision,templateScope:"test_draft",
    content:body.channel==="sms"?content as SmsTemplateContent:undefined,rendered:body.channel==="email"?rendered as any:undefined,
  },db,smsSend,emailSend, info => { diagnostic = info; });
  const message = diagnostic
    ? `${diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}. ` : ""}${diagnostic.message}`
    : outcomeMessages[status];
  return {status,message,subject:rendered.subject,body:rendered.text};
}
