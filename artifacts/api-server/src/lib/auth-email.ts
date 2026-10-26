import nodemailer from "nodemailer";
import { HttpError } from "./http";
import { smtpConfig, smtpTransportOptions } from "./integration-config";
import { systemEmailTemplate } from "./email-template";
import { resolvedIntegration } from "./integration-vault";
export { smtpConfig } from "./integration-config";
export class EmailRejectionError extends HttpError {
  constructor(public diagnostic: "authentication_rejected" | "sender_rejected" | "recipient_rejected") {
    // Preserve the shared rejection contract used by operational mail as well.
    super(503, "Email provider rejected the message", "EMAIL_REJECTED");
  }
}
/** Transport can be injected by tests; never expose codes or tokens in response/logs. */
export async function sendAuthEmail(to: string, subject: string, text: string,
  transport?: { sendMail: (options: { from: string; to: string; subject: string; text: string }) => Promise<unknown> },
  rendered?: { text: string; html: string; logoPath?: string },
  files: { filename: string; content: Buffer; contentType: string }[] = [], savedEnv?: NodeJS.ProcessEnv,
  beforeDispatch?: () => Promise<void>) {
  const cfg = smtpConfig(savedEnv || (await resolvedIntegration("smtp")).env);
  let dispatchStarted = false;
  try {
    const client = transport || nodemailer.createTransport(smtpTransportOptions(cfg));
    const attachments: any[] = [...files];
    if (rendered?.logoPath) {
      const { loadLogoBytes } = await import("./logo-bytes");
      try {attachments.push({ filename: "clinic-logo.png", content: await loadLogoBytes(rendered.logoPath), contentType: "image/png", cid: "clinic-logo" });}
      catch {throw new HttpError(503,"Email preparation unavailable","EMAIL_PRE_DISPATCH_FAILED");}
    }
    const message = {
      from: cfg.from, to, subject, ...(rendered || systemEmailTemplate(subject, text)),
      attachments,
      disableFileAccess: true, disableUrlAccess: true,
    };
    await beforeDispatch?.();
    dispatchStarted = true;
    const result = await client.sendMail(message);
    // Legacy injected transports return undefined. SMTP results must not silently
    // report success when the provider rejected the recipient or accepted nobody.
    if (result && typeof result === "object") {
      const delivery = result as { accepted?: unknown; rejected?: unknown };
      if ((Array.isArray(delivery.accepted) && delivery.accepted.length === 0) ||
          (Array.isArray(delivery.rejected) && delivery.rejected.length > 0))
        throw new EmailRejectionError("recipient_rejected");
    }
  }
  catch (error:any) {
    if(error instanceof HttpError && ["EMAIL_REJECTED","EMAIL_PRE_DISPATCH_FAILED","SECURITY_DELIVERY_DISABLED"].includes(error.code!))throw error;
    if(!dispatchStarted) throw new HttpError(503,"Email preparation unavailable","EMAIL_PRE_DISPATCH_FAILED");
    // Inspect only bounded transport metadata. Never retain response text,
    // recipients, credentials, message bodies or the original error.
    const command = typeof error?.command === "string" ? error.command.toUpperCase() : "";
    const rejected = Number(error?.responseCode) >= 500 && Number(error?.responseCode) < 600;
    if(error?.code==="EAUTH" || rejected && /^AUTH(?: |$)/.test(command))
      throw new EmailRejectionError("authentication_rejected");
    if((error?.code==="EENVELOPE" || rejected) && /^MAIL FROM(?: |$)/.test(command))
      throw new EmailRejectionError("sender_rejected");
    if((error?.code==="EENVELOPE" || rejected) && /^RCPT TO(?: |$)/.test(command))
      throw new EmailRejectionError("recipient_rejected");
    if(error?.code==="EAUTH"||error?.code==="EENVELOPE"||[530,535,550,551,552,553,554].includes(error?.responseCode))
      throw new HttpError(503,"Email provider rejected the message","EMAIL_REJECTED");
    if(["EDNS","ECONNECTION"].includes(error?.code))throw new HttpError(503,"Email connection unavailable","EMAIL_PRE_DISPATCH_FAILED");
    throw new HttpError(503, "Email delivery outcome is uncertain", "EMAIL_DELIVERY_FAILED");
  }
}