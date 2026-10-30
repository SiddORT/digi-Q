---
name: Profile demographic contract
description: Exact birth dates, approximate age and focused profile-completion boundaries.
---
Exact DOB and approximate age are distinct facts. Never fabricate a birth date from an age. An estimate is labelled with its recorded reference date; a legacy estimate with no known date stays explicitly unknown rather than being backdated or automatically presented as today's exact age.

**Why:** The user explicitly approved approximate-age completion without synthetic DOBs or invented legacy reference dates.

**How to apply:** Keep exact DOB authoritative for calculated age, preserve existing estimates separately, and require an explicit choice when replacing an exact DOB with an estimate. Confirmation must cover every removal path, not just a dedicated mode-switch button; typed deletion and calendar Clear are equally destructive on save.

Missing editable profile values use direct actions such as “Add gender” or “Add mobile number”, not “Not entered · Add…”. Completing a profile contact is not account creation, contact verification or a change to a separate visit contact.

**Why:** The user explicitly requested concise completion actions and preservation of the existing contact and permission boundaries.

**How to apply:** Reuse authorized persistence and existing fields on each surface; distinguish missing, inaccessible, loading and malformed data.

Profile completion and self-account updates must share database serialization before checking a saved baseline or merging profile data. Lock an account before its linked doctor profile, consistently across entry points.

**Why:** An advisory lock used only by completion does not protect against a self-account save waiting on a row lock. A baseline can pass before that save commits, and opposite account/profile lock orders can deadlock.

**How to apply:** For new profile writers and contention checks, coordinate the real shared rows, reread after acquiring them, and verify both acquisition orders using separate PostgreSQL connections with observable lock waits.
