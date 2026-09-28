import nodemailer from "nodemailer";
import { HttpError } from "./http";

type EmailConfig = { host: string; port: number; user: string; password: string; from: string };
export function smtpConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM ||
      !Number.isInteger(port) || port < 1 || port > 65535)
    throw new HttpError(503, "Email delivery is not configured", "EMAIL_UNCONFIGURED");
  return { host: SMTP_HOST, port, user: SMTP_USER, password: SMTP_PASSWORD, from: SMTP_FROM };
}
/** Transport can be injected by tests; never expose codes or tokens in response/logs. */
export async function sendAuthEmail(to: string, subject: string, text: string,
  transport?: { sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown> }) {
  const cfg = smtpConfig();
  const client = transport || nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password }, requireTLS: cfg.port !== 465,
  });
  try { await client.sendMail({ from: cfg.from, to, subject, text }); }
  catch { throw new HttpError(503, "Email delivery unavailable", "EMAIL_DELIVERY_FAILED"); }
}