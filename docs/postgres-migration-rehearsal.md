# Minimum/current PostgreSQL migration rehearsal

Run `pnpm test:migrations` from the repository root. This is an independent,
focused release check, not the broad backend regression suite.

## What it runs

- Reads the same minimum/current major declarations as appointment-detail
  compatibility: `scripts/appointment-detail-postgres-versions.json` (15 and 16).
  “Current” means the project's declared major, not latest upstream.
- Preflights both toolsets before starting either cluster. Each toolset must
  contain matching `initdb`, `pg_ctl`, and `postgres` versions. Missing, mixed,
  or wrong-major tools fail; neither major can silently skip.
- Uses `createQueueHarness({ empty: true })` to initialize a new private,
  socket-only cluster for each major, with no application fixtures or seed.
  Checks the actual server version, data directory, disabled TCP and empty
  schema before applying anything.
- Runs the actual `pnpm --filter @workspace/db run migrate` command, including
  the repository's Drizzle configuration, SQL files and journal. The explicit
  `out` path keeps that command pointed at the tracked migration directory.
- Requires every SQL file to be journaled, verifies all applied hashes and
  timestamps against the files, and reruns the command to verify a no-op.
- Verifies all ten custom ownership trigger attachments remain enabled,
  including their deferred settings. Synthetic records exercise automatic
  owner assignment, protected owner removal/deactivation, foreign-admin
  rejection, valid staff/consulting-owner writes and deferred foreign-staff
  rejection at commit.
- Stops the server and removes its temporary directory in `finally`, on either
  success or failure. Successful cleanup is explicitly reported. The shared
  helper retains the directory if stopping PostgreSQL fails, rather than delete
  files beneath a running server.

No migrations or ownership functions are replaced with simplified fixture SQL.
The test does not repair or disable guards to make the chain pass.

## Tools and safety

Set `CLINICFLOW_TEST_PG15_BIN` and `CLINICFLOW_TEST_PG16_BIN` to absolute
directories containing the corresponding tools. Without an override, the runner
uses `nix-build '<nixpkgs>' -A postgresql_<major> --no-out-link` to obtain
test-only store outputs. This does not change the application database, modules
or configured PostgreSQL major.

The runner and migration child remove inherited `DATABASE_URL` and `PG*`
variables. The migration child receives only a newly constructed disposable
socket connection URL. There is no target-database option. Never adapt this
command to accept development, hosted or production connection URLs.

This does not authorize an upgrade, deployment, production schema change or
live data inspection. It proves fresh-install compatibility only: populated
legacy backfills and hosted custom-function rollout remain separate work.

## Recorded execution

`pnpm test:migrations` passed with:

| Role | Tool/server version | `server_version_num` | Chain |
| --- | --- | --- | --- |
| Minimum | PostgreSQL 15.13 | 150013 | All 23 tracked migrations |
| Current | PostgreSQL 16.9 | 160009 | All 23 tracked migrations |

Both runs reported the selected absolute tool directory, full server version,
private socket location and TCP-disabled state. Both verified the exact ledger,
no-op rerun, ownership checks and removal of their stopped clusters. The
tool-selection negative tests also passed. Patch versions may differ on future
runs; each run must report its own evidence rather than assume these versions.
