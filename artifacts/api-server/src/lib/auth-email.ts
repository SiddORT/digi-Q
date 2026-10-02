import nodemailer from "nodemailer";
import { HttpError } from "./http";
import { smtpConfig } from "./integration-config";
export { smtpConfig } from "./integration-config";
/** Transport can be injected by tests; never expose codes or tokens in response/logs. */
export async function sendAuthEmail(to: string, subject: string, text: string,
  transport?: { sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown> }) {
  const cfg = smtpConfig();
  const client = transport || nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password }, requireTLS: !cfg.secure && cfg.requireTLS,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  try { await client.sendMail({ from: cfg.from, to, subject, text }); }
  catch { throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED"); }
}