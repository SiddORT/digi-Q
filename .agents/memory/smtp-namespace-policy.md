---
name: SMTP namespace policy
description: User clarification on SMTP secret values, saved-provider boundaries and live verification
---

The user clarified that they wanted credential values updated, not variable names,
and authorized restoring the original SMTP_* names. This supersedes the previous
DIGI namespace decision. Do not assume original keys contain newer intended values,
or compare/copy values between namespaces. Existing encrypted website settings must
not be replaced just because environment secrets exist.

**Why:** The user's clarification concerns the environment contract only; changing
secrets or switching a saved provider would alter operational email without approval.

**How to apply:** Distinguish environment readiness from the application's effective
source, and historical DIGI checks from current SMTP checks. Preserve website/vault
contracts and fail closed on unreadable saved credentials. Do not probe real SMTP
under readiness-only authorization. A connection/authentication check is not proof
of sender authorization or inbox delivery, and workspace evidence does not verify UAT.
