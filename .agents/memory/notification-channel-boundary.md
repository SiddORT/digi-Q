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
