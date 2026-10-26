# Read-only registration delivery diagnosis

## Scope

Inspected workspace code, development database metadata and existing API logs.
The user subsequently requested investigation of a registration verification
email rejection and explicitly approved a connection-only SMTP check.
No application code, settings, contacts, templates or credentials were changed.
No messages, registration requests, replays, worker restarts or deployments were
initiated. UAT is separately hosted; local evidence does not represent UAT.

## Onboarding SMS

- Self-registration and Superadmin-created onboarding both call
  `createOwnedClinic` inside their creation transaction. The helper captures
  onboarding after submitted setup, policies and owner sessions are saved.
  Transaction failure rolls capture back. Completed-request recovery returns
  the existing result before creation/capture, preserving no-replay behavior.
- Development `enqueueEvent` records onboarding as `not_attempted` and returns
  before SMS enqueueing. Independently, the Preview SMS worker selects only
  appointment events after its persisted start boundary. This explains why
  booking/cancellation can work while automatic onboarding does not.
- Onboarding is outside appointment default activation. SMS resolves a local
  publication first, then the platform publication, otherwise a disabled
  fallback. Drafts do not replace published content.
- At inspection, development platform SMS publications for onboarding's Clinic
  Admin and Superadmin recipients were enabled, published revision 2, with DLT
  template IDs present and no drafts. This does not prove hosted activation,
  provider approval, historical configuration or delivery.
- Development contained four onboarding SMS history entries, all source `test`
  with no clinic ID: three Clinic Admin provider rejections and one Superadmin
  provider acceptance. There were no SMS onboarding occurrence claims or
  onboarding SMS outbox rows. These test results do not establish an automatic
  registration incident or handset receipt.

### Remaining incident-specific evidence

The clinic/date identification request was dismissed. An affected registration
therefore cannot be matched to capture, a skip, a pending job, preparation failure
or provider submission. No authorized hosted history/configuration evidence was
supplied.

For an identified hosted registration, inspect its exact occurrence/outbox and
history metadata, deployed environment mode, effective template source/revision
and activation time, shared provider readiness and event-specific sender/DLT
metadata, effective clinic notification policy, recipient SMS preference and
epoch, and current active owning-admin/mobile eligibility. Onboarding also
supports active Superadmin recipients independently. Recheck recipient binding
and contact changes for pending jobs. Do not substitute current settings for
historical proof or treat provider acceptance as handset delivery.

No UAT correction is supported yet. Allowing automatic onboarding in Preview
would require separate approval to change both capture and worker restrictions;
enabling a template alone would not overcome them. Historical skipped occurrences
must not be replayed implicitly.

## Registration verification email

The supplied screenshot concerns `clinic_registration_otp`, not the later
operational onboarding event. Verification email is not covered by Preview's
operational-email suppression.

The running development API recorded `Security email unsuccessful` for
`clinic_registration_otp`, category `provider_rejected`, at
2026-10-26 08:54:11 UTC (14:24:11 IST). This is consistent with the supplied
screenshot, but no recipient identity was used to establish an exact match.

`node scripts/verify-smtp.mjs` confirmed required SMTP fields were present and
syntactically ready; the effective configuration source was `environment`,
not a database override. After explicit user approval,
`node scripts/verify-smtp.mjs --verify-connection` passed connection, TLS and
authentication verification using the shared SMTP transport options.
The check reported zero messages sent and no settings changes.

This rules out a current connection/login failure in that check, not a past
transient rejection, sender/recipient restrictions, quotas or message-policy
rejection. Sender authorization and inbox delivery remain unverified. Existing
incident logs retain only the generic rejection category, not the SMTP stage
or provider response; naming an exact cause would be speculation.

### Next evidence and correction boundary

Inspect the SMTP provider's existing activity/error log around 14:24 IST on
26 October 2026 for the original registration attempt. Request only the
sanitized SMTP reply code/reason and stage, never credentials, full contacts,
verification codes or message bodies. Do not trigger a resend to generate
evidence without separate approval. Any sender, quota, recipient, credential,
configuration or code correction requires an evidence-backed proposal and
separate approval.

## Verification limits

Read-only SQL projections, code tracing, existing runtime logs and the explicitly
approved no-send SMTP connection check were used. No regression/browser suites
were launched: this was a diagnosis, not an application change. Incident-specific
UAT conclusions and the precise historical SMTP rejection cause remain blocked
on the evidence above.
