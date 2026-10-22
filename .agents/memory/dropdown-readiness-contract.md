---
name: App-wide dropdown readiness
description: Product scope and boundaries for dropdown loading across all modules and roles.
---
Dropdown readiness is an app-wide contract, not limited to clinic details,
doctors, patients, staff, booking, and appointments. Include applicable filters,
tabs, dialogs, public visitors and custom roles. Start permitted first-page
reads on the owning page/form's entry, and dependent reads when the required
parent scope is available.

**Why:** The user explicitly identified those six areas as examples, not a
scope limit. Existing mounted shared pickers were already eager; lazy owners
and misleading states must be distinguished from the picker itself.

**How to apply:** Preserve bounded actor/scope-aware sharing, saved labels and
public-safe endpoints. Readiness must not mutate hidden drafts, create arbitrary
first-row defaults, open menus, fetch unrelated screens, or convert optional
aggregate filters into mandatory parent selections. Keep incident-specific
diagnosis separate; directory readiness is not evidence for an incident cause.
