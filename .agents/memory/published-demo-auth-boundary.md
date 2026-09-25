---
name: Published same-app demo authentication boundary
description: Why the dedicated demo login cannot change ordinary staff verification
---

The owner explicitly declined a separate demo deployment and authorized a
fictional, single-clinic demo inside the same published application.
Ordinary users, real clinic staff and user-owned real accounts must continue
using the existing Clerk password, new-device verification and session-bound
staff password proof. Never disable verification tenant-wide, infer staff
password knowledge from a Clerk session alone, or treat a fabricated
email address as a real user's verified inbox.

The designated demo identity alone may use the dedicated demo-password path:
the backend checks that the marked, active provider identity is the fixed
demo account, asks Clerk to verify its password, then issues a short-lived
Clerk sign-in ticket. The new session still needs the normal server-side
staff password proof. The demo identity can own only its one marked clinic,
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