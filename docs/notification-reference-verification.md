# Notifications reference-layout verification

## Changes and boundaries

Notifications owns its single heading and concise description. Scope and Optional
Delivery share the header; search and all three filters stay visible. Event
accordions have leading indicators, icons, actual option counts and explicit
full-group actions. Expanded sections use five aligned desktop columns and
responsive cards, labeled Edit actions, complete preview help and protected
required-message treatment.

The shared management projection supplies the canonical event metadata independently
of editable rows, activation and overrides. Clinic Admins can change their currently
owned clinic's optional gate and Email/SMS activation. This does not grant SMS
wording, platform security templates, System Admin recipient details, provider
configuration or another clinic's access. Mutations reuse the existing transactional
save path, revision checks, audit and pending-work cancellation. Viewing, filtering,
expanding or selecting scope performs no settings writes.

## Exact catalog diagnosis

Disposable PostgreSQL, System Default before (first occurrence in returned rows):

`booking`, `rescheduled`, `cancelled`, `completed`, `reminder`,
`patient_email_otp`, `onboarding`, `clinic_registration_otp`, `staff_setup`,
`password_setup_complete`, `doctor_setup`, `patient_login_otp`,
`registration_mobile_otp`.

Before, both fictional clinic selections returned:

`booking`, `rescheduled`, `cancelled`, `completed`, `reminder`, `onboarding`.

After, System Default and both fictional clinic selections have the identical
canonical section order:

1. `booking`
2. `onboarding`
3. `rescheduled`
4. `cancelled`
5. `completed`
6. `reminder`
7. `patient_login_otp`
8. `clinic_registration_otp`
9. `patient_email_otp`
10. `registration_mobile_otp`
11. `doctor_setup`
12. `staff_setup`
13. `password_setup_complete`

The seven required events are informational at clinic scope, marked **Managed at
System Default**, with no fabricated options or template content. No additional
omissions were found in either tested clinic. Ordering comes from shared event
definitions, not a hardcoded section count or saved rows.

## Default inventory — no default changes or migrations

- Existing appointment Email defaults cover booking, rescheduled, cancelled,
  completed and reminder for Patient, Clinic Admin and Doctor.
- Reuse the existing approved SMS publication/activation: eleven supported
  appointment combinations. Clinic Admin/Doctor rescheduled and reminder SMS
  remain subject to their existing explicit off publications; those four
  combinations were not reactivated.
- Receptionist appointment options remain outside the approved default-on
  activation. No new defaults were applied to them.
- Other optional event: clinic onboarding. Built-in Email fallback is enabled for
  Clinic Admin and System Admin; built-in SMS fallback is disabled. Saved
  platform/clinic choices take precedence. The authenticated Preview showed all
  four onboarding options disabled; this task did not change them.
- Security/OTP activation remains required. Provider readiness, published SMS
  metadata, valid recipients, assignments and personal opt-outs still apply.
- No activation maintenance command, seed reset, repeat migration, live message,
  provider probe, production/UAT edit or deployment was performed.

## Checks and evidence

- 53 distinct backend checks passed across
  `notification-settings.integration.test.mjs` (41) and
  `appointment-notification-activation.integration.test.mjs` (12).
  Disposable PostgreSQL and fake transports only.
- Covered own-clinic Email/SMS opt-outs, atomic conflict rollback, unchanged
  wording/drafts, unchanged platform/other-clinic settings, pending cancellation
  across both channels, no replay after re-enabling, personal opt-outs, required
  exemptions, SMS prerequisites, forged platform/security/System Admin recipient
  writes, ownership loss and SMS wording denial.
- Persistence was checked using fresh PostgreSQL connections and stop/start of a
  disposable HTTP server against its retained database. This is not evidence of
  a production process restart or a newly authenticated Clinic Admin session.
- 33 focused browser fixture tests passed. Real application CSS and fictional
  API responses, including scope selection, clinic-admin gate/group/row actions,
  confirmations, draft/discard recovery, retries, no false success, filters,
  canonical sections and keyboard/hover/touch help.
- Additional final visual assertions exercise the actual `.workspace` CSS context,
  including switch thumb containment and shape, after a legacy shell button rule
  was found to override the shared switch geometry.
- Frontend and backend typechecks, frontend production build and backend workflow
  build passed. Existing frontend bundle-size and source-map warnings remain.
- Workflows restarted and served requests without a startup exception.

### Visual evidence

`generated-artifacts/notification-reference/layout-comparison.html` is a
self-contained before/after comparison at **1440, 1024, 768 and 390 pixels**.
Before images were reconstructed from historical Git source with fictional
responses; they are not authenticated screenshots captured before editing.
After fixture images exercise real checked-in styles. Empty configured fixture
events show zero options honestly.

An authenticated native Super Admin Preview session was independently confirmed
with same-origin `/api/me` returning HTTP 200 and role `superAdmin`. It verified:
single title/description, System Default initialization, all canonical sections,
eight Booking options, no switches in required sections, preview access by
hover/keyboard/touch, independent help, and editor opening/cancellation without
non-auth writes. At all four widths the document had no horizontal overflow and
the checked controls and Edit action were contained.

Actual Preview screenshots:
`generated-artifacts/notification-reference/preview/templates-system-default-{1440,1024,768,390}.png`.
These were captured before the final route-local switch-specificity correction;
the correction is confirmed by the workspace-context fixture assertions.

### Limitations

The authenticated Preview pass did not finish selecting two clinics: its selector
matched hidden native filter options rather than the scope menu. Clinic-scope
informational states and Clinic Admin mutations were verified in fixtures and
disposable PostgreSQL, not in an authenticated Clinic Admin Preview session.
The actual-session logout was attempted but its final result was not captured.
No real Email/SMS delivery or provider acceptance was tested.
