import { createHash, randomUUID } from "node:crypto";
import { db, settings, auditLogs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { resolvedIntegration } from "./integration-vault";
import { smtpFields } from "./integration-config";

// Never return this digest or any credential material to the browser.
export function smtpTestFingerprint(env: NodeJS.ProcessEnv) {
  return createHash("sha256").update(JSON.stringify(smtpFields.map(key => [key, env[key] ?? null]))).digest("hex");
}

export async function latestSmtpTestReceipt(actor: string, conn: any = db) {
  const prefix = `notification-test:${actor}:`;
  const [row] = await conn.select().from(settings).where(sql`
    left(${settings.id}, ${prefix.length}) = ${prefix}
    and ${settings.data}->>'receiptKind' = 'smtp_provider_test'
  `).orderBy(sql`(${settings.data}->>'createdAt')::bigint desc`, settings.id).limit(1);
  if (!row) return { test: null };
  let currentConfiguration = false;
  try {
    currentConfiguration = row.data.smtpFingerprint === smtpTestFingerprint((await resolvedIntegration("smtp", conn)).env);
  } catch { /* An unreadable configuration cannot establish a current receipt. */ }
  return { test: {
    requestId: row.id.slice(prefix.length),
    sentAt: new Date(row.data.createdAt).toISOString(),
    status: row.data.finishedAt ? row.data.status : "sending",
    currentConfiguration,
    receivedAt: row.data.receivedAt ?? null,
  } };
}

export async function confirmSmtpReceipt(actor: string, requestId: string, conn: any = db) {
  const id = `notification-test:${actor}:${requestId}`;
  await conn.transaction(async (tx: any) => {
    const [row] = await tx.select().from(settings).where(eq(settings.id, id)).for("update");
    assert(row?.data.receiptKind === "smtp_provider_test", 409, "This SMTP test is not available for confirmation.");
    assert(row.data.finishedAt && ["provider_accepted", "delivery_unknown"].includes(row.data.status),
      409, "Only a completed, dispatched test can be confirmed.");
    const fingerprint = smtpTestFingerprint((await resolvedIntegration("smtp", tx)).env);
    assert(row.data.smtpFingerprint === fingerprint, 409, "Saved SMTP settings changed. This receipt belongs to an earlier configuration.");
    if (row.data.receivedAt) return;
    const receivedAt = new Date().toISOString();
    await tx.update(settings).set({ data: { ...row.data, receivedAt } }).where(eq(settings.id, id));
    await tx.insert(auditLogs).values({
      id: randomUUID(), actorId: actor, action: "smtp_test_receipt",
      entityType: "integration", entityId: "smtp",
      summary: "Superadmin manually confirmed receipt of an SMTP test email; not automatic delivery verification.",
    });
  });
  return latestSmtpTestReceipt(actor, conn);
}
