import nodemailer from "nodemailer";
import { HttpError } from "./http";
import { smtpConfig } from "./integration-config";
import { systemEmailTemplate } from "./email-template";
export { smtpConfig } from "./integration-config";
/** Transport can be injected by tests; never expose codes or tokens in response/logs. */
export async function sendAuthEmail(to: string, subject: string, text: string,
  transport?: { sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown> }) {
  const cfg = smtpConfig();
  const client = transport || nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password }, requireTLS: !cfg.secure && cfg.requireTLS,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const result = await client.sendMail({
      from: cfg.from, to, subject, ...systemEmailTemplate(subject, text),
      disableFileAccess: true, disableUrlAccess: true,
    });
    // Legacy injected transports return undefined. SMTP results must not silently
    // report success when the provider rejected the recipient or accepted nobody.
    if (result && typeof result === "object") {
      const delivery = result as { accepted?: unknown; rejected?: unknown };
      if ((Array.isArray(delivery.accepted) && delivery.accepted.length === 0) ||
          (Array.isArray(delivery.rejected) && delivery.rejected.length > 0))
        throw new Error("Email not accepted");
    }
  }
  catch { throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED"); }
}