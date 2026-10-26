# SMS diagnosis, fixes and UAT handoff

## Evidence and safety boundary

This is a workspace implementation and local verification, **not a UAT deployment
or live-delivery certification**. No provider request, real SMS, UAT write, inbox
access, historical replay, activation change, credential change or real booking
was performed. Database reads below were limited to development template settings;
all mutations used disposable fixtures. Actual dispatch still uses the effective
database publication, not `approved-appointment-sms.ts`.

Evidence levels:

1. **Supplied reference:** all eleven numbered entries in
   `attached_assets/Pasted-Sender-ID-DIGIQU-Product-Digi-Q-Company-ORTSPL-Status-D_1792978334807.txt`.
   Sender is DIGIQU. Its header says approval pending, its introduction says ten,
   but there are eleven entries. Login OTP has no DLT ID. These are documentary
   inconsistencies, not grounds to contradict the user's approval assertion or
   claim external DLT certification.
2. **Current source:** event contracts, real booking/action/registration routes,
   recipient resolution, editor, stores and both dispatch paths were examined.
3. **Read-only workspace database:** fifteen platform SMS publications; no saved
   clinic SMS overrides or SMS drafts. This is not the user's hosted database.
4. **Hosted evidence supplied by the user:** Booking/SMS/Patient revision 5,
   DLT ID 1777179180199333856, `queue_token` and a space before a full stop.
   Earlier hosted HTML/status evidence has truncated wording and cannot establish
   complete bodies, IDs, provider acceptance or receipt. No fresh hosted access
   was used.
5. **Disposable verification:** real lifecycle routes and SQL, fictional distinct
   identities, injected fake transports; intercepted-browser editor fixtures.
   None establishes live provider acceptance or handset receipt.

The earlier reported repeated-name message was an **automatic booking SMS**, not
an editor test. No matching historical event/deployment/message was available.
No direct patient-to-doctor name copying was reproduced; this work does not claim
to identify that historical message's cause.

## Supplied registrations and effective SMS inventory

P = patient, A = owning Clinic Admin, D = assigned Doctor, R = assigned
Receptionist, S = active Superadmin. “On” below means saved template activation,
not provider readiness. All fifteen saved platform records have blank sender
overrides and blank Entity IDs; sender therefore inherits the shared provider
configuration. That shared sender and external approval were not probed. Expected
reference sender is **DIGIQU**; fictional tests use synthetic settings, not evidence
of the configured hosted sender.

| Supplied entry | Event / recipients | DLT Template ID | Current workspace effective state |
|---|---|---|---|
| 1 Patient Login OTP | `patient_login_otp` / P | **Not supplied** | No publication/draft; inherited built-in, own security activation defaults on; no per-message ID. Not certified ready |
| 2 Patient Booking | `booking` / P | 1777179180199333856 | Platform publication on, revision 9, no draft; numeric `token_number`, exact registered punctuation |
| 3 Team Booking | `booking` / A, D, R | 1777179180212222829 | A on revision 3; D on revision 1; R inherited off, no publication/ID |
| 4 Patient Cancellation | `cancelled` / P | 1777179180230206932 | Platform on revision 1 |
| 5 Team Cancellation | `cancelled` / A, D, R | 1777179180247974768 | A/D platform on revision 1; R inherited off, no publication/ID |
| 6 Patient Completion | `completed` / P | 1777179180260833424 | Platform on revision 1 |
| 7 Team Completion | `completed` / A, D, R | 1777179180271292281 | A/D platform on revision 1; R inherited off, no publication/ID |
| 8 Patient Reminder | `reminder` / P only | 1777179180284769924 | Platform on revision 1 |
| 9 Clinic Onboarding | `onboarding` / A | 1777179180913265071 | No saved publication/draft; generic inherited SMS default off, no ID |
| 10 Clinic Admin Onboarded | `onboarding` / S | 1777179180324816576 | No saved publication/draft; generic inherited SMS default off, no ID |
| 11 Patient Rescheduled | `rescheduled` / P only | 1777179180927080590 | Platform on revision 1 |
| No supplied team reschedule/reminder registration | `rescheduled`, `reminder` / A, D | None | Four explicit platform off publications, revision 1, no IDs. **Preserved** |
| No supplied team reschedule/reminder registration | `rescheduled`, `reminder` / R | None | Inherited off. **Preserved** |

