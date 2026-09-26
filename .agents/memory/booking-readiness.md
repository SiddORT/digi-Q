---
name: Explicit clinic booking readiness
description: Product boundary between completed registration and bookable doctor sessions
---

Registration completion must distinguish an account and clinic being created from a doctor being ready to accept bookings. Location opening hours alone do not establish doctor availability or patient capacity.

**Why:** Users reasonably interpreted completed onboarding plus a working clinic QR as proof that patients could book. Public clinic and doctor details can resolve even when there are no doctor sessions.

**How to apply:** Provide explicit owner-driven session setup using saved hours as a template, with visible capacity and consultation-duration choices. Never infer or silently backfill those choices into existing live clinics. Explain incomplete setup clearly and verify the full setup-to-public-booking journey, rather than treating a populated clinic page or successful registration as sufficient evidence.

Solo consulting owners should default to using location hours for their own doctor sessions during onboarding, with explicit capacity and consultation settings. Offer a custom-hours opt-out and explicit opt-in for existing clinics.

**Why:** The user rejected entering the same timetable twice for a one-person clinic and approved linked clinic/doctor hours as the normal solo-owner experience. Demo provisioning had created both records, while normal registration previously created hours alone.

**How to apply:** Treat linked hours as an ongoing relationship, not merely a one-time copy. Preview subsequent changes; reject changes affecting booked history or protected exceptions rather than silently rescheduling patients. Explicit unlinking preserves existing sessions and bookings. Administrative ownership remains separate from clinical doctor capability.