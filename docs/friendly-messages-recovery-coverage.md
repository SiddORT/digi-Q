# Friendly messages and recovery actions

## Boundary and discovery

This record covers the existing ClinicFlow/DigiQ application, not the deck or design sandbox. The approved registration screenshot is an example, not the coverage boundary. Discovery reused `docs/messages-and-dropdowns-audit.md` and the existing search/ticket technical-error findings; it did not treat every item in that audit as permission to delete information.

No authentication, verification, role/record authorization, recipient eligibility, notification activation, message templates, credentials, billing, or delivery authority was changed. No real email/SMS tests, live bookings, production/UAT edits, or deployments were performed. Browser fixtures use fictional data and intercepted transports; their default transport fails closed.

## Message and action inventory

| Surface / previous wording | Actual state | Plain-language treatment | Permitted action / authority |
|---|---|---|---|
| Registration email: “Provider accepted…delivery is not confirmed” | Request accepted, inbox receipt not proven | “Check your inbox and spam folder for the verification code. If it doesn’t arrive, request another code when the timer ends.” | Existing Verify, timed Resend code and Change details; server code/session validity unchanged |
| Registration rejection / pre-dispatch / unavailable | Required email verification incomplete, known no-send | Email could not be sent / was not sent; ask system administrator to check email settings | Existing timed resend; existing Change details keeps draft. No invented support destination or unauthorized settings link |
| Registration uncertain | Send not confirmed | Check inbox/spam before timed resend | Existing server-authorized resend; no automatic request or eligibility claim |
| Registration disabled | Sending deliberately off | Email sending is turned off; verification still required | Honest administrator assistance; required verification not bypassed |
| Registration “challenge / email proof / intent” | Saved verification session / registration draft | Verification session, email verification, this registration | Existing recovery receipt, resumed draft, previous-code handling, review/back/details flow preserved |
| Optional registration mobile | Separate optional verification | Optional mobile verification, mobile verified for this registration | Existing Request SMS / Verify mobile and cooldown, extended by server wait; cannot replace email |
| Patient code/login | Privacy-sensitive account eligibility | Check for verification code; shared privacy-safe unknown state | Email/SMS controls, Verify, Change Email/Mobile, timed Resend; entered email retained |
| Staff sign-in / demo sign-in | Credentials, throttling or access unavailable | Contextual safe errors, no server response interpolation | Existing submit guarded while pending; server wait countdown; no account eligibility disclosure |
| Password completion | Password saved even if notification failed | Explicit password saved success, notification separately explained | Continue to workspace handles refresh failure without losing success; sign-in alternative. Unauthenticated completion uses existing sign-in success flag |
| Expired / incomplete password link | Link no longer usable / missing | No false delivery claim; request a new link | Existing password recovery link for reset; staff login/help for invitation. No invented invitation resend authority |
| Access / exact record | 401, 403, 404 vs transient read | Session ended / no permission / unavailable record vs could not load | Sign-in links for 401; Close/Back on missing or denied records; transient refetch only |
| Workspace search | One category/page failed | Couldn’t search that category, no raw exception | Retry only failed source, retain query and successful sources; failed load-more preserves loaded rows; Close stays available |
| Unexpected-page fallback | Render exception | Safe explanation without development preview exception block | Existing Try Again; diagnostics remain in console, not user-facing page |
| Ticket recipient check | Preview GET failed | Couldn’t check recipient | Per-row retry of preview only; no send. Close invalidates stale preview completions |
| Ticket ineligible / wrong recipient | Known sending requirement unmet | Plain reason or honest clinic-admin assistance | Existing recipient edit/record workflow; 409 offers Review recipient, not blind repeated send |
| Ticket accepted | Email request accepted, delivery not proven | Email submitted, inbox delivery not confirmed | Done/Close; submitted rows never encouraged to resend |
| Ticket uncertain / lost response | Same-request result unresolved | Explicit unconfirmed result | Check same request retains original request ID; no blind fresh dispatch; accepted rows preserved |
| Ticket known failure / mixed batch | Some accepted, unknown, failed, skipped or unchecked | Separate submitted/unconfirmed/not-completed/can’t-email/unchecked counts | Retry only failed row with original request; send remaining eligible rows only; selected successful rows remain intact |
| Manual booking-status SMS | Preview/send result | Plain submitted / couldn’t send / not sent / sending unconfirmed | Scoped preview retry, same-request reconciliation, rate wait, Done for accepted, no expanded recipient authority |
| Operational load / directories / dashboard / booking policy / reports | Read failed | Shared safe load explanation | Actual query refetch; no mutation replay; permanent errors do not gain a retry |
| Mutations / bulk changes | Save not confirmed | Review current details before another change; no false “nothing saved” guarantee | Existing explicit form or bulk action; never automatic replay |
| Exports / QR / documents | Generated read or file failed | Contextual safe explanation instead of raw exception | Existing Export/Download/Print controls; filters and selections retained; bulk PDF completeness unchanged |
| Email/SMS settings load/save | Read failed or settings saved without delivery test | Checking settings / couldn’t check SMS settings / settings incomplete / settings saved, delivery hasn’t been tested | Existing settings/check buttons under existing operator role gates |
| Connection checks / storage | Configuration check, not delivery proof | Check settings, settings complete/incomplete, contact server operator when appropriate | Existing check/settings controls; useful connection/key/path/API diagnostics retained separately |
| Template preview/test | Rendering failed, wait limit, definite not-sent, accepted or uncertain | Safe main summary; actual returned sending state, never HTTP success as proof | Existing preview/send consent boundary; timed same-request check; no retry for permission errors; technical result details remain available to authorized Superadmin |
| SMTP/SMS connection test | HTTP 200 may still mean rejected, known not-sent or uncertain | Summary uses channel status, not HTTP status or raw response | Accepted same test disabled; uncertain/error reuses request ID; explicit fresh tests retain consent and limits |
| Test email receipt | Operator assertion, separate from transport | Couldn’t check receipt / refresh status / receipt not confirmed | Refresh status actually refetches; manual receipt confirmation remains actor/configuration bound |
| Staff creation/invitations / clinic completion | Account/clinic saved independently from notification | Saved/created success retained; invitation submitted or unconfirmed separately | Existing Staff Management and workspace controls, no duplicate account creation instruction |
| Notification/owner booking history | Read-only sending history | Submitted / not sent / sending unconfirmed / settings incomplete | Refresh status only; no history replay. Authorized diagnostic HTTP/API details not deleted |

