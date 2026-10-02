# DigiQ local API performance investigation — findings 23/35/77/89

## Result and evidence boundary

**Local measurement and confirmed list-query optimization are complete. This is not original-incident resolution, live UAT, deployed performance, network timing, or browser/render certification.** The doctor listing was already server-paginated with a constant three queries, but repeated assignment enrichment inside its SQL was measurable. Staff and branch lists also had genuine enrichment N+1 queries. Those confirmed list-only bottlenecks are fixed.

The queue GET was measured using its production handler, lock, complete-session summary and paginated entries. It has **20 SQL statements** at both page sizes in this fixture. No queue mutation, ordering, lock, privacy or summary rule was changed. Five unbounded catalog reads in its shared clinical-membership context are identified below; they were not silently rewritten in mutation/shared authorization code.

The authoritative disposition register and final status are owned separately. These measurements support closing the **local API investigation** part of 23/35/77/89, not claiming every component of the original perceived delay is resolved.

## Reproduction and isolation

From the workspace root, with the installed PostgreSQL binaries available:

```sh
node artifacts/api-server/src/performance-harness.mjs --baseline > /tmp/digiq-performance-baseline.json
node artifacts/api-server/src/performance-harness.mjs > /tmp/digiq-performance-after.json
node --test artifacts/api-server/src/list-query.test.mjs
```

- Harness: `artifacts/api-server/src/performance-harness.mjs`. Run directly, deliberately not part of the recursive test suite. `PERFORMANCE_SAMPLES` optionally changes warm samples (5–200; default 30).
- Creates and removes a private PostgreSQL 16.10 cluster through `test-support/postgres-queue.mjs` in empty mode. Unique temporary Unix-socket directory, no TCP listener, explicit local connection configuration. **Never reads DATABASE_URL, PG connection environment variables, application data, or secret values.** All seed/update statements affect this disposable synthetic fixture only.
- Production Express GET handlers for doctors, users, branches and queue are bundled with esbuild. The database import is redirected exclusively to the fixture. `requireUser` is replaced with an injected actor; production scope/filter/projection checks remain. This is a direct-handler benchmark, **not HTTP/auth middleware/end-to-end latency**.
- Baseline mode replays the exact previous `sourceSql` assignment enrichment and two GET post-enrichment blocks in the isolated bundle only. It does not roll back workspace files. Baseline replay assertions fail if the expected optimized blocks disappear. The separately coordinated #61 patient-filter repair is present in both modes.
- Seed schema uses the existing queue fixture's physical columns, primary keys and queue uniqueness indexes, plus assignment user/clinic and user/branch uniqueness indexes. `ANALYZE` runs after seeding. It is **not a full migrated-production schema**: ownership triggers, all unrelated indexes, foreign keys, extensions, pool/proxy configuration and production statistics are not reproduced. This limits extrapolation, not the same-fixture before/after comparison.
- No application workflow restart, full suite rerun, real message send or real-data write was performed.

## Hardware, data and sampling

Recorded sequential baseline then after run: Linux x64, Intel Xeon Platinum 8581C @ 2.30 GHz, **8 exposed logical CPUs**, **16,794,300,416 bytes RAM**; Node **v24.13.0**, PostgreSQL **16.10**, clang 19.1.7. Shared container hardware, not a dedicated or load-isolated benchmark host; CPU quotas, physical-host RAM, storage speed and competing external activity were not measured.

Fixture: **2 tenants; 200 clinics; 200 branches; 400 doctors; 602 users; 600 assignments; 10,000 patients; 10,000 appointments.** Admin actor owns 100 clinics and sees 200 doctors/100 receptionists/100 branches. The selected queue has **1,000 appointments**, including 200 completed and one called; the other 9,000 are in the foreign tenant. Clinic/branch naming and display preferences are deterministic; credential-state fixture strings are not usable credentials and never appear in output.

