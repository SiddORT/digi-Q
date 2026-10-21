---
name: PDF fixture CSS isolation
description: Why unrelated global fixture styles can change otherwise self-contained ticket PDF snapshots.
---

Lazy-load mode-specific browser fixtures that import global styles. Do not
eagerly import their application stylesheet into the shared ticket fixture
entry point.

**Why:** html2canvas measures font metrics through the host document, not only
the rendered ticket iframe. Global image/display or text defaults can move PDF
text even when the ticket HTML, PDF renderer and QR payloads are unchanged.
Unchanged renderer source alone therefore does not prove baseline drift is an
environment issue.

**How to apply:** When PDF snapshots differ only in text positioning, inspect
new fixture imports and stylesheet leakage before updating snapshots, changing
rendering code or blaming browser/font versions. Confirm fixture isolation
with a representative single and bulk PDF comparison.
