---
name: Keep in Touch contract boundary
description: Supplied provider example leaves credential equality and country-code prefix unverified
---

The supplied Keep in Touch example does not establish whether countryCode includes
`+`, or whether the Bearer token equals the body apiKey. Do not describe either as
provider-verified or infer equality from a single generic placeholder.

**Why:** The user supplied the request fields and success JSON, but no actual
credentials or confirmed country-code convention. Development authorization is
limited to fictional credentials and fake transports, not real SMS sends.

**How to apply:** Keep the two protected values separate and require a deliberate
country-code format choice. Any live verification needs provider clarification,
approved credentials and a controlled recipient; never probe both formats or
automatically resend an uncertain dispatch.

SMS Settings requires both Bearer Token and Sender ID for both provider options.
Remove Status API URL and Entity ID controls from the settings page. Entity ID
is neither required nor sent for Keep in Touch.

**Why:** The user corrected the earlier optional-Sender requirement: “remove
Status API URL,Entity ID (optional)” and “bearer token and sender id are mandatory
nt optional.”

**How to apply:** Keep Bearer Token separate from API Key. Require both Bearer
Token and Sender ID in settings, readiness and dispatch, allowing existing saved
values to satisfy the form. Do not reintroduce the removed settings controls.