Each of nine scenarios records **one first-invocation sample plus 30 sequential warm samples**, without concurrency/load simulation. Each mode uses a fresh Node process and fresh cluster. “Cold” means first invocation of that scenario; earlier scenarios warm shared catalogs, so this is **not physical-disk/OS-cache cold boot**. The queue has no pre-timing handler probe. Medians/p95 use ordered samples, nearest-rank quantiles. Cluster startup, schema, seeding, bundling, oracle assertions and `EXPLAIN ANALYZE` are excluded from timed intervals. SQL counts include BEGIN/COMMIT/advisory lock for queue but exclude requireUser/auth/session lookup.

## Baseline → after

All times are milliseconds, rounded to two decimals. Query budgets were asserted on **every** timed invocation.

| Scenario / page size | First invocation | Warm median (30) | Warm p95 | SQL statements |
|---|---:|---:|---:|---:|
| Doctors / 1 | 101.44 → 44.90 | 69.65 → 32.21 | 78.94 → 38.87 | 3 → 3 |
| Doctors / 20 | 72.69 → 31.20 | 70.52 → 32.20 | 84.26 → 42.40 | 3 → 3 |
| Doctors / 100 | 73.22 → 32.61 | 73.38 → 32.79 | 82.81 → 39.92 | 3 → 3 |
| Receptionists / 20 | 173.47 → 54.36 | 174.18 → 56.32 | 195.66 → 63.28 | 23 → 3 |
| Branches / 20 distinct parents | 14.15 → 7.02 | 10.15 → 5.75 | 14.78 → 10.08 | 21 → 2 |
| Receptionists / 100 | 176.77 → 61.92 | 177.24 → 58.25 | 204.58 → 66.05 | 103 → 3 |
| Branches / 100 distinct parents | 23.20 → 6.31 | 25.08 → 6.53 | 38.45 → 8.27 | 101 → 2 |
| Queue / 20 from 1,000 | 128.30 → 143.72 | 91.70 → 93.09 | 110.23 → 106.73 | 20 → 20 |
| Queue / 100 from 1,000 | 98.91 → 108.86 | 104.10 → 95.18 | 118.66 → 115.57 | 20 → 20 |

Doctor-20 median improved **54%**, receptionist-20 **68%**, branch-100 **74%** in this sample. These percentages describe only this fixture/run, not a production SLA. Queue timings fluctuate without a changed queue query budget or queue implementation; **no queue speedup is attributed to this patch**.

The JSON output includes sample min/max, hardware, query budgets and plan relation rows/loops. Recorded output was at `/tmp/digiq-performance-baseline.json` and `/tmp/digiq-performance-after.json`; the table above preserves the central evidence even after temporary output cleanup.

## Confirmed bottlenecks and repairs

1. **Repeated SQL assignment enrichment (`lib/list-query.ts`).** `sourceSql` previously produced full clinic IDs and branch IDs using separate correlated aggregates, then produced separate scoped replacements. PostgreSQL plans also repeated these expressions through filtering/projection. The new listing source uses a **single lateral aggregate** over the existing assignment relation, with per-aggregate scope filters. Existing `readScope`, own-record and managing-receptionist exceptions, inactive-doctor management visibility and `clinicalMembership` definitions are unchanged.
2. **User-list credential N+1 (`routes/resources.ts` GET only).** `queryPage` already projects `passwordEnabled` from the credential column. The subsequent `withPasswordState` call queried each staff user again, including parallel queries against the same client in the baseline harness. This redundant list-only reread is removed. Detail/mutation behavior and the shared helper remain unchanged. Doctor documents typically have no `role` field, so the old helper did **not** add per-doctor credential queries; the measured doctor improvement comes from SQL aggregation, not a fabricated doctor N+1.
3. **Branch-parent N+1 (`routes/resources.ts` GET only).** Up to one parent lookup per distinct listed clinic is replaced by one bounded parent query over IDs **already on the authorized page**. Parent JSON is flattened for the existing display-preference helper. Missing parents still produce explicit 404 rather than silently inventing default rows. Empty pages issue no parent query.

