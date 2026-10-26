# Booking reference layout — local evidence

## Scope and acceptance

The first supplied image is the approved hierarchy; the second is the rejected
fragmented layout. This work changes booking presentation only, not allocation,
permissions, assignment scope, automatic defaults, schedules, notification delivery
or contact-proof policy. Example names, dates, timezone and capacity remain data.

- Visit title and compact horizontal progression precede the visit section.
- Source controls stay at the right of the heading where permitted.
- Context/timezone and server-authorized schedule management share a slim band.
- Clinic group, Location, Doctor, Visit date and Session share a responsive row.
  Missing/fixed-context parent controls do not reserve empty columns.
- A sole session is read-only at field scale. Multiple sessions still require
  explicit selection; closed controls show hours, while options retain capacity,
  mode, eligibility and unavailable reasons.
- Remaining capacity, session hours, timezone and Refresh share one strip.
- Reset stays next to visit fields. Continue stays right-aligned after a separator.
- Cancellation cutoff consequences, active restrictions, errors, offline/stale
  states, consent and blocked-action explanations remain visible.
- Optional session-mode/ticket/background explanations use adjacent accessible help.
- Long selected names use the existing measured full-value reveal (keyboard,
  Escape, hover and touch). Empty placeholders are not reveal targets.

## Routes, callers and intentional differences

All rows below use the real booking components and production CSS. HTTP fixtures
intercept **every** `/api/` request. Role names describe fictional fixture
identities, not successful authentication against real staff accounts.

| Route/caller | Permitted differences retained | Local verification |
|---|---|---|
| `/admin/book` — Superadmin | Editable care scope, staff source, patient selection/registration; verified management capability | Single/multiple sessions, all four sizes; staged progression and ticket |
| `/admin/book` — Clinic Admin | Own assigned scope, owner-recovery entry, staff source, permitted patient registration | Single/multiple sessions, all four sizes; mobile/footer containment; capability denial; progression and ticket |
| `/doctor/book` | Fixed self-doctor and pinned location where applicable; existing-patient selection, no new-patient registration | Single/multiple sessions, all four sizes; progression, mobile, ticket |
| `/receptionist/book` | Assigned care scope, staff source and existing permitted registration | Single/multiple sessions, all four sizes; progression, mobile, ticket |
| `/patient/book` | No staff source or management; patient's own details and existing contact-proof rules | Single/multiple sessions, all four sizes; progression, consent, ticket |
| `/book/:reference` — guest | Fixed QR clinic/location/doctor as supplied; no staff source, management or patient registration | Clinic/location QR, phone/desktop progression; no management requests; immediate fictional receipt |
| `/book/:reference` — signed-in patient/staff | Public entry remains patient-facing, no workspace management capability probe; existing patient selection/registration eligibility unchanged | All six fixture roles, clinic/location QR; phone/desktop; change-visit/back; no management requests |
| `/guest-booking`, public clinic pages, `/scan-qr` | Existing discovery/QR entry points lead to the same public booking route | Caller mapping inspected in source; discovery/scanner themselves were not redesigned or independently browser-tested |

Reference sizes: **1366×768, 1024×640, 768×1024, 390×844**.
No new public staff controls, registration feature or management links were added.

## State and stage verification

| State or interaction | Evidence |
|---|---|
| Populated sole session / explicit multiple sessions | Six-role × four-viewport matrix; control bounds and listbox bounds |
| Empty date and next-date search | Six roles; bounded search, no-result range, explicit candidate review, cancellation after deliberate date change |
| Availability failure and retry | Existing choices retained, Continue blocked until successful refresh |
| Full/stale selected session, mode/break/queue/date restrictions | Rendered full-session invalidation and disabled option; session-selection/date eligibility unit tests |
| Offline/stale availability | Explicit visible offline/current-availability warning, disabled Continue, refresh recovery retaining date |
| Walk-in today | Fixed date, no future-date action, visible today-only restriction and cutoff; fictional approved-layout screenshot |
| Schedule access | Server-authorized link in context, checking/failure/denial render tests; public QR excludes capability requests and management UI |
| Patient details | Role-specific selection/registration preserved; required visit mobile, actor prefill, replacement/clearing and identity hydration covered |
| Confirmation | Back preserves draft, changed session prevents confirmation, explicit consent/permission required, no write before explicit confirm |
| Ticket | Fictional immediate private ticket/reference, guest receipt and staff/patient ticket screenshots; existing ticket implementation/export geometry unchanged |
| Accessibility | Field/listbox bounds, Escape/focus restoration, real touch selected-value/help dismissal, 200% root text-size fixture, long names and compound phone/footer containment |

