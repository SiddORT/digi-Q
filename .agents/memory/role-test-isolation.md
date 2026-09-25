---
name: Role test authentication isolation
description: Avoiding false authorization conclusions during multi-account browser verification
---

Use a fresh isolated browser context per role, explicitly select the intended Clerk fixture identity, and confirm both the browser identity and `/me` role before evaluating a protected flow.

**Why:** A browser-helper handshake initially left the patient view unauthenticated during the flow audit. Fresh-context identity checks established the correct patient session without any application authentication change. A helper's apparent sign-in success alone was insufficient evidence.

**How to apply:** Compare loaded/signed-in state, the intended versus actual non-secret user identifier, and the mapped application role. Do not record cookies, JWTs, passwords, or other credentials. Keep API-authenticated and browser-authenticated verification results distinct.

Confirm the observation tool is capturing the same page being driven, and recheck identity after helper reattachment.

**Why:** A multi-page acceptance run drove the patient page while screenshots still captured the original admin page. Reattaching the helper later produced an unmapped identity instead of the intended existing fixture.

**How to apply:** Prefer one observable page per testing pass where tooling cannot switch reliably. Confirm `/me` again after reattachment. Treat mismatches as test-tool limitations, not successful role login or application failures; do not bypass authentication to make the test pass.

Create booking fixtures through the real booking API when testing queue summaries.

**Why:** Hand-inserted rows lacking generated token data produced blank current/next summaries and a false application-bug report even though row transitions worked. Real API bookings passed the same checks.

**How to apply:** Use database setup only for identities, assignments and prerequisite configuration; exercise appointment creation through the API and compare raw queue responses with the displayed state before attributing a mismatch to the app.