The original eight appointment registrations represent the existing **eleven**
activated/registered appointment combinations (P/A/D for booking, cancellation
and completion, P for reschedule/reminder). Their fixed words and IDs are
unchanged. Correcting team metadata adds the three explicitly supplied R
combinations to the reference map, making fourteen potential registered targets,
**not fourteen activated targets**. The receipt-protected development maintenance
operation still iterates only P/A/D and is not a startup/UAT synchronization tool.
Do not run it to transfer these changes: it can publish/activate within its
separately authorized maintenance scope.

Other effective SMS targets:

| Event | Valid SMS recipient groups | Inherited behavior / missing evidence |
|---|---|---|
| `staff_created_admin` | S, A, D | Off by default, no SMS publication/ID in workspace. Notice only to actual creator's verified contact |
| `staff_welcome` | A, D, R | Off by default, no SMS publication/ID. Once per new staff account/channel after that channel's contact proof |
| `registration_mobile_otp` | P, A | Platform security, default own activation on; no approved saved wording/ID. Optional mobile proof cannot replace required email proof |
| `staff_mobile_otp` | S, A, D, R | Platform security, default own activation on; no approved saved wording/ID. Separate verified staff contact |
| `doctor_setup` | D | Platform security, default own activation on; no approved saved SMS wording/ID; no bearer setup link in SMS |
| `staff_setup` | S, A, R | Same publication/ID blocker; email invitation link remains the setup mechanism |
| `password_setup_complete` | S, A, D, R | Platform security, default own activation on; no approved saved SMS wording/ID; one-time completion claim |
| `clinic_registration_otp`, `patient_email_otp`, `staff_email_otp` | **No SMS target** | Intentionally email-only, not missing SMS triggers |

No Superadmin appointment target exists. A receptionist can be an appointment
actor without receiving its SMS. Catalog presence does not mean publication,
activation, membership, proof or delivery eligibility. Source SMS fallback for
P/A/D appointment targets is broadly on, but these saved publications override
it, including the four explicit off rows. Security fallbacks cannot approve their
own wording; an activation-only record and a draft do not constitute publication.

## Before / after fixes

| Verified issue | Before | After / affected journeys | Evidence |
|---|---|---|---|
| Team recipient metadata | Supplied team lists R, source reference lists only A/D | Metadata lists A/D/R for booking/cancelled/completed; routing remains current clinic/branch assignments; no recipient enabled or saved template rewritten | Byte-for-byte supplied-word/ID assertions; default-off, fixture-only opt-in, unrelated-branch exclusion, duplicate assignment, shared phone, opt-out and revoked-membership regression |
| Security editor mismatch | Patient login and staff contact OTPs were not consistently classified as fictional-only; login could reach the operational test sender | All required events use fictional samples; login real editor tests rejected before transport; staff OTP targets exposed with correct channel/role rules | Fake send count zero for login/contact/setup; rendered security-policy unit tests; browser login/staff mobile controls contain no Send Test or consent control |
| Onboarding captured incomplete setup | Event captured before submitted setup policies and sessions were saved | Capture moved after successful setup writes, within the same transaction; snapshot includes saved policies and registered owner name | Real onboarding route, final `bookingHorizonDays`, inherited gate on/off, immutable receipt retry; setup failures retain rollback behavior |
| Onboarded owner confused with notice recipient | Only `recipient_name` available; a Superadmin recipient cannot represent the new Clinic Admin in supplied entry 10 | New onboarding-only `clinic_admin_name` comes from the identity-bound creation snapshot; recipient remains separately resolved; clinic name snapshot retained | Distinct onboarded owner, current owner recipient, platform observer and clinic; exact supplied #9/#10 bodies and DLT IDs through fake payload preparation |
| Primary owner email asymmetry (shared-helper compatibility) | Primary onboarding email lacked active-owner check and captured recipient binding; secondary recipients and SMS already rechecked | Current active Clinic Admin required at capture/dispatch; primary captures owner/contact identity rather than following a changed owner; active platform observer remains independent | Inactive capture, deactivate-before-dispatch, separate active platform observer; existing email and staff suites retained |
| Stale regression assumptions | Old whole-file hash excluded valid recipient metadata changes; old fixtures omitted visit mobile and expected obsolete role labels/catalog counts | Assert supplied literal bodies/IDs directly; fixtures satisfy current booking/contact/role contracts | Focused suites below; no production validation or disabled-button safeguard removed |

