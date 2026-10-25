---
name: Tabbed schedule validation
description: Whole-record validation must not depend on the visibility of registered controls.
---

Validate the complete schedule draft before a write, independently of the currently visible tab. Keep controls mounted for draft retention, but do not treat that as proof that every constraint will run.

**Why:** Browser regression submitted an out-of-range capacity after switching back to Schedule, despite the capacity control remaining in the form. Native checks alone did not protect a text-based numeric control.

**How to apply:** Preserve a complete-record validation boundary alongside field and native validation. Test an invalid value on an inactive panel, assert no write, and verify the panel is revealed and the field focused. Test time relationships and optional numeric bounds too.

Preserve invalid optional time intent separately from the canonical value. Empty
canonical text can mean either an intentional clear or an invalid typed time.
Only user typing or picker choices should change this draft-error state, not
mounting controls or loading inherited display preferences.

**Why:** Loading a clinic's clock format can briefly make the previous display
text fail parsing. Treating that transition as a user edit creates false errors;
conversely, dropping invalid optional input to an empty canonical value can let a
hidden-day save silently clear a setting.

**How to apply:** Resolve location/clinic formatting before mounting the editor,
retain user-originated invalid-time intent across day changes, and clear it only
when the user supplies a valid value or deliberately clears the optional field.
