---
name: Rows-per-page preference scope
description: Persistence and precedence decisions for the optional listing-size preference.
---

The optional rows-per-page preference follows existing browser-local display preferences, scoped to the account. It is not a promise of synchronization to other browsers or devices.

**Why:** This feature extends existing display customization without silently changing defaults or introducing a new server preference system. The Profile explanation explicitly states browser scope.

**How to apply:** Preserve each surface's original default until opt-in. Explicit link sizes and applied saved-view sizes override the preference; applying either must not silently change the remembered preference. Keep cursor logs and surfaces without existing size controls out of this feature. If cross-device settings are requested later, treat synchronization as a deliberate extension rather than claiming local storage already supplies it.
