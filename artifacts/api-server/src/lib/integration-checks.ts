import nodemailer from "nodemailer";
import { access, constants } from "node:fs/promises";
import { resolvedIntegration } from "./integration-vault";
import { integrationReadiness, smtpConfig } from "./integration-config";
import { mediaConfig } from "./local-media";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";

export async function checkIntegration(provider: "smtp" | "sms" | "storage") {
  const checks: { name: string; status: "passed" | "failed" | "not_verified"; message: string }[] = [];
  let source = "environment";
  try {
    if (provider === "smtp") {
      const resolved = await resolvedIntegration("smtp"); source = resolved.source;
      const cfg = smtpConfig(resolved.env);
      const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure, auth: { user: cfg.user, pass: cfg.password }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
      try { await transport.verify(); } finally { transport.close(); }
      checks.push({ name: "Connection and authentication", status: "passed", message: "SMTP connection, TLS and authentication succeeded. No message was sent." });
      checks.push({ name: "Sender permission and inbox delivery", status: "not_verified", message: "SMTP verification cannot prove sender authorization or inbox delivery. Use the separately confirmed test email." });
    } else if (provider === "sms") {
      const resolved = await resolvedIntegration("sms"); source = resolved.source;
      if (!integrationReadiness(resolved.env).sms.ready) throw Error("Incomplete");
      const env = resolved.env;
      const headers = { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}` };
      const account = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, { headers, signal: AbortSignal.timeout(12000) });
      if (!account.ok || (await account.json() as any).status !== "active") throw Error("Account unavailable");
      const service = await fetch(`https://messaging.twilio.com/v1/Services/${env.TWILIO_MESSAGING_SERVICE_SID}`, { headers, signal: AbortSignal.timeout(12000) });
      if (!service.ok || (await service.json() as any).account_sid !== env.TWILIO_ACCOUNT_SID) throw Error("Service unavailable");
      checks.push({ name: "Account and messaging service access", status: "passed", message: "Credentials can read the active account and configured Messaging Service. No SMS was sent." });
      checks.push({ name: "SMS delivery permission", status: "not_verified", message: "Sender registration, destination restrictions, credit and delivery are not proven by read-only checks." });
    } else {
      const config = mediaConfig();
      if (config.driver === "local") {
        await access(config.root, constants.R_OK | constants.W_OK);
        checks.push({ name: "Folder access", status: "passed", message: "The configured folder is readable and writable by the service account. No file was created." });
      } else {
        const path = new ObjectStorageService().getPrivateObjectDir().replace(/^\/+/, "");
        // Bucket-metadata access is a different permission from object read/write.
        // Probe only the permissions the application's upload/download flow needs.
        const [permissions] = await objectStorageClient.bucket(path.split("/")[0]).iam.testPermissions(["storage.objects.get", "storage.objects.create"]);
        for (const [permission, name] of [["storage.objects.get", "Read objects"], ["storage.objects.create", "Create objects"]]) {
          const allowed = permissions[permission];
          checks.push({ name, status: allowed ? "passed" : "failed", message: allowed ? "The provider reports this permission for the configured bucket. No object was read or uploaded." : "The provider did not grant this permission for the configured bucket. Check the application's bucket access." });
        }
      }
      checks.push({ name: "Durability and end-to-end upload", status: "not_verified", message: "This check cannot prove disk persistence, every object permission or successful browser uploads." });
    }
  } catch (error: any) {
    const code = error?.code;
    const reason = code === 401 || code === "EAUTH" ? "Authentication was rejected."
      : code === 403 ? "Access to the checked resource was denied."
      : code === 404 ? "The configured resource was not found."
      : ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET"].includes(code) ? "The provider could not be reached."
      : code === "INTEGRATION_KEY_REQUIRED" || code === "INTEGRATION_DECRYPT_FAILED" ? "The server encryption key is unavailable or cannot decrypt the saved settings."
      : "The configuration or provider access could not be verified.";
    checks.push({ name: provider === "storage" ? "Storage permission check" : "Connection/access check", status: "failed", message: `${reason} Check configuration and provider permissions. Raw provider diagnostics are not exposed because they may contain secrets.${provider === "storage" ? " A failed permission probe alone does not establish whether individual object uploads or downloads work." : ""}` });
  }
  return { provider, source, checkedAt: new Date().toISOString(), checks };
}