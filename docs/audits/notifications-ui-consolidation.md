# Notifications: compact controls and configuration-identity audit

## Scope and safety

This is a presentation-only cleanup of `/admin/templates`. The supplied compact
reference guides layout, not catalog membership, event names or example counts.
No backend, API contract, schema, provider, published template, DLT ID,
publication provenance, draft record, permission or delivery mechanism changed.
No real configuration writes, messages, historical replay or hosted deployment
were performed. Browser writes are intercepted fictional requests; policy checks
use disposable PostgreSQL and fake transports.

## Identity and source of truth

An editable setting is identified by **scope + channel + original event +
recipient**, with the original event supplying its challenge/lifecycle purpose.
`notification-template-store.ts` constructs the persisted key using
`sms-template:` or `notification-template:`, clinic ID or `platform`, event, and
a recipient suffix except for the event's default recipient. Omitting that suffix
does not alias another recipient: `defaultRecipient` determines it per event.

The sources below are relative to `artifacts/api-server/src/`:

- `lib/notification-templates.ts`: `templateEvents`, `defaultRecipient`,
  `validTemplateTarget` define catalog membership and recipient/channel pairs.
- `lib/security-template-definitions.ts`: challenge purposes and security status.
- `lib/notification-template-store.ts`: key, effective published/default content,
  local saved draft, source and revision. Local published wording wins over
  platform published wording; absence uses the existing default. Drafts do not
  become dispatch content.
- `lib/notification-controls.ts`: per-pair delivery projection, timing and blocked
  reasons; `lib/managed-notification-settings.ts`: canonical sections and permissions.
- `lib/notification-outbox.ts`, `lib/notification-sms-outbox.ts`,
  `lib/appointment-confirmation.ts`: appointment capture and dispatch.
- `routes/auth.ts`, `lib/patient-login-sms.ts`, `lib/registration-mobile.ts`,
  `routes/staff-verification.ts`: separate authentication/proof paths.
- `lib/staff-account-notifications.ts`: staff-creation and welcome capture.

## Source-backed inventory

Here “staff” enumerates the roles in each row, not an additional recipient.
Operational rows retain platform/default and clinic override contexts. Required
security rows are edited only at System Default; clinic views retain their
existing managed-at-System-Default explanations, not copies of editable rows.
Clinic Admins see only owned-clinic scopes, can switch permitted optional
Email/SMS options, and cannot edit SMS wording or platform security.

| Original event / purpose | Channels and recipients | Source / distinction |
| --- | --- | --- |
| `booking` / booking committed | Email + SMS; Patient, Clinic Admin, Doctor, Receptionist | `routes/appointments.ts` → `enqueueEvent`. Patient email uses `capturePatientConfirmation`; generic email capture explicitly skips booking/patient. Same setting is not edited twice. |
| `rescheduled` / visit moved | Email + SMS; same four operational recipients | `lib/reschedule.ts` → `enqueueEvent`. Different lifecycle fact and values from booking. |
| `cancelled` / visit cancelled | Email + SMS; same four | `lib/appointments.ts` → `enqueueEvent`. Independent cancellation wording/activation. |
| `completed` / visit completed | Email + SMS; same four | `lib/appointments.ts` → `enqueueEvent`. Completion is not cancellation or booking confirmation. |
| `reminder` / upcoming session | Email + SMS; same four | Reminder capture in `lib/notification-outbox.ts`. Session-relative timing, not promised consultation time. |
| `onboarding` / clinic registration committed | Email + SMS; owning Clinic Admin, active System Admin observers | `lib/clinic-expansion.ts` → `enqueueEvent`. Different recipient authority from staff setup/welcome. |
| `booking_status_link` / explicit staff share | SMS; Patient only | Manual preview/confirmation, not lifecycle capture; both outboxes reject automatic capture of this event. Different approval and ownership constraints. |
| `patient_login_otp` / existing patient SMS login | SMS; Patient only | `lib/patient-login-sms.ts`. Unique existing-account login; not registration proof. |
| `patient_email_otp` / patient email identity | Email; Patient only | `routes/auth.ts`. Existing/new patient email journey, not SMS or owner registration. |
| `clinic_registration_otp` / clinic owner email proof | Email; Clinic Admin only | `routes/auth.ts`. Pre-account owner registration; independent of staff email proof. |
| `registration_mobile_otp` / pre-account phone proof | SMS; Patient and Clinic Admin | `lib/registration-mobile.ts`; owner flow also uses this shared registration mechanism. Two recipient rows in the existing Mobile verification presentation. No borrowed login/staff template. |
| `doctor_setup` / doctor secure setup | Email + SMS; Doctor only | Setup path in `routes/auth.ts`. Email carries the secure link; SMS is an advisory, not duplicate link delivery. |
| `staff_setup` / non-doctor secure setup | Email + SMS; Clinic Admin, Receptionist, System Admin | Same setup infrastructure, role-specific recipient pairs; not Doctor setup. |
| `password_setup_complete` / setup completion | Email + SMS; Clinic Admin, Doctor, Receptionist, System Admin | Completion path in `routes/auth.ts`. Acknowledges a different lifecycle fact from the setup invitation. |
| `staff_email_otp` / saved account email proof | Email; Clinic Admin, Doctor, Receptionist, System Admin | `routes/staff-verification.ts`; authenticated account proof, not pre-account clinic registration. |
| `staff_created_admin` / account committed | Email + SMS; creating System Admin, Clinic Admin or Doctor | `routes/resources.ts` → `captureStaffCreated`; addressed to the creating administrator's verified contact, not the new staff member. |
| `staff_welcome` / new staff contact verified | Email + SMS; Clinic Admin, Doctor, Receptionist | `captureStaffWelcome` from staff-verification; once per eligible contact/channel, not account creation or password completion. |
| `staff_mobile_otp` / saved account mobile proof | SMS; Clinic Admin, Doctor, Receptionist, System Admin | Intentionally **hidden** in Notifications before and after this cleanup. Persisted controls, proof, approval and challenge purpose are untouched. |

