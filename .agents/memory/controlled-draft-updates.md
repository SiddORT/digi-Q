---
name: Controlled schedule draft updates
description: Paired value/validity events must compose across React Hook Form adapters.
---

Controlled draft adapters must execute functional updates against the latest
form draft, rather than transforming a captured render's props.

**Why:** The shared time input can publish both a canonical value and validity
in one browser event. Applying each callback to the same captured draft silently
overwrites the first update; scalar fields can appear correct while breaks and
queue times disappear before draft storage.

**How to apply:** Preserve functional-update semantics through the onboarding
adapter and read the current form values when applying each update. Verify
optional times after a tab change and draft reload, not just scalar settings.
