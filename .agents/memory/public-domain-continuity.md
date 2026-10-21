---
name: Public domain continuity
description: Approval boundary for old links after changing the canonical public website domain.
---

Changing the canonical public website domain does not authorize automatic old-host
aliases, cross-domain redirects, or regeneration/migration of private or security
tokens. Retaining old-domain continuity requires explicit domain control and
separate approval.

**Why:** The user explicitly separated public-link centralization from live
infrastructure changes and continuity for previously distributed emails, tickets
and QR codes. Private/security-token routes make silent redirects especially
risky.

**How to apply:** When old codes stop working after an operator changes domains,
do not quietly widen scanner trust or add redirects. Establish ownership and
obtain separate approval for the continuity strategy. Root self-hosting remains
the supported model; local frontend prefixes are not canonical URL prefixes.
See `docs/self-hosting.md` for the operator checklist.

## Operator configuration preference

Use one server-side `.env` website address and show it read-only in both Clinic
Admin and Super Admin profile/settings panels; do not make it web-editable.

**Why:** The operator clarified that the address should be changed in `.env`,
while administrators can see the link but cannot edit it, and explicitly accepted
the recommendation to keep both sites unchanged with separate approval for a
future domain move or old-host retirement.

**How to apply:** Reuse the canonical public-origin setting instead of adding
per-clinic overrides or web writes to `.env`. The operator reports a separate
Git-deployed UAT installation on their own server; do not assume it shares the
published installation's database or that moving hosts migrates records/tokens.
