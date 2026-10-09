import { db, settings, clinics } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { audit, one } from "./store";
import { assert } from "./http";
import { defaultTemplate, eventTitles, renderNotification, templateContent, templateEvents, templateSave, templateVariables, type TemplateContent, type TemplateEvent } from "./notification-templates";
import { defaultRecipient, type TemplateRecipient } from "./notification-templates";

const key = (event: TemplateEvent, clinicId?: string, recipient = defaultRecipient(event)) => `notification-template:${clinicId || "platform"}:${event}${recipient === defaultRecipient(event) ? "" : `:${recipient}`}`;
type RecordData = { revision: number; published?: TemplateContent; draft?: TemplateContent };
async function stored(event: TemplateEvent, clinicId?: string, conn: any = db, recipient = defaultRecipient(event)): Promise<RecordData> {
  const [row] = await conn.select().from(settings).where(eq(settings.id, key(event, clinicId, recipient)));
  return row?.data || { revision: 0 };
}
export async function authorizedTemplateScope(user: any, clinicId?: string, conn: any = db) {
  assert(["superAdmin", "clinicAdmin"].includes(user.role), 403, "Administrator access required");
  assert(!user.demo, 403, "Demo accounts cannot change notification configuration");
  if (!clinicId) { assert(user.role === "superAdmin", 403, "Select a clinic you own"); return null; }
  const clinic = await one(clinics, clinicId, conn);
  assert(user.role === "superAdmin" || clinic.adminId === user.id, 403, "Clinic outside your administration scope");
  return clinic;
}
export async function resolvedTemplate(event: TemplateEvent, clinicId?: string, conn: any = db, recipient = defaultRecipient(event)) {
  const platform = await stored(event, undefined, conn, recipient);
  const local = clinicId ? await stored(event, clinicId, conn, recipient) : platform;
  const content = local.published || platform.published || defaultTemplate(event, recipient);
  // Corrupt configuration fails explicitly, rather than silently sending a different template.
  return { content: templateContent.parse(content), local, source: local.published ? (clinicId ? "clinic" : "platform") : platform.published ? "platform" : "default" };
}
export async function templateCatalog(user: any, clinicId?: string, recipient?: TemplateRecipient) {
  const clinic = await authorizedTemplateScope(user, clinicId);
  const values = { clinic_name: clinic?.name || "Example clinic", clinic_contact: [clinic?.email, clinic?.phone].filter(Boolean).join(" · "),
    patient_name: "[Patient name]", doctor_name: "[Doctor name]", appointment_details: "[Clinic-formatted visit details]", previous_details: "[Previous visit details]", reference: "[Booking reference]", timezone: "[Clinic location timezone]" };
  const items = [];
  for (const event of templateEvents) {
    if (event === "onboarding" && recipient && recipient !== "clinicAdmin") continue;
    const { content, local, source } = await resolvedTemplate(event, clinicId, db, recipient || defaultRecipient(event));
    const preview = renderNotification(local.draft || content, values);
    items.push({ event, recipient: recipient || defaultRecipient(event), title: eventTitles[event], revision: local.revision, source, content, draft: local.draft,
      previewSubject: preview.subject, previewBody: preview.text,
      delivery: event === "booking" ? (recipient === "clinicAdmin" ? "Owning Clinic Admin booking email is enabled by default when clinic notifications are enabled. Explicit published opt-outs remain in effect. Delivery is asynchronous; development never sends automatically." : "Used for eligible patient booking confirmations; notification and delivery settings apply. Provider acceptance does not guarantee inbox delivery.") : event === "reminder" ? "Production worker sends one hour before the session start when clinic notifications are enabled. Not an exact consultation-time promise." : "Queued automatically for this event when clinic notifications are enabled. Production worker delivers; development never sends automatically." });
  }
  return { scopeName: clinic?.name || "Platform defaults", variables: [...templateVariables], items };
}
export async function saveTemplate(user: any, input: unknown) {
  const parsed = templateSave.safeParse(input);
  assert(parsed.success, 400, parsed.success ? "" : parsed.error.issues[0]?.message || "Invalid template");
  const body = parsed.data!;
  assert(body.event !== "onboarding" || !body.recipient || body.recipient === "clinicAdmin", 400, "Clinic onboarding is sent to the Clinic Admin");
  await db.transaction(async tx => {
    await authorizedTemplateScope(user, body.clinicId, tx);
    const id = key(body.event, body.clinicId, body.recipient);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
    const current = await stored(body.event, body.clinicId, tx, body.recipient);
    assert(current.revision === body.revision, 409, "This template changed. Reload it before saving.");
    const next: RecordData = { revision: current.revision + 1 };
    if (body.mode === "draft") Object.assign(next, { published: current.published, draft: body.content });
    if (body.mode === "publish") next.published = body.content;
    await tx.insert(settings).values({ id, data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(user, `template_${body.mode}`, "notification_templates", { id, clinicId: body.clinicId }, tx);
  });
  return templateCatalog(user, body.clinicId, body.recipient);
}