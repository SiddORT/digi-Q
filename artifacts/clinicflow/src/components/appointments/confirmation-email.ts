export function confirmationEmailMessage(outcome?: string) {
  if (outcome === "provider_accepted") return "Confirmation email accepted for sending. Inbox delivery is not guaranteed.";
  if (outcome === "not_attempted") return "Booking confirmed. Confirmation email status is uncertain; keep your ticket. Do not book again or automatically resend.";
  if (outcome === "unavailable") return "Booking confirmed. Confirmation email could not be confirmed; keep your ticket.";
  if (outcome === "no_recipient") return "Booking confirmed. No email recipient was available; keep your ticket.";
  if (outcome === "disabled") return "Booking confirmed. Email notifications are disabled; keep your ticket.";
  return null;
}