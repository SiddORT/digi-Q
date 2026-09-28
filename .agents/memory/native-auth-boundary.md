---
name: Native authentication boundary
description: Why provider authentication must not be restored as a deployment workaround
---

Keep staff credential ownership in PostgreSQL, with Argon2id verification in the application. Keep patient passwordless identity separate from staff authentication.

**Why:** The user explicitly approved replacing Clerk completely after self-hosted VPS authentication problems. This is an intentional product/deployment decision, not a temporary fallback.

**How to apply:** Resolve email delivery, password initialization, and session configuration directly; do not silently restore a provider or bypass verification. Never rotate existing users' passwords as part of routine deployment. Workspace fixture results do not establish successful VPS rollout or real email delivery.