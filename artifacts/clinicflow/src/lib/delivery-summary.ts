/** HTTP success is not a sending outcome. Keep the channel result authoritative. */
export function deliverySummary(status:string,channel:"email"|"SMS") {
  switch(status){
    case "provider_accepted":return `Test ${channel} submitted. Check the recipient’s messages; delivery isn’t confirmed.`;
    case "provider_rejected":return `The test ${channel} could not be sent. Check the sending settings and recipient.`;
    case "not_dispatched":
    case "pre_dispatch_failed":return `The test ${channel} was not sent. Check the sending settings.`;
    case "delivery_unknown":return `We couldn’t confirm whether the test ${channel} was sent. Check for it before checking the same request.`;
    default:return "We couldn’t check the test message status.";
  }
}
