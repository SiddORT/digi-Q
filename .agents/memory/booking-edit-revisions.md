---
name: Booking metadata revision boundary
description: Why limited contact/notes edits must not use the lifecycle notification revision.
---

Visit-only mobile and notes edits need an independent concurrency revision while also checking the captured lifecycle revision. Do not advance the lifecycle revision for these edits or enqueue replacement booking events.

**Why:** Automatic notification dispatch binds eligibility to the lifecycle revision. Incrementing it for a contact/notes-only edit silently obsoletes pending messages and can change reminder capture, violating the requirement to leave automatic events and notification recipients unchanged.

**How to apply:** Preserve both revision baselines throughout dirty drafts. Scheduling/state changes must conflict with an open metadata editor, and concurrent metadata edits must also conflict. Keep the saved account/patient contact as notification authority, never the edited visit contact.
