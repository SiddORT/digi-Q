---
name: Patient-facing immediate booking
description: Product distinction between simple patient booking and internal staff queue operations
---

Patients see **Book Now**, then an immediately issued ticket with a personal QR,
waiting number, clinic, location/address, doctor, date and session time range.
Do not relabel this action “Join queue” or introduce reception approval.
“Guest” means that email and phone are optional, not that confirmation is delayed.
The session range is not a promised exact consultation time.

**Why:** The owner explicitly corrected the original guest-request design and
the proposed queue-centric wording. Queue operations are an internal staff concern;
the patient experience should resemble a straightforward booking ticket.

**How to apply:** Use the same protected allocator for anonymous and signed-in
bookings. Keep booking QR links distinct from personal ticket validation QRs.
Preserve historical pending receipts without making new bookings depend on approval.

Booking confirmation and email delivery are separate outcomes. Keep a committed
ticket valid even when mail is disabled, unavailable or has an uncertain outcome.

**Why:** Reversing or reporting a failed booking because SMTP failed can cause
duplicate reservations when the patient retries. Provider acceptance also does
not establish inbox delivery.

**How to apply:** Present booking success independently of the email result.
Do not silently add automatic resending or guaranteed-delivery claims; those
require a separate retry/delivery design.