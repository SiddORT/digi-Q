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
