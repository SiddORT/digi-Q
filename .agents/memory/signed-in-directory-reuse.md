---
name: Signed-in directory reuse
description: Scope and freshness decisions for sharing operational directory reads.
---
Prefer bounded shared reads when only zero/one/many is needed. Reuse a full
directory only when another consumer genuinely needs it, and only after
pagination proves it complete. Never optimize away actor/doctor intersections,
search isolation, or the distinction between optional all-location scope and
required assignments.

**Why:** Independent workspace, option, cardinality and saved-label paths caused
duplicate reads as staff directories grew. Fetching every catalog in full merely
to deduplicate would move that cost to screens that never needed it.

**How to apply:** Keep nested caches and their consumers on the same 60-second
refresh/invalidation boundary. One refresh owner is intentional; do not add
independent identity or cardinality pollers. Retain ordinary detail hydration
when a saved label is absent from a narrower picker; that absence proves only
option membership, not record unreadability. Doctor-scoped membership must still
come from authorized list results. Late canceled reads must never repopulate
shared caches after an account boundary.
