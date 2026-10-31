# Full-week schedule editor

## Implementation and persistence boundary

The shared authoring core now renders Monday–Sunday continuously, without weekday tabs. Add Schedule, row Edit, the doctor's schedule context and onboarding use this same core. Existing authorized context selection and dirty-draft guards remain in their adapters.

Consultation duration is time per patient, not the length of a session window. The repeated duration selectors are one doctor-level choice **within the currently edited week/location**. Supported new choices remain 20, 30 and 60 minutes. Existing legacy values and heterogeneous durations are displayed without normalization; changing the common choice requires confirmation. Working-day state, session windows and advanced capacity/break/queue settings remain independent. Off-day draft slots survive re-enabling before save.

No API, database schema, scheduling service, historical appointment or production configuration changes were made. The existing session APIs and confirmed linked-day overrides remain authoritative. Successful writes reconcile from their own responses; partial failures keep failed drafts and original write baselines for retry. Successful create identities remain attached to drafts. Onboarding stays draft-only until Finish.

Headers show saved doctor names and an existing display code when returned by the doctor service, never a fabricated code or a raw private ID. Clinic, location and inherited display preferences remain real context. Date Exceptions remain separate from recurring rules. Clinic-hours context is available in each day's compact disclosure; existing linking, outside-hours warnings and explicitly confirmed location-copy capabilities remain available.

## Modified implementation

- `artifacts/clinicflow/src/components/schedule/CompactDayEditor.tsx`: full-week rows, latest-draft edits, per-day copy, shared duration selection and error focus.
- `artifacts/clinicflow/src/components/schedule/compact-day.css`: responsive grid, horizontal start/end controls and sticky actions.
- `artifacts/clinicflow/src/components/schedule/week-duration.ts`: context-local duration derivation/application; no persistence or migration.
- `artifacts/clinicflow/src/components/schedule/WeeklyScheduleEditor.tsx`: existing persistence integration, per-day clinic-hours context, common new-session defaults and full-draft validation focus.
- `artifacts/clinicflow/src/components/schedule/week-plan.ts`: copying clinic-hour intervals preserves compatible settings on reused sessions.
- `artifacts/clinicflow/src/components/schedule/ScheduleContextHeader.tsx` and `DoctorScheduleContext.tsx`: existing saved display code in the shared real-data header.
- `artifacts/clinicflow/src/components/schedule/AvailabilityScheduleEntry.tsx`: scoped non-clipping parent so standalone sticky actions follow the viewport rather than an oversized panel.
- `artifacts/clinicflow/src/components/schedule/OwnerWeeklySessions.tsx`: compatible duration inheritance for draft-only onboarding copies.
- `artifacts/clinicflow/src/components/schedule/week-duration.test.mjs`, `artifacts/clinicflow/package.json`, and the two schedule browser specifications: regression coverage and test entry point.

## Local verification

- `pnpm run typecheck:libs` and `pnpm --filter @workspace/clinicflow typecheck`: passed. The first leaf-only check encountered stale shared declarations; rebuilding the existing libraries resolved them without API regeneration or source-contract changes.
- `pnpm --filter @workspace/clinicflow test:weekly-drafts`: **37 passed**, including mixed/legacy preservation, explicit common duration, retained off-day drafts, independent settings, copy scope, protection, response-based retry and create identity reconciliation.
- `node --test artifacts/clinicflow/src/lib/schedule-draft.test.mjs artifacts/clinicflow/src/lib/schedule-editor.test.mjs`: **8 passed**.
- Isolated backend tests for confirmed day overrides and registration onboarding: **25 passed**, including booked-session protection, role/scope denial, stale baselines, real lock contention, cross-location timezone conflicts and date exceptions.
- `schedule-persistence.config.ts`: **11 cases verified** using disposable PostgreSQL and the real session routes. Includes actual Add/Edit/reopen across Super Admin, Clinic Admin, Doctor and Receptionist; common duration and distinct windows; legacy mixed preservation and confirmed replacement; complete-week draft toggles; partial success, duplicate-submit and stale retry; read-only public availability; and onboarding Finish/reload/recovery. One stale final text assertion was corrected to assert the selector's accessible selected name and that case passed on its targeted rerun.

The rendered-component suite uses fictional HTTP fixtures, not a production database. Its initial failures exposed obsolete entry-route and selector assumptions during migration; these were corrected rather than treating them as successful application checks. Layout assertions cover desktop/laptop/mobile widths, long saved labels, equal horizontal time fields, menus, focus, per-day copy, linked-day confirmations and separate exception cancellation.

- `availability-editor.spec.ts`: **76 cases verified across the initial and targeted fix runs**, not a single uninterrupted clean run. Initially 58 passed and 18 failed; the fixed-flow run passed 15 of those 18, and the final targeted three passed after the remaining fixes.
- One genuine layout defect was found at the standalone 512×320 viewport: the generic panel's hidden overflow prevented viewport-relative sticky actions. A schedule-only parent class fixes it without changing other panels. The final measured footer is at y=194, height=126, bottom=320, and Save is in view after scrolling to Sunday.
- The 11 persistence cases and component checks cover different evidence boundaries: the former exercise real SQL/routes, while HTTP fixture checks exercise actual React entry components, interaction, copy/confirmation, exceptions and layout. Initial fixture failures are not counted as application successes.

## Evidence and limits

Generated screenshots and diagnostic traces are intentionally ignored, under `generated-artifacts/schedule-full-week`, `generated-artifacts/shared-schedule`, `generated-artifacts/schedule-persistence`, and the browser runner's test-results directory. This tracked report preserves the verification boundary even when generated files are omitted from a merge.

All evidence is local and isolated. No hosted login, real-device mobile, Safari/Firefox, live appointment, live notification, UAT or production deployment verification is claimed. Existing session APIs—not this UI—continue to enforce availability, permissions, booked-session restrictions and timezone conflicts.

Fixture-aborted font requests emitted expected console request failures. No JavaScript page errors were observed in the logs inspected; this is not a claim that every console event in every split run was independently audited.
