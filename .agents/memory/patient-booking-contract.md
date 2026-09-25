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