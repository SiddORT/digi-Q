# Clinic Details implementation and acceptance

## Scope and implementation audit

Implemented in the existing ClinicFlow artifact and application shell. The
supplied Clinic image is the layout reference; current Notifications/shared
workspace styles remain the styling reference. No independent design system,
new owner, new role, database migration or production deployment was introduced.

The screenshot was inspected at its native 1024 × 683 size. The initial unsigned
Preview showed Staff Login, not an authenticated before-image. Authenticated
comparisons below therefore are not represented as before/after evidence.

Supported contracts:

- Clinic name, full address string, saved public slug, email, phone, category,
  specialities, referral code and existing date/time preferences are reused.
  The settings endpoint stores one full address string; its editor does not
  present separate geography values that this endpoint would discard.
- Status is persisted and displayed, not a pretend settings-endpoint toggle.
  Existing permitted status operations remain in the existing listing.
- Clinic email is labelled **Clinic Email**. There is no verified independent
  notification-recipient contract or alternate-contact record, so neither is
  fabricated. Location email/phone inheritance remains backend-owned.
- Clinic-wide Management is a minor informational label with existing
  accessible help, not a button leading to an invented destination.
- Linked Owner Hours counts the selected clinic's locations with
  `linkedSchedule.enabled`, out of that clinic's returned locations. It does
  not calculate availability from opening hours. Manage opens Locations, where
  the existing editor, linked-hours preview/review and consultation workflow
  remain available. Readiness opens the existing schedule workspace with
  verified explicit clinic context.

## UI and navigation delivered

- Horizontal overview: real persisted identity/address/status, genuine edit
  actions, secondary management explanation and linked-location/readiness area.
- Equal, aligned Basic Information and Contact Information cards; suitable copy
  controls with success and failure feedback; Linked Owner Hours section.
- Five mutually exclusive sections: Details, Locations, Staff, Policies and
  Activity History. History is no longer a Details disclosure.
- Canonical private routes:
  `/admin/clinics/:clinicId/details`, `/locations`, `/staff`, `/policies`,
  `/activity-history`. IDs remain authoritative, not names or new slugs.
- Legacy `/admin/clinic?clinicId=...&section=...` and settings links resolve to
  the same component. `general`, `qrs`, `sessions`, and `history` aliases are
  normalized. Invalid section values consistently select Details.
- Validated Clinics-list return context, location-editor context, other query
  parameters and hashes are retained where applicable. Switching clinics drops
  the previous location/open-record context. Existing static routes take
  precedence over public slug fallbacks.
- Listing, search, inherited-settings, registration-completion and location-edit
  links use the clinic navigation helpers. Contextless entry points remain
  supported chooser links, not fabricated clinic IDs.
- Public routes reuse saved clinic/location slugs and configured public origin.
  Existing booking/display/QR/password/invitation references are not regenerated
  or migrated. No domains, host aliases or cross-domain redirects were changed.

## Roles, integrations and data

| Actor | Clinic settings access |
| --- | --- |
| Super Admin | Existing permitted clinics and actions |
| Owning Clinic Admin | Existing owned clinics and actions |
| Foreign Clinic Admin | Rejected for another owner's clinic |
| Doctor, receptionist, patient | No new configuration access |
| Anonymous/expired session | Sign-in/session-expiry behavior retained |

Backend ownership and resource permissions remain authoritative. The selector
uses authorized directory reads. Child lists are keyed by selected clinic;
clinic-bound dialogs/mutations reset on a confirmed clinic change. Explicit
readiness context cannot silently inherit a different top-bar location.

Writes use the existing settings and linked-schedule APIs. Nullable contacts can
be cleared, failed saves retain entered values, successful responses refresh the
settings cache and dependent lists. Pending operations block exits/duplicates.
Parent leave protection also observes nested staff/location drafts. In-app,
tab/selector and browser exits use the shared confirmation/history mechanism;
discarding or saving clears the relevant draft.

