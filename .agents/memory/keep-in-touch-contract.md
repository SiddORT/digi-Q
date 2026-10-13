---
name: Keep in Touch contract boundary
description: Supplied provider example leaves credential equality and country-code prefix unverified
---

The user's successful Postman example uses a digits-only countryCode and distinct
Bearer authorization and body apiKey fields. Never infer that the credentials
are equal. Keep the deliberate country-code format choice for existing settings.

**Why:** The user supplied a successful Postman example to debug portal SMS.
This does not authorize real SMS sends during development; use fictional
credentials and fake transports rather than copying their supplied values.

**How to apply:** Keep the two protected values separate and require a deliberate
country-code format choice. Any live verification needs explicit approval,
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

Keep in Touch's demonstrated HTTP 200 response uses boolean `Success` and its
observed response time exceeded ten seconds. Accept capitalized `Success`
alongside lowercase compatibility, but not strings or conflicting aliases;
allow a bounded thirty-second KIT request.

**Why:** The portal's lowercase-only response check and ten-second deadline
were incompatible with the user's working Postman response.

**How to apply:** Use the shared transport for explicit tests and triggered
events. Preserve unknown outcomes without automatic retry, and do not equate
provider acceptance with confirmed handset delivery.

Check the selected provider as well as credential presence when investigating
an authentication rejection. A Keep in Touch endpoint saved under Custom API
does not activate the dedicated KIT JSON/Bearer contract, even if settings report
syntactic readiness.

**Why:** Portal tests returned HTTP 401 while safe settings metadata showed the
KIT endpoint selected as Generic. Presence checks alone did not reveal the
request-contract mismatch.

**How to apply:** Inspect only public readiness metadata and sanitized log
outcomes. Offer an explicit draft preset correction requiring ordinary
administrator confirmation; do not inspect credential values, silently rewrite
saved settings, or use real SMS sends to probe the cause.
