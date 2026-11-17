import { HelpTip } from "./HelpTip";

/** Context for the existing shared event; recipient rows remain independently configured. */
export function RegistrationSmsGuidance({ recipient }: { recipient?: string }) {
  return <div className="muted" data-testid="registration-sms-guidance">
    <p>{recipient === "clinicAdmin"
      ? "Clinic Admin: required mobile proof before account details in both public owner registration and Superadmin-led clinic owner setup."
      : recipient === "patient"
        ? "Patient: optional phone proof during email registration; required email verification remains separate."
        : "Clinic Admin is required owner mobile proof; Patient is optional phone proof during email registration. Configure each row separately."}
      {" "}<HelpTip label="About registration SMS configuration" text={`This is not patient SMS login, staff phone verification or the post-creation clinic welcome SMS. For each approved DLT variable slot, substitute its matching application placeholder; preserve all approved literal text, spacing and punctuation. Owner codes expire in 10 minutes. Save Draft does not change requests; explicitly Publish the wording and matching registration DLT Template ID, then enable the ${recipient === "patient" ? "Patient" : "Clinic Admin"} SMS row at System Default. Drafts and switches do not establish DLT approval. No message is sent by saving, publishing or enabling. Sender ID comes from SMS Communication Settings. Keep in Touch requires a valid Sender ID and this event's Template ID, but no Entity ID; generic providers require Entity ID and Template ID when their mapping requires DLT.`}/></p>
    <p>Required body placeholders: {"{{otp}}"} and {"{{expiry_minutes}}"}; no others are supported.
      {" "}If approved wording is incompatible, stop and resolve it; do not rewrite literal text or invent an expiry.</p>
  </div>;
}
