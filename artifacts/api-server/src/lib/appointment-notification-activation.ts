import { createHash, randomUUID } from "node:crypto";
import { db, settings, clinics, users, integrationCredentials, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { flatten, getSettings } from "./store";
import { resolvedTemplate, notificationTemplateKey } from "./notification-template-store";
import { templateEvents, templateRecipients, validTemplateTarget, requiredEvent, type SmsTemplateContent } from "./notification-templates";
import { resolvedIntegration, encryptIntegration, integrationFields } from "./integration-vault";
import { integrationReadiness, emailNotificationsEnabled } from "./integration-config";
import { notificationSmsConfig, notificationSmsReadiness, smsMetadataReady } from "./notification-sms-transport";
import { lockNotificationPreferences } from "./notification-preferences";
import { recordNotification, notificationEntry } from "./notification-history";
import { appointmentActivationId, appointmentNotificationTarget, appointmentNotificationEvents, appointmentNotificationRecipients } from "./appointment-notification-scope";

async function configuration(conn: any) {
  const rows = await conn.select().from(settings).where(sql`${settings.id} = 'platform'
    or ${settings.id} = ${appointmentActivationId} or ${settings.id} like 'notification-template:%'
    or ${settings.id} like 'sms-template:%' or ${settings.id} like 'notification-policy-revision:%'`);
  const scopes = (await conn.select().from(clinics)).map(flatten).sort((a: any, b: any) => a.id.localeCompare(b.id));
  const providers = await conn.select().from(integrationCredentials);
  const smtp = await resolvedIntegration("smtp", conn), sms = await resolvedIntegration("notificationSms", conn);
  // Hash the opaque stored configuration, never return its contents or credentials.
  const revision = createHash("sha256").update(JSON.stringify({
    rows: rows.sort((a: any, b: any) => a.id.localeCompare(b.id)), scopes,
    providers: providers.sort((a: any, b: any) => a.provider.localeCompare(b.provider)),
    environmentFingerprint: createHash("sha256").update(JSON.stringify(
      [integrationFields.smtp.map(k => smtp.env[k]), integrationFields.notificationSms.map(k => sms.env[k])]
    )).digest("hex"),
    readiness: [integrationReadiness(smtp.env).smtp.ready, emailNotificationsEnabled(smtp.env),
      notificationSmsReadiness(sms.env).ready, notificationSmsReadiness(sms.env).notificationsEnabled],
  })).digest("hex");
  return { rows, scopes, smtp, sms, revision };
}

/** Redacted policy readiness, not a promise of contact eligibility or delivery. */
export async function appointmentActivationInventory(conn: any = db) {
  const cfg = await configuration(conn);
  const scopes = [];
  let smsConfig: ReturnType<typeof notificationSmsConfig> | undefined;
  try { smsConfig = notificationSmsConfig(cfg.sms.env); } catch { /* reported below */ }
  for (const [index, clinic] of [null, ...cfg.scopes].entries()) {
    const clinicId = clinic?.id;
    const gate = !!(await getSettings(conn, clinicId)).notificationsEnabled;
    const items = [];
    for (const channel of ["email", "sms"] as const) for (const event of appointmentNotificationEvents)
      for (const recipient of appointmentNotificationRecipients) {
        const t = await resolvedTemplate(event, clinicId, conn, recipient, channel);
        const reasons = [];
        if (!gate) reasons.push("Notification gate off");
        if (!t.content.enabled) reasons.push("Published activation off");
        if (channel === "email") {
          if (!integrationReadiness(cfg.smtp.env).smtp.ready) reasons.push("SMTP configuration missing or invalid");
          if (!emailNotificationsEnabled(cfg.smtp.env)) reasons.push("Optional Email channel switch off");
        } else {
          if (!smsConfig) reasons.push("SMS provider configuration missing or invalid");
          if (!notificationSmsReadiness(cfg.sms.env).notificationsEnabled) reasons.push("Optional SMS channel switch off");
          if (smsConfig && !smsMetadataReady(smsConfig, t.content as SmsTemplateContent))
            reasons.push(smsConfig.provider === "keepInTouch" ? "Event-specific DLT Template ID or template Sender override missing/invalid; shared provider configuration is present (no Entity ID)"
              : "Event DLT Template ID, Sender ID or DLT Entity ID missing for configured mapping");
        }
        items.push({ channel, event, recipient, enabled: t.content.enabled, source: t.source,
          status: reasons.length ? "blocked" : "enabled-ready", reasons });
      }
    scopes.push({ scope: index === 0 ? "platform" : `clinic-${index}`, notificationsEnabled: gate, items });
  }
  const receipt = cfg.rows.find((r: any) => r.id === appointmentActivationId)?.data;
  return { revision: cfg.revision, applied: !!receipt, cutoff: receipt?.cutoff ?? null, scopes,
    eligibility: "At each event: active patient/owner/assigned doctor, valid contact, personal opt-in and unique destination required. Development automatic delivery remains suppressed. Ready means configuration only; no provider acceptance or delivery verified." };
}

/** One atomic, explicit operation. Receipt makes reruns non-mutating, even after later opt-outs. */
export async function applyAppointmentActivation(expectedRevision: string, conn: any = db) {
  return conn.transaction(async (tx: any) => {
    await lockNotificationPreferences(tx);
    // Include legacy full-row policy/template/provider writers, not only new UI writers.
    await tx.execute(sql`lock table settings, clinics, integration_credentials in share row exclusive mode`);
    const cfg = await configuration(tx);
    const existing = cfg.rows.find((r: any) => r.id === appointmentActivationId);
    if (existing) return { alreadyApplied: true, cutoff: existing.data.cutoff };
    assert(expectedRevision === cfg.revision, 409, "Activation configuration changed. Inspect again before applying.");
    const [actor] = await tx.select().from(users).where(sql`${users.role} = 'superAdmin' and ${users.status} = 'active'`).limit(1);
    assert(actor, 409, "An active Superadmin is required for the activation audit");
    const cutoff = Date.now();
    let smsConfig: ReturnType<typeof notificationSmsConfig> | undefined;
    try { smsConfig = notificationSmsConfig(cfg.sms.env); } catch { /* leave guarded rows unchanged */ }
    const before = [];
    // Capture every optional non-target before opening a shared gate or channel.
    for (const clinic of [null, ...cfg.scopes]) {
      const id = clinic?.id;
      const platform = cfg.rows.find((r: any) => r.id === "platform")?.data || {};
      const oldGate = clinic?.policies?.notificationsEnabled ?? platform.notificationsEnabled ?? false;
      for (const channel of ["email", "sms"] as const) for (const event of templateEvents)
        for (const recipient of templateRecipients) {
          if (requiredEvent(event) || !validTemplateTarget(event, recipient, channel)) continue;
          const t = await resolvedTemplate(event, id, tx, recipient, channel);
          const channelOn = channel === "email" ? emailNotificationsEnabled(cfg.smtp.env) : notificationSmsReadiness(cfg.sms.env).notificationsEnabled;
          before.push({ id, channel, event, recipient, template: t,
            permitted: !!oldGate && channelOn && t.content.enabled });
        }
    }
    let changedTemplates = 0, blockedSms = 0;
    // Platform precedes clinics, so unnecessary local publications are not created.
    for (const row of before) {
      const target = appointmentNotificationTarget(row.event, row.recipient);
      const current = await resolvedTemplate(row.event, row.id, tx, row.recipient, row.channel);
      if (!target && current.content.enabled === row.permitted) continue;
      if (target && row.channel === "sms" && (!smsConfig || !smsMetadataReady(smsConfig, current.content as SmsTemplateContent))) {
        blockedSms++; continue;
      }
      const enabled = target || row.permitted;
      if (current.content.enabled === enabled) continue;
      const revision = current.local.revision + 1;
      const data = { ...current.local, revision, publishedRevision: revision,
        published: { ...current.content, enabled }, activatedAt: enabled && target ? cutoff : row.template.activatedAt };
      await tx.insert(settings).values({ id: notificationTemplateKey(row.event, row.id, row.recipient, row.channel), data })
        .onConflictDoUpdate({ target: settings.id, set: { data } });
      changedTemplates++;
    }
    // Merge only the requested gate; preserve other platform/clinic policy fields.
    await tx.insert(settings).values({ id: "platform", data: {} }).onConflictDoNothing();
    await tx.execute(sql`update settings set data = data || '{"notificationsEnabled":true}'::jsonb where id = 'platform'`);
    for (const clinic of cfg.scopes) {
      if (clinic.policies?.notificationsEnabled === false)
        await tx.execute(sql`update clinics set data = jsonb_set(data, '{policies}', coalesce(data->'policies','{}'::jsonb) || '{"notificationsEnabled":true}'::jsonb) where id = ${clinic.id}`);
    }
    // Change only an existing configured optional switch, never provider credentials.
    let changedChannels = 0;
    for (const [provider, resolved, flag, ready] of [
      ["smtp", cfg.smtp, "SMTP_NOTIFICATIONS_ENABLED", integrationReadiness(cfg.smtp.env).smtp.ready],
      ["notificationSms", cfg.sms, "NOTIFICATION_SMS_ENABLED", !!smsConfig],
    ] as const) {
      if (!ready || resolved.env[flag] !== "false") continue;
      const values: Record<string, string> = {};
      for (const name of integrationFields[provider]) if (resolved.env[name] !== undefined) values[name] = resolved.env[name]!;
      values[flag] = "true";
      await tx.insert(integrationCredentials).values({ provider, encrypted: encryptIntegration(provider, values), revision: randomUUID() })
        .onConflictDoUpdate({ target: integrationCredentials.provider,
          set: { encrypted: encryptIntegration(provider, values), revision: randomUUID() } });
      changedChannels++;
    }
    const receipt = { cutoff, changedTemplates, changedChannels, clinicCount: cfg.scopes.length, blockedSms };
    await tx.insert(settings).values({ id: appointmentActivationId, data: receipt });
    // Terminally close stale pending target work. Sending/unknown/terminal jobs are never changed.
    const pending = await tx.select().from(settings).where(sql`(${settings.id} like 'mail-outbox:%' or ${settings.id} like 'sms-outbox:%') and ${settings.data}->>'state' = 'pending'`);
    for (const job of pending) if (appointmentNotificationTarget(job.data.event, job.data.recipientGroup)) {
      await tx.update(settings).set({ data: { ...job.data, state: "disabled", finishedAt: cutoff } }).where(eq(settings.id, job.id));
      await recordNotification(tx, job.data.historyKey || job.id, notificationEntry(job.data, job.id.startsWith("sms-") ? "sms" : "email"), "disabled");
    }
    await tx.insert(auditLogs).values({ id: randomUUID(), actorId: actor.id, action: "appointment_notification_activation",
      entityType: "notification_policy", entityId: appointmentActivationId,
      summary: `Prospective appointment activation; cutoff=${cutoff}; clinics=${cfg.scopes.length}; templates=${changedTemplates}; channels=${changedChannels}; blockedSMS=${blockedSms}` });
    return { alreadyApplied: false, ...receipt };
  });
}
