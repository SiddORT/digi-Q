---
name: SMTP namespace policy
description: Why the environment SMTP namespace differs from website and encrypted settings
---

Treat the DIGI SMTP namespace as an environment-only change, not a saved-provider migration.
Existing encrypted website settings must not be replaced just because new secrets exist.

**Why:** The user requested DIGI SMTP secrets while explicitly retaining existing saved
configuration, masking, revision checks and source precedence. Automatically switching
providers would change operational email without approval.

**How to apply:** Distinguish direct verification of new environment credentials from
verification of the application's effective source. Preserve canonical website/vault
contracts and fail closed on unreadable saved credentials. A connection/authentication
check is not proof of sender authorization or inbox delivery.
