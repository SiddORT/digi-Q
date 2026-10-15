# ClinicFlow notification journey coverage audit

**Read-only audit · 15 October 2026 · workspace code and development metadata**

> Historical pre-activation snapshot. The development activation and current
> 30-combination readiness matrix are recorded in
> [Appointment notification activation](appointment-notification-activation.md).
> That change supersedes this audit's default-off observations for the five
> appointment events and patient/owning Clinic Admin/assigned Doctor only.

## Executive answers

- **Email and SMS are not universally enabled by default.** The shared operational `notificationsEnabled` fallback is **false**. Individual email templates may default on, but that does not open the clinic gate. Optional operational SMS templates default off. Configured channel switches default permissive when absent; a provider still has to be configured.
- **Required security email is different:** registration OTP, patient email OTP, staff/doctor password invitation and initial-setup completion bypass optional channel/clinic switches. That is an attempted security action, not a guarantee of delivery. Conditional registration/setup SMS requires eligible mobile, explicitly published approved wording and valid provider metadata.
- **Patient booking cannot select a registration/setup template through the normal code path.** Creation fixes the event to `booking`; its patient email resolves `booking/patient`, and its operational outboxes use `booking` recipient variants. Neither the booking form nor booking source supplies a template event. Setup, onboarding and registration use distinct keys.
- **Custom published booking wording can nevertheless be misleading.** Operational validation checks supported placeholders, sizes and formatting, not the meaning of a subject or prose. A booking template can say “Doctor password setup” without selecting the actual setup event. Patient confirmation appends factual ticket details when custom wording omits `appointment_details`; it does not correct a misleading custom subject or introduction.
- **The editor and the actual default patient booking subject do not match.** Editor: `Booking confirmation — {{clinic_name}}`. Actual built-in delivery: `DigiQ Doctors — Appointment confirmation`. Published custom patient booking templates do use the resolver's rendered subject and prefix.
- **Rescheduling does enqueue a notification.** There is no confirmed missing reschedule trigger. Default patient wording shows old and new details; secondary staff wording omits old details unless customized.
- **No UAT inbox or handset delivery is certified.** No real send, configuration write, template publication, approval, deployment, credential inspection or replay was performed.

## 1. Evidence and environment boundary

This audit traces current workspace source, executes existing isolated regressions, renders fictional messages, and reads a narrow projection of development policy/template metadata. It is not a security scan or a claim that the separately hosted UAT build matches this workspace.

| Evidence | What was observed | What it cannot establish |
| --- | --- | --- |
| Current source | Route → committed action/event → resolver → recipient → transport/worker | Effective UAT settings or deployed source parity |
| Authorized read-only development SQL | Policy booleans; published subject, activation, revision, draft flag and safe content-presence checks only | Provider credentials/readiness, UAT policy, full semantic approval of published bodies |
| Fictional regression fixtures | Disposable PostgreSQL, injected fake SMTP/SMS or fake provider transport | Live provider acceptance or recipient receipt |
| Pure-render preview export | Actual built-in ticket renderer and all valid email event/recipient default renderings | Saved published wording or message delivery |
| Existing UAT readiness document | Previously recorded unauthenticated health success and configuration routes returning 401 | Not a fresh UAT check; no authenticated UAT configuration access was available in this audit |

No database identities, clinic names, addresses, real codes/links, provider responses, encrypted credentials or outbox payloads were requested. Development SQL used SELECT only. Existing clinic records were not modified. Disposable tests write only their own isolated fixtures.

### Observed development effective settings

At the time of this audit:

- Saved platform policy: `notificationsEnabled: false`.
- Nine clinic records: all inherit the platform policy; none has a clinic notification override. Thus all nine effective operational gates are **off** in this development snapshot.
- No clinic-published template rows were returned.
- Only the following platform-published template rows were returned. All have no draft, no subject prefix, and the exact saved subject `Booking confirmation — {{clinic_name}}`.

| Channel / event / recipient | Published activation | Published revision | Safe body/metadata observations |
| --- | --- | --- | --- |
| Email / booking / receptionist | On | 1 | Contains `appointment_details`; no setup/registration/password/invitation word matched |
| SMS / booking / patient | On | 8 | No `appointment_details` block; DLT template metadata present; no setup/registration/password/invitation word matched |
| SMS / booking / clinicAdmin | Off | 2 | No `appointment_details` block; DLT template metadata present; no setup/registration/password/invitation word matched |

