---
name: Registration completion recovery
description: Why clinic-owner onboarding retries must reconcile against the original committed result.
---

An uncertain clinic registration response is not a reason to submit another creation. Reconcile using the verified actor and a stable request identity before attempting any create; reject a changed payload for an already-completed request. Retain the completion receipt through later edits to clinic settings.

**Why:** The original transaction may have atomically committed the owner, clinic, locations and consultation sessions even when the browser never received its response. Retrying creation blindly either duplicates those resources or misleads the owner into registering again.

**How to apply:** When changing onboarding, completion reads, saved clinic metadata or retry handling, preserve actor authorization and the saved receipt, and keep the replay path read-only. This does not relax the single-owner or URL uniqueness rules.