No new external integration was needed. No existing application clinic record
was used for mutation tests. Native sign-in acceptance used a disposable
PostgreSQL database, real API handlers, fictional `.test.invalid` accounts and
disabled external delivery. The opt-in marker was removed and the normal API
workflow restored afterward. The development-only fixture support remains
reusable; fixture passwords/sessions are not production credentials.

## Error and indexing boundaries

Settings and contextual schedule requests distinguish loading, permission denial,
not-found, expired session and retryable failure. Failure does not supply a zero
linked-location count. Existing staff/location/history lists retain their own
error/retry behavior instead of substituting an empty-success collection.

Initial HTML is noindex by default. Actual resolved public clinic/location pages
set relevant titles/descriptions and configured-origin canonicals; private,
authentication, booking and display modes retain noindex and no private
canonical. robots.txt also excludes private/auth/token route families.

These are SPA crawler directives, not authorization. Initial public HTML is not
server-rendered per clinic; JavaScript execution is required for page-specific
metadata. Published-host headers, crawler behavior and indexing/ranking were
not verified or guaranteed. The browser tester initially expected Preview-origin
canonicals, then withdrew that failure because configured-origin canonicals are
the explicit requirement. No UAT link was followed.

## Files changed

| Area | Files |
| --- | --- |
| Workspace UI | `src/components/ClinicSettings.tsx`, `clinic-settings.css` |
| Routing and navigation | `src/App.tsx`, `src/clinic.tsx`, `src/resources.tsx`, `src/lib/clinic-navigation.ts`, `inherited-defaults.ts`, `search-categories.ts`, `src/components/ClinicRegistrationComplete.tsx` |
| Scope and draft safety | `src/components/WorkspaceBranch.tsx`, `AppDialog.tsx`, `SchedulingWorkspace.tsx`, `src/lib/use-workspace-leave-guard.ts` |
| Public metadata | `src/components/PublicClinicPage.tsx`, `src/lib/page-metadata.tsx`, `index.html`, `public/robots.txt` |
| Frontend regressions | `src/components/clinic-navigation.test.mjs`, `workspace-regression/main.tsx`, `workspace-regression/tests/workspace.spec.ts`, `public-metadata.spec.ts` |
| Disposable authenticated acceptance | API server `package.json`, `src/test-support/staff-removal-browser.mjs` |

Frontend paths above are relative to `artifacts/clinicflow`. No OpenAPI or
database-schema changes were needed. Project memory records the user's
informational-management clarification and the repeated-history test lesson.

## Executed verification

### Passed automated checks

