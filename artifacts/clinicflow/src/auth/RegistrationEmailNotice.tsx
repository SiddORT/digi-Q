import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";

/** Required email proof is separate from optional phone proof. No delivery claim. */
export function RegistrationEmailNotice({channels}:{channels?:SecurityChannels}) {
  const email = channels?.email;
  if (!email) return <p role="status">Email verification is still required. Check your inbox and spam folder for the verification code. If it doesn’t arrive, request another code when the timer ends. If this verification session expires, choose Change details.</p>;
  const failure = email.status !== "provider_accepted";
  return <>
    <div className={failure ? "error-box" : "notice"} role={failure ? "alert" : "status"} data-testid="registration-email-delivery">
      {failure && <strong>Required email verification is not complete. </strong>}
      {email.status === "provider_rejected"
        ? "The verification email could not be sent. Ask the system administrator to check email settings, then use Resend code when the timer ends."
        : email.status === "pre_dispatch_failed" || email.status === "unavailable"
          ? "The verification email was not sent. Ask the system administrator to check email settings, then use Resend code when the timer ends."
          : email.status === "delivery_unknown"
            ? "We couldn’t confirm whether the email was sent. Wait and check your inbox and spam folder before choosing Resend code when the timer ends."
            : email.status === "disabled"
              ? "Email sending is turned off. Ask the system administrator for help. Email verification is still required."
              : email.status === "provider_accepted"
                ? "Check your inbox and spam folder for the verification code. If it doesn’t arrive, request another code when the timer ends."
                : <SecurityChannelNotice channels={{email}}/>}
      {failure && <p>Your registration details are kept. Email verification is still required; optional SMS cannot replace it. If the code expires, choose Change details and re-enter your password.</p>}
    </div>
    {channels?.sms && !["unavailable","not_requested","disabled"].includes(channels.sms.status) && <SecurityChannelNotice channels={{sms:channels.sms}}/>}
  </>;
}
