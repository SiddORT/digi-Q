---
name: Notification channel boundary
description: Keep notification SMS separate from security OTP and preserve future-event-only activation
---

The administrator requested configurable notification SMS HTTP URL/key, not a fixed
provider. Keep this channel separate from existing Twilio verification credentials,
and never make account/security messages disable-able appointment events.

**Why:** Security verification, invitations and password recovery were explicitly out
of scope; changing their transport or controls would change existing account behavior.

**How to apply:** Extend the shared encrypted vault and durable notification machinery
for appointment channels rather than adding an alternative email sender or modifying OTP.
Constrain configuration to declarative POST mappings, never executable provider scripts.

Enabling/configuring a channel must affect future eligible events only. In particular,
idempotent booking retries must not capture fresh notification jobs for old bookings.

**Why:** The requested operational boundary forbids backlog replay and silent clinic
activation. A retry after a configuration change is not a newly created booking.

**How to apply:** Capture booking jobs at actual creation, independently of the separately
claimed patient email. Preserve the clinic gate and existing explicit opt-outs. Do not
activate real clinics or send real recipients as part of development verification.

Optional email and notification SMS activation are independent. Disabling optional
email must not stop SMS capture or disable SMTP for account-security messages.

**Why:** The approved provider controls affect one optional channel, not all notifications
or sign-in, invitations and recovery.

**How to apply:** Apply each channel's opt-out inside its own preparation/dispatch path,
after the shared clinic gate. Verify that another enabled channel still queues when one is off.

SMS/email template drawers should remain simple like the user's supplied references:
template key/variables, Active, email Subject/Body or SMS DLT registration/Body, and
Cancel/Save Template at the bottom.

**Why:** The user explicitly requested simpler drawers, not a change to template delivery
or an HTML-authoring feature.

**How to apply:** Keep optional branding, sender overrides and secondary actions under
collapsed Advanced controls. Preserve DigiQ branding, supported double-brace variables,
plain-text email escaping, scope/revision checks and save/discard confirmation.