## Test results and reproducible commands

1. Pre-edit baseline: one existing 1366×768 rendered containment test passed and
   its screenshot was copied **before** UI edits.
2. Main regression pass: **88 passed**, zero failed/skipped/flaky.
   `generated-artifacts/booking-reference/results.json`
3. Focused compact-name/stage/accessibility follow-up: **21 passed**, zero failures.
   `generated-artifacts/booking-reference/followup-results.json`
4. Final tablet/evidence selection: **7 passed, 2 failed**. Both failures identified
   an actual truncated-placeholder overlay intercepting the Session trigger.
   Fix: placeholders no longer get full-value help; compact selected sessions use
   hours without removing detailed option text.
5. Targeted verification of both failed tablet cases: **2 passed**, zero failures.
   `generated-artifacts/booking-reference/tablet-fix-results.json`
6. Focused unit/source/render checks: **61 passed**.
7. Production frontend/server bundle: **passed** with
   `PORT=25283 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`.
8. Typecheck: rebuilding the referenced API declarations with
   `pnpm exec tsc -b lib/api-client-react` eliminated stale generated-type errors.
   `pnpm --filter @workspace/clinicflow typecheck` still reports **two pre-existing
   errors in unchanged `vite.config.ts`**, from incompatible installed Vite plugin
   type identities (different transitive YAML package versions). No changed
   booking source has a remaining TypeScript error.

Do not add these pass counts together as distinct test coverage: follow-ups
intentionally repeat only affected cases. The broad pass preceded the compact-name
follow-up; final tablet corrections were checked narrowly, not with another broad run.

Main browser command:

```sh
pnpm exec playwright test \
  --config artifacts/clinicflow/workspace-regression/playwright.config.ts \
  --project=workspace booking-discovery.spec.ts
```

## Rendered evidence

All screenshots contain fictional data. Artifacts are intentionally ignored by Git
and deployment; the accompanying downloadable HTML report embeds representative
images and the matrix.

- Matched component baseline: `generated-artifacts/booking-reference/before/visit-1366.png`
- Same fixture/viewport after: `generated-artifacts/booking-reference/after/matched-visit-1366.png`
- Full workspace, target walk-in state: `generated-artifacts/booking-reference/after/approved-walk-in-1366.png`
- Role/state matrix: `generated-artifacts/booking-reference/after/<role>-<width>-single.png`
  and `...-multiple.png`
- Staff/patient stages: `.../after/<role>-patient.png`, `...-confirmation.png`,
  `...-ticket.png`
- Guest phone stages: `.../after/guest-patient-390.png`,
  `.../after/guest-confirmation-390.png`, `.../after/guest-ticket-390.png`
- Enlarged text: `.../after/enlarged-text-390.png`

The matched before/after pair intentionally uses the same unwrapped component
fixture, not a real workspace login. Separate screenshots show the full real App
route with its sidebar/header and fictional HTTP responses.

## Hosted and access limitations

**`https://uat.digi-q.in/admin/book` was not inspected or changed.**
This is local fork work, not a deployed UAT fix. Merge and separately authorized
deployment are still required for hosted rollout.

No real account authentication, patient/staff data writes, actual bookings,
messages, SMTP/SMS provider checks or UAT writes were performed. Mocked successful
booking responses are not persistence or delivery evidence. Native Safari/Firefox,
physical-device text scaling and screen-reader announcement quality were not
verified. The opt-in owner-recovery suite needs its disposable Preview setup and
was not run; its entry and underlying recovery behavior remain unchanged.
