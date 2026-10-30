# Focused live-ticket/receipt PostgreSQL gate

Run `pnpm test:live-tickets` from the workspace root. It checks tool selection,
matrix failure handling and arrival-estimate units, then runs the existing
public live-ticket/receipt integration file serially against **both** roles in
`scripts/appointment-detail-postgres-versions.json`: minimum PostgreSQL 15 and
configured current PostgreSQL 16. This is the same declaration and runner used
by appointment-detail compatibility, not a separate support policy.

The runner preflights both installations before starting a test child. It uses
`nix-build '<nixpkgs>' -A postgresql_<major> --no-out-link` by default, or explicit
absolute directories:

```sh
CLINICFLOW_TEST_PG15_BIN=/path/to/postgresql-15/bin \
CLINICFLOW_TEST_PG16_BIN=/path/to/postgresql-16/bin \
  pnpm test:live-tickets
```

Missing installations, mixed tools, wrong majors, assertion failures and child
process failures all fail the command; neither role is silently skipped. The
selected full version and directory are logged. The existing disposable harness
checks the actual server major and uses a fresh private Unix-socket-only cluster
with explicit local client settings and no TCP listener. Cluster subprocesses
exclude `DATABASE_URL` and `PG*` variables. It never connects to application or
hosted databases.

The unchanged integration assertions cover PDF snapshot privacy, minimal public
projection, hashed capabilities, exact-owner upgrades, invalid/expired/revoked
links, issuance scope, duration snapshots and guest receipt management. Public
sharing remains read-only and cannot substitute for guest-management authority;
revoking a shared link does not revoke the separate guest receipt.

This command is the focused gate, not a broad backend-suite repair or a change
to deployment configuration.

## Local verification

On 2026-10-30, `pnpm test:live-tickets` passed the 11 tool-selection,
matrix-contract and arrival-estimate tests, then all 8 existing live-ticket/
receipt assertions on PostgreSQL 15.13 and 16.9. Deliberate child failures in
the contract fixture are expected evidence that the parent gate fails closed,
not failures of the outer test.

`pnpm test:appointment-detail-compatibility` also passed its selector test and
all 4 focused detail tests on each declared major after sharing the runner.
