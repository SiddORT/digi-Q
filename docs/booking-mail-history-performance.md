# Owner booking email history query plans

## Scope and safety

The read-only owner endpoint retains its existing OpenAPI page/pageSize contract,
current-owner join, active-workspace authorization, response allowlist, timestamp
ordering and ID tie-break. No dispatch logic, retry eligibility or history payload
is changed. The index does not contain snapshots, recipient identifiers or email
content.

Migration `lib/db/drizzle/0017_booking_mail_history.sql` and the Drizzle schema
declare the same partial B-tree index: clinic ID, numeric createdAt descending
with nulls last, then ID descending. Only booking outbox records for the
clinicAdmin recipient group enter it. State is deliberately not a predicate:
pending, durable sending claims and terminal uncertain outcomes remain visible.

The migration is additive and replay-safe. It was applied only in disposable
tests, not the application's development or production database. Use the
project's approved schema rollout process. Standard CREATE INDEX takes a write
lock while building; schedule a maintenance window for large installations,
or arrange a separately approved concurrent build outside migration transactions.
Do not delete history to accelerate index creation. The preexisting history
query and index both expect eligible non-null createdAt values to be bigint-castable.

## Reproducible plan assessment

Run:

```sh
node --test artifacts/api-server/src/booking-mail-history-plan.test.mjs
node --test artifacts/api-server/src/booking-mail-outcomes.integration.test.mjs artifacts/api-server/src/notification-templates.test.mjs
```

The plan regression creates a private socket-only PostgreSQL 16 cluster and applies
the actual migration journal. It never reads DATABASE_URL or sends email. The
pre-index baseline drops only the index in that disposable cluster; it never
deletes outbox rows. Its 220,000 fictional outbox records include:

- 200,000 records distributed across 100 other clinic IDs, mixed events and
  recipient groups, with 600-character snapshot payloads.
- 20,000 owner booking records in the selected clinic, including sending and
  delivery_unknown states, timestamp ties and null timestamps.
- An unrelated setting with a nonnumeric timestamp, excluded by the index predicate.

The test captures SQL from the actual service rather than maintaining a query
copy. It uses EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), with normal planner
settings and fresh ANALYZE statistics. It reapplies the index migration twice
and verifies a count and ordered full-payload digest across all settings are
unchanged. It checks index clinic equality, no settings-wide sequential scan,
no sort, unchanged first-page results, null ordering and deterministic tie-breaks.

One local sample (instrumented timings, not a production SLA):

| Read | Execution ms | Root shared buffers | Settings rows read |
| --- | ---: | ---: | ---: |
| First page before index | 73.522 | 64,723 | All 220,000, parallel scan/filter |
| First page after index (20 + 1) | 0.307 | 49 | 21 |
| Middle page (page 101, size 50) | 23.199 | 10,785 | 5,051 |
| Last page (page 400, size 50) | 50.478 | 42,690 | 20,000 |
| Owned clinic without history | 0.080 | 3 | 0 |
| Beyond history (page 10,000, size 50) | 24.723 | 42,690 | 20,000 |

Before indexing, PostgreSQL scanned settings and sorted the matching history.
After indexing, all measured reads used the partial index with clinic equality
as an Index Cond and no sort. The first-page test requires at least a tenfold
buffer reduction, not a fragile wall-clock threshold.

## Remaining boundary

The unchanged numeric-page API uses OFFSET. Deep pages still visit the skipped
rows within that clinic's owner history; the index prevents scanning unrelated
clinics but does not make arbitrary deep offsets constant-cost. A future cursor
contract would require explicit API/client work and is not silently introduced
here. Production hardware, real payload sizes, write load, replication and
concurrent index rollout are not covered by these isolated measurements.

Running the endpoint regression also exposed preexisting generated Zod constants
declared after their use, breaking the documented omitted-pageSize default and
library typechecking. Regeneration restored the existing OpenAPI values and
declaration order without changing the contract.
