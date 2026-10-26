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

Anchor external dependency resolution to each importing workspace package,
rather than assuming the process entrypoint can resolve every transitive module.

**Why:** A read-only backend metadata bundle initially failed because PostgreSQL
was installed for the database workspace, not the API entrypoint. Loader failures
can mask healthy application code.

**How to apply:** Preserve importer-relative resolution when externalizing
dependencies in diagnostic or test bundles. Return public metadata only from
credential-bearing application helpers; never print their internal inputs.

Workspace source packages are not necessarily executable as external Node modules.

**Why:** The runtime can load TypeScript while still rejecting extensionless
imports in a source package's barrel, so adding an otherwise valid generated
schema import can fail an isolated bundle before any test executes.

**How to apply:** Explicitly bundle the workspace schema entry in isolated tests
instead of treating all workspace packages as Node-executable external modules.

Code generation and module loading are separate prerequisites; do not diagnose an
extensionless-import error as a missing generated fixture solely from Node's
“module not found” message.

**Why:** Native TypeScript loading can reject an extensionless path even when
generation produced the target. Excluding its importing test would hide a harness
failure and change the measured suite.

**How to apply:** Verify generation first, then bundle the real TypeScript import
graph while keeping shared React/provider runtimes external. Execute transient
render bundles in memory so their CSS side outputs cannot pollute source folders.