### Historical findings not confirmed as current defects

- The old claim “registration can submit notificationsEnabled=true after
  onboarding was captured with false” is **not a current public-route reproducer**:
  current `ClinicPolicy` accepts booking horizon/cancellation cutoff only and strips
  that field. No new registration notification setting was added. The real fix is
  final saved setup capture, not an assertion that today's public UI could enable
  that discarded gate field.
- Current direct-password staff creation does not require invitation/SMTP/SMS
  delivery. Current channel-specific proof releases the corresponding welcome
  once. The former invitation-only assumption is obsolete.
- Receptionist routing already exists and rechecks clinic/branch assignment and
  active status. The verified discrepancy was metadata, not a missing broadcast.
- Empty samples disabling Render Preview, missing phone/consent/readiness disabling
  Send Test, and unchanged wording disabling Save Draft are **correct** safeguards.
  Advanced must be opened to interact with the editor test panel.
- Revisions, draft isolation, reset inheritance and durable request deduplication
  already work; they were verified rather than replaced.
- Missing onboarding/setup/OTP publications and missing IDs are configuration/
  evidence blockers, not permission to invent wording, IDs or activate messages.

## Variables, identities and role/journey coverage

| Journey / initiating roles | Authorized recipient and value behavior | Verification |
|---|---|---|
| Guest and patient booking; S/A/D/R staff booking | Patient and assigned doctor labels from committed visit snapshot, not acting user. Team notice to owner/assigned doctor; R only with independently saved opt-in. Current eligible unique contacts, clinic gate and personal opt-outs apply | Real guest/patient/staff creation and final fake SMS payloads, all eleven existing approved appointment combinations; fictional patient/doctor/owner/desk have distinct identities |
| Cancellation by patient or permitted staff | Cancellation snapshot only; latest cancel reason trimmed; absent reason is `Not specified`, not another action's reason | Actual patient cancellation; every recipient's value preparation; all supported fixed bodies preserved |
| Completion by permitted clinical staff | Completion captured from real call-next → start → complete transitions; actor is not a replacement patient/doctor | Real doctor queue actions; patient/owner/doctor exact registered text |
| Cross-doctor reschedule by owning admin | New doctor ID/name, destination date/session/token; structured old session separately retained. P-only registration remains P-only | Actual reschedule route to distinct fictional doctor; old/new values and snapshot-identity mismatch denial |
| Reminder worker | P-only registered SMS; session timezone and one-hour timing, not a promised consultation time; bounded dispatch allowance; revision/status/check-in rechecked | Real scheduler capture and fake dispatch; midnight/noon/12h/24h, date format and non-server timezone tests |
| Clinic registration / S-created clinic onboarding | Owner recipient and active S observer separate from creating actor; public clinic booking link, not private ticket/QR; final setup transaction controls capture | Actual onboarding creation/retry, inactive owner test, exact supplied onboarding fake SMS bodies |
| Patient registration, email login/contact proof, mobile registration proof | Required email identity; optional phone proof cannot create a session, merge accounts or change another patient's contact | Native-auth fixtures: separate purposes/channels, expiry, attempts, resend remaining expiry, shared-phone denial |
| Patient SMS login | Existing unique active patient only; six-digit OTP, actual remaining expiry rounded up to minutes; no code/history persistence or synthetic identity | Fake transport native-auth success/expiry/shared-number/changed-contact/rejection/unknown tests. Existing OTP-only publications remain compatible |
| Direct-password staff creation by S/A/D as permitted | Creation independent of delivery; actor notice only to creating administrator's matching verified channel; role label is actual saved role, not generic staff | Staff-accounts fixture tests cover all created roles, permission failures, independent proof/welcome, channel-specific once-only claims |
| Legacy doctor/staff setup and completion | D setup uses D; A/R/S use staff setup; no bearer URL in SMS; own platform security activation, not optional clinic gates; completion once | Native-auth invitation/acceptance fixtures including failed/unknown transport, expiry and exact role labels |

`queue_token` remains the full saved token (for example `Q-007`).
`token_number` remains its positive numeric sequence (`7`). They are not aliases.
Date/session values are saved local calendar/clock values, not converted through
the server timezone. Empty required values, malformed OTP/expiry, unknown event
variables and mismatched appointment snapshot IDs fail preparation; equal names
alone are valid. `clinic_contact` is optional. New `clinic_admin_name` cannot be
guessed for legacy onboarding snapshots without its owner label. Existing legacy
clinic display fallback remains same-clinic only.