These local saved activations differ from built-in recipient defaults but **do not override the effective off clinic gate**. Other event/recipient selections inherit built-in defaults in this snapshot. The word check is only a narrow screen, not a semantic review; absence of `appointment_details` also does not prove missing facts, because individual visit placeholders or literal text may be used.

**Not observed:** effective provider readiness, channel-switch values, SMTP/public-origin validity, SMS sender/DLT approval, current published body semantics, worker health, or acceptance/receipt. No authenticated UAT administrator session or UAT database access was available. Workspace secret names are not readiness evidence. Do not treat Replit-managed production data as the separately hosted UAT database.

## 2. Selection, gates and recipient rules

### Template selection

Operational events resolve **clinic published → platform published → built-in**, separately for each event, recipient and channel. Drafts do not affect dispatch. Email subjects prepend a nonempty published prefix, separated by a space. Reset restores inheritance; explicit published opt-outs remain authoritative.

Required authentication templates are platform-owned; clinic editors cannot override them. Security email is validated again before sending. SMS registration/setup refuses default-only content even though its fallback is marked Required. The existing patient SMS-login template is a separate exception: it may use its built-in content when the configured provider's sender/DLT requirements can be met.

Templates are resolved again at dispatch. Newly enabled templates cannot resurrect older captured events; optional events skipped while disabled do not become a replay backlog.

### Gate shorthand used below

**O (optional operational):** clinic/platform effective gate true; corresponding Email/SMS channel switch permissive; valid effective published/default activation; configured provider; eligible active contact; current recipient ownership/assignment and current visit revision/status; no duplicate occurrence/contact or prior uncertain dispatch. Automatic outbox worker is production-only (30-second polling). Development records no-attempt decisions instead of queuing operational sends. Patient booking email is a separate post-commit path and refuses automatic non-production sends.

**E (required security email):** valid platform template with required variables, SMTP configuration and action authorization/rate limits. Invitations additionally require configured HTTPS public origin and active staff eligibility. Optional channel/clinic switches are bypassed. These authentication actions are immediate, not governed by the production operational worker.

**S (conditional required security SMS):** eligible voluntary/saved mobile, provider configuration, explicitly published approved registration/setup content, required OTP/expiry or token-free setup wording, and provider-specific metadata. Optional channel/clinic switches are bypassed. Keep in Touch requires Sender ID + event DLT Template ID; generic providers use their configured DLT policy. Metadata presence is not regulatory approval.

**L (patient SMS login):** separately selected SMS channel; exactly one active existing patient account matching saved phone; platform `patient_login_otp`; valid OTP body and provider/sender/DLT; bounded expiring challenge. Bypasses optional switches. No phone-only new account, staff MFA or simultaneous routine email+SMS login.

Patient booking confirmation has first priority for shared email deduplication. Secondary recipients use the owning Clinic Admin, assigned treating doctor, or branch/clinic receptionist assignments—not the person clicking Book. Shared addresses/numbers are deduplicated. Superadmins receive only onboarding operational notices, not every appointment. SMS and email have independent claims/outcomes.

## 3. Journey-to-trigger coverage

“Default” below means built-in behavior, not a statement about enabled UAT communications. All operational rows are blocked by the observed development gate.

