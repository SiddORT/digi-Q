---
name: Public directory sharing
description: Cancellation and cardinality boundaries for shared guest menus and automatic defaults.
---
Share public menu/default reads through the same observed query rather than separate observers that each start a nested cached request.

**Why:** Nested requests can outlive their consumers unless explicitly coordinated. A single observed query lets one consumer leave without canceling the other, while aborting when the last consumer leaves or the actor boundary clears.

**How to apply:** Keep public and staff keys separate and preserve actor and exact parent/filter scope. Automatic defaults use only the first unsearched page and wait for refresh to finish. Guest finder eligibility is the sole slugged row of a complete result; visit defaults require exactly one authorized active row. Do not fetch a full catalog merely to establish these defaults.
