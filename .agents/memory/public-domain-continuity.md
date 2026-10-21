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
