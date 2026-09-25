import type { GuestReceipt } from "@workspace/api-client-react";

export function canPollGuestReceipt(committed:boolean, secret:unknown, sending:boolean) {
 return committed && !sending && typeof secret==="string" && /^[a-f0-9]{64}$/.test(secret);
}

/** Deliberate allowlist: never print the capability, contacts, or private appointment QR. */
export function guestReceiptText(receipt:GuestReceipt) {
 const status=receipt.status==="confirmed"
  ? `Confirmed · Token ${receipt.token}`
  : receipt.status==="pending"
   ? "Awaiting reception confirmation — no token or queue place reserved."
   : `Declined: ${receipt.reason||"Please ask reception."}`;
 return `ClinicFlow · Visit receipt\n${receipt.fullName}\n${receipt.clinicName} · ${receipt.branchName}\n${receipt.doctorName} · ${receipt.date}\n${receipt.startTime||""} – ${receipt.endTime||""} ${receipt.timezone}\n${status}\nPrinted status is a snapshot. A token is not queue position.`;
}