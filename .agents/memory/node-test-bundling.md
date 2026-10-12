---
name: Node render test bundling
description: Avoid misleading React server-render test failures from ESM data-URL bundles.
---

Use a Node-compatible module boundary for bundled React server-render tests; do not assume an ESM data-URL bundle can load CommonJS dependencies.

**Why:** React's server renderer relies on Node built-ins through CommonJS. Bundling it into an ESM data URL failed before rendering and produced enormous base64 stack traces that obscured the actual error. This was a test loader failure, not an application defect.

**How to apply:** Keep React runtime imports external and use an anchored CommonJS loader for a CommonJS test bundle, or a real file-based loader that supports the dependencies. Preserve a single React runtime across the renderer and component.

Context providers and hooks must also use the same conditional package export.

**Why:** React Query's ESM and CommonJS exports can have separate context objects.
An ESM provider wrapping a CommonJS-bundled hook can fail with “No QueryClient set”
even when the tree visibly contains a provider. That is a loader mismatch, not a
missing application provider.

**How to apply:** For CommonJS render bundles, load both the provider and hook
dependency through the same anchored CommonJS loader; keep it external instead of
bundling another instance.
