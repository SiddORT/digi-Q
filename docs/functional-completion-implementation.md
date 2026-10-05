# Final verification addendum

The authoritative per-point disposition is [functional-completion-acceptance.md](functional-completion-acceptance.md). Final frontend checks pass 292/292 and final feature checks pass 21/21; shared/API/UI typechecks pass. A real configured private-storage create/read/delete check passed using a synthetic non-patient text object, and cleanup was verified. This supersedes the earlier storage-not-exercised limitation below. Patient Profile now exposes View My Records, opening the patient's own appointment history, activity and documents; staff upload rights remain separate.

Notification receipts include patients' own appointment events. Staff own-action noise remains excluded. The panel explicitly explains its 60 appointment/queue + 30 system event limit, 30-day window and displayed-list unread/read-all scope. Workspace and notification titles use full-value disclosure.

# Functional Completion — Implementation Report

Scope: local development only. Nothing in this report is based on live, deployed or production evidence. No emails were sent, nothing was published, and no real accounts were changed.

## Completed

| Item | Implementation |
|---|---|
| Notifications | `GET /api/notifications`, `POST /api/notifications/read` (`routes/workspace-features.ts`). Events come from real `appointment_history` rows within the caller's `sourceSql` appointment scope (statuses checkedIn/waiting/called/inConsultation count as Queue, the rest as Appointments). Clinic and super admins also get scoped `audit_logs` (System). The window is the last 30 days. The caller's own actions are excluded. Read markers are stored per user in `notification_reads`. Only IDs currently visible to the caller can be marked. No email is sent. The UI (`NotificationsPanel.tsx`) has the tabs All / Appointments / Queue / System, and the Mentions tab is removed. |
| Workspace switching | `GET /api/workspaces`, `PUT /api/workspaces/active`. The active clinic is stored in `settings` row `workspace:<userId>`. `requireUser` → `applyWorkspace` → `narrowToWorkspace` narrows `clinicIds`/`branchIds` to that one clinic, but only if it is still assigned (a stale or unassigned value is ignored). Super admins and patients are never narrowed. Decision: the active workspace is **enforced server-side** for every route that uses `requireUser`. Routes that call `findUser` directly keep the full assigned scope, which can never be wider than the assignments. Switching is audited (`switchWorkspace`). The client clears the React Query cache and reloads. Auth changes already clear the cache (`auth/native-auth.tsx`). |
| Patient documents | `GET/POST /api/patients/{id}/documents`, `GET/DELETE /api/patient-documents/{id}` (`routes/patient-records.ts`, `lib/document-storage.ts`). Bytes go to private storage through the configured `MEDIA_STORAGE` driver: local `MEDIA_ROOT/private-documents/<uuid>` (mode 0600), or object storage `PRIVATE_OBJECT_DIR/patient-documents/<uuid>`. They are never publicly addressable. Limits: 10 MB maximum, with the type detected from magic bytes (PDF/PNG/JPEG/WebP/plain text) and the filename sanitized. Uploads are rate-limited to 30 per 15 minutes. Each document is checked against `canRead(patient)` plus its own clinic. Uploads are limited to staff, and only in clinics that link the caller's scope to the patient. Delete is allowed for the uploader or a clinic/super admin and is a soft delete plus byte removal. Upload, download and delete are audited. Downloads use `Content-Disposition: attachment`, `nosniff` and `no-store`. |
| Patient activity | `GET /api/patients/{id}/activity` is a paginated, patient-wide feed of all `appointment_history` rows within scope. It is independent of the Timeline paging. Actor names are hidden from patients. |
| Report trends | `GET /api/reports/trends` builds daily series from `generate_series` over the scoped `sourceSql` CTE, using the same report context authorization. The range is limited to 366 days. The chart (`ReportTrends.tsx`) has an sr-only data table and appears when the range covers more than one day. |
| Global search | `GET /api/search/records` matches scoped queue/report appointment records by reference, token or patient name, with a maximum of 10 results. Search text is not stored. Its results appear as a "Queue & Report Records" group in `WorkspaceSearch`. |
| Saved views | `GET/POST /api/saved-views`, `DELETE /api/saved-views/{id}`, stored in table `saved_views`. The server re-sanitizes every view: only allowlisted key shapes are kept, values must match `^[A-Za-z0-9_\-:.,]{1,80}$`, and search/name/email/mobile/reference keys are dropped. Sharing: a clinic admin shares with all staff (clinic admins, doctors, receptionists) whose clinics overlap the admin's, because each clinic has only one admin. A super admin shares only with super admins. Patients never receive shared views. The client cache key includes the user ID and role. Only the owner can delete. Column layout stays per device. |
| Accessibility | `lib/tabs-a11y.ts`: tab/panel IDs, `aria-controls`/`aria-labelledby`, roving tabindex, and Arrow/Home/End keys in the patient drawer and notifications. Status filter tablists (resources, system users) also support arrow keys. The profile menu now moves focus into the menu on open, supports Arrow/Home/End, opens on ArrowDown from the trigger, closes on Tab, and Escape returns focus to the trigger. Workspace and membership names use `OverflowText`. |
| Placeholders | The notification, switch, document and activity "not connected" placeholders were replaced with working features. |
| Staff creation | Unchanged, as instructed. |

## Database
`lib/db/drizzle/0016_functional_completion.sql` is additive only (`CREATE TABLE/INDEX IF NOT EXISTS`) and creates `notification_reads`, `patient_documents` and `saved_views`. It is registered in `meta/_journal.json` (idx 15), and its DDL matches the Drizzle schema exactly, so `migration-readiness.test.mjs` passes with zero schema differences. It was applied to the **development** database only; the empty dev tables were recreated so they use the Drizzle constraint names. The Drizzle schema in `lib/db/src/schema/core.ts` was updated to match.

## Tests (local)
- `pnpm --filter @workspace/api-server run test:features`: `functional-features.integration.test.mjs` (11 tests that run the real routers and SQL in disposable PGlite with the actual migration journal applied, with only document bytes replaced by an in-memory fake) plus pure policy tests covering workspace narrowing and no-expansion, saved-view sanitization, document sniffing and size limits, and name sanitization.
- `cd artifacts/clinicflow && node --test $(find src -name "*.test.mjs")`: includes the updated `workspace-surfaces.test.mjs` and the new `tabs-a11y.test.mjs`.
- Typecheck: `pnpm -w run typecheck:libs`, `pnpm --filter @workspace/api-server run typecheck`, `cd artifacts/clinicflow && npx tsc --noEmit -p .`

## Limitations / Not done
- The integration tests use PGlite and fictional fixtures. They were not run against a production-like dataset, and no browser testing was done.
- The generated client does not URL-encode path parameters (existing Orval behaviour). This is safe for the server-generated IDs used here.
- Object-storage document paths were not exercised end to end. Local storage requires `MEDIA_ROOT`.
- Patients can view their own documents but cannot upload them.
- Notifications are polled every 60 seconds; there is no push. Unread counts cover the 30-day window only (up to 60 history plus 30 system items).
- Unchanged existing views stored in localStorage are not migrated to the server.
- Workspace switching does a full page reload after clearing the cache.
- The full api-server suite passes (249/249) when run with `--test-concurrency=1`. Running it in parallel can hit `initdb` 20-second timeouts in the disposable Postgres harness on this container.
- No live, deployed or production verification was performed.