| Action and entry point | Trigger / event and recipient | Email / SMS behavior and default | Prerequisites, intentional distinctions |
| --- | --- | --- | --- |
| Clinic Admin self-registration start and email resend (`POST /auth/register/start`, `/auth/registration/resend`) | `clinic_registration_otp` → prospective Clinic Admin | Required email on via E; optional supplied mobile → `registration_mobile_otp` via S | Email proof mandatory; SMS proof cannot replace email. Same email event on resend, remaining challenge expiry. |
| Registration verify (`/auth/register/verify`) | Consumes email challenge, creates Clinic Admin with chosen password/session | No additional welcome/password-setup email at this point | Password already chosen; does not use staff invitation or completion event. |
| Self-service clinic creation (`POST /clinic-registration`) | `createOwnedClinic` → `onboarding` → owner and active System Admins | Owner + System Admin email defaults on via O; SMS off | Clinic creation is separate from identity registration. See capture-order finding below. |
| Administrator-created clinic onboarding (`POST /clinic-admin-onboarding`) | New owner + clinic transaction; `onboarding`; post-commit `staff_setup` invitation to new Clinic Admin | Optional onboarding email via O, independently required setup email via E; token-free setup SMS via S if mobile eligible | No registration OTP for administratively created identity; configuration preflight before save. Setup invitation failure retains saved account/clinic and explicit resend recovery. |
| Doctor created with new login | Resource staff save → post-commit `inviteStaff` → `doctor_setup/doctor` | Required setup email via E; conditional token-free SMS via S | Doctor identity and valid assignment/ownership; no plaintext password; already credentialed login is not a new setup invitation. |
| Receptionist/other supported staff created | Staff save → `staff_setup` with actual recipient role | Same E/S behavior; Required email on | Clinic Admin accounts use dedicated onboarding, not generic creation. Superadmin template target support alone does not prove a separate automatic bootstrap invitation. |
| Explicit invitation resend (`POST /users/:id/resend-invitation`) | `deliverInvitation` → same doctor/staff setup event | Same E/S template selection as initial invitation | Authorized scoped administrator; active target without password; throttled. Existing resend-concurrency task remains separate. |
| Initial password invitation accepted (`POST /auth/invitation/accept`) | Commit password/session plus one-time completion claim → `password_setup_complete` to that staff role | Required acknowledgement email via E; eligible mobile via S | Exactly the winning initial acceptance notifies. No acknowledgement for replay, ordinary password change or reset; failures do not undo password. Doctor role says doctor; other completion roles currently say “staff member.” |
| Patient email registration/login (`POST /auth/patient/start`, `/auth/patient/resend`) | `patient_email_otp/patient` for new or existing eligible email | Required email via E; optional registration mobile proof uses S, not login SMS | Generic response does not certify account existence or delivery. New patient account only after email proof; profile completion has no separate welcome notification. |
| Optional registration phone request/resend and verify (`/auth/registration/mobile/request`, `/verify`) | `registration_mobile_otp` for patient/Clinic Admin, bound to email intent | SMS only via S; no email template for this event | Independent proof; five-attempt/original-expiry boundary; skipped/unverified number not saved as new patient phone identity. |
| Existing patient chooses SMS login (`POST /auth/patient/start`, channel sms) | `patient_login_otp/patient` via L | SMS only; built-in required template on; no simultaneous email | No match or ambiguous shared phone fails closed without new account/session; another request invalidates prior challenge. |
| Ordinary staff login (`POST /auth/login`) | Password verification → session | **No routine email or SMS notification** | Intentional SMTP-independent email/password login; retired device endpoint fails closed. Not a missing OTP trigger. |
| Staff-created booking (`POST /appointments`: Clinic Admin, doctor, receptionist; also authorized System Admin) | Shared `bookAppointment` commits `booking`; then separate patient confirmation | Patient + owning-admin email defaults on via O; doctor/reception email off; all operational SMS fallback off | Actor role does not change event/template. Patient email independent of asynchronous owner outcome. |
| Signed-in patient booking (`POST /appointments`) | Same committed `booking`; own-patient scope | Same O recipient defaults | Terms/mobile rules apply; no setup/registration event chosen. |
| Public QR/guest booking (`POST /public/guest-requests`, compatible booking route) | Same `bookAppointment` in guest policy; post-commit patient confirmation | Same O; absent optional contact means no patient channel send, not booking failure | Immediate ticket; no account creation/password invitation. No-email booking can still notify eligible owner. |
| Reschedule (`POST /appointments/:id/reschedule`) | `reschedule` persists new coordinates/revision then `enqueueEvent("rescheduled", updated, oldRow)` inside transaction | Patient email on; secondary email off; all SMS fallback off via O | Old/new snapshots distinct; before-check-in and scope/cutoff rules. Real trigger present. Default secondary wording loses old details. |
| Cancel (`POST /appointments/:id/actions`, action cancel) | `transition` → `cancelled` | Patient email on; secondary email off; SMS fallback off via O | Current cancellation snapshot; optional `cancel_reason` can be used; fallback reason “Not specified” when absent. Default body omits reason. |
| Complete visit (same route, action complete) | `transition` → `completed` | Patient thank-you email on; secondary email off; SMS fallback off via O | Not emitted by all status changes: check-in/call/no-show do not select completed/cancelled. |
| Reminder (production worker) | `reminderDue` → `reminder` around one hour before session start in its timezone | Patient email on; secondary email off; SMS fallback off via O | Only waiting/booked, not checked in. 59–60-minute capture window; already queued reminder allows up to five-minute delay. Revision/status rechecked; session range, not promised consultation time. |
| Password recovery (adjacent boundary) | `/auth/forgot-password` or assisted recovery → reset link | Hardcoded required email, no SMS; not template-managed | Exact subject below; not initial-setup completion. Existing recovery-email task owns readiness remediation. |

