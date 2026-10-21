# Communication Usage: observed activity, not a billing ledger

## Scope and coverage

Reports → Communication Usage is read-only for real Super Admins and the
currently persisted owning Clinic Admin. An administrator who owns multiple
clinics can read their combined owned-clinic activity; explicit clinic filters
must stay within that current ownership set. The existing clinical report and
Super Admin Notification Logs/provider administration remain separate.

Operational email/SMS outboxes, patient appointment-confirmation capture,
operational skipped decisions and manual provider/template tests write best-effort
notification history. Available old mail/SMS outboxes supply partial legacy
metadata when no captured history (including a permanent erasure marker) exists
for their history key. They never supply reconstructed message text or contacts.

Native authentication emails (verification, password recovery, invitations,
patient codes), security SMS and direct security transports do **not** all enter
operational history. This report does not instrument those paths. Missing
records, earlier purges and sends that failed to be captured cannot be recovered.
Zero matching recorded activity is not proof of zero sends.

## Counts and dates

One retained history key is one recorded notification/channel/recipient
occurrence. Retries and timeline transitions update that occurrence, not the
count. Different recipients or channels are separate records. Counts do not
represent appointments, SMS segments, delivered messages, provider credits or
billable usage.

The occurrence timestamp is the original `createdAt`, not dispatch, completion
or the latest status transition. Summary and records use the exact same filters,
source union, effective status and snapshot. Unknown timestamps remain accessible
in all-time results and sort after known timestamps; an explicit time bound cannot
match an unknown time. Dates are ISO timestamps with explicit offset. UI presets
and custom inputs use Asia/Kolkata, consistent with Notification Logs, with
inclusive bounds. Last 7/30 days include today and the previous 6/29 local days;
Current month is month-to-date. Omitted bounds are open-ended; there is no earliest
date, maximum range or required date filter.

| Bucket | Recorded status |
| --- | --- |
| Provider accepted | provider_accepted; not confirmed delivery |
| Pending / in progress | pending, sending within five minutes of a recorded claim |
| Failed | provider_rejected, pre_dispatch_failed, configuration_failed, preparation_failed |
| Unknown | delivery_unknown, unrecognized/missing status, sending older than five minutes or without a claim time |
| Skipped / not attempted | disabled, obsolete, no_recipient, not_attempted |

Manual tests are excluded by default. Only Super Admin can select the separate
test source. The earliest available timestamp is informational and scope/source
specific, independent of date/status/event/channel filters; it is never a cutoff.

## Attribution and safe projection

Attribution uses explicit recorded clinic source coordinates only, never a name,
contact match or a current doctor/administrator assignment. Clinic attribution is
restricted to automatic operational events and operational recipient groups. A
captured record without historical source provenance stays unattributed; a
partial legacy outbox is itself the operational source. Platform/security events,
manual tests and unproven envelopes are not made clinic-visible even if they
contain a clinic ID. Source provenance here establishes capture provenance;
existing signed account-erasure provenance and privacy safeguards are unchanged.

Every clinic read joins against the current database ownership set, not cached
`clinicIds`, including direct detail requests. Scope is rechecked inside the
read statement so ownership changes cannot open another clinic. Demo identities
cannot enter the report. Denied foreign detail requests do not reveal whether
the record exists. Clinic users cannot select tests, platform or foreign clinics.

The Communication Usage tab is clinic-scoped, not active-location-scoped, and
remains available when location lookup fails, returns no active locations or
requires a selection. The clinical-report tab retains its original location gate.

Summary/list SQL projects metadata only and never scans decrypted bodies. Detail
is lazy and read-only: timestamps, status, recipient group, masked contact and
allowlisted diagnostic information only. Neither role receives message bodies,
credentials, security codes, reset links, private booking links, provider settings
or resend controls through this report.

## Retention, pagination and scale

Notification history no longer has an age cutoff or automatic age deletion.
The old cleanup entry point is intentionally inert and the worker no longer
calls it. Permanent account-removal erasure markers and independent occurrence,
dispatch and test idempotency claims are preserved. No deleted data is restored.

Each response contains at most the requested 1–100 metadata records, with
deterministic descending occurrence-time/ID keyset pagination. Unknown timestamps
use a stable null sentinel. Newer inserts do not shift the next-page boundary.
Summaries cover the entire matching set, not a capped sample. Counts and page are
produced by one database statement/snapshot. The existing partial history
time/scope indexes, legacy time index and primary-key deduplication index support
the retained sources. Exact all-time aggregation still scales with matching
metadata volume; there is no hidden query cutoff.

The disposable integration benchmark exercises 20,000 additional fictional rows,
whole-set aggregation, bounded response bytes, cursor ties and concurrent inserts.
Measured subsecond execution did not justify a separate mutable summary store,
which would introduce status-update and privacy-erasure consistency risks.
Deployment-specific capacity is not established by the disposable benchmark.
