---
name: Appointment presentation boundary
description: Approved Booking composition and truthful History states during accordion refinement.
---

Keep the approved Booking composition and safety behavior when simplifying appointment details. Remove surrounding summary repetition only where a parent row supplies the context; standalone views still need identity and visit context.

**Why:** The user approved the Booking layout and explicitly limited accordion refinement to existing standard UI conventions, not a new theme, card design or appointment workflow.

**How to apply:** Preserve editing, ticket controls and status information; retain full-value access, hidden-column data and reference copying even when reducing duplicate summary text.

A genuinely empty History is different from missing private data, loading or failed authorization. Never discard a recorded initial waiting event or invent events from the current status to fit an empty-state design.

**Why:** The supplied history reference contained a real initial waiting event; the requested empty state applies only when there are zero actual records.

**How to apply:** Use authorized recorded events and configured timestamps. Keep backend lifecycle/history semantics separate from presentation changes.

Patient demographics and actor display names belong to the independently permission-checked *private detail* read, not the reusable appointment view used by lists, tickets and guest receipt management. Patient profile editing has its own registration/self authority; seeing an appointment or a demographic profile never grants editing.

**Why:** The screenshot requests richer private cards and attribution, but a shared booking serializer also serves capability-based and list contexts. A current actor account role/name is not automatically a historical role/name, and a reschedule's current session does not establish prior session coordinates.

**How to apply:** Add narrowly selected details only after the exact-visit authorization check, keep public and list serializers unchanged, retain recorded actor role/session snapshots when genuinely present, and show missing/anonymized data explicitly.

New reschedule name snapshots describe the moment of the move, not the original booking. Do not reuse a potentially older booking label or reconstruct legacy events from today's directory.

**Why:** Booking-time caches and later directory renames represent different points in time. The approved scope preserves names for new moves only, with no backfill or revival of erased staff attribution.

**How to apply:** Capture source and destination labels at the move; retain explicit missing-name and removed-doctor states in private History. Keep those labels out of shared list, ticket and guest receipt responses.
