import { randomUUID } from "node:crypto";
import { db, settings, users, auditLogs, integrationCredentials } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { approvedAppointmentSms } from "./approved-appointment-sms";
import { appointmentNotificationEvents, appointmentNotificationRecipients } from "./appointment-notification-scope";
import { appointmentActivationInventory, applyAppointmentActivation } from "./appointment-notification-activation";
import { notificationTemplateKey, resolvedTemplate, saveTemplate } from "./notification-template-store";
import { resolvedIntegration } from "./integration-vault";
import { notificationSmsConfig, notificationSmsReadiness } from "./notification-sms-transport";
import { integrationReadiness, emailNotificationsEnabled } from "./integration-config";
import { lockNotificationPreferences } from "./notification-preferences";
import type { SmsTemplateContent } from "./notification-templates";

export const appointmentRegistrationReceipt = "appointment-template-registration";

/** Explicit development maintenance only; never imported by startup or dispatch. */
export async function registerAppointmentTemplates(expectedRevision: string, conn:any=db) {
  assert(process.env.NODE_ENV === "development",403,"Template registration is restricted to workspace development");
  return conn.transaction(async (tx:any) => {
    await lockNotificationPreferences(tx);
    await tx.execute(sql`lock table settings, clinics, integration_credentials in share row exclusive mode`);
    const [receipt] = await tx.select().from(settings).where(eq(settings.id,appointmentRegistrationReceipt));
    if(receipt) return {alreadyApplied:true,...receipt.data};
    const before=await appointmentActivationInventory(tx);
    assert(before.revision===expectedRevision,409,"Notification configuration changed. Inspect again before registering.");
    const [actor]=await tx.select().from(users).where(sql`${users.role} = 'superAdmin' and ${users.status} = 'active'`).limit(1);
    assert(actor,409,"An active Superadmin is required for template registration");
    const smsEnv=(await resolvedIntegration("notificationSms",tx)).env;
    const smtpEnv=(await resolvedIntegration("smtp",tx)).env;
    assert(notificationSmsConfig(smsEnv).provider==="keepInTouch",409,"Existing shared Keep in Touch configuration is required");
    assert(notificationSmsReadiness(smsEnv).notificationsEnabled,409,"Enable the shared SMS channel before registration; provider settings will not be changed");
    assert(integrationReadiness(smtpEnv).smtp.ready && emailNotificationsEnabled(smtpEnv),409,
      "Existing enabled Email configuration is required; provider settings will not be changed");
    const providerRows=await tx.select().from(integrationCredentials).orderBy(integrationCredentials.provider);
    // Reuse the receipt-protected prospective activation and its stale-job barrier.
    await applyAppointmentActivation(before.revision,tx);
    const cutoff=Date.now();
    let emailCreated=0,smsCreated=0,smsAligned=0,smsDisabled=0;
    for(const event of appointmentNotificationEvents) for(const recipient of appointmentNotificationRecipients) {
      const email=await resolvedTemplate(event,undefined,tx,recipient,"email");
      if(!email.local.published) {
        await saveTemplate(actor,{channel:"email",event,recipient,revision:email.local.revision,
          mode:"publish",content:email.content},tx,{preserveDraft:true,activatedAtFloor:cutoff});
        emailCreated++;
      }
      const sms=await resolvedTemplate(event,undefined,tx,recipient,"sms");
      const registration=approvedAppointmentSms.find(r=>r.event===event && r.recipients.includes(recipient));
      const content=sms.content as SmsTemplateContent;
      if(registration) {
        assert(!content.dltTemplateId || content.dltTemplateId===registration.dltTemplateId,409,
          `Saved ${event}/${recipient} registration conflicts with the supplied source; no templates were changed`);
        if(!sms.local.published || content.body!==registration.body || content.dltTemplateId!==registration.dltTemplateId) {
          await saveTemplate(actor,{channel:"sms",event,recipient,revision:sms.local.revision,mode:"publish",
            content:{...content,body:registration.body,dltTemplateId:registration.dltTemplateId}},tx,
          {preserveDraft:true,activatedAtFloor:cutoff});
          if(sms.local.published) smsAligned++; else smsCreated++;
        }
      } else if(!sms.local.published || content.enabled) {
        // Explicit off records override the broad built-in enabled defaults.
        await saveTemplate(actor,{channel:"sms",event,recipient,revision:sms.local.revision,mode:"publish",
          content:{...content,enabled:false}},tx,{preserveDraft:true});
        smsDisabled++;
      }
    }
    // Fail atomically if the old activation would have changed a provider switch.
    assert(JSON.stringify(providerRows)===JSON.stringify(await tx.select().from(integrationCredentials).orderBy(integrationCredentials.provider)),
      409,"Provider configuration would change; registration was rolled back");
    const result={cutoff,emailCreated,smsCreated,smsAligned,smsDisabled,supportedSms:11,unsupportedSms:4};
    await tx.insert(settings).values({id:appointmentRegistrationReceipt,data:result});
    await tx.insert(auditLogs).values({id:randomUUID(),actorId:actor.id,action:"appointment_template_registration",
      entityType:"notification_templates",entityId:appointmentRegistrationReceipt,
      summary:`Development registration; emailCreated=${emailCreated}; smsCreated=${smsCreated}; smsAligned=${smsAligned}; unsupportedOff=4`});
    return {alreadyApplied:false,...result};
  });
}
