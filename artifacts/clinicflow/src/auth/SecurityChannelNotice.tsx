export type SecurityChannels = Partial<Record<"email"|"sms",{status:string;destination?:string}>>;
const copy:Record<string,string> = {
  provider_accepted:"Provider accepted the message; delivery is not confirmed.",
  provider_rejected:"Provider rejected the message.",
  pre_dispatch_failed:"Message was not sent.",
  delivery_unknown:"Outcome uncertain. Wait and check before requesting another message.",
  unavailable:"Unavailable. Approved template and provider configuration may be required.",
  disabled:"Delivery is disabled by the System Admin. Verification is still required; no message was sent.",
  not_requested:"Not requested.",
  not_reported:"For privacy, account eligibility and message outcome are not disclosed. Check your inbox and spam folder; a request is not proof of delivery.",
};
export function securityChannelSummary(channels?:SecurityChannels) {
  return channels ? Object.entries(channels).map(([channel,outcome])=>`${channel === "sms" ? "SMS" : "Email"}${outcome.destination ? ` (${outcome.destination})` : ""}: ${copy[outcome.status] || "Outcome unavailable."}`).join(" ") : "";
}
export function SecurityChannelNotice({channels}:{channels?:SecurityChannels}) {
  if (!channels) return null;
  return <div className="notice" role="status" aria-live="polite">{Object.entries(channels).map(([channel,outcome])=>
    <p key={channel}>{channel === "sms" ? "SMS" : "Email"}{outcome.destination ? ` (${outcome.destination})` : ""}: {copy[outcome.status] || "Outcome unavailable."}</p>)}</div>;
}
