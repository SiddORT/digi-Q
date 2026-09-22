---
name: Single Clinic Admin ownership
description: User-confirmed ownership rule overriding the attachment's multiple-admin possibilities
---

Each clinic must have exactly one Clinic Admin. Each doctor has one explicitly recorded original/owning Clinic Admin. A doctor-created clinic receives that same Clinic Admin automatically.

**Why:** The user explicitly rejected multiple managing admins when clarifying the role/assignment requirements on 2026-09-22. The attachment's discussion of multiple admins is superseded by this clarification.

**How to apply:** Never infer doctor ownership merely from shared clinic assignments or grant multiple admins access to a clinic. Legacy records without provable ownership require an explicit user-approved assignment before enforcing complete ownership constraints.

New Clinic Admin identities may be staged without clinic access until an explicit clinic creation or ownership transfer assigns their first clinic. Do not silently take ownership from another admin to complete provisioning.

**Why:** Requiring an already-owned clinic when creating the first admin identity creates a circular onboarding dependency under the single-owner rule. The staged identity has no existing clinic scope.

**How to apply:** Keep this staging limitation visible in onboarding and audit reports. An atomic admin-plus-first-clinic onboarding flow could remove the intermediate state without weakening ownership constraints.