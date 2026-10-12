import { db, settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { assert } from "./http";
import { authorizedTemplateScope, resolvedTemplate, type Channel } from "./notification-template-store";
import { templateEvents, templateRecipients, templateContent, smsTemplateContent, renderNotification, substitute, type SmsTemplateContent } from "./notification-templates";
import { integrationSettings, resolvedIntegration } from "./integration-vault";
import { notificationSmsConfig, sendNotificationSms, notificationSmsReadiness, type SmsOutcome } from "./notification-sms-transport";
import { smtpConfig, validEmailAddress } from "./integration-config";
import { sendAuthEmail } from "./auth-email";
import { getSettings } from "./store";
import { DEMO_FIXTURE } from "./demo-policy";

export const eventControlInput = z.object({
  channel:z.enum(["email","sms"]),event:z.enum(templateEvents),recipient:z.enum(templateRecipients),
  clinicId:z.string().min(1).max(100).optional(),revision:z.number().int().min(0),
  enabled:z.boolean(),confirmed:z.literal(true),
}).strict();
export async function eventControls(user:any,clinicId?:string) {
  assert(user.role==="superAdmin"&&!user.demo&&user.demoFixture!==DEMO_FIXTURE,403,"Real Superadmin access required");
  const clinic=await authorizedTemplateScope(user,clinicId);
  const readiness=await integrationSettings();
  const gate=clinicId?(await getSettings(db,clinicId)).notificationsEnabled:undefined;
  let dltRequired=false, providerSender=false, providerEntity=false;
  try {const config=notificationSmsConfig((await resolvedIntegration("notificationSms")).env);dltRequired=config.mapping.dltRequired;providerSender=!!config.senderId;providerEntity=!!config.dltEntityId;}catch{/* missing configuration shown below */}
  const items=[];
  for(const channel of ["email","sms"] as const) for(const recipient of templateRecipients) for(const event of templateEvents) {
    if(event==="onboarding"&&recipient!=="clinicAdmin")continue;
    const template=await resolvedTemplate(event,clinicId,db,recipient,channel);
    const reasons:string[]=[];
    if(!(channel==="sms"?readiness.notificationSms:readiness.smtp).ready)reasons.push(`Configure ${channel==="sms"?"SMS API":"SMTP"} on the ${channel==="sms"?"SMS":"Email"} page`);
    if(channel==="sms"&&readiness.notificationSms.notificationsEnabled===false)reasons.push("SMS notifications are disabled in Communication Settings");
    if(channel==="email"&&readiness.smtp.notificationsEnabled===false)reasons.push("Email notifications are disabled in Communication Settings");
    const sms=template.content as SmsTemplateContent;
    if(channel==="sms"&&dltRequired&&!((sms.senderId||providerSender)&&(sms.dltEntityId||providerEntity)&&sms.dltTemplateId))reasons.push("Configure Sender and Entity IDs, and publish a DLT Template ID for this event");
    if(gate===false)reasons.push("Enable the clinic-wide notification gate in Clinic settings (not changed here)");
    if(!template.content.enabled)reasons.push("Published activation is off");
    items.push({channel,event,recipient,revision:template.local.revision,enabled:template.content.enabled,source:template.source,ready:reasons.length===0,blockedReasons:reasons,
      timing:event==="reminder"?"One hour before the session start in the session timezone; not an exact consultation time":
        event==="onboarding"?"After clinic registration commits, to the owning Clinic Admin":"After the corresponding visit change commits; current contact and membership rechecked"});
  }
  return {scopeName:clinic?.name||"Platform defaults",notificationsEnabled:gate,
    gateDescription:clinicId?`Clinic notification gate is ${gate?"on":"off"}. This page never changes it.`:"Platform defaults are inherited only when a clinic has no published override. Each clinic's notification gate still applies.",items};
}
export const eventTestInput=z.object({
  channel:z.enum(["email","sms"]),event:z.enum(templateEvents),recipientGroup:z.enum(templateRecipients),
  clinicId:z.string().min(1).max(100).optional(),revision:z.number().int().min(0),
  content:z.union([templateContent,smsTemplateContent]),
  values:z.record(z.string(),z.string().min(1).max(1500)),recipient:z.string().max(254).optional(),
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
  assert(body.event!=="onboarding"||body.recipientGroup==="clinicAdmin",400,"Invalid event recipient");
  const effective=await resolvedTemplate(body.event,body.clinicId,db,body.recipientGroup,body.channel);
  assert(effective.local.revision===body.revision,409,"Template changed. Refresh before testing.");
  const content=(body.channel==="sms"?smsTemplateContent:templateContent).parse(body.content);
  const texts=body.channel==="sms"?[content.body]:[content.subject,content.body,content.prefix,content.footer];
  const used=new Set(texts.flatMap(text=>[...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map(m=>m[1])));
  assert(Object.keys(body.values).length===used.size&&Object.keys(body.values).every(k=>used.has(k))&&[...used].every(k=>body.values[k]?.trim()),400,"Provide exactly the placeholders used by this template");
  const rendered=body.channel==="sms"?{subject:"",text:substitute(content.body,body.values)}:renderNotification(content,body.values);
  assert(rendered.text.length<=(body.channel==="sms"?1600:24000),400,"Rendered message is too long");
  return {body,content,rendered};
}
/** A durable actor/request claim makes double submits and ambiguous HTTP retries non-dispatching.
 * Only sanitized outcome is stored; never recipient, values, rendered text or credential data. */
export async function testTemplate(user:any,prepared:Awaited<ReturnType<typeof prepareTemplateTest>>,
  smsSend=sendNotificationSms,emailSend=sendAuthEmail) {
  const {body,content,rendered}=prepared;
  assert(body.confirmed===true&&body.requestId,400,"Confirm one real test send and provide a request ID");
  assert(body.recipient && (body.channel==="sms"?/^\+[1-9]\d{6,14}$/.test(body.recipient):validEmailAddress(body.recipient)),400,"Enter one valid explicit recipient");
  const id=`notification-test:${user.id}:${body.requestId}`;
  const digest=createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const replay=await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const [prior]=await tx.select().from(settings).where(eq(settings.id,id));
    if(prior){assert(prior.data.digest===digest,409,"Request ID already used for a different test");return prior.data.status||"delivery_unknown";}
    // Readiness is required, not implied by an earlier successful test.
    if(body.channel==="sms") {
      const env=(await resolvedIntegration("notificationSms",tx)).env;
      assert(notificationSmsReadiness(env).ready,400,"Configure notification SMS before testing");
      const cfg=notificationSmsConfig(env),meta=content as SmsTemplateContent;
      assert(!cfg.mapping.dltRequired||!!((meta.senderId||cfg.senderId)&&(meta.dltEntityId||cfg.dltEntityId)&&meta.dltTemplateId),400,"Sender and DLT metadata are required for this transport");
    }else smtpConfig((await resolvedIntegration("smtp",tx)).env);
    const inserted=await tx.insert(settings).values({id,data:{digest,status:"delivery_unknown",createdAt:Date.now()}}).onConflictDoNothing().returning({id:settings.id});
    if(!inserted.length) {
      const [existing]=await tx.select().from(settings).where(eq(settings.id,id));
      assert(existing?.data.digest===digest,409,"Request ID already used for a different test");
      return existing.data.status||"delivery_unknown";
    }
    return null;
  });
  let status:SmsOutcome=replay as SmsOutcome;
  if(!replay) {
    status="delivery_unknown";
    try {
      if(body.channel==="sms") status=await smsSend((await resolvedIntegration("notificationSms")).env,body.recipient!,rendered.text,content as SmsTemplateContent);
      else {await emailSend(body.recipient!,rendered.subject,rendered.text,undefined,rendered as any);status="provider_accepted";}
    }catch(error:any){status=error?.code==="EMAIL_UNCONFIGURED"?"pre_dispatch_failed":error?.code==="EMAIL_REJECTED"?"provider_rejected":error?.code==="EMAIL_PRE_DISPATCH_FAILED"?"pre_dispatch_failed":"delivery_unknown";}
    await db.update(settings).set({data:{digest,status,finishedAt:Date.now()}}).where(eq(settings.id,id));
    const {auditLogs}=await import("@workspace/db");
    await db.insert(auditLogs).values({id:randomUUID(),actorId:user.id,action:"notification_test",entityType:"notification_templates",entityId:body.channel,summary:`${body.channel} ${body.event} ${body.recipientGroup} test: ${status}`});
  }
  return {status,message:outcomeMessages[status],subject:rendered.subject,body:rendered.text};
}
