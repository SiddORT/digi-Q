# Appointment detail loading — verification, 2026-10-27

## Proven boundary and cause

The supplied UAT screenshot shows an **open row with a private-detail error and
Retry Details**, not a failed accordion interaction. The tabs depend on
`GET /api/appointments/:id`; that route authorizes the exact visit, then reads its
first embedded-history page before projecting private patient/actor information.

Before the correction, calling that route against a dedicated socket-only
**PostgreSQL 15.13** cluster with fictional Super Admin, waiting and cancelled
visits raised the same database exception in both cases:

```text
SQLSTATE 42883
function pg_input_is_valid(text, unknown) does not exist
```

`select to_regprocedure('pg_input_is_valid(text,text)')` returned NULL on 15.13.
The function exists on the checked PostgreSQL 16.10 and 17.6 servers. The route
failed during history paging, before private-detail enrichment, independently of
cancelled status or Super Admin permissions. The new regression explicitly checks
the missing-function condition when run below PostgreSQL 16.

**This is a reproduced compatibility defect, not a confirmed diagnosis of UAT.**

## Hosted evidence and remaining limit

- A read-only HEAD of `https://uat.digi-q.in/admin/appointments?size=20`
  returned HTTP 200 from nginx. This proves only that the application shell is
  reachable.
- An unauthenticated GET of
  `/api/appointments/fictional-detail-compatibility-probe` returned HTTP 401,
  `{"error":"Sign in required","code":"REQUEST_FAILED"}`. No real appointment ID
  or privileged session was used.
- This fork reports no connected Replit deployment. There is no available
  authorized UAT browser session or connected read-only VPS diagnostic channel.
  UAT's authenticated detail response, server exception and PostgreSQL version
  have **not** been inspected.
- No UAT database/schema/server changes, database upgrades, real appointment
  edits, message delivery or publishing were performed.

An authorized operator still needs to correlate an authenticated failed detail
request's status with its sanitized server exception and `SHOW server_version`
on that same UAT database, then check waiting/cancelled expansion after an
independently authorized rollout. Do not infer hosted repair from this report.

## Narrow correction

- Replace the PostgreSQL-16-only input validator with PostgreSQL JSONPath's
  silent datetime parser. Accept calendar-date/ISO timestamp input, normalize a
  terminal UTC `Z` to `+00:00`, and cast only successfully parsed dates/timestamps.
  The normalization matters: automatic JSONPath parsing rejects fractional-second
  `Z` input on the checked servers unless normalized.
- Bad dates, bad offsets, time-only strings, infinities, missing/null values and
  other malformed legacy values sort as unknown times rather than aborting the
  private-detail request. Valid timestamps compare by actual instant, not text.
  Legacy unzoned timestamps retain the database-session timezone interpretation;
  no new timezone policy or historical backfill is introduced.
- Keep SQL-side expansion/order/limit: at most 31 events are transferred from SQL,
  with 30 returned per page, newest instant first, then original JSON ordinal
  descending. Unknown times sort last with the same ordinal tie-breaker.
  No full-history application-memory workaround or DDL is needed.
- Preserve exact-visit authorization before all history reads, page-scoped actor
  lookup, actor/doctor erasure and missing-versus-empty history.
- A focused privacy check also found raw history actor IDs in staff list
  responses. The shared serializer now removes actor IDs and display names for
  staff too; authorized attribution still comes from private detail. Existing
  list/write/receipt snapshot-label stripping remains unchanged.
- No accordion, tab, lifecycle, authentication or permission changes. Initial
  failure still renders Retry Details, never list-data replacement.

## Focused verification

All fixtures are fictional and use disposable databases, never the workspace or
hosted database. Socket cluster tools (`initdb`, `pg_ctl`, `postgres`) must all
come from the same PostgreSQL installation. To repeat a version-specific check:

```sh
PATH="$PG_BIN:$PATH" node --test \
  artifacts/api-server/src/appointment-detail-loading.integration.test.mjs
```

`PG_BIN` is the local bin directory for the version being checked, not a database
URL. PostgreSQL 15 was installed only as a local verification tool; that temporary
environment configuration was removed afterward. No application database version
or checked-in toolchain requirement changed.

| Check | Result |
| --- | --- |
| New detail-loading regression on PostgreSQL 15.13 | 4/4 pass |
| New detail-loading regression on PostgreSQL 16.10 | 4/4 pass |
| New detail-loading regression on PostgreSQL 17.6 | 4/4 pass |
| Detail-loading, booking, movement and live-ticket suites on 15.13 | 43/43 pass |
| Detail-loading and booking suites on 16.10 | 16/16 pass |
| Focused rendered appointment checks | 4/4 pass |
| `pnpm run typecheck:libs` then API-server typecheck | Pass |
| API workflow restart/build/start | Listening successfully, no startup exception |

The new backend cases exercise real HTTP 200 + `Cache-Control: no-store` from the
production appointments router, with a fixture actor injected only in the
disposable test app. They check Super Admin waiting/cancelled records, private
demographics, fractional UTC and offset normalization, leap dates, malformed and
missing times, more than 30 equal-time events, and enough unknown-time events to
cross a null-time cursor boundary. Across pages, every event appears exactly once
in the expected order. Foreign-patient/out-of-scope staff detail and history reads
remain forbidden. List responses exclude private demographics, actor identity and
historical display labels. Existing live-ticket/receipt checks confirm public
capabilities do not gain private fields.

Rendered checks use the real components and existing styles with intercepted
fictional API responses, not a signed-in UAT session:

```sh
pnpm test:tickets appointment-details.spec.ts \
  --grep 'Super Admin (waiting|cancelled) expansion|loading, QR and queue retry|row, off-page link' \
  --workers=1
```

Both status cases start with a 503 private-detail response: no tabs/private
record/false-empty history render. Retry Details restores Booking/Details/History.
An older-history 503 retains the latest event and offers retry; retry appends the
older page once and removes the paging button when exhausted. Existing checks
also cover shared off-page/calendar tabs and preserving the chosen tab through a
refresh failure.

The focused run reused the already-running ticket fixture server. For future
runs, let an existing suite finish first, or isolate its port **and** output/report
directories. The broader ticket workflow that was already running reported one
booking-draft assertion failure and two missing trace-file failures; the focused
run shared its output directory and can account for the latter. This report does
not claim a clean full browser suite from that run or change unrelated tests.

The ordinary Preview screenshot of `/admin/appointments?size=20` displayed the
expected Staff Login with no browser runtime exception. It is a startup check,
not signed-in acceptance; rendered expansion evidence is from the fixture tests
above.
