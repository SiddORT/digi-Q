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