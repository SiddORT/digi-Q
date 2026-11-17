---
name: Staff account and legacy invitation boundary
description: Direct password-ready creation is delivery-independent; legacy invitations retain explicit recovery.
---

Administrator-created staff use email as their username and a create-time password, with no separately editable username or mobile login. Ordinary team members verify their own email and mobile separately after signing in, may defer, and request each OTP explicitly. New clinic owners are the deliberate exception: public and Super Admin-led clinic creation require the owner's mobile OTP before account details. Ordinary existing-account password login must not depend on either proof or message delivery.

**Why:** The user explicitly replaced the mobile-as-username proposal with email/password accounts and staff-owned contact verification.

**Why the owner exception:** The user explicitly selected verification during clinic onboarding, not after first login, while preserving required email identity and existing account access.

**How to apply:** Do not restore invitations or delivery preflight to the direct-password flow. Preserve role-specific ownership requirements without turning them into another password-onboarding process. Welcome channels require their matching proof; never infer one channel's verification from the other.

For legacy invitation-based accounts only, check email and public-link configuration before creation, but treat a mail provider failure after commit as a failed invitation on the saved profile, not failed account creation.

**Why:** Staff creation previously returned an error after saving the account. Retrying creation then conflicted with the saved email and hid the account from the editor.

**How to apply:** Keep the saved identity and authorized assignment context visible, offer explicit resend using that identity, and never bypass native email verification. Resend failures must preserve honest status and invalidate unusable invitation links. SMTP acceptance is not confirmed inbox delivery.
