import nodemailer from "nodemailer";
import { HttpError } from "./http";
import { smtpConfig } from "./integration-config";
import { systemEmailTemplate } from "./email-template";
import { resolvedIntegration } from "./integration-vault";
export { smtpConfig } from "./integration-config";
/** Transport can be injected by tests; never expose codes or tokens in response/logs. */
export async function sendAuthEmail(to: string, subject: string, text: string,
  transport?: { sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown> },
  rendered?: { text: string; html: string; logoPath?: string },
  files: { filename: string; content: Buffer; contentType: string }[] = [], savedEnv?: NodeJS.ProcessEnv) {
  const cfg = smtpConfig(savedEnv || (await resolvedIntegration("smtp")).env);
  const client = transport || nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password }, requireTLS: !cfg.secure && cfg.requireTLS,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    const attachments: any[] = [...files];
    if (rendered?.logoPath) {
      const { loadLogoBytes } = await import("./logo-bytes");
      try {attachments.push({ filename: "clinic-logo.png", content: await loadLogoBytes(rendered.logoPath), contentType: "image/png", cid: "clinic-logo" });}
      catch {throw new HttpError(503,"Email preparation unavailable","EMAIL_PRE_DISPATCH_FAILED");}
    }
    const result = await client.sendMail({
      from: cfg.from, to, subject, ...(rendered || systemEmailTemplate(subject, text)),
      attachments,
      disableFileAccess: true, disableUrlAccess: true,
    });
    // Legacy injected transports return undefined. SMTP results must not silently
    // report success when the provider rejected the recipient or accepted nobody.
    if (result && typeof result === "object") {
      const delivery = result as { accepted?: unknown; rejected?: unknown };
      if ((Array.isArray(delivery.accepted) && delivery.accepted.length === 0) ||
          (Array.isArray(delivery.rejected) && delivery.rejected.length > 0))
        throw new HttpError(503,"Email provider rejected the recipient","EMAIL_REJECTED");
    }
  }
  catch (error:any) {
    if(error instanceof HttpError && ["EMAIL_REJECTED","EMAIL_PRE_DISPATCH_FAILED"].includes(error.code!))throw error;
    if(error?.code==="EAUTH"||error?.code==="EENVELOPE"||[530,535,550,551,552,553,554].includes(error?.responseCode))
      throw new HttpError(503,"Email provider rejected the message","EMAIL_REJECTED");
    if(["EDNS","ECONNECTION"].includes(error?.code))throw new HttpError(503,"Email connection unavailable","EMAIL_PRE_DISPATCH_FAILED");
    throw new HttpError(503, "Email delivery outcome is uncertain", "EMAIL_DELIVERY_FAILED");
  }
}