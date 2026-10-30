export type SecurityChannels = Partial<Record<"email"|"sms",{status:string;destination?:string}>>;
const copy:Record<string,string> = {
  provider_accepted:"Check for the message. It may take a few minutes to arrive.",
  provider_rejected:"The message could not be sent. Ask the system administrator to check the sending settings.",
  pre_dispatch_failed:"The message was not sent. Ask the system administrator for help before requesting another.",
  delivery_unknown:"We couldn’t confirm whether the message was sent. Wait and check for it before requesting another.",
  unavailable:"Messaging is unavailable. Ask the system administrator for help. Verification is still required.",
  disabled:"Sending is turned off. No message was sent. Ask the system administrator for help. Verification is still required.",
  not_requested:"No message was requested.",
  not_reported:"If you can use this account, check for the message. For privacy, we can’t confirm account details here.",
};
export function securityChannelSummary(channels?:SecurityChannels) {
  return channels ? Object.entries(channels).map(([channel,outcome])=>`${channel === "sms" ? "SMS" : "Email"}${outcome.destination ? ` (${outcome.destination})` : ""}: ${copy[outcome.status] || "We couldn’t check the message status."}`).join(" ") : "";
}
export function SecurityChannelNotice({channels}:{channels?:SecurityChannels}) {
  if (!channels) return null;
  return <div className="notice" role="status" aria-live="polite">{Object.entries(channels).map(([channel,outcome])=>
     <p key={channel}>{channel === "sms" ? "SMS" : "Email"}{outcome.destination ? ` (${outcome.destination})` : ""}: {copy[outcome.status] || "We couldn’t check the message status."}</p>)}</div>;
}
