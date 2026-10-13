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