## Route and role coverage

**S** means source/handler and shared-consumer inspection, not a signed-in browser journey. **F** means actual component rendered with fictional/intercepted data in the dedicated fixture or isolated render tests. A shared component check is not proof that every route/role combination was opened. Permission logic and backend state machines remain unchanged.

| Routes / page families | Roles / branches checked in source | Coverage and recovery ownership |
|---|---|---|
| `/`, `/guest-booking`, `/scan-qr` | Public, guest; signed-in landing branches | S: directory search/filter/locations retries scoped to their actual queries; scan retry uses existing camera control |
| `/:clinicSlug`, `/:clinicSlug/:branchSlug`, `/book/:reference` | Public, guest, patient, staff following public booking intent | S: safe clinic/page errors, find-clinic/home fallback, retry only transient reads; saved booking form flow unchanged |
| `/live-ticket`, `/display/:reference`, `/check-in` | Public ticket capability, display capability, authorized check-in staff vs patient | S: revoked/private capability errors retain closed/private state; no new private authority; check-in access load uses status-aware recovery |
| `/sign-in`, `/patient-login`, `/sign-up`, `/login`, `/register` | Staff and patient entry/aliases, patient signup vs login and SMS vs email | S + F: shared channel notices, patient access render variants, intercepted patient wait/change-details journey |
| `/register-clinic`, `/register-doctor`, `/onboarding` | Anonymous owner, signed-in doctor/Clinic Admin/patient as already permitted | S: account review/email/mobile/draft/session/completion receipt branches; F: notice and optional-mobile render states. Full owner creation deliberately not run |
| `/forgot-password`, `/reset-password`, `/set-password`, `/demo-login` | Unsigned staff, signed-in password completion, demo | S: safe errors and waits, success action; F: password completion with notification rejection and workspace continuation. No real reset/demonstration account altered |
| `/admin/dashboard`, `/doctor/dashboard`, `/receptionist/dashboard`, `/patient/dashboard` | Superadmin/Clinic Admin, doctor, receptionist, patient | S: access/summary read errors use shared notices; successful/stale summary retained |
| `*/appointments`, `*/book` | All permitted workspace roles and role-specific patient/booking branches | S + F shared record/ticket dialogs: safe errors, recipient checks, uncertain/accepted/mixed results, original request identity retained. No live booking |
| `*/queue`, availability/session queues | Staff operational vs patient visibility branches | S: queue refresh/loading/private capability failures; existing stale/offline guards retained; no automatic operational mutation |
| `*/patients`, patient exact record/timeline/clinical/document/activity drawers | Staff scoped access; patient own views | S + F shared ExactRecordDrawer: transient, 401, 403, 404. CapabilityView retains permission/not-supported distinctions and Close in host drawer |
| `/admin/clinic`, `*/clinics`, `*/branches`, `*/qrs` | Superadmin/Clinic Admin, doctor/receptionist assigned scope | S: shared directory/selected-record/error translation and existing draft guards; public links/QR exports remain separate from private IDs |
| `*/users`, `/admin/staff`, `/admin/system-users`, `/admin/doctors` legacy redirect | Owning Clinic Admin, Superadmin, assigned doctor staff branches | S: direct creation vs invitation outcomes, contact verification, directory/record errors; no account/assignment changes |
| `*/availability`, `*/exceptions` | All existing authorized staff branches | S: shared notices and field validation; schedule conflict/concurrency warnings and existing load controls retained |
| `*/profile`, `*/settings` | All workspace roles; doctor/patient profile branches | S: shared read/mutation translation, contact verification waits, existing form values/actions; passwords continue to be cleared after sensitive auth attempts |
| `/admin/reports` and report dashboard/templates/usage | Superadmin/Clinic Admin and assigned report scopes | S: query retry separate from export failure, filters retained, billing/delivery limitations retained |
| `/admin/masters`, `/admin/permissions`, `/admin/audit` | Existing administrative role guards | S: generic resource/error helpers; validation and useful audit diagnostics retained |
| `/admin/communication` notification/email/SMS/logs tabs; legacy email/template/integration/settings links | Superadmin settings/test authority; Clinic Admin permitted notification preferences/usage only | S + isolated helper/render tests: settings summaries, diagnostics separation, actual status reporting, same-request test identity and receipt refresh. No live send |
| Demo workspace branches, unknown paths, role/access fallbacks | Demo identity; missing role; denied role; unexpected render failure | S + F: safe fallback without raw diagnostic preview; existing role menus unchanged |

