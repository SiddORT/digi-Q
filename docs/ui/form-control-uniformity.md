# Bounded Form Control Acceptance Matrix

This inventory covers the approved form-control corrections only. It does not authorize live messages, provider probes, credential changes, real account writes, production repair or publishing.

| Production caller | Control and contract | Intentional exceptions / safety boundary |
| --- | --- | --- |
| SMS and Email `EventTemplateTest`, including Advanced inside the template drawer | Explicit shared variable metadata; Appointment/Previous Date use `DateFormatInput`; all four session clocks use `TimeFormatInput`; readable Title Case labels. Canonical picker state is serialized to the selected clinic's display format before the API receives it. | Session clocks never pass through browser `Date`/timezone conversion. Unknown variables, names, prose, references and queue tokens stay text. Security previews stay fictional/read-only, without a recipient/send action. Used-value, scope, revision, recipient and content changes retain signature invalidation. Explicit recipient, confirmation and immutable retry remain unchanged. |
| Notification Logs | Shared `FilterBar` right drawer and shared date/time entry. Open-ended bounds, explicit IST conversion, exact matching and cursor reset are preserved. | Clinic Name uses the bounded authorized lookup. Separate exact Clinic ID remains editable for legacy/deleted records; failed name hydration cannot clear it. Sender/recipient/reference remain exact text filters. |
| Communication Usage | Same draft Apply/Cancel/Reset drawer. All Time, Today, Last 7/30 Days, Current Month and Custom remain available inside it. Shared custom date/time controls interpret wall clocks as IST. | No draft is applied by selecting Custom or another preset. Report cards remain explicit applied-filter shortcuts. Source and cross-clinic scope stay Superadmin-only; attribution and counts retain their existing meaning. |
| Staff removal: visit handoff | Shared date picker and searchable Doctor/Location choices from the handoff response only. | Location choices come from the selected authorized doctor, not the general directory. Availability, session identity, revision, reviewed proposal and destructive-action confirmations are unchanged. A removed doctor/location cannot produce a ready move. |
| Staff removal: clinic responsibility handoff | Searchable Administrator choice from the authorized handoff response only. | No general administrator catalog is requested; a removed candidate is not reviewable. Review/commit protections remain server-authoritative. |
| Linked owner-doctor consultations | Searchable 20/30/60-minute duration selector, matching registration/scheduling; current nonstandard duration is explicitly labeled as a saved legacy value. | No implicit conversion, new minimum, session cap or schedule rule is introduced. Linking is an explicit schedule relationship, not a record-status switch. |
| Record editors, Users, SMS/Email provider enablement | Shared `StatusSwitch` for the two-state active/inactive record edit and provider enablement draft. | User deactivation retains its confirmation. Provider switches change drafts only and still require the existing save/password boundary. Filters, consent, selection, DLT requirements and mutually exclusive TLS/SSL/exception settings remain their existing controls. Read-only status badges remain read-only. |
| Email provider From Email / Test Email | Shared `EmailInput`; invalid addresses have local feedback and block the corresponding action. | SMTP Username remains text, not an email constraint. Test still uses saved configuration, explicit recipient and confirmation; no test is initiated by editing. |
| Registration email, patient login, registration mobile, booking mobile, staff contact proof | Shared string-based six-digit `VerificationCodeInput`, numeric keyboard, length/pattern, paste normalization and one-time-code autocomplete. | Leading zeroes retained. Submission is manual. No challenge identity/expiry/delivery policy changes. Optional mobile proof is not a member of the enclosing email verification form and cannot block email completion with an unfinished optional code. |
| SMS endpoint / Email template logo | Shared URL presentation/constraint feedback, with the caller's existing validation policy. | Empty Custom API endpoint retains keep-saved semantics; blank logo remains optional and internal stored logo paths remain accepted. No URL/provider probe is added. Server restrictions remain authoritative. |

## Regression Evidence

- `node --test artifacts/clinicflow/src/components/{form-control-contracts,form-control-callers,uniform-controls,notification-logs,communication-usage,sms-settings,email-templates,searchable-select-callers,form-standard}.test.mjs`
  covers all dynamic date/time keys and all display formats, minute preservation, leading-zero/paste behavior, malformed/partial/inverted IST bounds, historical IDs, caller adoption and existing request/confirmation policy assertions.
- Caller-handler regressions additionally execute the production email enablement/save path with a fake mutation sink, authorized visit handoff choices/removal, responsibility candidates and legacy duration changes. No real request is issued by these tests.
- `pnpm typecheck:libs` checks workspace exports; `pnpm --filter @workspace/clinicflow typecheck` checks application callers.
- `workspace-regression/FormControlFixture.tsx` renders production components rather than reimplementing controls. All acceptance browser traffic must be intercepted before navigation. The fixture is a development/test entry only, not a production route or authentication bypass.
- Browser evidence is stored under `generated-artifacts/form-controls/`; generated output is excluded from source control.

### Verified Results

- All 59 targeted frontend checks passed, including production caller handlers rather than only shared-control presentation.
- All 28 notification-template/value backend regressions passed with isolated fixtures.
- Workspace library checks, frontend TypeScript checks and the production build passed. The build retains its existing large-chunk advisory.
- Fictional intercepted browser journeys passed for SMS/email template fields, read-only security preview, invalid/incomplete values, display serialization and signature invalidation; and for Logs plus Usage as Clinic Admin/Super Admin, IST presets/custom bounds, exact fields, historical clinic IDs, pagination and drawer Apply/Cancel/Reset.
- Desktop and 390px calendar/time popovers retained parent drawers, restored focus on Escape and did not create horizontal overflow.
- The public landing-page screenshot and restarted frontend logs showed no manifest startup failure. This is not a claim about live authentication, real delivery, physical-device OS autofill or deployment acceptance.

## Coverage Guard and Native-Control Exceptions

`uniform-controls.test.mjs` checks the production callers listed above, including dynamic template dispatch and all five verification entries, not just shared component existence. Calendar, time and combined local-date/time native inputs must not bypass shared controls in these callers. Unknown template values are intentionally text-capable. Read-only log timestamps are formatted output, not editable controls.

Browser checks are fictional local acceptance, not proof of real provider delivery, OS SMS extraction, production permissions or a repaired account.
