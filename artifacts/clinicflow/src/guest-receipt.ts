export function canPollGuestReceipt(committed:boolean, secret:unknown, sending:boolean) {
 return committed && !sending && typeof secret==="string" && /^[a-f0-9]{64}$/.test(secret);
}
