---
name: Optional notification values
description: Missing optional cancellation reasons must not block cancellation notices.
---

When a cancellation reason was not entered, render "Not specified" rather than
silently dropping the value or blocking the cancellation notice. Do not infer a
reason from another action or reuse a prior cancellation after reopening.

**Why:** Cancellation reasons are optional in the existing workflow. Adding a
template variable must not turn an optional field into a notification prerequisite.

**How to apply:** Preserve event snapshot semantics and explicit absence for
cancellation templates. Do not automatically change existing message wording or
DLT approvals when adding supported variables.
