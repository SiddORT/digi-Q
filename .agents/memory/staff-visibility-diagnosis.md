---
name: Staff visibility diagnosis
description: Distinguish staff-category navigation from ownership exclusions using the actual actor and selected view.
---

Before treating a missing receptionist as inconsistent ownership, establish the
actual signed-in role and the staff category displayed in each compared page.
A clinic's Staff list and the System Users directory do not necessarily display
the same role category.

**Why:** Operator SQL showed correct ownership while screenshots initially
described as a Clinic Admin visibility failure actually compared two Superadmin
views, one scoped to Clinic Admins and the other including receptionists.

**How to apply:** Use screenshot role labels, search placeholders and column
labels as evidence of the displayed category. Keep live owner-session acceptance
separate from fixture-backed authorization tests; do not repair ownership merely
because a different staff type is selected.