## Editor and dispatch invariants retained

- Preview renders current unsaved text and exactly its used sample placeholders.
  Security previews use fixed fictional credentials, regardless of caller samples.
- Save Draft does not change the effective publication. Publish changes wording
  while the UI carries the current activation; it does not queue a message.
  Low-level publication APIs still validate enabled SMS metadata.
- Reset removes this scope's wording/draft to inherit its parent (or built-in
  default). It increments the revision; it is **not** revision rollback.
  Security reset preserves independent activation. Appointment inheritance that
  changes off→on retains the existing prospective cutover barrier.
- Revision conflicts keep local edits and require explicit discard/reload.
- Test send requires a real Superadmin, explicit recipient, confirmation, current
  revision and actor/request-bound durable claim. The same request never dispatches
  twice; reusing its ID with another payload conflicts. Unknown results remain
  non-retryable; only definite pre-dispatch failure/rejection permits an explicitly
  confirmed new test.
- Development automatic capture/worker restrictions remain unchanged. Isolated
  tests use `NODE_ENV=test` with injected transports; this is not a server-setting
  recommendation. Automatic worker starts only in production. Security OTP actions
  are separate direct flows: do not exercise real ones under this implementation's
  no-send authorization.

## Required saved-template action for the screenshot

The workspace's current revision 9 is already correct. **Do not infer UAT is
correct from that.** If UAT still matches the supplied revision-5 screenshot,
the authorized operator should inspect the current effective publication and
any draft, then explicitly edit Booking / SMS / Patient with its **current**
revision. Keep DLT ID **1777179180199333856** and existing activation/opt-outs.
Recommended exact body:

```text
Dear {{patient_name}}, your appointment with Dr. {{doctor_name}} is confirmed for {{appointment_date}}. Queue No: {{token_number}}. Expected time: {{session_start}}. Please arrive 10 minutes before your expected time. - Digi-Q
```

Specifically use `{{token_number}}.` (not `{{queue_token}} .`). Do not trim,
reword, globally rename tokens or overwrite custom bodies/drafts automatically.
This is a database publication action; **Git push does not perform it**.

For supplied onboarding entry 10, the correctly mapped optional authoring form is:

```text
A Clinic Admin, {{clinic_admin_name}}, has been successfully onboarded on Digi-Q for {{clinic_name}}.
```

The code supports that variable but does not publish the body, supply approval
evidence or enable its recipients. Existing missing-publication/wording work
remains separate. For entry 9 the name is `recipient_name` and the link is
`booking_link`. Login OTP ID remains unknown; no ID was borrowed from an
appointment or contact-verification registration.

## Local verification and known limitations

Run from workspace root. All test transport destinations and credentials are
fictional and isolated.

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/sms-dynamic-variables.integration.test.mjs \
  artifacts/api-server/src/notification-template-values.test.mjs \
  artifacts/api-server/src/notification-settings.integration.test.mjs \
  artifacts/api-server/src/appointment-notification-activation.integration.test.mjs \
  artifacts/api-server/src/registration-onboarding.integration.test.mjs \
  artifacts/api-server/src/native-auth.integration.test.mjs \
  artifacts/api-server/src/notification-templates.test.mjs
