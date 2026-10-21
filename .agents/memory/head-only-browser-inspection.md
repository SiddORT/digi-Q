---
name: Head-only browser inspection
description: Metadata checks with strict restrictions on capturing queue, QR, or page-body content
---

When only metadata collection is authorized, use a browser method that returns
only requested document-head fields and does not automatically emit page-body
snapshots.

**Why:** The browser inspection tool automatically produced an accessibility/
layout snapshot containing public live-session content and a QR element, even
with a tiny viewport. A small viewport is not a privacy filter.

**How to apply:** For restricted metadata audits, prefer direct head-only
Playwright evaluation with screenshots, video and tracing disabled. Block writes,
remain signed out, use synthetic invalid tokens, and do not log bodies, QR
values or full network responses. If a tool cannot suppress snapshots, stop
that collection method rather than assuming metadata-only intent suppresses it.
