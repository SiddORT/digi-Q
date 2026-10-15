import { db, settings, users, clinics, doctors, patients } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert, HttpError } from "./http";
import { flatten, getSettings } from "./store";
import { templateEvents, validTemplateTarget, type TemplateRecipient } from "./notification-templates";
import { requiredEvent } from "./security-template-definitions";
import { resolvedTemplate } from "./notification-template-store";
import { resolvedIntegration } from "./integration-vault";
import { smtpConfig, validEmailAddress, emailNotificationsEnabled } from "./integration-config";
import { notificationSmsReadiness, notificationSmsEnabled, notificationSmsConfig, smsMetadataReady } from "./notification-sms-transport";
import { notificationPhone } from "./notification-sms-outbox";
import { personalPreferences, preferenceKey, lockNotificationPreferences, writePersonalPreferences, pendingPreferenceAllowed } from "./notification-preferences";
import { recordNotification, notificationEntry, historyId } from "./notification-history";
import { DEMO_FIXTURE } from "./demo-policy";
import { enforcePermissionPolicy } from "./permission-policy";

async function personalContext(user: any, conn: any) {
  const [raw] = await conn.select().from(users).where(eq(users.id, user.id));
  assert(raw, 401, "Account unavailable");
  const account = flatten(raw);
  const patientProfiles = account.role === "patient" ? await conn.select().from(patients).where(eq(patients.userId, user.id)) : [];
  const groups = new Set<TemplateRecipient>([account.role]);
  if ((await conn.select({ id: doctors.id }).from(doctors).where(eq(doctors.userId, user.id))).length) groups.add("doctor");
  // Patients receive their own visits, not the entire clinic directory.
  const scope = account.role === "patient"
    ? await conn.select({ id: clinics.id, data: clinics.data }).from(clinics)
      .where(sql`${clinics.id} in (select clinic_id from appointments where patient_id in (select id from patients where user_id = ${user.id}))
        or ${clinics.id} in (select clinic_id from patients where user_id = ${user.id})`)
    : account.role === "superAdmin" ? await conn.select({ id: clinics.id, data: clinics.data }).from(clinics)
    : await conn.select({ id: clinics.id, data: clinics.data }).from(clinics)
      .where(sql`${clinics.adminId} = ${user.id} or ${clinics.id} in (select clinic_id from assignments where user_id = ${user.id})`);
  const owned = account.role === "clinicAdmin"
    ? await conn.select().from(clinics).where(eq(clinics.adminId, user.id)) : [];
  return { account, groups, scope, owned, patientProfiles };
}
export async function personalNotificationSettings(user: any, conn: any = db) {
  const { account, groups, scope, owned, patientProfiles } = await personalContext(user, conn);
  const prefs = await personalPreferences(user.id, conn);
  const items: any[] = [];
  const emailEnv = (await resolvedIntegration("smtp", conn)).env;
  const smsEnv = (await resolvedIntegration("notificationSms", conn)).env;
  let emailReady = true; try { smtpConfig(emailEnv); } catch { emailReady = false; }
  let smsConfig: ReturnType<typeof notificationSmsConfig> | undefined;
  try { smsConfig = notificationSmsConfig(smsEnv); } catch { /* sanitized reason below */ }
  for (const channel of ["email", "sms"] as const) for (const event of templateEvents) {
    if (![...groups].some(group => validTemplateTarget(event, group, channel))) continue;
    const mandatory = requiredEvent(event);
    const key = preferenceKey(channel, event), saved = prefs.choices[key] ?? null, selected = mandatory || saved !== false;
    const reasons: string[] = [];
    if (!mandatory) {
      if (account.status !== "active") reasons.push("Your account is inactive");
      const contacts = patientProfiles.length ? patientProfiles.map((p:any) => ({
        email: account.email || p.data?.email, mobile: account.mobile || p.mobile,
      })) : [account];
      if (!contacts.some((contact:any) => channel === "email" ? validEmailAddress(contact.email) : notificationPhone(contact.mobile)))
        reasons.push(`No eligible ${channel === "email" ? "email address" : "mobile number"} on your account or linked patient profile`);
      if (channel === "email" ? !emailNotificationsEnabled(emailEnv) : !notificationSmsEnabled(smsEnv)) reasons.push(`${channel === "email" ? "Email" : "SMS"} provider notifications are disabled`);
      if (channel === "email" ? !emailReady : !notificationSmsReadiness(smsEnv).ready) reasons.push(`${channel === "email" ? "Email" : "SMS"} provider is not ready`);
      const scopes = scope.length ? scope : [{ id: undefined, data: { name: "Platform defaults" } }];
      let eligible = false;
      const scopeReasons: string[] = [];
      for (const clinic of scopes) {
        const name = String(clinic.data?.name || "Clinic");
        const gate = (await getSettings(conn, clinic.id)).notificationsEnabled;
        const targetReasons: string[] = [];
        if (!gate) targetReasons.push("notification gate is off");
        let published = false, metadata = false;
        for (const group of groups) {
          if (!validTemplateTarget(event, group, channel)) continue;
          const template = await resolvedTemplate(event, clinic.id, conn, group, channel);
          if (template.content.enabled) {
            published = true;
            if (channel === "email" || smsConfig && smsMetadataReady(smsConfig, template.content as any)) metadata = true;
          }
        }
        if (!published) targetReasons.push("published event activation is off");
        if (published && !metadata) targetReasons.push("published SMS sender/template metadata is not ready");
        if (!clinic.id && account.role !== "superAdmin") targetReasons.push("no current clinic recipient context; membership is checked on each event");
        if (!targetReasons.length) eligible = true;
        else scopeReasons.push(`${name}: ${targetReasons.join("; ")}`);
      }
      // Per-clinic reasons remain visible even when another clinic is eligible.
      if (!eligible) reasons.push(...scopeReasons);
      else if (scopeReasons.length) reasons.push(`Other clinics remain restricted: ${scopeReasons.join(" | ")}`);
      const blocked = !eligible || reasons.some(r => !r.startsWith("Other clinics remain restricted:"));
      items.push({ key, event, channel, saved, inherited: saved === null, selected, state: !selected ? "Off" : blocked ? "On but blocked" : "On", reasons });
    } else items.push({ key, event, channel, saved: null, inherited: true, selected: true, state: "Required", reasons: ["Account-security messages cannot be disabled. Optional delivery and inbox choices do not apply."] });
  }
  let inboxAvailable = true;
  try { await enforcePermissionPolicy({ ...user, role: account.role }, { method: "GET", path: "/notifications" }); }
  catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    inboxAvailable = false;
  }
  for (const category of ["appointments", "queue", ...(["superAdmin", "clinicAdmin"].includes(account.role) ? ["system"] : [])]) {
    const key = preferenceKey("inApp", category), saved = prefs.choices[key] ?? null;
    items.push({ key, event: category, channel: "inApp", saved, inherited: saved === null, selected: saved !== false,
      state: !inboxAvailable ? "Unavailable" : saved === false ? "Off" : "On",
      reasons: [inboxAvailable ? "Only records you are authorized to see appear. Hiding a category preserves history and read markers." : "Inbox access is disabled by your administrator. Preferences cannot grant access."] });
  }
  const canManage = ["superAdmin", "clinicAdmin"].includes(account.role) && !user.demo && user.demoFixture !== DEMO_FIXTURE;
  return { revision: prefs.revision, items, canManage, clinics: canManage ? owned.map((c:any) => ({ id: c.id, name: String(c.data?.name || "Clinic") })) : [],
    activeClinicId: owned.some((c:any) => c.id === user.activeClinicId) ? user.activeClinicId : null };
}
export async function savePersonalNotificationSettings(user: any, input: { revision: number; choices: { key: string; enabled: boolean | null }[] }, conn: any = db) {
  await conn.transaction(async (tx: any) => {
    await lockNotificationPreferences(tx);
    const supported = await personalNotificationSettings(user, tx);
    const allowed = new Set(supported.items.filter(r => r.state !== "Required" && r.state !== "Unavailable").map(r => r.key));
    assert(new Set(input.choices.map(c => c.key)).size === input.choices.length, 400, "Duplicate notification choice");
    assert(input.choices.every(c => allowed.has(c.key)), 400, "Unsupported or required notification choice");
    const prefs = await personalPreferences(user.id, tx);
    assert(prefs.revision === input.revision, 409, "Notification choices changed. Reload before saving.");
    const next = { revision: prefs.revision + 1, choices: { ...prefs.choices }, epochs: { ...prefs.epochs } };
    for (const choice of input.choices) {
      if (choice.enabled === null) delete next.choices[choice.key];
      else next.choices[choice.key] = choice.enabled;
      if (choice.enabled === false) next.epochs[choice.key] = (next.epochs[choice.key] || 0) + 1;
    }
    await writePersonalPreferences(tx, user.id, next);
    // Cancel only pending work. Sending/unknown outcomes and durable occurrence claims are untouched.
    const pending = await tx.select().from(settings).where(sql`(${settings.id} like 'mail-outbox:%' or ${settings.id} like 'sms-outbox:%') and ${settings.data}->>'state' = 'pending'`);
    for (const job of pending) {
      const channel = job.id.startsWith("sms-") ? "sms" : "email";
      if (!await pendingPreferenceAllowed(tx, job.data, channel)) {
        await tx.update(settings).set({ data: { ...job.data, state: "disabled", finishedAt: Date.now() } }).where(eq(settings.id, job.id));
        await recordNotification(tx, job.data.historyKey || job.id, notificationEntry(job.data, channel), "disabled");
      }
    }
    // Separate patient booking path has no outbox job. Its durable receipt is
    // invalidated by the epoch; mark the pending history outcome without changing clinical JSON.
    if (input.choices.some(c => c.key === "email:booking" && c.enabled === false)) {
      const receipts = await tx.select().from(settings).where(sql`${settings.id} like 'patient-confirmation-preference:%' and ${settings.data}->>'userId' = ${user.id}`);
      for (const receipt of receipts) {
        const bookingId = receipt.id.slice("patient-confirmation-preference:".length);
        const [history] = await tx.select().from(settings).where(eq(settings.id, historyId(`patient-booking:${bookingId}`)));
        if (history?.data.status === "pending" && !history.data.dispatchAt)
          await recordNotification(tx, `patient-booking:${bookingId}`, { channel: "email", event: "booking", recipientGroup: "patient" }, "disabled");
      }
    }
  });
  return personalNotificationSettings(user, conn);
}
