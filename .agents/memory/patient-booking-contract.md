---
name: Patient-facing immediate booking
description: Product distinction between simple patient booking and internal staff queue operations
---

Patients follow Visit details → Patient details → Ticket. The explicit Book Appointment action on Patient details immediately issues a ticket with a personal QR,
waiting number, clinic, location/address, doctor, date and session time range.
Do not relabel this action “Join queue” or introduce reception approval.
Guest booking requires no account and confirmation is not delayed. Every new
booking now requires a valid mobile; email remains optional.
The session range is not a promised exact consultation time.

**Why:** The owner explicitly corrected the original guest-request design and
the proposed queue-centric wording. Queue operations are an internal staff concern;
the patient experience should resemble a straightforward booking ticket.

**How to apply:** Use the same protected allocator for anonymous and signed-in
bookings. Keep booking QR links distinct from personal ticket validation QRs.
Preserve historical pending receipts without making new bookings depend on approval.

**Why the staged flow:** The user approved removing redundant pre-submit review screens for staff, patients and guests. The final input screen retains a current visit summary, consent and explicit booking action; advancing between input sections must not create a booking.

**How to apply:** This is a bounded simplification, not permission to remove cancellation, rescheduling, queue movement, deletion, schedule-impact, communication-send or discard confirmations. Keep post-save tickets and success screens.

Booking confirmation and email delivery are separate outcomes. Keep a committed
ticket valid even when mail is disabled, unavailable or has an uncertain outcome.

**Why:** Reversing or reporting a failed booking because SMTP failed can cause
duplicate reservations when the patient retries. Provider acceptance also does
not establish inbox delivery.

**How to apply:** Present booking success independently of the email result.
Do not silently add automatic resending or guaranteed-delivery claims; those
require a separate retry/delivery design.

All new bookings require a visit contact, including walk-ins, staff advance,
patient self-booking and anonymous guest bookings. Staff walk-ins initially use
the actual authenticated booking actor's saved mobile, allow replacement or
clearing, but cannot be confirmed without a valid number. Manual changes and
explicit clearing must survive patient selection, identity hydration and step
or mode changes.

**Why:** The owner explicitly superseded the earlier optional guest and
unlinked-walk-in contact policy. A staff member's submitted contact does not
establish ownership of the patient's permanent contact.

**How to apply:** Keep the submitted visit number separate from existing
patient/account contact and verification. New contact entry does not authorize
new notification routing, bypass consent or channel gates, or expand doctor
registration/public walk-in permissions. Historical contactless tickets remain
usable; standalone patient registration contacts remain optional.