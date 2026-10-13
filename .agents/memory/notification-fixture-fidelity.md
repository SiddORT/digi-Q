---
name: Notification fixture fidelity
description: Persist production-valid appointment records when testing template dispatch, not only valid-looking event payloads.
---

Use production-valid persistent records in notification regression fixtures, not
just correctly shaped event payloads. Exercise both event capture and dispatch
after database hydration.

**Why:** Direct enqueue tests can consume a complete event snapshot while the
separate patient booking path reads the saved record. A permissive disposable
schema allowed incomplete persistent attributes that production forbids, hiding
the distinction until the booking-render test failed.

**How to apply:** Populate required persistent attributes as well as JSON
snapshots, respect appointment uniqueness, and keep send-callback assertions
outside callbacks whose errors are intentionally converted to delivery outcomes.
Use fictional data and fake transports; never compensate with live SMS probes.

Include ordinary-length and multi-line messages in transport regression fixtures,
not only short smoke-test strings.

**Why:** Short fixtures hid a cross-layer boundary error: message content was
accidentally subject to an identifier-only size/format check. Direct provider
tests and complete-template dispatch did not exercise the same inputs.

**How to apply:** Test both explicit template tests and automatic event dispatch
with complete templates, rendered text and fake provider requests. Assert exact
outbound message preservation and continued validation of the actual identifiers.

Network isolation must replace the actual dispatch boundary, not just a convenient
high-level HTTP API.

**Why:** A global fetch double did not isolate the SMS client's pinned Node TLS
transport. Fictional credentials are not a substitute for preventing network dispatch.

**How to apply:** Use an explicitly injected sender or a transport-module double in
authentication/notification fixtures. Keep real configuration and payload validation
where possible, but prove the test cannot reach provider endpoints before running it.
