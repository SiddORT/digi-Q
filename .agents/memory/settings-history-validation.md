---
name: Settings history validation
description: Verify repeated browser navigation after cancelling an unsaved-edit prompt
---

Verify dirty-settings navigation with **Back → Cancel → Back again → Discard**,
not just the first prompt or sidebar links.

**Why:** A successful first prompt does not prove that cancellation preserves later
navigation. Static checks and sidebar links do not exercise native history traversal.

**How to apply:** When changing dirty-form history handling, confirm both draft
retention and history continuity across repeated cancellation/acceptance. Preserve
the history sequence, not merely the visible URL. Test only this changed flow when
following up a failure.

Also verify that Cancel leaves the original editor **usable**, not merely
mounted. An underlying editor can mistake interaction with the navigation
confirmation for an outside-close request and open a second discard prompt.

**Why:** A visible retained modal and unchanged URL can conceal an inaccessible
draft behind a second confirmation.

**How to apply:** Assert that the actual field remains editable after Cancel,
before attempting Back again.
