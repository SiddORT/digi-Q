---
name: Single Clinic Admin ownership
description: User-confirmed ownership rule overriding the attachment's multiple-admin possibilities
---

Each clinic must have exactly one Clinic Admin. Each doctor has one explicitly recorded original/owning Clinic Admin. A doctor-created clinic receives that same Clinic Admin automatically.

**Why:** The user explicitly rejected multiple managing admins when clarifying the role/assignment requirements on 2026-09-22. The attachment's discussion of multiple admins is superseded by this clarification.

**How to apply:** Never infer doctor ownership merely from shared clinic assignments or grant multiple admins access to a clinic. Legacy records without provable ownership require an explicit user-approved assignment before enforcing complete ownership constraints.

New Clinic Admin onboarding should create a new first clinic atomically rather than stage an identity without access. Do not silently take ownership from another admin to complete provisioning.

**Why:** Requiring an already-owned clinic creates a circular onboarding dependency under the single-owner rule. Creating both records together resolves that dependency without taking another admin's clinic.

**How to apply:** Preserve the atomic new-clinic path for new admins. Treat transfers of existing clinics as a separate explicit ownership decision, never an automatic onboarding fallback.

Doctors and receptionists must each have one managing admin, and every assigned clinic must be owned by that admin—even when Super Admin makes the assignment. For new staff, derive the manager from the selected clinics only when all selected clinics share one valid owner; do not ask for a separate manager selection.

**Why:** The user's revised user-management specification on 2026-09-22 makes the managing admin an ownership boundary, not merely a record of who created a doctor. It also extends this relationship to receptionists.

**How to apply:** Reject mixed-owner assignments and ownership changes that would invalidate existing staff mappings. Distinguish the doctor's management catalog (clinics owned by their managing admin) from operational access (actual clinic/branch assignments and own clinical relationships). A wider staff-assignment catalog must not grant wider appointment or queue access.