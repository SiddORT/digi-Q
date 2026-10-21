# SMS dynamic variables — verification

## Outcome and evidence boundary

The verified corrections are exact account-role labels, event-specific variable
availability, identity-bound booking snapshot labels, and fail-closed preparation.
The reported historical SMS was a successful **automatic booking SMS outside
Replit Preview**, not a template test. No matching deployed booking/message was
available in the authorized workspace records, and no direct patient-to-doctor
copying defect was established. These corrections do not prove that incident's
root cause or repair its deployed records.

No live messages, provider probes, activation, old-job replay, production access,
data repair or deployment were performed. Fake-provider acceptance is not handset
delivery evidence.

## Expected versus actual variables

All examples below are fictional fixture values. The authoring and rendering
contract covers the existing 23 variables; no new placeholders were introduced.

| Variable | Before | Expected and verified actual |
|---|---|---|
| `role_name` | Invitations used `doctor`/generic staff; completion mapped every non-doctor to `staff member` | Actual account role maps to **Doctor**, **Clinic Admin**, **Receptionist**, **Superadmin** for both invitation and first completion |
| `patient_name` | Live patient label; absent names were not checked by the shared validator | Captured patient: `Patient Person`; edited live names cannot replace it |
| `doctor_name` | Saved doctor label, but not checked for absence | Captured booked doctor: `Doctor Person`; real cross-doctor movement renders `Nila Sen` |
| `clinic_name` | Live clinic label, unlike embedded appointment details | Captured clinic: `Fictional Clinic`; unchanged after a live clinic rename |
| `recipient_name` | Actual eligible recipient, but validation was incomplete | `Patient Person`, `Owner Person`, `Doctor Person`, `Reception Person`; remains current and identity-bound, not replaced with booking actor |
| `appointment_details` | Saved clinic/doctor labels could disagree with top-level fields; incomplete details could contain missing values | Same snapshot clinic/doctor/session as individual placeholders; incomplete captured details block dispatch |
| `previous_details` | Broadly available; prose could survive without structured prior details | Rescheduling only; complete captured previous booking details, otherwise explicit preparation failure |
| `reference` | Not checked by the shared referenced-value validator | `FICTIONAL` or the real fixture booking reference; required if referenced |
| `timezone` | Could use current clinic fallback | Captured `Asia/Kolkata` / `UTC`; required if referenced, no timezone guessing |
| `clinic_contact` | Optional current clinic details | Still optional and current; an empty value does not block a message |
| `booking_link` | Current scoped canonical clinic route | `https://booking.example.invalid/fictional-clinic`; actual booking fixture uses `/lakeview`, never `/foreign` or a private ticket link |
| `appointment_date` | Shared with unrelated operational events | Appointment events only: `15/01/2030`, using current clinic formatting preference |
| `session_start` | Session-start meaning retained | `09:00`; actual cross-doctor movement changes `00:00` to `13:00`, not estimated consultation time |
| `session_end` | Session-end meaning retained | `12:00`; missing referenced session end blocks preparation |
| `previous_date` | Allowed on unrelated events | Rescheduling only: `14/01/2030` |
| `previous_session_start` | Allowed on unrelated events | Rescheduling only: `14:00` |
| `previous_session_end` | Allowed on unrelated events | Rescheduling only: `17:00` |
| `queue_token` | Full token | Still `Q-007`, including prefix and padding |
| `token_number` | Numeric queue number | Still `7`, not `Q-007`; missing/invalid numeric values fail if referenced |
| `cancel_reason` | Allowed on unrelated events | Cancellation only; current cancellation reason or exactly `Not specified` |
| `otp` | Security-specific variable | Still security-only; fictional `123456`, no blank/invalid code dispatched |
| `expiry_minutes` | Security-specific variable | Still security-only; fictional `10` / `30`, no blank/nonpositive expiry dispatched when referenced |
| `setup_link` | Setup-specific variable, no SMS bearer links | Still setup-email only in dispatch; fictional HTTPS setup URL; missing link blocks setup email |

Only clinic/recipient/contact/public-link variables are available for onboarding.
Security events retain their narrower event-specific catalogs and delivery gates.
Previous-session variables are exclusive to rescheduling; cancellation reason is
exclusive to cancellation.

## Failures, preservation and compatibility

- IDs and relationships are checked, never display-name inequality. Legitimate
  equal patient/doctor names pass.
