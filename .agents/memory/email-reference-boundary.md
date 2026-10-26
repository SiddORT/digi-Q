---
name: Email visual-reference boundary
description: Visual email references do not override event variables, message meaning or delivery authorization.
---

Email-only theming must use both the booking and OTP references, without treating their sample content as authoritative. In particular, the reference's doctor placeholder is a full visit summary, not a doctor name. OTP references do not authorize a patient-name greeting, appointment-booking copy for every security event, or a sample code/expiry.

**Why:** The user explicitly approved the appearance while retaining event-specific wording, restricted security links, saved wording and plain-text alternatives. The supplied images contain placeholders and sample values that conflict with those requirements.

**How to apply:** Treat event/structured values as the content authority and the images only as presentation guidance. Keep security previews fictional and real-inbox checks separately authorized; browser screenshots are not evidence of inbox delivery or real-client compatibility.

The user subsequently specified Digi-Q for email-owned branding only and explicitly selected `mailto:no-reply@digi-q.in` for the fixed Get support action, despite its no-reply name. This does not authorize app-wide rebranding, SMS changes, sender/reply-to changes, mailbox probing or editable security links.

**Why:** The user chose the exact help destination separately from the visual reference and limited this correction to email presentation.

**How to apply:** Keep this support action outside editable content and continue rejecting arbitrary authored addresses and URLs in security templates. Preserve saved wording until its owner explicitly edits/publishes it.
