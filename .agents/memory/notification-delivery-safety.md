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

The user authorized Email and SMS defaults and existing-clinic activation for booking,
rescheduled, cancelled, completed and reminder events, to patient, owning Clinic Admin
and assigned Doctor. This supersedes earlier default-off restrictions for that scope
only. Receptionist, Superadmin, onboarding/security messages and personal opt-outs
are not included. Shared destinations receive one message per channel and event.

**Why:** The user explicitly selected defaults plus existing clinics and reiterated
"activate all mails and sms, as we have put the approved tempaltes only."

**How to apply:** Reuse the existing templates and sender/DLT validation, without a
new approval mechanism. The user says templates saved on the SMS Templates page
are approved. Inventory the full effective catalog, not only saved overrides; if
the screenshot and workspace differ, identify the exact environment before writes.
Ask before adding extra scope; never invent registration IDs or infer them from an image.

Queued reminders have a five-minute dispatch allowance beyond the narrow scheduling
window; this must not widen event capture or replay a historical backlog.

**Why:** Independent channel polling can run before a scheduler transaction commits,
so the next poll may miss the original capture window even for a correctly queued job.

**How to apply:** Retain a bounded dispatch allowance while rechecking current status,
check-in state, appointment revision, session timezone, channel policy and recipient
eligibility. Expire older reminders and never automatically resend uncertain dispatch.