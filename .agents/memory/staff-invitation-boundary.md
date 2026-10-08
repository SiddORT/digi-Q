---
name: Staff invitation persistence boundary
description: Configuration and delivery errors must not hide saved staff profiles.
---

Check email and public-link configuration before creating staff, but treat a mail provider failure after commit as a failed invitation on the saved profile, not failed account creation.

**Why:** Staff creation previously returned an error after saving the account. Retrying creation then conflicted with the saved email and hid the account from the editor.

**How to apply:** Keep the saved identity and authorized assignment context visible, offer explicit resend using that identity, and never bypass native email verification. Resend failures must preserve honest status and invalidate unusable invitation links. SMTP acceptance is not confirmed inbox delivery.