- Missing required referenced values, mismatched booking identities and
  incompatible saved publications do not reach the provider. History/outbox
  provide safe preparation reasons without copying provider responses.
- Incompatible publications receive explanatory previews. They are not rewritten
  or republished. Explicit reset and activation-only changes remain usable.
- Activation does not approve unpublished security SMS. Expiry, mandatory proof,
  opt-outs, eligibility, current contacts and no-replay rules remain in place.
- Missing old structured/composite snapshot data fails safely; no stored records
  are backfilled from today's names. Existing previous-session-only fields can
  still render when their required structured values exist.
- Substitution remains single-pass. Braces inside a person's name or cancellation
  reason are not interpreted as another variable.
- Shared booking email and queued email use the same snapshot labels and required
  value checks. No unrelated email copy/layout or ticket-email redesign was made.

## Approved-content evidence

`artifacts/api-server/src/lib/approved-appointment-sms.ts` is unchanged from the
pre-task source. Both source versions have SHA-256:

`0db17698beb642cba9b5f0bc2e058019fc85116b83f4d2f39b8694269dd3b3ba`

The source-byte assertion protects literal words, spaces, punctuation and all
eight DLT IDs covering the eleven enabled event/recipient combinations:

| Event | Patient DLT ID | Clinic Admin / Doctor DLT ID |
|---|---|---|
| Booking | `1777179180199333856` | `1777179180212222829` |
| Cancellation | `1777179180230206932` | `1777179180247974768` |
| Completion | `1777179180260833424` | `1777179180271292281` |
| Reminder | `1777179180284769924` | Not among the eleven approved SMS combinations |
| Rescheduling | `1777179180927080590` | Not among the eleven approved SMS combinations |

SMS schema parsing now preserves leading/trailing body spaces instead of trimming
them. Provider registrations, sender settings and stored real publications were
not edited. The deployed example `DR-03` remains unexplained; neither numeric
`token_number` nor full `queue_token` was silently redefined to match it.

## Verification

Tests use disposable PostgreSQL, real booking/action/rescheduling routes and
persisted outbox records, with injected SMS and intercepted mail transports.
They do not use workspace booking data or contact real recipients.

- `sms-dynamic-variables.integration.test.mjs`: all eleven approved combinations;
  patient, reception and anonymous guest booking; cancellation, actual queue
  start/completion, reminder scheduling, cross-doctor/date/time rescheduling;
  profile edits after capture, composite details, distinct actor/recipient,
  equal names, missing legacy labels, ID mismatch, current optional contact and
  clinic-scoped public links. Exact final payload and DLT ID assertions.
- `notification-template-values.test.mjs`: all 23 variables/event restrictions;
  missing required values, optional cancellation/contact, date/time preferences,
  prior snapshots, incompatible legacy publication, reset/activation/no replay,
  SMS whitespace, single-pass escaping and fake security/email callers.
- `staff-invitation.integration.test.mjs`: actual saved accounts of all four
  roles through the invitation service and password-acceptance route, plus
  existing persistence/resend tests.
- `notification-templates.test.mjs`: template authoring, authorization, email
  rendering, recipients, deduplication and no replay. Old fixture assertions
  were aligned with the already-approved default-on appointment policy.
- `appointment-notification-activation.integration.test.mjs`: exact approved
  registrations, byte preservation, drafts, explicit activation/reset and
  fake-only channel dispatch.
- `notification-settings.integration.test.mjs`: security delivery, configuration,
  previews, histories, preferences, prospective activation and independent
  transport/preparation behavior. Incomplete hand-built booking fixtures were
  given explicit snapshot labels; no production check was relaxed.
- `booking-notifications.integration.test.mjs`: real native-session guest,
  patient and every permitted staff creation, tickets and shared email callers.
- `notification-sms-transport.test.mjs`: provider payload, full-template bodies,
  token metadata, safe diagnostics and bounded transport behavior.

API/frontend typechecks pass. The frontend production build passes with nonfatal
source-map, CSS-minifier and bundle-size warnings. API and frontend workflows restart successfully.
The public landing-page screenshot loads without a manifest error; it does not
verify the signed-in template editor. No additional signed-in browser journey or
live delivery was claimed.

## Historical incident still unresolved

To establish the original deployed cause, authorized read-only evidence would
need to link that booking, patient and doctor IDs/accounts, rendered SMS history,
published template revision and deployed version. Workspace fixture success
cannot establish which code/template/data produced the historical handset SMS.
