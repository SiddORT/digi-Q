import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";

/** Required email proof is separate from optional phone proof. No delivery claim. */
export function RegistrationEmailNotice({channels}:{channels?:SecurityChannels}) {
  const email = channels?.email;
  if (!email) return <p role="status">Email verification is still required. Enter a valid code if you have one, or use Resend code when the timer ends. Choose Change email to restart.</p>;
  const failure = email.status !== "provider_accepted";
  return <>
    <div className={failure ? "error-box" : "notice"} role={failure ? "alert" : "status"} data-testid="registration-email-delivery">
      {failure && <strong>Required email verification is not complete. </strong>}
      {email.status === "provider_rejected"
        ? "We couldn’t send your verification email. Use Resend code when the timer ends; if this continues, ask the system administrator for help."
        : email.status === "pre_dispatch_failed" || email.status === "unavailable"
          ? "Your verification email was not sent. Use Resend code when the timer ends; if this continues, ask the system administrator for help."
          : email.status === "delivery_unknown"
            ? "We couldn’t confirm whether the email was sent. Wait and check for a code before using Resend code when the timer ends."
            : email.status === "disabled"
              ? "Email sending is turned off. Ask the system administrator for help. Email verification is still required."
              : email.status === "provider_accepted"
                ? "Your verification email was accepted for sending. Enter the code when it arrives, or use Resend code when the timer ends."
                : <SecurityChannelNotice channels={{email}}/>}
      {failure && <p>Your registration details are kept. Email verification is still required; optional SMS cannot replace it. To restart, choose Change email and re-enter your password.</p>}
    </div>
    {channels?.sms && !["unavailable","not_requested","disabled"].includes(channels.sms.status) && <SecurityChannelNotice channels={{sms:channels.sms}}/>}
  </>;
}
