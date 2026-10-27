---
name: Audit report durability
description: Preserve reviewable audit evidence outside ignored local-only directories.
---

When an audit must be delivered under `.local`, also preserve its release-verification
evidence in a normally tracked documentation report.

**Why:** Completion commits omitted the ignored `.local` report even after forced
staging, leaving the reviewer without the actual observations and limitations.

**How to apply:** Keep the requested local deliverable, but confirm that a tracked
documentation companion containing the substantive evidence appears in the
completion diff. Do not infer durability from a successful forced staging command.
