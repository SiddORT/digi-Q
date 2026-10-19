import nodemailer from "nodemailer";
import { smtpConfig, smtpTransportOptions } from "./integration-config";

/** Connection/TLS/authentication only. No envelope or message is submitted. */
export async function verifySmtp(env: NodeJS.ProcessEnv) {
  const transport = nodemailer.createTransport(smtpTransportOptions(smtpConfig(env)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      transport.verify(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("SMTP verification deadline"), { code: "ETIMEDOUT" })), 35000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    transport.close();
  }
}
