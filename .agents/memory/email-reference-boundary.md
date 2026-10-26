---
name: Email visual-reference boundary
description: Visual email references do not override event variables, message meaning or delivery authorization.
---

Email-only theming must use both the booking and OTP references, without treating their sample content as authoritative. In particular, the reference's doctor placeholder is a full visit summary, not a doctor name. OTP references do not authorize a patient greeting, appointment-booking copy for every security event, a sample code/expiry, or a new support destination.

**Why:** The user explicitly approved the appearance while retaining event-specific wording, restricted security links, saved wording and plain-text alternatives. The supplied images contain placeholders and sample values that conflict with those requirements.

**How to apply:** Treat event/structured values as the content authority and the images only as presentation guidance. Keep security previews fictional and real-inbox checks separately authorized; browser screenshots are not evidence of inbox delivery or real-client compatibility.
