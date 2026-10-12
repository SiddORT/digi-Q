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

The communication-settings reference screenshots define the simple provider-form,
event-list and side-editor experience, not an expansion of the notification event catalogue.

**Why:** The user approved separating communication from general settings while preserving
existing delivery rules. The reference application's OTP, invoice and payment examples
are not authorization to introduce those events into DigiQ's optional notifications.

**How to apply:** Retain DigiQ branding and supported events. Treat additional events and
security-template customization as separate changes; never copy reference credentials or branding.

For the SMS reference form, match its layout and field labels without copying the
reference's HTTP/IP endpoints, OTP text, business branding or sample credentials.

**Why:** The user requested the SMS page “as it is” in the screenshot. That authorizes
the provider form presentation, not weakened transport security or a switch controlling
security verification. The status URL is configuration, not evidence of delivered messages.

**How to apply:** Keep HTTPS/SSRF protections and explicit test confirmation. Provider
Sender/Entity defaults must be honored consistently by publish validation, readiness and
dispatch, while event-specific metadata takes precedence.

The user also requested Email Settings “as it is” in the provided SMTP screenshot:
compact Host/Port and From Email/From Name rows, TLS/SSL choices, configured
credentials with Replace, and a shared Save/Test footer.

**Why:** This is a reference-matched provider form, not permission to copy another
business's sender identity, enable plaintext SMTP, or disable account-security emails.

**How to apply:** Keep DigiQ branding and actual saved non-secret values. Require
STARTTLS or implicit SSL. Optional-email activation stays separate from SMTP availability
for sign-in, invitations and recovery; tests require explicit confirmation.
