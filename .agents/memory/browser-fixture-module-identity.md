---
name: Browser fixture module identity
description: Reusing live Vite components in read-only browser fixtures requires identical dependency module identities.
---

Injected browser fixture providers must use the same resolved dependency module URL as the live components, including Vite's version query. An unversioned import can create a different context identity even when it points at the same package.

**Why:** A directly mounted visual fixture rendered stateless controls but failed when a notification component consumed its query provider; the provider and consumer had loaded distinct module instances. Such a harness failure is not evidence the application's notification panel is broken.

**How to apply:** When mounting existing components without changing application source, obtain shared dependency imports from the current transformed module instead of guessing optimized URLs. Isolate each query-state fixture with a fresh provider identity so an earlier empty result cannot masquerade as loading or error evidence. Keep all API traffic intercepted and block mutations for read-only audits.

A separate-root browser fixture must explicitly scan the application's sources
for utility CSS, including components loaded only after an interaction.

**Why:** Importing the real app entry did not guarantee complete styles in a
separate Vite root. Ordinary pages rendered, but lazy dialogs lost positioning,
translation and stacking utilities and appeared below the viewport. That was a
fixture omission, not proof the application dialog was broken.

**How to apply:** Match the real global stylesheet order and source scanning
before interpreting missing dialog/menu styles as an application regression.
Verify an actual opened overlay, not only its DOM presence or initial page.
