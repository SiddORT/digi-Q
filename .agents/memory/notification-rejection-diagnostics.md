---
name: Notification rejection diagnostics
description: Safe provider error categorization and rejection retry boundaries.
---

Provider responses may echo credentials, recipients or entire messages. Only
approved, fixed-text error categories may be displayed or retained as rejection
diagnostics; unknown responses must stay explicitly unspecified.

**Why:** The user encountered HTTP 200 with a negative provider result, but the
generic failure message could not identify the cause. Passing through the raw
provider error would risk exposing unrelated sensitive values.

**How to apply:** Classify acceptance independently of diagnostic text. Retain
only a safe category and HTTP status with the durable request claim so a replay
can explain the same failure without dispatching again. An explicit provider
rejection may offer a new, manually confirmed test; accepted or uncertain results
must not offer that shortcut. Never change DLT settings or send live tests merely
to discover an error reason.

Distinguish ClinicFlow request failures from provider outcomes. Display fixed,
safe request-status explanations rather than raw exception/response text. Only
recognized, pre-dispatch request failures may claim this attempt was blocked;
network and server errors must retain original-request duplicate protection.

**Why:** A test request blocked by ClinicFlow throttling looked like another SMS
delivery failure because the interface hid its HTTP status. A generic server
failure, unlike local throttling, does not prove nothing was dispatched.

**How to apply:** Keep request-error and provider-result feedback separate.
Reconstruct wait times only from the known rate-limit response format, and never
automatically retry a real-message test.
