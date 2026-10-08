# Saved clinic assignment regression verification

Date: 2026-10-08. No deployment or live-database fixture writes.

## Operational boundary

- Saved patient registration is fixed for ordinary staff; demographic updates omit its clinic/location IDs. The server rejects null, blank, foreign and forbidden moves.
- New forms use a verified workspace/booking context or a sole permitted option. Multi-location first use asks for a choice; a valid remembered choice is retained.
- Cardinality uses unsearched scoped totals, not a searched page. Loading/failure/partial results never auto-select or clear a value.
- Doctor-specific clinic/location queries intersect active clinical membership and actor access. Detail hydration is not treated as membership evidence.
- QR's optional all-location/all-doctor semantics and authorised configuration/assignment flows remain available. Schedule creation queries assignments rather than bookable sessions.
- Unchanged projected mapping arrays do not recreate clinic-wide links. Intentional changes retain unchanged link IDs. Common doctor/account fields, including name, mobile, address and profile photo, update transactionally.
- Profile refresh merges untouched fields while preserving dirty drafts. Successful profile saves publish their response before marking submitted fields clean.

## Focused automated checks

All of the following passed:

```sh
node --test artifacts/api-server/src/saved-assignments.integration.test.mjs
node --test artifacts/api-server/src/users-administration.integration.test.mjs
node --experimental-strip-types --test artifacts/clinicflow/src/lib/sole-option.test.mjs
node --test artifacts/clinicflow/src/components/workspace-branch.test.mjs artifacts/clinicflow/src/staff-controls.test.mjs artifacts/clinicflow/src/staff-input.test.mjs
node --test artifacts/clinicflow/src/components/saved-scope.test.mjs artifacts/clinicflow/src/components/scope-completion.test.mjs artifacts/clinicflow/src/components/clinical-branches.test.mjs
pnpm --filter @workspace/clinicflow typecheck
pnpm --filter @workspace/api-server typecheck
PORT=8099 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
git diff --check
```

The focused API suite uses migrated disposable PGlite with actual resource/identity routers and SQL. It checks exact saved registration, doctor/actor intersections, totals under pagination/search, missing/inactive assignments, separate doctor-identity readback, account/profile synchronisation, stable entity/link IDs after repeated saves, unchanged branch-only mappings, explicit scope changes, historical appointment JSON preservation and explicit location contact overrides. It is not a PostgreSQL lock-contention proof.

Unit/source-wiring regressions check failed/incomplete sole-option resolution, absence of first-row defaults, fixed accessible fields, new-editor scope handoff, optional QR scope, unchanged assignment payloads, and live-profile draft-preserving refresh wiring. They complement, not replace, rendered acceptance.

## Rendered acceptance and freshness

See [the browser report](saved-assignments-browser.md) for actual password-authenticated Clinic Admin, receptionist, doctor, Super Admin and isolated administrator observations.

The active signed-in context refresh interval is **60 seconds plus successful request latency**, with additional navigation/focus refresh and some location/directory queries polling at 30 seconds. This is not real-time transport or an unconditional guarantee during a network failure, a throttled/background tab or a paused browser. The first browser observation refreshed updated location labels in **24,625 ms** without navigation/focus while retaining an unsaved profile draft. The targeted stale-profile correction passed: untouched name input and header refreshed in **28,203 ms** with an unsaved photo draft intact; after a successful profile save, a further administrator change refreshed the now-clean name field in **28,675 ms**. Navigation readback also remained current.

Both managed preview workflows were restarted after code batches and returned clean startup logs. The public preview screenshot rendered normally. No public discovery, booking confirmation, queue, deployment or email-delivery rules were changed.
