# Notifications consolidation: development verification

## Boundaries

This record covers the existing Notifications page and its two existing write
paths. No production settings/data, messages, provider checks, migrations or
deployments were authorized or performed. A passing local check is not proof of
real delivery, inbox receipt or a production system free of errors.

## Before changes

- Inspected the actual running Preview using separate native staff sessions in
  the existing disposable PostgreSQL browser harness. `/api/me` confirmed
  Superadmin and Clinic Admin identities.
- Both roles could open `/admin/templates`, but neither had an overall delivery
  gate there. Superadmin had no activation switches. Clinic Admin had the
  standalone email wording editor.
- `/admin/settings?area=notifications` actually rendered the Superadmin Settings
  fallback, and redirected Clinic Admin to `/admin/clinic`. Neither rendered the
  old delivery matrix. This was verified at runtime, not attributed to caching.
- The focused baseline below passed **73/74** tests. The existing contract test
  expected activation confirmation in the template page even though it had
  already been removed.
- The already-running `ticket-browser-regression` workflow reported **50 passed,
  2 failed**: the obsolete activation-to-Settings link expectation, and an unrelated
  missing Playwright trace file during guest PDF cleanup. A separate attempted
  baseline command could not start because that workflow already owned its port.
  No ticket-export implementation was changed to address either issue.
- Existing disposable-database tests exercised gate, activation, revisions,
  publication/drafts, role restrictions and fake transports before UI changes.
  Full authenticated before-change save/publish/discard journeys for every role
  were not separately completed; the unavailable gate/activation UI could not be
  exercised. This is a baseline limitation, not a passing browser result.

## Reproducible checks

Run from the repository root. Do not run concurrent Playwright commands against
the same fixture server or output directory.

```sh
node --test \
  artifacts/clinicflow/src/lib/communication-routes.test.mjs \
  artifacts/clinicflow/src/lib/communication-contract.test.mjs \
  artifacts/clinicflow/src/lib/notification-template-input.test.mjs \
  artifacts/api-server/src/notification-settings.integration.test.mjs \
  artifacts/api-server/src/notification-templates.test.mjs

pnpm exec playwright test \
  --config artifacts/clinicflow/ticket-regression/playwright.config.ts \
  notification-accordion notification-management

pnpm run typecheck:libs
pnpm --filter @workspace/clinicflow typecheck
pnpm --filter @workspace/api-server typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
pnpm --filter @workspace/api-server build
```

The browser regression fixtures intercept every API call. Their stateful
fictional responses verify UI request targeting and reload behavior, not real
database persistence. The integration tests create a disposable PostgreSQL
cluster, use fictional identities and fake transports, and verify actual saved
records, authorization, conflicts, pending-job cancellation and future-only
delivery semantics.

For native authenticated Preview verification, the existing development-only
browser fixture is selected with `.local/staff-removal-browser-fixture` and the
managed API workflow. It creates its own PostgreSQL database, fake mail
transports and fictional accounts, blocks external fetch, and never opens the
normal application database. Its generated local account-information file is
ephemeral; never commit it. Remove the marker and restart the managed API workflow
after testing. This fixture does not implement every Communication read API.

## After changes

- Focused tests: **74/74 passed**.
- Browser regressions: **14/14 passed**, covering independent email/SMS and
  recipient activation, gate-off with enabled templates, scope targeting,
  inherited platform labels, saved overrides, cancellation without writes,
  pending scope locking, errors/conflicts, permission changes during confirmation,
  inherited-value changes during confirmation, required security rows, Clinic
  Admin restrictions, ordinary-role denial, saved draft preservation, publication
  preserving activation, variable validation, filters, keyboard accordions and
  1280/820/390px layouts.
- First extended browser run: **11/12 passed**. The failed assertion looked for
  an accessible scope control while a modal intentionally hid the background.
  Corrected the test to inspect the background trigger's disabled property.
  The application locking behavior did not require a fix.
- Shared-library, frontend and backend typechecks passed.
- Frontend and API production builds passed. Existing frontend build warnings
  remain: UI component sourcemap location warnings, a generated Tailwind
  `data-testid` selector syntax warning and bundle-size warnings. No unrelated
  styling/toolchain changes were made to silence these warnings.
- Public sign-in screenshot and workflow logs confirm the Preview starts without
  a manifest page failure. This screenshot alone does not verify signed-in
  management behavior.

### Native authenticated Preview pass

The final pass used fresh native sessions with `/api/me` confirming Superadmin,
Clinic Admin and Doctor roles in the disposable database. Signed-in screenshots
were inspected for both administrative roles.

- Superadmin: one scope selector; required-security explanations/locked controls;
  gate confirmation cancellation and save/reload; independent Patient and Clinic
  Admin email activation off/on cycles with reload; enabled rows stay enabled but
  blocked when the gate is off.
- Saved wording remained after activation cycles. Publication showed its explicit
  confirmation and success while retaining activation. Unsupported variables
  disabled publication. Dirty close → Keep Editing retained edits; Discard
  removed only the unsaved text.
- Dirty browser Back → Keep Editing → Back → Discard retained the prior history;
  the following Back reached the preceding Communication Logs route.
- Selecting a clinic showed inherited values; saving a clinic gate created an
  explicit override that survived reload/reselection, while the platform gate
  stayed unchanged.
- Clinic Admin: managed-clinic selector, gate off/on persistence, email wording
  editor available, event activation disabled, no SMS/System Admin rows. Direct
  Communication navigation did not expose provider credentials.
- Doctor: direct template/legacy navigation did not expose administrative
  notification controls.
- Both administrative roles' legacy `area=notifications` and `area=events` URLs
  reached `/admin/templates` without loops.
- The separate draft-only action was **not observed in this native pass**. Draft
  persistence across activation is covered by the stateful browser regression
  and disposable-database integration tests, not claimed as native-browser proof.
- Communication retained its SMS/Email/Logs tabs, but the fixture returned missing
  read APIs: Email showed unavailable, Logs showed a retryable load error, and SMS
  stayed loading. No provider check or send was attempted. Complete provider/log
  browser acceptance remains unverified; their unchanged code passed the focused
  contracts, typecheck and builds.

The disposable fixture was removed and the normal managed Preview service
restored after this pass. Fictional state/wording edits were confined to its
temporary database, not applied to normal development or production settings.

## Sample behavior to inspect

- Platform defaults / Booking / Email to Patient: saved activation is independent
  of the overall optional-delivery gate; an enabled row can show `On, blocked`.
- A clinic row sourced from a published platform template says **Inherited
  platform value**, not **Override**. After explicit local activation, it says
  **Override**. The gate has its own independent inheritance label.
- Required security rows remain checked and disabled, explain the security
  boundary, and retain provider/readiness reasons.
- The wording drawer uses fictional placeholders such as `[patient name]`; saving
  wording keeps current published activation. An unpublished draft survives an
  activation change.

## Unverified / not claimed

No live SMTP/SMS checks or messages; no production authorization/settings audit,
production browser acceptance, backlog replay, rollout or provider delivery proof.
The broader backend regression suite was not repaired or represented as clean.
