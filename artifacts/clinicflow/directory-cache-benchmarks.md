# Signed-in directory request budgets

Run `pnpm --filter @workspace/clinicflow test:directory-cache`.

The deterministic benchmark uses real TanStack Query clients and synthetic
authorized records. It counts loader calls, returned rows, and serialized JSON
bytes, not production latency or compressed HTTP transfer size.

## Initial workspace and ten distinct clinic pickers

The baseline reproduces the former independent paths: one complete workspace
location list (100 rows/page), then each picker's initial options (20 rows),
sole-option check (2 rows), sole-care default check (2 rows), and saved-label
read (one row). The shared path reads the workspace catalog once and reuses its
verified clinic projections for the ten pickers, defaults, and labels.

| Directory rows | Baseline requests | Shared requests | Baseline JSON bytes | Shared JSON bytes |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 41 | 1 | 26,932 | 10,312 |
| 1,000 | 50 | 10 | 132,281 | 105,111 |
| 10,000 | 140 | 100 | 1,098,492 | 1,071,272 |

These figures describe this fixture, not every screen. Without an existing
complete catalog, twelve concurrent matching option/default consumers share
one bounded 20-row request; they do not fetch a complete directory. Distinct
searches/pages/scopes still require their own reads. Permission keys include
actor, role, actor doctor identity, and all non-transport scope parameters.
Assignment pickers share the endpoint's aggregate response across resource
kinds. Saved detail reads are shared per actor/resource/ID.

## Refresh and correctness budgets

- A 2,500-row catalog costs 25 requests initially and 25 on the next refresh,
  even when workspace, picker, cardinality, and saved labels refresh together.
  Two overlapping refresh triggers do not add another full read.
- Complete reuse expires at 60,000 ms. One signed-in refresh owner initiates
  refreshes every 60 seconds; navigation/focus refresh only stale context.
  Existing request timeouts remain 20 seconds. Browser suspension and network
  delay are not instantaneous cross-session synchronization.
- Inner page/detail/aggregate caches and outer observers are invalidated
  together. Mutation invalidation cannot reuse pre-mutation successful data.
- Native session checks supply the access gate's status response; the gate
  does not send another status request. Identity observers no longer have
  independent polling timers.
- Only complete, unsearched, fresh, successful catalogs can be reused.
  Pagination totals, duplicate IDs, changing totals, truncated pages, and failed
  refreshes are checked. The workspace reader has no arbitrary directory-size
  cutoff.
- The sole permitted cross-scope projection is an individual clinic's branches
  from a complete branch list with exactly matching actor/doctor/status/other
  filters. No broader doctor or actor intersection is inferred.
- Ordinary saved labels absent from a scoped catalog still use detail hydration;
  a missing ordinary label is not proof that its record is inaccessible.
  Doctor-scoped clinic/location membership stays authoritative and list-based.
- Inactive sole records never become defaults, optional all-location choices
  remain optional, errors retain existing selections, and sign-out cancellation
  cannot repopulate the cache with late responses.

## Verification

The focused directory/session/sole-option suite and existing lookup regression
checks pass, as does the ClinicFlow TypeScript check. The broader backend-flow
test cannot initialize its existing fixtures: missing exports `inArray`,
`isNull`, `lt`, `authRateLimits`, and `queryAppointmentCalendar`. Repairing that
suite is tracked separately; this change updates its selected-hydration wiring
assertion to follow the new shared helper without changing backend behavior.