## 4. Exact email titles, subjects and content alignment

All “effective” claims in this section refer only to the observed development snapshot. Except the published receptionist booking entry, no email overrides were returned; therefore built-in selection applies there. **Every UAT effective subject and prefix remains unverified.**

| Event / editor title | Exact default subject (unsubstituted) | Recipient/body assessment |
| --- | --- | --- |
| `clinic_registration_otp` / Clinic Admin registration verification | `Verify your DigiQ clinic registration` | Correct administrator-registration purpose; code + remaining expiry, email proof instruction, explicitly not doctor invitation. |
| `patient_email_otp` / Patient email verification | `Patient email verification` | Correct email OTP and expiry; same wording for registration and existing-account email login (“verification,” not a separate welcome). |
| `doctor_setup` / Doctor password setup | `Doctor password setup` | Correct invitation to doctor; recipient, role, single-use setup link and expiry; never password. |
| `staff_setup` / Staff password setup | `Staff password setup` | Correct generic invitation; role substituted as Clinic Admin or staff member. Supported recipient variants share subject. |
| `password_setup_complete` / Password setup completed | `Password setup completed` | Correct acknowledgement, no password, warns to contact administrator if unexpected. Non-doctor completion says staff member rather than exact administrative role. |
| `booking` / Booking confirmation — patient editor | `Booking confirmation — {{clinic_name}}` | Editor body greets patient, confirms visit and includes canonical details/reference. Actual built-in delivery below bypasses this wrapper/footer. |
| `booking` / actual built-in patient delivery (no separate editor row) | `DigiQ Doctors — Appointment confirmation` | Canonical clinic/location, doctor, date/session/timezone, reference/token and clinic contact. No attachment/private bearer ticket link. |
| `booking` / Booking confirmation — Clinic Admin, doctor, receptionist | `Booking confirmation — {{clinic_name}}` | Generic “Clinic notification,” patient/doctor/details/reference/contact matches staff audience; not setup. Saved **receptionist** email subject observed exactly equal to this; on at revision 1. Owner/doctor inherit built-ins. |
| `onboarding` / Clinic onboarding — owner | `Clinic onboarding — {{clinic_name}}` | Correct checklist for opening hours, sessions, assignments before sharing link. Default body does **not** insert `booking_link`, though supported in custom templates. |
| `onboarding` / Clinic onboarding — System Admin | `Clinic registered — {{clinic_name}}` | Correct registration notice, recipient name and contact; not an instruction to set up the recipient's password. Default on. |
| `rescheduled` / Appointment rescheduled | `Appointment rescheduled — {{clinic_name}}` | Patient: old and new visit details/reference. Secondary roles: generic new details only, without previous session. |
| `cancelled` / Appointment cancelled | `Appointment cancelled — {{clinic_name}}` | Correct cancellation heading and rebook advice; canonical details include token/timezone. Default does not show reason. Canonical ticket instructions still say keep ticket/check in, which is confusing after cancellation. |
| `completed` / Thank you after your visit | `Thank you after your visit — {{clinic_name}}` | Patient: thank-you and contact, no session/reference block. Secondary: generic staff details. Appropriate brief acknowledgement, not a booking confirmation. |
| `reminder` / Appointment reminder | `Appointment reminder — {{clinic_name}}` | Upcoming session details/reference and explicit no-exact-consultation-time warning. Secondary generic body retains canonical session disclaimer. |
| Recovery / no notification-template editor row | `DigiQ Doctors account access` | Hardcoded “Use this link within 30 minutes” plus HTTPS reset URL. Does not contain password. Sender configuration separate from routine login. |

`registration_mobile_otp` / **Optional registration mobile verification**, and `patient_login_otp` / **Patient login OTP** have **no valid email target**, despite having subject-like SMS metadata labels. They are not missing email sends. SMS login body is `Your DigiQ Doctors login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.` Registration-mobile body similarly identifies DigiQ mobile verification.