Separate, untimed `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the actual page SQL confirmed less work:

| Page SQL / 20 | Execution ms before → after | Sum of assignment-scan loops | Shared buffer hits |
|---|---:|---:|---:|
| Doctors | 86.292 → 40.220 | 1,200 → 600 | 16,867 → 7,854 |
| Receptionists | 240.317 → 63.908 | 2,405 → 702 | 25,113 → 6,398 |
| Branches | 4.680 → 7.075 | 0 → 0 | 1,203 → 1,203 |

EXPLAIN execution has instrumentation overhead and is one separate sample, not the timed median. Branch page SQL itself is unchanged; the improvement is fewer parent round trips. Doctor projection still evaluates all 200 authorized rows to support exact count/search/sort semantics, so page size 1 is not proportional SQL work to one row. No pagination-before-enrichment shortcut was introduced that would change full-name search/order, counts or tenant scope.

## Queue diagnosis and remaining boundaries

`GET /queue` measured a full production transaction and maintained reservation-rank order, CURRENT/NEXT, version and complete-session counts, despite only returning one page. Its authorization context calls `isClinicalMember` → `clinicalBranchIds`, which performs unbounded reads of **doctors, users, assignments, branches and clinics**. The harness records these five table names; they do not escape as response data. They account for five of the 20 statements but their individual latency contribution is **not separately timed**. This is a concrete broad-query inventory, not a claim those queries caused the UAT delay. That helper is shared with non-list authorization/mutation paths and was outside the agreed listing-only ownership; no speculative rewrite of safety guards was made.

Network round trips over TCP/HTTPS, session verification, browser rendering/hydration, retained-content refresh visuals, real-data cardinality/skew, locks under contention, patient-mode queue, multiple sessions, connection-pool saturation and deployment hardware remain **unmeasured**. First-load skeletons are not evidence of latency reduction. Existing contention evidence is not rerun or relabeled as a performance trace.

## Regression evidence

- Both baseline replay and optimized harness finished successfully; **279 measured handler invocations per mode** (9 × 31), with constant expected query counts checked each time and no measured GET DML.
- Assertions cover authorized totals, doctor ordering, page boundaries, tenant isolation, password-enrollment boolean/no credential serialization, parent display inheritance, scope/label parity for Super Admin/Clinic Admin/Doctor, queue rank order, fixed current/next/version, full counts despite pagination, response stability across reads, and explicit rejection of a foreign-scope queue.
- #61 repair in `queryPage`: patient clinic/branch filtering now matches registration **or the same authorized visit**, while retaining `readScope`, actor operational scope and doctor's own appointment restriction. Harness regression asserts foreign registration/local visit discovery, foreign location exclusion, other-doctor exclusion and incompatible location dimensions. Disposable fixture-only updates occur after timed measurements.
- Targeted `node --test artifacts/api-server/src/list-query.test.mjs`: **12/12 passed, zero skipped**, including the coordinated diagnostic worker's booking-patient/location regression and existing all-role SQL vs legacy scope oracle. No claim of a new full-suite result.
- API-only `pnpm --filter @workspace/api-server typecheck` and harness `node --check` passed. Already-running preview `/api/healthz` showed `{"status":"ok"}`; this is a liveness check only, not evidence that the preview has rebuilt these changes or that protected UI renders correctly.
- Baseline emits pg's same-client parallel-query deprecation warning because it deliberately retains the original per-user `Promise.all` rereads. Optimized execution does not emit that warning.

### Follow-up: stale repository double, not missing production enrollment state

The parent's subsequent root run reported 332/333 passing, with `backend-flow.test.mjs`'s staff-enrollment assertion receiving undefined. Its isolated `queryPage` double called `enrich()` but did not reproduce production `documentSql("users")`'s `passwordEnabled = password_hash IS NOT NULL` projection; the old redundant credential reread happened to mask that omission. Production SQL and the real PostgreSQL performance/SQL regressions already proved the boolean and privacy contract.

The double now derives **only the boolean** from its raw fixture account before returning safely serialized users/doctors; no credential is added to response records. The existing privacy assertion is retained and now also checks that every listed user has a boolean. **Full targeted backend-flow file: 38/38 passed, zero skipped (1.37 seconds).** No production query rereads were reinstated, and no new root/full-suite result is claimed.