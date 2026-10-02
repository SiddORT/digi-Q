---
name: Native authentication boundary
description: Why provider authentication must not be restored as a deployment workaround
---

Keep staff credential ownership in PostgreSQL, with Argon2id verification in the application. Keep patient passwordless identity separate from staff authentication.

**Why:** The user explicitly approved replacing Clerk completely after self-hosted VPS authentication problems. This is an intentional product/deployment decision, not a temporary fallback.

**How to apply:** Resolve email delivery, password initialization, and session configuration directly; do not silently restore a provider or bypass verification. Never rotate existing users' passwords as part of routine deployment. Workspace fixture results do not establish successful VPS rollout or real email delivery.

Normal staff password login must be independent of SMTP; successful password verification establishes a local session without mandatory email delivery.

**Why:** The user explicitly removed the mandatory login email challenge after missing SMTP configuration blocked UAT password login. This is a deliberate authentication policy, not an error fallback.

**How to apply:** Keep SMTP mandatory for operations that actually send email (registration verification, recovery requests, invitations, patient codes). Do not reintroduce email delivery as a prerequisite for ordinary staff password login.

Password recovery must not impose a per-account email-request cap. Keep IP abuse protection and reset-token controls separate from that policy.

**Why:** The user reported legitimate recovery blocked after three requests and explicitly requested removing that account limit without weakening token security or other authentication endpoints.

**How to apply:** Do not reintroduce the shared account limiter for forgot-password. Preserve single-use, expiring random tokens, password validation/hashing, and limits on other auth operations.

Cookie-transport fixes require a network-level test through the real Express middleware and frontend transport, not just direct calls to authentication handlers.

**Why:** Direct handler tests passed while the deployed login could still fail at CSRF middleware; concurrent anonymous status and token bootstrap requests could issue competing cookies.

**How to apply:** Include first-visit bootstrap, overlapping status responses, cookie/header mismatch rejection, and session establishment over HTTPS using isolated data. Distinguish a Node cookie-jar integration from real browser or live-UAT verification.

The user's reason for considering app-owned JWT is that their team is more familiar with JWT than OAuth. They want a comparison with Clerk-managed authentication and native database sessions, plus a complete change list reviewed together before implementation approval.

**Why:** The user clarified the motivation and requested live-deployment verification rather than assuming the workspace migration is deployed.

**How to apply:** Explain that JWT is a token format, OAuth an authorization protocol, and Clerk a provider. Treat JWT as an architecture choice, not a prerequisite for removing Clerk. Verify each deployment independently; do not treat approval of an audit or checklist as permission to change authentication.

UAT at `https://uat.digi-q.in` is the authoritative target for the authentication review.

**Why:** The user explicitly selected UAT rather than the Replit-published site or both deployments.

**How to apply:** Scope live verification and release-readiness conclusions to UAT. Observations of the Replit deployment do not establish UAT behavior, and discrepancies there do not automatically expand the work.

The user says development was done here, pushed through Git and deployed, then Clerk authentication was manually changed to JWT in the deployed version. They cannot provide the requested deployment evidence.

**Why:** The user corrected the assumption that workspace authentication represents deployed authentication.

**How to apply:** Treat deployed JWT as user-reported, not independently verified. Scope further analysis as reconciliation of potentially divergent implementations, not automatically a new JWT migration. Do not repeat requests for the unavailable deployment files or claim public endpoint checks prove token format.

Use hybrid configuration: private server environment/.env for database, signing and encryption keys; supported integration credentials can be managed by Super Admin through the website and stored encrypted.

**Why:** The user explicitly chose “Private .env + website settings” to support independent self-hosting, superseding the earlier deployment-only choice.

**How to apply:** Keep templates placeholder-only and real values out of Git/browser responses/logs. Retain server-environment operation, require password confirmation for website changes, and keep bootstrap keys outside the UI. Never make the website rewrite .env. Keep real delivery distinct from fake-transport tests.

Initial JWT compatibility work preserves the existing fixed 12-hour session policy instead of introducing refresh-token behavior at the same time.

**Why:** Keeping lifetime and database revocation unchanged limits authentication regressions while workspace and manually modified UAT implementations remain divergent.

**How to apply:** Treat short access-token/rotating refresh design as unfinished, not silently completed. Activation is explicit and requires a dedicated signing key; do not weaken validation or fall back on a missing JWT key.