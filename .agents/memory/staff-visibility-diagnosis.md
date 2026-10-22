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

For the reported Kushan Clinic owner-booking problem, take consulting consent as
already supplied: the owner selected “also consults as a doctor,” and the failure
was an empty Doctor dropdown in Clinic Admin → New Booking. Do not ask the user
to repeat those facts or infer that the checkbox was omitted.

**Why:** These were explicitly supplied facts in the reported failure. Fresh
fictional onboarding success cannot establish the historical cause or repair of
that deployed clinic.

**How to apply:** Trace persisted self-owned doctor/location membership, actual
authenticated directory request/response, and rendered selection to the first
proven divergence. Do not broaden administrator consultation eligibility or
automatically repair live records merely because the symptom was reported.

Multiple authorized staff roles use the same booking route. Establish the
authenticated identity and preserve each reported actor as a separate case.

**Why:** Identical routes and clinic/location labels do not establish identical
identity, authorization or saved IDs. Additional actor evidence does not retract
an earlier report from another role.

**How to apply:** Compare exact authenticated requests for Super Admin and the
owning Clinic Admin separately. Do not turn successful fictional native-session
checks into a claim that UAT's saved data or reported JWT adaptation is fixed.
