---
name: Notification delivery safety
description: Preserve safe retry semantics and distinguish session reminders from fixed consultation appointments.
---

Do not automatically retry a notification after an uncertain SMTP outcome or a crash
following its durable dispatch claim. Retry only when delivery is known not to have begun.

**Why:** SMTP acceptance and database persistence cannot be committed atomically.
Blind retries can send duplicate patient notifications even when the first call timed out.

**How to apply:** Preserve explicit unknown outcomes during retries, operator tooling
and provider changes. Never report SMTP acceptance as confirmed inbox delivery.

Queue reminders refer to session start, not a promised consultation time. Automated
development delivery must remain off unless an isolated test supplies a fake transport.

**Why:** The user authorized implementation and testing, not messages to real recipients;
queue-based care does not promise exact consultation times.

**How to apply:** Preserve the development safety boundary and recheck visit eligibility
at dispatch rather than trusting an earlier reminder snapshot.