## Verification evidence and limitations

- Shared-library type build: `pnpm run typecheck:libs` passed. Initially stale generated type outputs caused frontend failures; rebuilding the unchanged shared types resolved them.
- Frontend: `pnpm --filter @workspace/clinicflow typecheck` passed.
- Focused Node/render tests cover technical error inputs, safe waits, permanent versus transient reads, all channel outcomes, required email versus optional mobile, patient access branches, session lifecycle, staff notices, integration/template behavior and SMTP receipt.
- Focused Node/render result: **56 passed, 0 failed**. `git diff --check` passed. These are isolated frontend checks, not proof of real delivery or every signed-in role journey.
- Dedicated browser suite: `pnpm --dir artifacts/clinicflow exec playwright test --config workspace-regression/friendly-messages.config.ts`. Results are recorded below after the single fixture pass. It intercepts every API request, with no live dispatch.
- Browser result: **22 passed, 0 failed** — 11 cases each at desktop and 390px mobile. Actual consumers exercised registration channel notices, transient/401/403/404 record drawers, server wait expiry, scoped recipient preview retry, mixed ticket results and same-request reconciliation, retained patient email with timed verification recovery, category-only search retry, safe unexpected-page fallback and password success despite notification rejection.
- Browser harness correction: the fictional transport needed to intercept the existing CSRF endpoint before protected requests. That correction was limited to the test spec. Desktop/mobile security, patient and ticket screenshots are stored under ignored `artifacts/clinicflow/generated-artifacts/friendly-messages/`; the separate preview capture is under ignored root `generated-artifacts/friendly-messages/`.
- Managed frontend restarted once after implementation and served cleanly. Preview screenshot at 390px shows practical verification guidance and separate rejected/not-sent/uncertain/unavailable/disabled notices without horizontal overflow.
- No real signed-in role matrix, provider delivery, actual inbox/handset receipt, production/UAT configuration, live mutation, deployment, Safari or Firefox coverage is claimed.
- Existing unrelated workflow output is not a new verification claim. Any earlier broad ticket-suite failures must be distinguished from this isolated pass and from deliberately changed wording expectations.

### Completion validation follow-up

The first completion check passed the backend contention, movement, communication-usage and database-compatibility commands and the completion review, but `pnpm test:tickets` reported 157 passed and 8 failed. Four failures were old SMS wording expectations. One booking-save test inspected the mock payload synchronously instead of waiting for the request. Three bulk-PDF cases exposed a real regression: removing the internal `failed —` marker from the sanitized message meant the existing results classifier no longer displayed/counting failed rows. The marker was restored without restoring raw exceptions, the approved wording expectations were updated, and the save assertions now wait for their actual payloads. Completion validation is required again; these corrections are not themselves a claim that the full suite passed.
