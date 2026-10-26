import { db, settings, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { audit, one } from "./store";
import { assert } from "./http";
import { defaultTemplate, eventTitles, renderNotification, templateContent, smsTemplateContent, templateEvents, templateSave, templateVariables, type TemplateContent, type SmsTemplateContent, type TemplateEvent } from "./notification-templates";
import { defaultRecipient, patientLoginSmsBody, substitute, type TemplateRecipient } from "./notification-templates";
import { resolvedIntegration } from "./integration-vault";
import { notificationSmsConfig, smsMetadataReady } from "./notification-sms-transport";
import { DEMO_FIXTURE } from "./demo-policy";
import { visitTemplateValues } from "./notification-template-values";
import { validTemplateTarget, validEventContent } from "./notification-templates";
import { requiredEvent, isSecurityEvent, securityDefault } from "./security-template-definitions";
import { appointmentActivationId, appointmentNotificationTarget } from "./appointment-notification-scope";
import { accountRoleLabel } from "@workspace/api-zod/notification-variable-contract";
import { emailPreviewHtml } from "./email-preview";

export type Channel = "email" | "sms";
const key = (event: TemplateEvent, clinicId?: string, recipient = defaultRecipient(event), channel:Channel="email") => `${channel==="sms"?"sms":"notification"}-template:${clinicId || "platform"}:${event}${recipient === defaultRecipient(event) ? "" : `:${recipient}`}`;
export const notificationTemplateKey = key;
type RecordData = { revision: number; publishedRevision?:number; published?: TemplateContent | SmsTemplateContent; draft?: TemplateContent | SmsTemplateContent; activatedAt?: number; activationOnly?: boolean; activationEnabled?: boolean };
async function stored(event: TemplateEvent, clinicId?: string, conn: any = db, recipient = defaultRecipient(event),channel:Channel="email"): Promise<RecordData> {
  const [row] = await conn.select().from(settings).where(eq(settings.id, key(event, clinicId, recipient,channel)));
  return row?.data || { revision: 0 };
}
export async function authorizedTemplateScope(user: any, clinicId?: string, conn: any = db) {
  assert(["superAdmin", "clinicAdmin"].includes(user.role), 403, "Administrator access required");
  assert(!user.demo && user.demoFixture!==DEMO_FIXTURE, 403, "Demo accounts cannot change notification configuration");
  if (!clinicId) { assert(user.role === "superAdmin", 403, "Select a clinic you own"); return null; }
  const clinic = await one(clinics, clinicId, conn);
  assert(user.role === "superAdmin" || clinic.adminId === user.id, 403, "Clinic outside your administration scope");
  return clinic;
}
export async function resolvedTemplate(event: TemplateEvent, clinicId?: string, conn: any = db, recipient = defaultRecipient(event),channel:Channel="email") {
  const platform = await stored(event, undefined, conn, recipient,channel);
  const local = clinicId ? await stored(event, clinicId, conn, recipient,channel) : platform;
  const fallback = defaultTemplate(event, recipient);
   const content = local.published || platform.published || (channel === "sms" ? {...(isSecurityEvent(event) ? securityDefault(event,true) : fallback), enabled:requiredEvent(event)||appointmentNotificationTarget(event,recipient),body:isSecurityEvent(event)?securityDefault(event,true).body:event==="booking_status_link"?fallback.body:event==="patient_login_otp"?patientLoginSmsBody:`${eventTitles[event]}: {{clinic_name}}\n${fallback.body}`,prefix:"",footer:"",logoUrl:"",senderId:"",dltEntityId:"",dltTemplateId:""} : fallback);
   const [activation] = appointmentNotificationTarget(event, recipient)
     ? await conn.select().from(settings).where(eq(settings.id, appointmentActivationId)) : [];
  // Corrupt configuration fails explicitly, rather than silently sending a different template.
   const effectiveContent = requiredEvent(event) && typeof platform.activationEnabled === "boolean"
     ? {...content,enabled:platform.activationEnabled} : content;
   return { content: channel === "sms" ? smsTemplateContent.parse(effectiveContent) : templateContent.parse(effectiveContent), local,
     wordingPublished: !!(local.published || platform.published) && !(local.published ? local : platform).activationOnly,
     activatedAt: Math.max((local.published ? local : platform).activatedAt ?? 0,local.activatedAt ?? 0,activation?.data?.cutoff ?? 0),
    effectiveRevision: local.published ? local.publishedRevision ?? (local.draft ? undefined : local.revision) :
      platform.published ? platform.publishedRevision ?? (platform.draft ? undefined : platform.revision) : 0,
    source: local.published ? (clinicId ? "clinic" : "platform") : platform.published ? "platform" : "default" };
}
export async function templateCatalog(user: any, clinicId?: string, recipient?: TemplateRecipient,channel:Channel="email",conn:any=db) {
  if(channel==="sms") assert(user.role==="superAdmin",403,"Superadmin access required");
  if(recipient==="superAdmin") assert(user.role==="superAdmin",403,"Superadmin access required");
   const clinic = await authorizedTemplateScope(user, clinicId,conn);
  const values = { ...visitTemplateValues({date:"2030-01-15",startTime:"09:00",endTime:"12:00",token:"Q-007",tokenNumber:7},
      clinic,"[Recipient name]",{date:"2030-01-14",startTime:"14:00",endTime:"17:00"}),
    clinic_name: clinic?.name || "Example clinic", clinic_contact: [clinic?.email, clinic?.phone].filter(Boolean).join(" · "),
     patient_name: "[Patient name]", doctor_name: "[Doctor name]", clinic_admin_name: "[Onboarded Clinic Admin name]", appointment_details: "[Clinic-formatted visit details]", previous_details: "[Previous visit details]", reference: "[Booking reference]", timezone: "[Clinic location timezone]" };
  values.cancel_reason = "[Cancellation reason]";
   const previewValues = { ...values, booking_status_link: "https://example.invalid/patient/queue?appointment=fictional", booking_link: clinic ? values.booking_link || "[Clinic booking link unavailable]" : "https://example.invalid/example-clinic", otp: "123456", expiry_minutes: "10", setup_link: "https://example.invalid/set-password?token=fictional-preview-only", role_name: accountRoleLabel(recipient || "receptionist") };
  const items = [];
  for (const event of templateEvents) {
     if (!validTemplateTarget(event, recipient || defaultRecipient(event), channel) || requiredEvent(event) && clinicId) continue;
     const { content, local, source } = await resolvedTemplate(event, clinicId, conn, recipient || defaultRecipient(event),channel);
     const candidate=local.draft || content;
     const preview = validEventContent(event,candidate) ? (channel === "sms"
       ? { subject: substitute(candidate.subject, previewValues), text: substitute(candidate.body, previewValues) }
       : renderNotification(candidate, previewValues, {event})) :
       {subject:"Template preparation unavailable",text:"This saved template uses variables incompatible with this event. Edit it explicitly or reset; saved wording has not been changed."};
    items.push({ event, recipient: recipient || defaultRecipient(event), title: eventTitles[event], revision: local.revision, source, content, draft: local.draft,
      previewSubject: preview.subject, previewBody: preview.text,
      previewHtml: channel === "email" && "html" in preview ? await emailPreviewHtml(preview) : undefined,
       required: requiredEvent(event),
       delivery: event === "booking_status_link" ? "Manual only, after staff previews and confirms. Requires approved published wording and its own registration. Patient must sign in with the account owning the booking. Development never sends; acceptance is not delivery." : requiredEvent(event) ? "Platform security message controlled at System Default. Own activation applies; Optional Delivery and operational provider switches do not. SMS requires approved published wording and sender/DLT configuration. Provider acceptance is not delivery. Real codes and links never enter notification history." : event === "onboarding" ? "Clinic onboarding retains its own activation and recipient policy. Communication Settings and eligible recipient contact apply. Development never sends automatically." : "Appointment Email and SMS default on for patient, owning Clinic Admin and assigned Doctor. Published overrides and personal opt-outs still apply. Active membership and valid unique contact are rechecked. SMS uses existing provider-specific sender/DLT metadata. Reminders are one hour before session start in its timezone, not a consultation-time promise. Development never sends automatically; provider acceptance is not delivery." });
  }
  return { scopeName: clinic?.name || "Platform defaults", variables: [...templateVariables], items };
}
export async function saveTemplate(user: any, input: unknown, conn:any=db,
  maintenance: { preserveDraft?: boolean; activatedAtFloor?: number } = {}) {
  const parsed = templateSave.safeParse(input);
  assert(parsed.success, 400, parsed.success ? "" : parsed.error.issues.slice(0,5).map(issue =>
    `${issue.path.join(".") || "template"}: ${issue.message}`).join("; ") || "Invalid template");
  const body = parsed.data!;
  if(body.channel==="sms") assert(user.role==="superAdmin",403,"Superadmin access required");
  if(body.content) body.content = (body.channel==="sms"?smsTemplateContent:templateContent).parse(body.content);
  assert(validTemplateTarget(body.event,body.recipient||defaultRecipient(body.event),body.channel),400,"Invalid event, recipient or channel");
   if(body.recipient==="superAdmin" || requiredEvent(body.event)) assert(user.role==="superAdmin",403,"Superadmin access required");
   assert(!requiredEvent(body.event)||!body.clinicId,400,"Security templates are platform-scoped");
   if(body.content) assert(validEventContent(body.event,body.content),400,"Use this event's supported variables, including required code and expiry placeholders.");
   if(body.content && isSecurityEvent(body.event) && body.channel==="email" && ["doctor_setup","staff_setup"].includes(body.event))
     assert(/\{\{\s*setup_link\s*\}\}/.test(body.content.body),400,"Setup email must include {{setup_link}}");
   if(body.content && isSecurityEvent(body.event) && body.channel==="sms")
     assert(!/\{\{\s*setup_link\s*\}\}/.test(body.content.body),400,"SMS must not include a bearer setup link");
   await conn.transaction(async (tx:any) => {
    await authorizedTemplateScope(user, body.clinicId, tx);
    const id = key(body.event, body.clinicId, body.recipient,body.channel);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const current = await stored(body.event, body.clinicId, tx, body.recipient,body.channel);
    assert(current.revision === body.revision, 409, "This template changed. Reload it before saving.");
    const next: RecordData = { revision: current.revision + 1 };
    if(body.mode==="reset") {
      const before=await resolvedTemplate(body.event,body.clinicId,tx,body.recipient||defaultRecipient(body.event),body.channel);
      const inherited=body.clinicId
        ?await resolvedTemplate(body.event,undefined,tx,body.recipient||defaultRecipient(body.event),body.channel)
         :{content:{enabled:body.channel==="email"?defaultTemplate(body.event,body.recipient||defaultRecipient(body.event)).enabled:requiredEvent(body.event)||appointmentNotificationTarget(body.event,body.recipient||defaultRecipient(body.event))}};
       if(requiredEvent(body.event)) next.activationEnabled=before.content.enabled;
       next.activatedAt=!requiredEvent(body.event)&&inherited.content.enabled&&!before.content.enabled?Date.now():before.activatedAt;
    }
    if (body.mode === "draft") Object.assign(next, { published: current.published, draft: body.content, activationOnly: current.activationOnly, activationEnabled: current.activationEnabled });
    if (body.mode === "publish") {
      const previous=await resolvedTemplate(body.event,body.clinicId,tx,body.recipient||defaultRecipient(body.event),body.channel);
      if(body.channel==="sms" && body.content?.enabled) {
        let cfg: ReturnType<typeof notificationSmsConfig> | undefined;
        try { cfg = notificationSmsConfig((await resolvedIntegration("notificationSms",tx)).env); } catch { assert(false,400,"Configure notification SMS before activation"); }
        const sms = body.content as SmsTemplateContent;
        assert(smsMetadataReady(cfg!,sms),400,cfg!.provider==="keepInTouch"?"Sender ID and this event's DLT Template ID are required for activation":"Sender ID, DLT Entity ID and DLT Template ID are required for activation");
      }
      next.published = body.content;
      if(requiredEvent(body.event)) next.activationEnabled=body.content!.enabled;
      next.publishedRevision = next.revision;
      next.activatedAt = body.content?.enabled && !previous.content.enabled ? Date.now() : previous.activatedAt;
       if(maintenance.preserveDraft && current.draft) next.draft=current.draft;
       if(maintenance.activatedAtFloor !== undefined)
         next.activatedAt=Math.max(next.activatedAt ?? 0,maintenance.activatedAtFloor);
    }
    if(body.mode==="draft") {
      next.activatedAt=current.activatedAt;
      next.publishedRevision=current.publishedRevision ?? (current.published&&!current.draft?current.revision:undefined);
    }
    await tx.insert(settings).values({ id, data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(user, `template_${body.mode}`, "notification_templates", { id, clinicId: body.clinicId }, tx);
  });
   return templateCatalog(user, body.clinicId, body.recipient,body.channel,conn);
}

/** Activation edits only published content; unpublished wording stays a draft. */
export async function changeActivation(user:any, input:{channel:Channel;event:TemplateEvent;recipient:TemplateRecipient;clinicId?:string;revision:number;enabled:boolean},conn:any=db) {
  assert((templateEvents as readonly string[]).includes(input.event),400,"Unsupported notification event");
  assert(["patient","clinicAdmin","doctor","receptionist","superAdmin"].includes(input.recipient),400,"Unsupported recipient");
   if(requiredEvent(input.event)) {
     assert(user.role==="superAdmin",403,"Superadmin access required");
     assert(!input.clinicId,400,"Security messages are managed at System Default");
   }
  assert(validTemplateTarget(input.event,input.recipient,input.channel),400,"Invalid event, recipient or channel");
  assert(user.role==="superAdmin" || user.role==="clinicAdmin" && !!input.clinicId && input.recipient!=="superAdmin",403,"Activation requires System Admin access or an owned clinic and clinic recipient");
  await conn.transaction(async (tx:any)=>{
    await authorizedTemplateScope(user,input.clinicId,tx);
    const id=key(input.event,input.clinicId,input.recipient,input.channel);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id},0))`);
    const effective=await resolvedTemplate(input.event,input.clinicId,tx,input.recipient,input.channel);
    assert(effective.local.revision===input.revision,409,"Template changed. Refresh before changing activation.");
    if(input.channel==="sms"&&input.enabled) {
       assert(!isSecurityEvent(input.event)||effective.wordingPublished,400,"Publish approved security SMS wording before activation");
      let cfg:ReturnType<typeof notificationSmsConfig>|undefined;
      try {cfg=notificationSmsConfig((await resolvedIntegration("notificationSms",tx)).env);} catch {assert(false,400,"Configure notification SMS before activation");}
      const content=effective.content as SmsTemplateContent;
      assert(smsMetadataReady(cfg!,content),400,cfg!.provider==="keepInTouch"
        ? "Publish a valid DLT Template ID for this event and configure a valid Sender ID before enabling SMS. Use Edit to publish the template; saved drafts do not count. Keep in Touch does not require an Entity ID."
        : "Publish this event's DLT Template ID and configure Sender and DLT Entity IDs before enabling SMS. Use Edit to publish the template; saved drafts do not count.");
    }
    const data={...effective.local,...(requiredEvent(input.event)?{activationEnabled:input.enabled}:{}),activationOnly:!effective.wordingPublished,revision:effective.local.revision+1,publishedRevision:effective.local.revision+1,published:{...effective.content,enabled:input.enabled},
      activatedAt:input.enabled&&!effective.content.enabled?Date.now():effective.local.activatedAt};
    await tx.insert(settings).values({id,data}).onConflictDoUpdate({target:settings.id,set:{data}});
    await audit(user,"template_activation","notification_templates",{id,clinicId:input.clinicId},tx);
  });
}