### Conclusions about apparent duplication

1. **Confirmed repeated navigation:** `NotificationScopeList` repeated the
   canonical scope selector, below groups for Superadmins and above them for
   multi-clinic owners. It never edited a second template. Removed that component,
   its list query, paging/search state, imports and route-owned styles.
2. **Unique discovery retained:** existing `ResourceLookup` already performs
   bounded server search, 20-item pages, subsequent-page loading, errors/retry,
   exact selected-label hydration and System Default selection. Owned clinic
   `SearchableSelect` keeps local search restricted to the authorized list.
   An owner without an initial clinic now still gets the canonical selector.
   Selection calls only the existing local guarded scope change, never a write.
3. **No confirmed duplicate editable template identity:** the existing event
   catalog enumerates each event/channel/recipient pair once. The mobile
   presentation maps registration into one group but passes its original event
   to the existing drawer and activation handler. No template pair was merged,
   removed, aliased or migrated.
4. **Intentional repetition:** equal text/DLT IDs across recipients, separate
   channels, independent lifecycle events, and a clinic inheriting platform
   wording do not establish duplicate configuration. Clinic overrides remain
   independently editable; default inheritance is not replaced by local writes.
5. **Dispatch limitation:** source inspection establishes distinct entry points
   and the explicit patient-booking-email exclusion. It does not establish what
   historical SMS actually reached a handset. Setup completion, welcome and clinic
   onboarding may occur near one another, but no same-purpose duplicate send was
   confirmed. Any incident needs separately authorized occurrence-level tracing;
   no sends were suppressed or trigger semantics changed here.

Earlier `registration-sms-administration.md` describes an older combined
registration/staff-contact presentation. The current explicit two-registration-row
requirement supersedes its UI description, not its proof/approval distinctions.

## Presentation and interaction changes

- One heading/search area with the existing Channel/Recipient/Status filters,
  conditional **Clear Filters**, one scope display/selector and Optional Delivery.
  No Module filter, Reset filter button, summary cards or extra search mechanism.
- Removed the introductory sentence and long permanent group instruction.
  Group help now explains timing/context and the complete **unfiltered** bulk
  scope; the same instructions remain attached to the group switch for assistive
  technology and in the existing confirmation. Consequential gate/provider/
  recipient warnings remain visible.
- Kept names, order, counts, collapsible groups, independent expansion, status
  chips, row/help switches and Edit actions. Enabled state remains separate from
  readiness; a gate-off warning does not claim security delivery is off.
- Matrix previews use `content.body`, not draft-preferring catalog rendering.
  Labels say Default, Published or Inherited published wording. A saved draft is
  explicitly marked **Draft saved; Edit opens draft**. “Published” describes
  wording source, not approval/readiness or guaranteed delivery.
- Existing search fields/behavior are retained: non-mobile draft text still
  matches when a draft exists, while mobile proof searches effective wording.
  The visible preview always remains effective wording, even for a draft match.
  No backend-rendered draft preview is mislabeled as active content.
- Edit keeps the existing drawer with exact original event/channel/recipient/
  clinic key. Advanced, optimistic revisions, confirmation, discard, busy locks,
  scope isolation and leave guards use the existing implementation unchanged.
- One coherent route stylesheet replaces overlapping historic rules. Narrow
  controls wrap and rows become cards; previews still use `OverflowText` for
  measured clipping, focus/Enter/touch reveal, Escape and coordinated dismissal.
  The application-wide styles, navigation and other pages are unchanged.

## Verification and reproducibility

Commands from the workspace root:

```sh
pnpm --filter @workspace/clinicflow typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
node --test artifacts/clinicflow/src/lib/{notification-presentation,notification-groups,mobile-verification-administration,notification-template-input}.test.mjs
node --test --test-name-pattern='scope policy batches|event activation batches|canonical sections|appointment SMS defaults|Required security effective-state|routes enforce' artifacts/api-server/src/notification-settings.integration.test.mjs
REUSE_TICKET_SERVER=1 pnpm exec playwright test --config artifacts/clinicflow/ticket-regression/playwright.config.ts notification-management.spec.ts notification-accordion.spec.ts --workers=1
```