```

Focused run: **134 passed, 0 failed** before the additional supplied-onboarding
payload assertion. The final rerun of `notification-template-values.test.mjs`
passed **16/16**, including that exact supplied #9/#10 payload assertion.
The first diagnostic run exposed obsolete fixture expectations;
they were corrected without weakening production requirements.

Additional unchanged supporting suites passed in the initial run:
`staff-accounts.integration.test.mjs`, `booking-notifications.integration.test.mjs`,
`notification-sms-transport.test.mjs`, `notification-sms-diagnostics.test.mjs`.
Frontend render/logic suites: **22 passed**, including security target matrix,
drawer rendering, email compatibility, recovery controls and sanitized errors.
Chromium isolated management/accordion tests: **38 passed**; new SMS editor
tests: **3 passed** after fixture bootstrap/Advanced-opening corrections.
The entire production signed-in UI and Safari/Firefox were not exercised.
The public app screenshot loaded cleanly and both managed app services restarted.

API typecheck and API build passed; the configured web build
(`PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build`) also
passed, with its existing large-chunk warning. `pnpm run typecheck` fails in the existing mockup sandbox's
Vite config; the separately run ClinicFlow typecheck also reports incompatible
Vite plugin types in its existing config (two installed YAML peer variants).
No errors were reported in the changed application modules before those config
errors. This dependency/typecheck issue is not an SMS fix and was not repaired
by casting away types or changing packages. Initial direct web build needed the
documented `PORT`/`BASE_PATH`; the correctly configured retry passed.

## User-owned server deployment and controlled verification

1. Back up/inspect UAT's current template publications, drafts, revisions,
   activation, recipient preferences and server configuration. Do not import the
   workspace database or run the maintenance activation/registration helper.
2. Push/merge the code and use your existing self-host build/restart procedure.
   There is **no database schema migration** in this change. A full strict build
   may encounter the independent Vite typecheck problem above; do not hide it.
3. Keep server-only settings out of Git. Existing encrypted integration settings
   can override environment defaults. Preserve the encryption key for saved vault/
   history readability. Verify the chosen provider mode, endpoint, client ID,
   key/bearer credentials and Sender ID using existing server settings, not by
   copying development secrets. Confirm sender **DIGIQU** against your provider.
4. Relevant existing setting names: `NOTIFICATION_SMS_PROVIDER`,
   `NOTIFICATION_SMS_KEEP_IN_TOUCH_URL` (Keep in Touch endpoint, if customized),
   `NOTIFICATION_SMS_URL`/`NOTIFICATION_SMS_MAPPING` (generic provider),
   `NOTIFICATION_SMS_KEY`, `NOTIFICATION_SMS_BEARER_TOKEN`,
   `NOTIFICATION_SMS_CLIENT_ID`, `NOTIFICATION_SMS_SENDER_ID`,
   `NOTIFICATION_SMS_COUNTRY_CODE_FORMAT`, `NOTIFICATION_SMS_ENABLED`.
   Keep in Touch uses Sender ID and each message's DLT Template ID, not Entity ID;
   generic DLT-required mappings also require `NOTIFICATION_SMS_ENTITY_ID`.
   Do not assume key/bearer equality or change country-code mode without evidence.
5. `CLINICFLOW_PUBLIC_ORIGIN` must identify the actual canonical public site for
   clinic-scoped links. `NODE_ENV=production` is required for the existing
   automatic worker; it is not authorization to turn notification gates on.
   Keep SMS operational channel, clinic gate, event activation, personal opt-outs
   and platform security activation separate. Existing SMTP/email settings are
   unchanged and remain necessary for email identity/setup paths.
6. Git does not transfer bodies, DLT IDs, drafts, sender overrides or activation.
   Review the exact screenshot correction above in UAT. Receptionist metadata does
   not publish its registration or opt it in. Missing onboarding/security
   publication and login-ID approval remain separate explicit actions.
7. Controlled hosted-send work remains the separate appointment-notification UAT
   task and its own recipient authorization. Use **new** authorized fictional
   visits with distinct patient/doctor/actor/owner/desk identities. Verify captured
   event, effective scope/revision/body, intended recipient and final provider
   payload; then observe provider outcome and handset independently. Do not use
   real security codes/inboxes here, replay old jobs or automatically retry an
   unknown dispatch.

### Diagnose outcomes without replay

| Observation | Meaning / next check |
|---|---|
| No event/occurrence | Confirm an actual committed new journey and deployed code version; catalog/readiness alone does not capture anything |
| `disabled`, `no_recipient`, `not_attempted` | Examine gates/activation/opt-out, current membership/contact, development restriction or dedup decision; not a provider rejection |
| `pending` | Captured, waiting for eligible worker/due time; not sent |
| `configuration_failed`, `preparation_failed`, `pre_dispatch_failed` | Known not dispatched: inspect ID/sender/publication/required values; correct only the verified cause, not a blanket retry |
| `obsolete` | Saved visit status/revision/time or recipient eligibility no longer matches; old event must not be forced through |
| `sending` then stale/unknown | Durable dispatch claim may already have reached provider; do not retry |
| `provider_rejected` | Explicit provider refusal, not inferred from every HTTP error; inspect sanitized category/configuration |
| `provider_accepted` | Provider's configured acceptance contract matched; **not handset delivery** |
| `delivery_unknown` | Timeout, ambiguous response or crash after claim; no automatic retry or history replay |
| Handset independently observed | Separate receipt evidence; record only sanitized confirmation under the controlled UAT task |

