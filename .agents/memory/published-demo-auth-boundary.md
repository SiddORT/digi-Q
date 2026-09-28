---
name: Published same-app demo authentication boundary
description: Why the dedicated demo login cannot change ordinary staff verification
---

The owner explicitly declined a separate demo deployment and authorized a
fictional, single-clinic demo inside the same published application.
Ordinary users, real clinic staff and user-owned real accounts must continue
using the ordinary staff password and email verification flow. Never disable
verification globally, infer staff password knowledge from a patient session,
or treat a fabricated
email address as a real user's verified inbox.

The designated demo identity alone may use the dedicated demo-password path:
the backend must check the marked active demo identity, verify its password,
and establish an application-owned session. The demo identity can own only its one marked clinic,
branch and self-owned doctor; structural writes/invitations and cross-clinic
access remain denied. An authorized Super Admin explicitly provisions,
disables and rotates the account; no startup seed or production SQL creates it.
Preview and published environments have separate data and credentials.

The publicly accessible demo-password endpoint uses an atomic PostgreSQL
attempt counter, HMAC-hashed (never raw) IP keys, a 10-attempt/10-minute
per-IP limit and a 200-attempt/10-minute global bound. This global safety cap
can still be exhausted deliberately; monitor it and prefer an independently
isolated demo if unrestricted public availability becomes essential.

**Why:** Shared fictional demo credentials must work without an inbox for the
user's publish-and-share test, but their convenience must not silently weaken
the authentication policy for real clinics.