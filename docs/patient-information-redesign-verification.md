# Shared patient information verification

## Delivered

- Patient-specific defaults in the existing ResourcePage: name with secondary public patient code, mobile, email and status; right-aligned icon actions with a divider. Existing column settings, sorting, selection, filtered CSV export and pagination remain in the shared listing architecture.
- Status and permitted clinic-group quick filters in the shared FilterBar; other filters retain the existing transactional drawer and reset behavior.
- New `PatientInformation` and its scoped stylesheet replace the sparse inline expansion and the separate drawer profile/timeline implementation. Profile is default, followed by Appointments, Activity and Documents. Appointments retains visit-only wording, existing server scope and independent paging.
- Five responsive groups: Basic Information, Contact Information, Address, Clinic & Registration, Emergency Contact. Registration labels use existing permission-checked saved-label hydration; private IDs are not displayed. Exact DOB/calculated age and referenced approximate age remain distinct.
- `PatientDetailsDrawer` reuses that content and canonical patient detail cache. Exact-link loading populates the same cache rather than triggering another authoritative profile request.
- Section and summary Edit controls reuse the existing full patient editor. Direct missing-field actions reuse `ProfileCompletion`, field-access checks, baseline persistence and AppDialog draft/busy protection. The opt-in dash presentation does not change other ProfileFacts consumers.
- `ResourceRecord` supplies the patient-code hierarchy, leaving other resource cells unchanged.

## Deliberate omissions and boundaries

No Medical History, Notes, allergies, blood group, registration source or last-visit data were invented. No schema/API, ownership, identifier, registration, document entitlement or notification changes. Doctors remain read-only for patient profiles; existing visit-scoped doctor document authority remains server-owned. Adding profile email/mobile does not create an account, verify a contact or change a visit contact.

The incoming role-layout unification is retained. The app header/sidebar were not replaced.

## Executed checks

- `node --test artifacts/clinicflow/src/components/patient-information.test.mjs artifacts/clinicflow/src/lib/patient-details.test.mjs artifacts/clinicflow/src/lib/profile-values.test.mjs`: **9 passed**.
- `pnpm run typecheck:libs`: **passed**. The initial frontend-only check read stale generated declaration outputs; rebuilding the existing referenced libraries resolved these without codegen/spec changes.
- `pnpm --filter @workspace/clinicflow typecheck`: **passed**.
- `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build`: **passed**, existing large-chunk advisory remains. An initial build without PORT correctly failed configuration validation.
- Backend-backed browser suites under the existing workspace Playwright config/project: `patient-information.spec.ts` **7 passed**, `patient-registration.spec.ts` **9 passed**.
- Browser checks used real permission/identity/resource/profile-completion/appointment/activity/document routers with disposable migrated PGlite and exclusively fictional records. Nothing touched workspace, UAT or production patients, credentials or notification providers.
- Super Admin, Clinic Admin, receptionist and Doctor: Profile default, grouped facts, supported missing actions versus read-only dashes, functional tabs, appointment visit scope, keyboard arrows/focus, Escape and exact links.
- Full edit cancel/save/reopen; focused email completion with unsaved-draft confirmation, save/list/drawer/reload refresh and unverified contact retained; search/reset, selection and page navigation.
- Screenshots and profile overflow assertions at **1440, 1024, 768 and 390px**, for all four roles. Representative screenshots were visually inspected. Existing horizontal tab scrolling is intentional; selection reveals the active tab. The last small CSS correction widens the checkbox/expansion track and removes the mobile “Select” pseudo-label; visible quick-filter wiring was added after the browser pass and confirmed by typecheck/build, not a second full browser run.
- Both managed workflows restarted and came up cleanly. Public preview screenshot rendered without application errors.

## Evidence and limitations

Browser images are generated, ignored evidence under `artifacts/clinicflow/workspace-regression/test-results/workspace/patient-information-*/profile-*.png`; this tracked report preserves the conclusions when generated files are absent after merge.

The role checks exercise actual backend identities in an isolated component/workspace fixture, not staff password login or production data. No hosted/UAT mutation or deployment occurred. A separate upload/download fault-recovery run, high-browser-zoom audit, and full app-wide shared-consumer browser sweep were not performed. Existing registration/booking consumers were exercised; unchanged generic table/tab/dialog code was not broadly rewritten. No test claims are made about phone camera/hardware behavior.
