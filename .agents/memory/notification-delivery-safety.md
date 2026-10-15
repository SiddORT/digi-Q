---
name: Notification delivery safety
description: Preserve safe retry semantics and distinguish session reminders from fixed consultation appointments.
---

Do not automatically retry a notification after an uncertain SMTP outcome or a crash
following its durable dispatch claim. Retry only when delivery is known not to have begun.

**Why:** SMTP acceptance and database persistence cannot be committed atomically.
Blind retries can send duplicate patient notifications even when the first call timed out.

Absent personal notification preferences inherit current eligible behavior; they
must not become a new blanket-off switch. Personal enablement cannot override
clinic, template, provider, contact or authorization restrictions. Account-security
messages remain mandatory.

**Why:** The user explicitly required preserving current behavior and existing
opt-outs without silently activating real clinics or recipients.

**How to apply:** Resolve linked accounts before checking optional preferences.
Opt-out and dispatch claims must share a transactional barrier, and re-enabling
must never replay historical skipped or cancelled occurrences.

**How to apply:** Preserve explicit unknown outcomes during retries, operator tooling
and provider changes. Never report SMTP acceptance as confirmed inbox delivery.

Queue reminders refer to session start, not a promised consultation time. Automated
development delivery must remain off unless an isolated test supplies a fake transport.

**Why:** The user authorized implementation and testing, not messages to real recipients;
queue-based care does not promise exact consultation times.

**How to apply:** Preserve the development safety boundary and recheck visit eligibility
at dispatch rather than trusting an earlier reminder snapshot.

Additional staff recipient groups start disabled except the explicitly approved owning Clinic Admin **booking** recipient, which is enabled by default when notifications are enabled. Existing explicitly disabled published templates and clinic opt-outs still require owner activation. Shared addresses across patient and staff roles receive one message for an event.

**Why:** The user approved one owning-admin booking notification/email for every creation entry point, including self-created bookings, without changing live settings or unrelated recipient groups. Other expansions still need explicit publication.

**How to apply:** Preserve primary-recipient compatibility and address-based deduplication when adding recipient groups or changing role assignments.

Queued reminders have a five-minute dispatch allowance beyond the narrow scheduling
window; this must not widen event capture or replay a historical backlog.

**Why:** Independent channel polling can run before a scheduler transaction commits,
so the next poll may miss the original capture window even for a correctly queued job.

**How to apply:** Retain a bounded dispatch allowance while rechecking current status,
check-in state, appointment revision, session timezone, channel policy and recipient
eligibility. Expire older reminders and never automatically resend uncertain dispatch.