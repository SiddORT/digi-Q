import { HttpError } from "./http";
import { resolvedIntegration } from "./integration-vault";
import { integrationReadiness } from "./integration-config";

export function developmentOtpEnabled() {
  return process.env.NODE_ENV === "development" && process.env.OTP_PROVIDER === "development";
}

export async function otpDeliveryConfigured(conn?: Parameters<typeof resolvedIntegration>[1]) {
  const { env, source } = await resolvedIntegration("sms", conn);
  return (source === "environment" && developmentOtpEnabled()) || integrationReadiness(env).sms.ready;
}

/** Never log provider payloads: the SMS body contains an authentication code. */
export async function deliverOtp(mobile: string, code: string, expirySeconds: number) {
  const { env, source } = await resolvedIntegration("sms");
  if (source === "environment" && developmentOtpEnabled()) return "development" as const;
  if (!integrationReadiness(env).sms.ready) {
    throw new HttpError(503, "SMS verification is not configured. Configure Twilio credentials and its messaging service.", "OTP_NOT_CONFIGURED");
  }
  const account = env.TWILIO_ACCOUNT_SID!;
  const body = new URLSearchParams({
    To: mobile,
    MessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID!,
    Body: `Your DigiQ Doctors verification code is ${code}. It expires in ${Math.ceil(expirySeconds / 60)} minutes. Do not share this code.`,
  });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${account}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      },
      body: body.toString(),
    });
    if (!response.ok) throw new Error("Delivery rejected");
    return "sms" as const;
  } catch {
    throw new HttpError(503, "The verification message could not be sent. Check the SMS connection and try again.", "OTP_DELIVERY_FAILED");
  }
}