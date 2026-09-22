---
name: Clerk role-specific authentication
description: Supported single-Clerk approach and the limits of authentication-method evidence
---

Keep Clerk as the sole password, email-code and session authority. A valid Clerk identity alone does not establish that a staff member supplied a password.

**Why:** Clerk's default session claims do not identify password versus email-code authentication. A role check before the patient UI sends a code can be bypassed by calling Clerk directly; it must not be treated as proof of password authentication.

**How to apply:** Require Clerk's documented server-side password verification before granting staff application access, and bind that proof to the authenticated Clerk session and identity. Never trust a browser method flag, a URL, or the mere presence of a password. This proves password knowledge, not the original session's authentication method.

Expire password proof with the verified Clerk session, not the access token's expiration.

**Why:** Clerk rotates short-lived tokens within a longer-lived session. Using token expiry for application proof unexpectedly sends active staff back to password confirmation after token refresh.

**How to apply:** Resolve the session through Clerk, check its identity/status, and use its session expiration. Test token refresh beyond the original token's lifetime.

Clerk supports reserved, initially unverified passwordless identities through its documented backend account-creation options even when public signup requires a password.

**Why:** This was confirmed with an isolated development-provider probe. Changing the tenant's global signup requirements or introducing another identity provider is not necessary just to provision a passwordless patient.

**How to apply:** Verify current SDK support and live provider behavior before reuse. Reserve an email without marking it verified, require Clerk email-code completion before application onboarding, and check authoritative staff-role exclusions first. Never create a patient password. Do not claim this disables provider-level password login for legacy patients who already have a password.

Check Clerk Device Trust independently from MFA when a requirement forbids staff OTP.

**Why:** A real browser password sign-in returned `needs_client_trust` with the password verified and email-code verification still required. Successful backend password verification did not establish a completed browser sign-in.

**How to apply:** Inspect the live sign-in status without logging identifiers or credentials. Explain the security tradeoff before changing Device Trust; do not offer staff OTP against the requirement, bypass the challenge, or claim browser completion from API-only evidence.

The owner explicitly approved disabling only Device Trust for password-only staff login on 2026-09-22; this approval is not evidence the setting has been applied.

**Why:** Normal staff login must require email/password without OTP, while patients retain email OTP. The owner accepted the Device Trust tradeoff but prohibited any other security or architecture changes.

**How to apply:** Preserve server-side password proof, authorization, session security and CAPTCHA. Use the supported managed-Clerk dashboard configuration path, and verify actual staff browser login before declaring completion.