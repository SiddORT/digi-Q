---
name: Saved schedule context freshness
description: Fresh assignment scope when reopening contextual doctor scheduling
---

Wait for a fresh authorised doctor response when opening or reopening contextual scheduling; a previously cached profile is not confirmation of the current assignment scope.

**Why:** Browser verification exposed a reopened dialog adopting the old profile before its refetch finished. This can prevent a newly assigned location from appearing, or expose an outdated schedule target.

**How to apply:** Distinguish the initial fresh load from cached data. After the editor is hydrated, ordinary background refetches must not reset either profile or weekly schedule drafts.
