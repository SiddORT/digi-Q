---
name: Dependency security updates
description: Lock-resolution and peer-identity pitfalls during compatible security updates
---

Check resolved lockfile versions after parent updates; successful package-manager output alone does not prove a vulnerable transitive dependency moved.

**Why:** Named transitive updates and compatible parent refreshes retained several vulnerable lock entries even though patched releases satisfied the parents' ranges.

**How to apply:** Audit the resulting graph. Prefer a compatible parent that removes an unsafe chain; otherwise document narrowly scoped, within-range security resolutions. Do not force transitive majors merely to clear an advisory.

Align shared optional tooling peers and editor model identities instead of casting away type errors.

**Why:** Identical Vite versions acquired incompatible plugin type identities through different tsx/YAML peer contexts, and mixed ProseMirror model patch versions also broke the deck's types.

**How to apply:** Trace peer contexts and align compatible direct tooling versions, then run the canonical root typecheck across every artifact, including mockup and deck.

Preserve release-age protection when selecting a security fix.

**Why:** The registry's newest patched XML parser was too young for the existing gate, while an older patched release already satisfied both the advisory and age policy.

**How to apply:** Check publication times and fixed ranges before requesting exceptions; do not weaken the age gate just to install the latest tag.
