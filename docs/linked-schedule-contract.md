# Linked solo-owner schedules

## Direct day customization

Authorized Super Admins, in-scope Clinic Admins and doctors editing their own
assigned schedule can customize individual weekdays in the shared compact editor.
This does not grant clinic-settings access. Receptionists retain their existing
ordinary session policy and cannot perform confirmed linked-day overrides.

`GET /schedules/day-context?doctorId=…&branchId=…` returns the complete active
session set and frozen weekday baselines from one locked transaction. Each day
reports `following`, `custom` and an opaque snapshot covering its complete
session set, location timezone/status, clinic hours, link configuration and
server-owned override decision. Missing hours are not reported as closed.

`POST /schedules/day-overrides` takes doctor/location/weekday, explicit
`confirmed:true`, `isOpen`, the loaded day snapshot, a stable save `requestId`
and the complete proposed interval set (`key`, optional existing `id`, validated
`ScheduleInput`). A day off sends no intervals. Session scope must exactly match
the selected doctor/location/day; doctors cannot spoof another doctor.
The server checks the normal create/update/delete policies, current assignments
and actor after acquiring doctor schedule locks, then the location-hours lock.

Only this confirmed day transition is transactional. It records
`branches.data.scheduleDayOverrides[doctorId][weekday]` separately from editable
link configuration, reuses retained session IDs, retires removed sessions and
validates replacements through the existing schedule service. A transaction-local
retirement of the old set makes start-time swaps safe under the active-start
unique index. All writes roll back if any validation fails. Booking history or
active date exceptions block timing/break changes and interval removal with an
actionable explanation. Settings-only edits preserve frozen appointment duration.
No appointments are moved/deleted and no notifications are dispatched.

Custom intent persists even with no sessions: synchronization skips the entire
custom weekday, not just individual linked markers. Clinic-hour changes continue
syncing unaffected days. Explicit whole-location unlink retains overrides;
re-enabling following does **not** reset them. Ordinary overlap protection still
applies to previously unlinked sessions. No new reset operation is introduced.
Clinic settings read server-owned day metadata only after the hours lock, so a
concurrent contact/hours edit cannot restore a stale document over an override.
Legacy locations with no day metadata preserve their existing behavior.

The confirmation names the doctor, location, changed weekdays, actual clinic
intervals and proposed sessions/day off, explaining that only those doctor days
become custom and future synchronization will not overwrite them. Cancellation
makes no writes and preserves the draft. Each confirmed day has an actor/scoped
audit event with prior authoring snapshots, proposed intervals and clinic hours.
Normal unlinked editing retains per-session save and partial-retry semantics.
Successful day responses rebase only that day's rows and baseline. A lost response
can be retried with the same actor/request/draft: its original write receipt is
replayed before checking the old snapshot, without duplicating intervals/audits.
Changed drafts with a reused identifier are refused. Reopening reads persisted
custom state, including day off; unrelated unsaved weekdays are never rebased by
another day's response.

## Compact schedule verification (2026-10-09)

- Frontend and API server TypeScript checks pass; the workspace TypeScript
  project-reference build also passes.
- `test:weekly-drafts`: 26 passing draft, settings, copy, reconciliation and
  deactivation-order checks.
- API `test:schedules`: 14 passing schedule checks, including stale updates,
  stale deactivation, scopes, assignments, timezone drift, explicit closures,
  overlaps, dated conflicts and running-visit duration preservation.
- The schedule and existing queue contention checks use separate connections
  and observable lock waits in a disposable socket-only PostgreSQL cluster.
  The existing queue contention suite passed all 20 checks. They do not use the
  configured clinic database.
- Native-session HTTP checks separately verify Doctor, Clinic Admin and Super
  Admin identities and permissions against fictional users in that disposable
  database. Browser role fixtures are not evidence of live staff authentication.
- Intercepted-browser journeys verify the focused versus ordinary profile
  entry, tabs and retained drafts, both copy modes and cancellation, validation
  navigation/focus and keyboard arrows, save/reopen, partial-save retry,
  deactivation for Doctor and Super Admin, Clinic Admin scope, dirty dismissal,
  busy-write guards, fixed/fresh assignment context, date exceptions and 12/24h
  inputs. All browser API requests are intercepted; no patient or clinic data
  is read or mutated. Targeted checks confirmed the corrected deactivation,
  selected-day preservation and focus failures.
