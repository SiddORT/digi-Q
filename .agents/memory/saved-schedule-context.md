---
name: Saved schedule context freshness
description: Fresh assignment scope when reopening contextual doctor scheduling
---

Wait for fresh authorised doctor and associated location responses when opening or reopening contextual scheduling; cached records alone are not confirmation of the current assignment scope.

**Why:** Browser verification exposed a reopened dialog adopting the old profile before its refetch finished. This can prevent a newly assigned location from appearing, or expose an outdated schedule target.

**How to apply:** Distinguish the initial fresh load from cached data. Do not label unresolved location hydration as an empty or unauthorised scope. After the editor is hydrated, ordinary background refetches must not reset either profile or weekly schedule drafts.

Freeze the verified authoring scope for a draft's lifetime; reopening is the point
at which new assignments become editor context. Server checks still use current
permissions, assignments and location configuration before every write.

**Why:** Allowing background assignment refreshes to remove the selected location
unmounts the editor and loses an unsaved draft. Freezing the presentation does not
grant permission to write under obsolete scope.

**How to apply:** Retain the draft and report actionable scope failures. Do not
silently switch an already-hydrated editor to newly returned assignments.
