import { ReplitConnectors } from "@replit/connectors-sdk";
import { HttpError } from "./http";

export function developmentOtpEnabled() {
  return process.env.NODE_ENV === "development" && process.env.OTP_PROVIDER === "development";
}

export function otpDeliveryConfigured() {
  return developmentOtpEnabled() || (
    process.env.OTP_PROVIDER === "twilio" &&
    /^AC[a-f0-9]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID ?? "") &&
    /^MG[a-f0-9]{32}$/i.test(process.env.TWILIO_MESSAGING_SERVICE_SID ?? "")
  );
}

/** Never log provider payloads: the SMS body contains an authentication code. */
export async function deliverOtp(mobile: string, code: string, expirySeconds: number) {
  if (developmentOtpEnabled()) return "development" as const;
  if (!otpDeliveryConfigured()) {
    throw new HttpError(503, "SMS verification is not configured. Connect Twilio and configure its messaging service before requesting a code.", "OTP_NOT_CONFIGURED");
  }
  const account = process.env.TWILIO_ACCOUNT_SID!;
  const body = new URLSearchParams({
    To: mobile,
    MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
    Body: `Your DigiQ Doctors verification code is ${code}. It expires in ${Math.ceil(expirySeconds / 60)} minutes. Do not share this code.`,
  });
  try {
    const response = await new ReplitConnectors().proxy(
      "twilio", `/2010-04-01/Accounts/${account}/Messages.json`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() },
    );
    if (!response.ok) throw new Error("Delivery rejected");
    return "sms" as const;
  } catch {
    throw new HttpError(503, "The verification message could not be sent. Check the SMS connection and try again.", "OTP_DELIVERY_FAILED");
  }
}