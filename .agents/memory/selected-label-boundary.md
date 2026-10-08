---
name: Selected label boundary
description: Saved dropdown names are display information, separate from permission to select an option.
---
Hydrate a saved name even when its control is disabled. Keep retained names associated with the exact selected ID and actor/resource scope; never apply a previous record's label to a new value.

**Why:** Restored Doctor Queue contexts contain IDs before catalogs arrive, and the doctor's control intentionally cannot be edited. Tying name loading to editability caused UUIDs to appear. Display hydration must not make an out-of-scope record selectable.

**How to apply:** Use permitted exact detail or scoped selected-ID reads, not full catalog scans. Keep menu membership based on the scoped option list. Public and patient-facing public selectors use public scoped reads, not staff details. Failed hydration keeps the ID and exposes an explicit readable state with retry; names and submission values remain separate.

Private guest receipt recovery uses the names already carried by the receipt, not new public directory hydration.

**Why:** Receipt access is a separate private boundary. Public-directory availability or eligibility can change after booking and must not introduce a dependency into recovery of an existing private ticket.

**How to apply:** Run public name hydration while choosing or reviewing a new visit, not when recovering a committed ticket.

Selected public labels may reuse a chosen search or sole-option row, but retain its original freshness rather than granting it a new freshness window at selection time.

**Why:** Choosing a cached row is not a new server read. Treating it as newly fetched can conceal changes while optimizing slow-connection booking lookups.

**How to apply:** Reuse only the chosen record in the exact public parent and actor scope. An invalidated label must refresh rather than being replaced with an older option row.
