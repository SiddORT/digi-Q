---
name: Patient profile visibility
description: Registration visibility for doctors is separate from clinical access.
---
Doctors may read patient profiles registered in their saved, authorized Clinic Group and Clinic without an appointment. Clinic-level registrations are eligible within an assigned group; branch registrations require that exact group/branch assignment. Empty or removed assignments grant no registration access.

**Why:** Newly registered patients must be discoverable before booking, but a demographic profile must not grant another doctor's clinical data or document access.

**How to apply:** Keep patient-list and individual-profile eligibility aligned. Preserve own-doctor appointment scoping independently, and require the existing visit-based entitlement for doctor documents. Do not grant doctors patient-create/edit permissions or manufacture appointments to make profiles visible.
