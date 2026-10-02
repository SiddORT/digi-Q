import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, integrationCredentials, auditLogs } from "@workspace/db";
import { HttpError } from "./http";
import { integrationReadiness } from "./integration-config";

export type Provider = "smtp" | "sms";
export const integrationFields = {
  smtp: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SECURE", "SMTP_REQUIRE_TLS"],
  sms: ["OTP_PROVIDER", "TWILIO_ACCOUNT_SID", "TWILIO_MESSAGING_SERVICE_SID", "TWILIO_AUTH_TOKEN"],
} as const;

function masterKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    throw new HttpError(503, "Configure the server integration encryption key before editing credentials.", "INTEGRATION_KEY_REQUIRED");
  return Buffer.from(raw, "hex");
}
export function vaultConfigured() {
  try { masterKey(); return true; } catch { return false; }
}
export function encryptIntegration(provider: Provider, values: Record<string, string>) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), nonce);
  cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
  const data = Buffer.concat([cipher.update(JSON.stringify(values), "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decryptIntegration(provider: Provider, encrypted: string): Record<string, string> {
  try {
    const [version, nonce, tag, data, extra] = encrypted.split(".");
    if (version !== "v1" || extra !== undefined) throw new Error("Format");
    const cipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(nonce, "base64"));
    cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8"));
  } catch {
    throw new HttpError(503, "Stored integration configuration cannot be decrypted. Restore the correct server encryption key.", "INTEGRATION_DECRYPT_FAILED");
  }
}
export async function resolvedIntegration(provider: Provider, conn: Pick<typeof db, "select"> = db) {
  const [row] = await conn.select().from(integrationCredentials).where(eq(integrationCredentials.provider, provider));
  // No fallback when a saved record is unreadable: fail closed.
  return {
    env: row ? { NODE_ENV: process.env.NODE_ENV, ...decryptIntegration(provider, row.encrypted) } : process.env,
    source: row ? "database" as const : "environment" as const,
    revision: row?.revision ?? null,
  };
}
export async function integrationSettings() {
  const [smtp, sms] = await Promise.all([resolvedIntegration("smtp"), resolvedIntegration("sms")]);
  return {
    editable: vaultConfigured(),
    smtp: { ...integrationReadiness(smtp.env).smtp, source: smtp.source, revision: smtp.revision },
    sms: { ...integrationReadiness(sms.env).sms, source: sms.source, revision: sms.revision },
  };
}
export async function saveIntegration(provider: Provider, values: Record<string, string>, revision: string | null, mode: "database" | "environment", actor: string) {
  masterKey();
  await db.transaction(async tx => {
    // Serializes both first save and later replacements across all server instances.
    const { sql } = await import("drizzle-orm");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`digiq:integration:${provider}`}))`);
    const [current] = await tx.select().from(integrationCredentials).where(eq(integrationCredentials.provider, provider));
    if ((current?.revision ?? null) !== revision)
      throw new HttpError(409, "Configuration changed in another session. Refresh before saving.", "INTEGRATION_CONFLICT");
    if (mode === "environment") {
      await tx.delete(integrationCredentials).where(eq(integrationCredentials.provider, provider));
    } else {
      const previous = current ? decryptIntegration(provider, current.encrypted) : process.env;
      const merged: Record<string, string> = {};
      for (const name of integrationFields[provider]) {
        const value = values[name] ?? previous[name];
        if (value !== undefined) merged[name] = value;
      }
      if (provider === "sms") merged.OTP_PROVIDER = "twilio";
      if (!integrationReadiness(merged)[provider].ready)
        throw new HttpError(400, "Complete all required fields with valid values before saving.", "INTEGRATION_INVALID");
      await tx.insert(integrationCredentials).values({ provider, encrypted: encryptIntegration(provider, merged), revision: randomUUID() })
        .onConflictDoUpdate({ target: integrationCredentials.provider, set: { encrypted: encryptIntegration(provider, merged), revision: randomUUID() } });
    }
    await tx.insert(auditLogs).values({
      id: randomUUID(), actorId: actor, action: "configure", entityType: "integration", entityId: provider,
      summary: `${provider} configuration changed; source=${mode}; fields=${Object.keys(values).sort().join(",") || "none"}`,
    });
  });
}