Security content requires OTP/expiry, invitation email link/expiry, and bans arbitrary literal URLs/email destinations; SMS cannot contain bearer setup links. This is structural protection, not proof that every permitted prose sentence matches its event. Operational content is less restrictive. Rendered HTML escapes content and patient values; substitution is single-pass.

## 5. Prioritized discrepancy matrix

These are audit findings, **not implemented fixes or permission to enable anything**.

| Priority / classification | Evidence and impact | Disposition |
| --- | --- | --- |
| P1 — confirmed capture-order discrepancy | `createOwnedClinic` enqueues `onboarding` before `saveClinicSetup` persists input policies. With prior effective gate false and creation policy true, capture sees false and records disabled instead of queuing the welcome. A later policy save does not replay it. Applies to both clinic-creation entry points. | Requires separately approved correction/regression. Not caused by missing template or provider. Source-order finding; not claimed as a newly exercised full route scenario. |
| P1 — unverified live readiness | No authenticated UAT policies, effective published bodies, SMTP/SMS readiness, sender approval, worker or receipt evidence. Development has gate off and some template activations on. | Existing controlled UAT/notification settings/SMS approval tasks; no live certification or activation. |
| P2 — confirmed default preview/delivery mismatch | Patient editor subject/body wrapper vs special built-in `confirmAppointmentEmail` path; exact differing subjects above. Default footer/greeting also differs. | Separate alignment decision needed; do not silently change wording or dispatch path in an audit. |
| P2 — confirmed default secondary reschedule omission | Non-patient defaults all use generic body without `previous_details` or structured old date/time placeholders. Actual enqueue passes old row, so data exists but body does not use it. | Default-off secondary recipients; if enabled, audit their published wording before rollout. |
| P2 — misleading custom wording is allowed | `validEventContent("booking", …)` accepts subject “Doctor password setup” and prose “Your registration is ready.” This preserves booking binding but can confuse recipient. | Confirmed isolated validation assertion; no such development published subject observed. UAT published semantic review remains open. |
| P2 — confirmed inactive-owner onboarding email asymmetry | Primary owner onboarding email uses a null primary target; the dispatch “no appointment” branch loads owner but does not check owner status. Secondary System Admin/staff and SMS targets do check active status. | Source-inspection finding, not evidence of an actual inactive-owner send. Separate active-owner safeguard needed; catalog presence does not establish eligibility enforcement. |
| P3 — default cancelled message retains generic ticket arrival instructions | `confirmationText` is reused with only its first heading replaced. Remaining text still says keep ticket/check in when arriving, inside a cancellation notification. | Body-content alignment issue; cancellation title and state are correct. |
| Deliberate restriction — not a defect | Operational gate fallback false; SMS fallback off; required email bypasses optional settings; setup SMS refuses unapproved defaults; staff login has no routine OTP; phone-only signup absent; optional contacts can mean no send. | Preserve as intentional; no enablement or auth redesign authorized. |
| Deliberate recipient/content difference | Owner notices independent of patient confirmation; doctor/reception default off; System Admin only onboarding; completed thank-you omits detailed visit; default cancellation omits optional reason. | Not a missing trigger merely because a template exists or the body is shorter. |

No duplicate booking trigger was demonstrated: retries use the original committed appointment and durable occurrence/dispatch claims. Patient direct confirmation and owner outbox are separate recipients, not a duplicate-event bug. Unknown delivery is never permission to retry.

## 6. Verification record and reproducibility

Run from workspace root:

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/native-auth.integration.test.mjs \
  artifacts/api-server/src/booking-notifications.integration.test.mjs \
  artifacts/api-server/src/notification-template-values.test.mjs \
  artifacts/api-server/src/notification-settings.integration.test.mjs