- Rendered fixture checks passed at 1440×900, 1024×768 and 390×844 with long
  names, visible footer/controls and no horizontal overflow; the phone duration
  menu remained inside the viewport.
- Two older navigation source-text assertions in the linked-schedule UI suite
  still fail against unchanged navigation code. The affected schedule assertion
  and all five shared dialog-close checks pass. Broad navigation/harness repair,
  publishing and production verification remain outside this work.

Existing routes stay intact. No DB migration or live backfill.

## Compact doctor schedule authoring

The focused doctor editor and Doctor/admin Availability entries share the same
per-session services, saved assignment scope, inherited location timezone and
clinic/platform time-format settings. Clinic-detail launches stay in that clinic
group. Location hours alone do not provide doctor availability or capacity.
Ordinary profile editing no longer contains weekly schedule editing.

`ScheduleInput.expectedSnapshot` and `DELETE /schedules/{id}?expectedSnapshot=...`
are optional additive authoring preconditions. The snapshot is canonical JSON of
sorted authoring fields (identity/scope, weekday/open state, times, break, timezone,
capacity, prefix, duration, buffer, queue settings, status and link protection).
Display names and audit timestamps are excluded. Existing clients can omit it;
modified weekly/detail callers pass their loaded baseline. The server compares
after acquiring the existing doctor/schedule locks; a mismatch returns 409 with
reload/review guidance and no writes. It is never stored. There is no schema
migration, weekly atomic API, new scheduling service or dependency.

Queue opening/closing overrides accept `null` to explicitly clear them. Generated
clients and validators come from the existing OpenAPI contract. New consultation
choices remain 20/30/60; legacy values stay unchanged unless selected otherwise.
Existing bookings retain their frozen duration when the future template changes.

Saving still performs updates, creates, then deactivations. Any failed update or
create blocks removals. Partial success attaches returned create IDs and rebases
only successful records from their write responses, never a background refetch
that might include another administrator's newer state. Failed records retain
their loaded preconditions and retryable drafts. A failed post-save reload keeps
the popup open. Delete Schedule is confirmed custom-session deactivation;
linked sessions, historical appointments and audit history remain.

- Registration (`ClinicRegistrationInput`, `ClinicAdminOnboardingInput`): optional `ownerSchedule: { maxTokens: integer >=1, consultationMinutes: integer >=1, tokenPrefix: string, queueMode: "mixed" | "appointmentsOnly" | "walkInsOnly" }`. Requires `ownDoctor:true`; links each created location to the owner's doctor. Omit to use custom schedules.
- PATCH `/clinics/:id/settings`: branch entries accept `linkedSchedule: { enabled:boolean, doctorId?:string, maxTokens?:number, consultationMinutes?:number, tokenPrefix?:string, queueMode?:string }`. Enabling requires explicit capacity/duration and owner's attached doctor (doctorId may be omitted to derive owner doctor). Disabling retains existing schedules but unlinks them; custom editing becomes possible.
- GET settings returns branch `linkedSchedule` with persisted doctorId/settings. Existing branch hours edits automatically reconcile linked sessions atomically. Sessions with bookings or date exceptions cannot be removed/changed; return 409 with specific session details, leaving all changes rolled back.
- POST `/clinics/:id/settings/preview` (`previewClinicSettings`): same input as PATCH; returns `{ allowed:boolean, impacts:[{branchId,create:number,update:number,retire:number,unlink:boolean}], conflicts:string[] }`. Preview is advisory; save rechecks under transaction locks.
- Linked sessions still reject generic per-session mutation/deactivation. Authorized users use the confirmed complete-day override above instead of unlinking an entire location. Custom doctors/schedules remain supported; overlapping custom schedules block linking rather than being adopted silently.
- Clinic settings and preview require Super Admin or the actual owning Clinic Admin. Same-account owner doctor retains Clinic Admin identity.
- Preserve QR URLs, appointment snapshots and schedule IDs for unchanged intervals; retire only unused obsolete linked sessions. Never infer capacity from opening hours.