- `pnpm run typecheck` — shared libraries and all configured workspace projects.
- `pnpm --filter @workspace/clinicflow run typecheck` — after functional edits.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build` —
  final frontend production build.
- Normal API workflow rebuild/start — listening on the configured port after
  disposable-fixture removal.
- `git diff --check`.
- Node navigation/display-contract suites: **12 passed**.
- Five selected isolated backend regressions: settings/contact inheritance and
  immutable slug; both admin roles/foreign staff rejection; generic update
  permission bypass rejection; linked-owner onboarding/bookable sessions and
  original QR; linked-hours preview/idempotency/multiple-location synchronization.
  **5 passed**.
- Focused intercepted-API Playwright checks: **14 passed together** for canonical
  and legacy tabs, query/return state, failed and successful writes, exact
  Back → Cancel → Back → Discard, honest failures, clinic/role separation,
  staff links, schedule context, metadata and responsive layout.
- Subsequent final CSS/mobile-editor check and separate keyboard/touch-help
  check: **2 passed**. The responsive check was rerun after the final card-margin
  and copy-icon corrections; this is 15 distinct focused browser tests overall,
  not 16 separate scenarios.
- Native-authenticated disposable API checks: authorized Super Admin and owner
  settings GET 200; foreign owner, doctor and receptionist GET/PATCH 403.
  A persisted disposable patient session also received GET/PATCH 403.
  PATCH checks used a fetched CSRF token and verified `/me` identity.

### Authenticated browser evidence

The actual Preview app, native sign-in and real isolated PostgreSQL-backed
handlers were used, not intercepted API responses.

Confirmed owner/Super Admin and c1/c2 scope checks were recorded; doctor and
receptionist ownership denials, receptionist private-route redirect and foreign
owner rejection were observed. Locations rendered the saved location and
genuine no-QR state. Staff and Activity History retained their sections and data
after reload. Policies retained 60 days / 0 minutes after reload.

Readback included changed fictional clinic name/contact values and existing
display preferences. The tester did not retain enough step-level evidence to
certify each original Save confirmation; fresh-save/persistence assertions are
therefore attributed to the automated frontend/backend tests, not promoted to
fully evidenced native-browser saves.

ArrowRight, Home and End switched tabs. Ctrl+K opened workspace search; Escape
closed it. Sign Out returned home and a protected dashboard visit redirected to
Sign In. Public clinic/location names, descriptions and index directives were
observed. An unavailable opaque booking reference was not treated as a successful
booking test; no booking was submitted by the browser tester.

Evidence IDs include:
`wprk88` (authenticated Details, 1024 × 683), `y6w7u0` (Locations),
`axptph` (Staff reload), `lbn4jk` (Policies reload), `hhakos` (History reload),
`o60vjd` (search), `chau4p` (keyboard tabs), `i3ynns` / `ci1ogu` (public
clinic/location), `ort191` (private/auth metadata), `829853` (signed-out guard).

### Rendered comparisons

Browser layout checks ran at **1024 × 683, 1536 × 1024, 1366 × 768,
768 × 1024 and 390 × 844**. Final fixture screenshots for each size and
`mobile-location-editor.png` are in the ignored Playwright result directory for
`workspace-Clinic-failures--6ba63-layout-fits-required-widths-workspace`.
These screenshots use the real shared components/styles with intercepted
fictional responses, not native-authentication evidence.

No page-level horizontal overflow was measured; the tab strip can scroll locally
on narrow screens. Card tops align on two-column screens. Long/null values wrap.
Phone-width location-editor Identity/Address fields and its sticky action footer
are visible. Keyboard focus/Escape and actual touch-context taps on help/tabs
passed the final fixture check.

Material reference differences: the existing shell has a wider sidebar and
taller top bar than the supplied image. The authorized selector, current shared
typography, long saved names and real contextual controls add height: at
1024 × 683 Details scrolls vertically rather than fitting the entire overview,
cards and hours into one viewport. The current Notifications tab/button style
is retained, rather than recreating the image's different underline tabs.
Unsupported alternate contact/notification-recipient rows, fake overflow action
and apparent management button are intentionally omitted.

## Failures, blockers and unverified checks

- Confirmed in-scope issues fixed during work: phone-width selector overflow;
  stacked discard confirmations hiding the retained editor; parent draft/busy
  state missing nested editors; stale draft flags after closing; card offset
  from a higher-specificity shared margin; shrinking copy icons; explicit
  readiness clinic context being overridden by a pinned location.
- An intermediate circular-import initialization error was fixed by deferring
  resource-field access until render. Final typechecks/builds/rendered tests pass.
- A native-browser note described a largely blank/clipped mobile location
  editor, without a retained screenshot. The final focused 390 × 844 check
  could not reproduce it and captured a visible editor. A follow-up on an
  authenticated physical mobile device remains unverified, not declared fixed
  from the fixture alone.
- Exact repeated-Back steps were not retained in the native browser evidence.
  The faithful-router automated test explicitly executes and passes the complete
  sequence with the draft remaining usable after Cancel.
- Native authenticated touch, screen-reader/physical-device behavior, all
  ancillary shell controls, end-to-end native saves for every editor, valid-QR
  browser booking, production/UAT behavior and complete application QA are
  **unverified**, not passed. No production access or deployment was authorized.
- Build succeeds with existing generated-selector CSS/sourcemap and bundle-size
  warnings. They are documented follow-up work, not hidden successful lint checks.
  There is no claimed lint run where no applicable configured command was used.
- This is Clinic-focused acceptance, not the full backend/browser regression
  suite or a search-engine indexing guarantee.