node artifacts/api-server/src/test-support/export-notification-audit.mjs
```

**Result in this session: 68 passed, 0 failed, 0 skipped (56.3 seconds).** Expected simulated-failure warnings appeared; a PostgreSQL client concurrent-query deprecation warning is existing test-harness debt, not a failed assertion. The four suites cover:

- Native staff SMTP-independent login; registration/patient email and separate SMS login; optional-gate bypass; independent registration channels; resend/expiry/attempt protection; approved security content; doctor/staff setup and one-time completion.
- Actual staff, patient and guest booking routes with shared committed tickets; correct owner, doctor opt-in and address deduplication; failed/unknown dispatch independence and no retry sends.
- Real template-store resolution, all four patient/staff recipient renderings, old/new reschedule values, cancellation reasons, active System Admin onboarding and canonical booking fields.
- Six operational event captures and independent channels, reminder timezone/revision eligibility and delayed dispatch, encrypted settings/readiness contracts, activation/draft rules, future-only behavior, and uncertain-delivery safeguards.

The booking suite exercises actual creation entry points; reschedule body/dispatch tests enqueue isolated event snapshots, while the actual reschedule handler's event selection was confirmed by source trace. These are different evidence levels. This audit does not claim an end-to-end browser rescheduling or live scheduling-worker test.

The export script retains only pure renderers in a bundle and asserts zero runtime imports; it never opens a database or transport. Its compiled public-origin fallback is a fixed example.invalid value, not live environment configuration. It verifies the exact default patient subject source, secondary reschedule omission and acceptance of misleading operational wording. **Export assertions passed: 32 email event/recipient previews, 33 SMS fallback previews, plus the actual built-in patient booking message.** It produces the complete fictional preview appendix and a self-contained HTML report. Fictional OTP `123456` and example.invalid link are nonfunctional.

### Remaining boundaries

No runtime application/configuration changes were made, so no app restart or browser interaction test was needed. No external provider, DNS/TLS connection test, real message or authenticated UAT operation was attempted. Configuration-readiness booleans alone would still not prove acceptance; provider acceptance would still not prove receipt. Full saved body review and live receipt require the already separate authorization.

Related work remains separate: `docs/notification-settings.md`, `docs/registration-setup-notifications.md`, `docs/booking-email-uat-readiness.md`; existing proposals for staff password recovery, invitation resend concurrency, owner “never queued” diagnosis, approved registration/setup SMS wording, controlled public-booking and registration UAT, and broader backend-suite reliability. This audit neither duplicates those fixes nor closes their acceptance gaps.

## 7. Source evidence index

Paths below are relative to `artifacts/api-server/src/`.

| Concern | Source and relevant symbol |
| --- | --- |
| Defaults and merge order | `lib/store.ts`: `defaultSettings`, `getSettings` |
| Exact titles, defaults, semantic limits, render | `lib/notification-templates.ts`: `eventTitles`, `defaultTemplate`, `validEventContent`, `renderNotification`; `lib/security-template-definitions.ts`: `securityTitles`, `securityDefault` |
| Published precedence/security scope | `lib/notification-template-store.ts`: `resolvedTemplate`, `templateCatalog`, `saveTemplate` |
| Security delivery | `lib/security-notifications.ts`: `securityEmail`, `securitySms`; `routes/auth.ts`: `mailCode`, `mailLink`, `updatePassword`, registration/login/resend routes |
| Existing patient phone login and registration proof | `lib/patient-login-sms.ts`; `lib/registration-mobile.ts` |
| Optional gates/provider policy | `lib/notification-controls.ts`: `eventControls`; `lib/integration-config.ts`; `lib/integration-vault.ts`; `lib/notification-sms-transport.ts`: config/metadata/payload/readiness |
| Booking route parity | `routes/appointments.ts`: `bookAppointment`; `routes/guest-requests.ts`; `lib/appointment-confirmation.ts`: `confirmationText`, `confirmAppointmentEmail` |
| Lifecycle capture/dispatch | `lib/notification-outbox.ts`: `enqueueEvent`, `processNotifications`, `reminderDue`, `startNotificationWorker`; `lib/notification-sms-outbox.ts` |
| Clinic/staff creation and resend | `lib/clinic-expansion.ts`: `createOwnedClinic`; `routes/clinic-expansion.ts`; `routes/resources.ts`: `createClinicAdminOnboarding`, `deliverInvitation`, resend route |
| Changes and structured values | `lib/reschedule.ts`: `reschedule`; `lib/appointments.ts`: `transition`; `lib/notification-template-values.ts` |
| Editor source (read only) | `artifacts/clinicflow/src/components/EmailTemplates.tsx` (workspace-relative): catalog-backed event title/content and preview |

The generated fictional previews follow in the downloadable report; the separate Markdown appendix is `docs/audits/notification-journey-previews.md`.
