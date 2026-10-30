# Unified multi-day schedule authoring

Verified locally on 2026-10-30. **This is not hosted UAT evidence.**

## Authoring and persistence inventory

| Entry | Shared controls | Context/persistence adapter |
| --- | --- | --- |
| Weekly schedules → Add | `CompactDayEditor` | `AddScheduleDialog` selects a permitted doctor; `AvailabilityScheduleEntry` / `DoctorScheduleContext` resolve fresh saved assignments and location |
| Weekly schedules → row Edit | `CompactDayEditor` | `ScheduleDayDialog` / `WeeklyScheduleEditor`, including permitted receptionist edits |
| Weekly management and doctor-context scheduling | `CompactDayEditor` | Existing `DoctorScheduleContext` / `WeeklyScheduleEditor` |
| Consulting-owner custom sessions during registration | `CompactDayEditor` | `OwnerWeeklySessions` holds per-location drafts; `ClinicRegistrationWizard` submits only on Finish |
| Location opening hours | Existing separate location-hours controls | Not doctor sessions; opening-hours policy is unchanged |

`week-plan` owns session settings, whole-week validation, copy-day/slot/location
transformations and the existing persisted save plan. Onboarding continues to
use the registration transaction; internal management retains compatible
per-session services, frozen snapshots and successful-write identities.
No atomic weekly endpoint, database schema migration or automatic schedule
rewrite was introduced.

The scalar generic availability form, its tab mapping and validation module,
`WeeklyDraftDays`, and the unused `WeeklyOverview` / `copy-plan` implementation
were removed after consumer migration. Unrelated generic resource editors remain.

Onboarding's allowlisted draft schema now retains all session settings and
invalid optional-time intent, but no passwords or server schedule identities.
Its form adapter composes paired value/validity callbacks against current form
values, preventing a later callback from erasing an entered break or queue time.
Location copying preserves explicitly custom timezones while adapting inherited
timezones to the target location.

## Isolation and authentication

The dedicated test runner starts a disposable PostgreSQL cluster and the actual
API routers, plus Vite rendering the actual ResourcePage, Add/Edit dialogs and
registration wizard. It never points to the workspace/hosted clinic database.
Fictional native sessions are stored in that isolated database; each role test
verifies its identity through `/api/me`, not a role passed as a UI prop.

The loopback-only evidence service seeds/resets fictional data and reads SQL
rows independently of UI responses. Mail is intercepted, operational delivery
is disabled, and no appointment or notification is issued. The public
availability check is GET-only. No deployment or hosted account was used.

## Scenario results

All nine scenarios passed across the initial run and focused continuations.
Previously passed scenarios were not repeated in the continuations.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Superadmin Add first week, save, fresh reload, actual row Edit | **Passed** | `/api/me` role assertion; four exact SQL rows; settings read back; Wednesday edit leaves other rows unchanged |
| Clinic Admin same Add/Edit journey | **Passed** | Actual role and native session; same exact SQL assertions |
| Own Doctor same Add/Edit journey | **Passed** | Actual doctor role; authorized own context; same exact SQL assertions |
| Permitted receptionist same Add/Edit journey | **Passed** | Actual receptionist role; same exact SQL assertions |
| Linked-day and denied-scope boundaries | **Passed** | Receptionist populated and empty following-hours weekdays remain locked; override denied; foreign doctor/receptionist, patient and guest writes denied; SQL unchanged |
| Hidden-day validation, copying, partial save, retry, repeated submission, stale write, discard | **Passed** | Invalid Monday capacity blocks all writes; copy remains a draft; actual Friday scope denial leaves two successful rows; retry leaves exactly three without duplication; concurrent capacity 15 remains after stale save rejection; discard leaves saved rows intact |
| Custom onboarding, multi-day/multi-slot/multi-location, reload and uncertain completion | **Passed** | Hidden-day error causes no writes; prefix and break survive draft reload; one real create commits; its response is deliberately lost and completion receipt recovers; ten exact SQL rows across two locations, one clinic and no appointments/outbox |
| Linked-hours onboarding | **Passed** | Finish creates exactly three linked Monday/Wednesday/Friday 08:00–20:00 rows, each linked to its own location |
| Onboarding cancellation | **Passed** | Discard of custom sessions does not change SQL counts |
| Downstream availability | **Passed** | Each staff journey reads public availability for the next Monday, receives 200 and eligible 09:00 session with Asia/Kolkata; no booking request |
| Desktop/mobile | **Passed** | Actual saved Edit view at 1366px and 390px for all four staff roles; no horizontal overflow |

The staff-created week is Monday 09:00–12:00 and 14:00–16:00, Wednesday
09:30–12:30, Friday 15:00–18:00. The subsequent Edit changes only Wednesday's
end to 13:00. Monday's read-back includes timezone Asia/Kolkata, prefix MX,
capacity 14, consultation 30 minutes, buffer 5 minutes, break 10:00–10:20,
appointments-only mode and queue 08:30–11:30.

### Failures found and resolved

- Initial fixture lacked the actual security-token bootstrap route; enabled the
  intercepted-mail auth harness. No failed-save response was counted as success.
- Initial fictional URL names contained uppercase letters; corrected the
  fixtures to satisfy the existing lowercase slug policy.
- Invalid-day tabs include “has errors” in their accessible names; corrected
  the exact-name test selector.
- Custom onboarding really lost optional times through captured-prop updates;
  fixed the functional-update adapter and verified persistence after reload.
- A physical double-click after successful retry could reach Cancel after the
  layout changed. The existing discard guard prevented loss; the test keeps
  editing and continues to verify stale-write safety.

## Reproduction and retained evidence

`pnpm test:schedules` runs the focused source/backend checks and dedicated
real-PostgreSQL browser suite. It is separate from mocked workspace tests.

Browser commands actually exercised:

1. `pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/schedule-persistence.config.ts`
   — initial 2 passed, 7 blocked/failed as described above.
2. Same command with `--grep 'real SQL|hidden-day|onboarding shared custom|onboarding linked-hours'`
   — 5 passed; two remaining flows isolated.
3. Same command with `--grep 'hidden-day|onboarding shared custom'`
   — final 2 passed, including the corrected onboarding adapter.

Additional checks: frontend and API typechecks passed; shared-library build and
OpenAPI generation passed; 54 focused source/backend tests passed, including
transactional rejection of invalid per-session settings, exact multi-day
registration persistence and idempotent retry. The migrated generic-form source
assertions are checked separately against their shared-editor replacements.

Screenshots are generated under
`generated-artifacts/schedule-persistence/{role}-{1366|390}.png`;
failure traces and snapshots are under its `results` directory. These generated
files are ignored by Git; this tracked report preserves the scenario verdicts.

### Broader checks and remaining boundaries

The last full `pnpm test:frontend` run was **not clean**: 714 passed, 50 failed.
Three obsolete scalar-schedule assertions were then migrated to the shared
controls and checked separately. Other reported failures include unchanged
notification UI expectations, CSS-governance assertions, inventory entries and
the existing registration-step normalization expectation. The broad suite was
not rerun or represented as passing; unrelated cleanup is outside this task.

Hosted UAT/production behavior, Safari/Firefox rendering, and live notification
delivery are **unverified** here. Existing dedicated follow-ups cover cross-
browser scheduling. No hosted state was changed, and no live-delivery claim is
made.
