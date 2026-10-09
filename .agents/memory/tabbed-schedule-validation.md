---
name: Tabbed schedule validation
description: Whole-record validation must not depend on the visibility of registered controls.
---

Validate the complete schedule draft before a write, independently of the currently visible tab. Keep controls mounted for draft retention, but do not treat that as proof that every constraint will run.

**Why:** Browser regression submitted an out-of-range capacity after switching back to Schedule, despite the capacity control remaining in the form. Native checks alone did not protect a text-based numeric control.

**How to apply:** Preserve a complete-record validation boundary alongside field and native validation. Test an invalid value on an inactive panel, assert no write, and verify the panel is revealed and the field focused. Test time relationships and optional numeric bounds too.
