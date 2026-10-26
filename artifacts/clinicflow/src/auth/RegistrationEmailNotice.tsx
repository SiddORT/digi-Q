import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";

/** Required email proof is separate from optional phone proof. No delivery claim. */
export function RegistrationEmailNotice({channels}:{channels?:SecurityChannels}) {
  const email = channels?.email;
  if (!email) return <p role="status">Email verification is still required. If no code arrives, wait for the resend timer. Choose Change Details if this challenge expires.</p>;
  const failure = email.status !== "provider_accepted";
  return <>
    <div className={failure ? "error-box" : "notice"} role={failure ? "alert" : "status"} data-testid="registration-email-delivery">
      {failure && <strong>Required email verification is not complete. </strong>}
      {email.status === "provider_rejected"
        ? "The email provider rejected the verification message. Contact the System Admin to check email delivery settings, then use Resend code after the timer."
        : email.status === "pre_dispatch_failed" || email.status === "unavailable"
          ? "The verification email was not sent. Contact the System Admin to check email preparation and settings, then use Resend code after the timer."
          : email.status === "delivery_unknown"
            ? "The email outcome is uncertain. Wait and check your inbox and spam folder before choosing Resend code."
            : email.status === "disabled"
              ? "Email delivery is disabled. Contact the System Admin. Email verification is still required."
              : <SecurityChannelNotice channels={{email}}/>}
      {failure && <p>Your registration details are retained. Email proof is still required; optional SMS cannot replace it. If the code expires, choose Change Details and re-enter your password.</p>}
    </div>
    {channels?.sms && !["unavailable","not_requested","disabled"].includes(channels.sms.status) && <SecurityChannelNotice channels={{sms:channels.sms}}/>}
  </>;
}