`REUSE_TICKET_SERVER=1` is only for the already-running fictional regression
server on port 43719; otherwise omit it and let the existing configuration start
that server. Build requires PORT even though it does not start a listener.
Build passed with the existing large-chunk advisory, not an error.
The application workflow restarted cleanly.

Focused PostgreSQL policy checks: **6 passed**, with fake transports. Focused
helper checks including scope/preview source safeguards: **13 passed**.
Browser results are recorded below.

Before header consolidation, the 1366×768 fixture check measured the first
Booking trigger at y=218.77px (Superadmin) / 219.16px (Clinic Admin), 44px high.
This is an intermediate baseline captured with original header markup; the
stylesheet consolidation was being prepared concurrently, so these measurements
are not represented as a pristine old/new CSS benchmark.
The supplied long screenshot is the user's visual baseline, not a measurement
of this branch's fixture data.

Generated browser screenshots/traces belong under `generated-artifacts/`, not
Git. This tracked report retains reproducible commands, identities, measured
results and limitations even when ephemeral browser artifacts are unavailable.

### Final browser evidence

The single broad Notifications browser pass ran **42 checks: 41 passed and one
fixture-timing assertion failed**. It covered both role views; scope selection
and dirty/pending locks; gate/row/group cancel and save; stale/revoked/error
paths; full unfiltered group counts/actions; exact target identity; separate
Email/SMS published-vs-draft previews; discard; focus/Enter/Escape; clipping
reveal; and touch help. The failed new scope-search assertion clicked an already
loaded result before the existing debounce elapsed. It now waits for the search
request before selecting the result; it does not change production debounce or
query behavior.

Visual inspection also found and corrected two CSS issues: the staff shell's
input rule overrode search-icon padding, and narrow group titles broke inside a
word beside the count. The route now explicitly preserves search padding and
places the phone count beneath the title, rather than narrowing title text.

The subsequent **three targeted browser checks all passed**: the corrected
bounded-discovery test and new icon-clearance/intact-title/no-overflow assertions
at **1440px and 360px**. The full 42-check pass was not repeated after these
localized CSS and test fixes. No failing notification assertion remains
unresolved; the passing checks are not claimed as one fresh 44-test run.

| Evidence | Before consolidation | After consolidation |
| --- | --- | --- |
| Scope navigation | Selector plus separate scope-list presentation | One selector; no scope-list or list query |
| First Booking group, 1366×768 fictional Superadmin | y=218.77px; 44px high | y=144px; 44px high |
| First Booking group, same Clinic Admin fixture | y=219.16px; 44px high | y=142px; 44px high |
| Non-mobile preview with a saved draft | Draft body displayed without version label | Effective body, source label and explicit separate-draft notice |
| Discovery | Two scope browsing paths | Canonical lookup reached page 3 of 45 fictional clinics with requests bounded to 20, plus server search |
| Document width at 1440 / 360 | Not measured on pristine baseline | Equal to viewport with collapsed and expanded Booking; corrected headers also passed |
| Drawer | Existing shared drawer | Desktop right edge=1440px, width=560px; phone width=360px, all four footer actions visible |

The intermediate-before measurement caveat above applies to this table. The
layout is compared to the actual fixture, not illustrative reference counts.
No pixel-perfect or real-device acceptance is claimed.

Generated visual evidence:

- `generated-artifacts/notifications-ui/viewport-booking-expanded-1440.png`
  and `viewport-booking-expanded-360.png`: expanded real component with
  fictional responses.
- `generated-artifacts/notifications-ui/viewport-drawer-1440.png`
  and `viewport-drawer-360.png`: existing drawer, translucent overlay and footer.
- `generated-artifacts/notifications-ui/touch-help-open-360.png`: contextual help.
- `generated-artifacts/notifications-ui/fix-results/notification-management-se-fbfc4-words-stay-intact-at-1440px/corrected-header-1440.png`
  and `notification-management-se-05ec1--words-stay-intact-at-360px/corrected-header-360.png`
  in the same `fix-results/` folder: inspected final corrected headers.
- `generated-artifacts/notifications-ui/suite-run-notification-management-accordion.log`
  and `fix-check.log`: broad pass and targeted corrections.

The older configured whole-ticket workflow log reported unrelated appointment
detail failures and historical info-icon sizing failures. That old run is not
the result of this focused check. Notification help icons now have a route-owned
20px size; the four corresponding responsive checks passed in the focused run.
No unrelated appointment code or acceptance threshold was modified.

### Explicit limitations

Browser API responses are intercepted fictional fixtures with real production
components. Backend permissions/atomic writes are separately checked against
disposable PostgreSQL; this is not a live authenticated UAT acceptance claim.
The unauthenticated application screenshot showed the expected Staff Login
boundary, not the protected Notifications view. No real staff/patient records
were exposed. Real-device accessibility and provider-side acceptance/handset
delivery are not established by Chromium fixtures. No existing live records or
approved bodies/IDs were loaded for the inventory.
