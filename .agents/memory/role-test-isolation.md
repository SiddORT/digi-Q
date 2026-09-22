---
name: Role test authentication isolation
description: Avoiding false authorization conclusions during multi-account browser verification
---

Use a fresh isolated browser context per role, explicitly select the intended Clerk fixture identity, and confirm both the browser identity and `/me` role before evaluating a protected flow.

**Why:** A browser-helper handshake initially left the patient view unauthenticated during the flow audit. Fresh-context identity checks established the correct patient session without any application authentication change. A helper's apparent sign-in success alone was insufficient evidence.

**How to apply:** Compare loaded/signed-in state, the intended versus actual non-secret user identifier, and the mapped application role. Do not record cookies, JWTs, passwords, or other credentials. Keep API-authenticated and browser-authenticated verification results distinct.