import { errorStatus, friendlyError, retryWaitSeconds } from "../lib/friendly-error";
import type { SecurityChannels } from "./SecurityChannelNotice";

/** A completed HTTP request alone does not establish SMTP acceptance. */
export function registrationEmailAccepted(channels?: SecurityChannels) {
  return channels?.email?.status === "provider_accepted";
}

export function registrationEmailError(error: unknown, action: "start" | "resend" | "verify") {
  const code = (error as { data?: { code?: string } })?.data?.code;
  if (errorStatus(error) === 429) {
    const seconds = retryWaitSeconds(error);
    return seconds > 0
      ? `Too many requests. Try again in ${seconds} seconds.`
      : "Too many requests. Wait a moment, then try again.";
  }
  if (code === "INVALID_VERIFICATION")
    return action === "resend"
      ? "This verification session has ended. Choose Change email and re-enter your password."
      : "The code is incorrect or has expired. Check the code, use Resend code when the timer ends, or choose Change email to restart.";
  if (["EMAIL_UNCONFIGURED", "INTEGRATION_DECRYPT_FAILED", "INTEGRATION_KEY_REQUIRED", "REGISTRATION_EMAIL_REJECTED", "REGISTRATION_EMAIL_NOT_SENT"].includes(code || ""))
    return action === "resend"
      ? "We couldn’t send a new verification email. Your previous code is unchanged. Try Resend code when the timer ends; if this continues, ask the system administrator for help."
      : "We couldn’t send your verification email. Try again; if this continues, ask the system administrator for help.";
  if (code === "EMAIL_DELIVERY_FAILED")
    return action === "resend"
      ? "We couldn’t confirm whether a new email was sent. Your previous code is unchanged. Wait before using Resend code again."
      : "We couldn’t confirm whether your verification email was sent. Wait and check for a code before trying again.";
  if (code === "SECURITY_DELIVERY_DISABLED")
    return "Email sending is turned off. Ask the system administrator for help. Email verification is still required.";
  // A lost response may follow a completed send. Never automatically retry it.
  if (action !== "verify" && (errorStatus(error) === undefined || (errorStatus(error) || 0) >= 500))
    return action === "resend"
      ? "We couldn’t confirm the resend. Wait and check for a code before trying Resend code again."
      : "We couldn’t confirm the request. Wait and check for a code before trying again.";
  return friendlyError(error, "auth");
}
