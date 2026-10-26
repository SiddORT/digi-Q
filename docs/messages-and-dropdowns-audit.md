# Messages and dropdowns audit

**ClinicFlow / DigiQ · 26 October 2026 · Recommendations for approval — not implemented**

## Executive summary

The supplied Book Appointment screenshot identifies a shared problem, not an isolated page: operational facts, instructions and background policy are presented at the same visual weight. The highest-impact changes are:

1. **P1 — Session picker:** separate time/capacity from a short, accurate availability status. Keep the actual blocking reason discoverable without making every option a paragraph.
2. **P1 — Booking guidance:** one instruction for the current step; one authoritative explanation per blocking condition. Move general walk-in background to the booking-mode help and ticket expectations to confirmation.
3. **P1 — Notification bell:** short previews, a clear detail action, safe wrapping and non-stretching read actions. Keep an explicit recent-list scope beside the bulk read action.
4. **P2 — Shared states:** remove duplicated empty/error prose, not recovery controls. Audit disabled-option reasons and clipped-value reveals before adopting shorter labels broadly.
5. **P2/P3 — Caller copy:** shorten a few operational links, repeated queue labels and generic “nothing here” guidance. Existing concise page introductions generally need no further rewrite.

This is **not** a recommendation to remove every blue banner or replace all messages with tooltips. Consequential warnings stay visible. No application code, records, read states, settings, delivery rules or eligibility rules were changed.

## 1. Evidence and limits

### Evidence labels

- **S — Source inspected:** current route/child definitions, conditions, copy or styles. Does not establish actual role authorization or rendered behavior.
- **R — Rendered component fixture:** current components and application styles in the development Preview browser, with fictional inputs and intercepted API requests. Not a signed-in end-to-end booking or notification-delivery test.
- **V — Visitor screen:** running public route captured without signing in.
- **U — Unvisited:** no rendered verification for that route/state in this audit; any finding is source-only.
- **E — Supplied evidence:** user's screenshot; evidence of that captured UAT state, not a claim that this fork or today's data matches it.

### Evidence register

| Reference | Evidence | What it establishes / does not establish |
| --- | --- | --- |
| E1 | `attached_assets/Screenshot_2026-10-26_at_8.53.21_AM_1792985007088.png` | Book Appointment, walk-in mode, narrow session popup, repeated session-selection instruction and two persistent blue guidance strips. Session text explicitly says queue not opened. Does not establish a scheduling defect. |
| S1 | `artifacts/clinicflow/src/App.tsx`, `clinic.tsx`, `lib/clinic-navigation.ts`, `lib/communication-routes.ts`, `components/WorkspaceNav.tsx` | Actual role routes, guard restrictions, aliases and child tab composition; mapped below. |
| S2 | `components/queue/SessionSelector.tsx:23–44`, `components/booking/BookingDiscovery.tsx:50–84`, `components/booking/continue-reason.ts`, `components/guest-booking-date.ts`, `components/booking/session-selection.ts` | Session labels, duplicate guidance, booking-mode checks, explicit-choice retention and next-date bounds. |
| S3 | `components/NotificationsPanel.tsx`, `components/workspace-surfaces.css`, `artifacts/api-server/src/routes/workspace-features.ts` | Complete bodies, read actions, bounded recent list, server read semantics and panel geometry rules. |
| S4 | `components/SearchableSelect.tsx`, `SearchableMultiSelect.tsx`, `OverflowText.tsx`, `overflow-text.css`, `HelpTip.tsx`, `NotificationInfo.tsx`, `CapabilityState.tsx` | Shared label/reveal/error/empty-state composition. |
| S5 | `docs/concise-page-descriptions.md`, `components/concise-descriptions.test.mjs`, `workspace-surfaces.test.mjs`, `admin-listing-ui.test.mjs`; current `CommunicationUsage.tsx`, `reports/ReportTemplates.tsx`, clinic/staff/public/provider components | Existing introduction work, current caller messages and source/render-test expectations. Tests were inspected, not rerun; they are not visual proof of this audit's recommendations. |
| S6 | `artifacts/api-server/src/lib/availability.ts:139–158` | Server reasons distinguish dated closure, location closure, timezone mismatch, past session, closed booking window and exhausted capacity. No new availability decision is proposed. |
| R1 | `generated-artifacts/message-audit/render.mjs`, `results.json`, `sessions-{1366,390,320}-{unavailable,available,full,mode,empty,loading,error}.png` | Actual session/booking-discovery components mounted into a fictional workspace; seven states at three widths. Not a complete booking form. Picker container intentionally 240 px desktop / 200 px narrow to exercise wrapping. |
| R2 | Same evidence directory, `bell-{1366,390,320}-{long,empty,loading,error}.png` | Actual bell with long spaced text plus an unbroken reference, two unread items, empty/loading/error responses and empty System tab. Panel screenshots and geometry recorded. No read action invoked. |
| V1 | Public `/guest-booking`, 390 × 844, captured with Preview screenshot | Existing concise public entry, clinic and dependent location controls. No clinic selected; no account or booking created. |

R1/R2 used 768 px viewport height, current styles, fictional data and browser-only mounts. All `/api/**` traffic was intercepted; non-GET requests were blocked, and **zero non-GET requests were observed**. No secrets, UAT account or patient records were used. No live notification/provider test ran. Generated evidence is ignored output, not application source. The temporary Preview banner is visible in fixture screenshots and can cover part of the page; it is not a DigiQ message finding.

**Observed measurements:** unavailable options were 112 px high at the desktop fixture width and 132 px at the narrow width; even eligible choices were 92 px. The long bell row was approximately 357/378/502 px high at 1366/390/320 viewport widths. At 390 px the panel itself was 366 px wide and inside the viewport, but the body had 1699 px scroll width against 364 px available. These are stress-fixture measurements, not estimates of every real notification.

**Coverage limitations:** no real signed-in role page was visited. All role-only pages, private links, camera permission outcomes, save results, confirmation mutations, real read-state persistence and provider outcomes are **U/S**, not verified in live use. Break, queue-close, timezone-mismatch, sole-session, explicit-invalid-selection, stale/offline, receipt recovery and bulk-read failure states were inspected in source but not rendered. Keyboard/touch disclosure behavior below is an acceptance requirement, not a claim it passed a device test. Short landscape, virtual keyboard, zoom, screen readers and Safari/Firefox were not rendered.

## 2. Coverage inventory

Every route declared in `App.tsx` is accounted for here. Role letters: **SA** Super Admin, **CA** Clinic Admin, **D** Doctor, **R** Receptionist, **P** Patient. “Route exists” does not mean every role may use it: guards, redirects, ownership, assignments and API checks remain authoritative.

### Role routes — all U/S unless R component coverage is explicitly noted

| Route group | Roles / actual destinations inspected | Audit disposition |
| --- | --- | --- |
| `/admin/dashboard`, `/doctor/dashboard`, `/receptionist/dashboard`, `/patient/dashboard` | Role-specific greeting, appointment summary and activity; P booking confirmations | F12; retain current introduction and failure/stale states. |
| `/admin/appointments`, `/doctor/appointments`, `/receptionist/appointments`, `/patient/appointments` | List, calendar, day drill-down, filters, columns, exports, row actions/ticket | F13; retain specific empty/filter errors and export completeness feedback. |
| `/admin/book`, `/doctor/book`, `/receptionist/book`, `/patient/book` | Visit → patient details → confirmation → ticket; staff/public paths differ | F01–F08; R1 covers shared components only. |
| `/admin/queue`, `/doctor/queue`, `/receptionist/queue`, `/patient/queue` | Staff session queue vs own patient queue; presence, duration, call, guest requests | F14–F16; do not turn patient view into a staff queue. |
| `/admin/patients`, `/doctor/patients`, `/receptionist/patients` | Registration/edit access differs; drawer, timeline, activity, documents | F17; physician visibility does not grant registration or document writes. |
| `/admin/clinic`, `/admin/clinics`, `/admin/branches`, `/admin/clinics/:clinicId/:section?` | SA/CA clinic workspace/listing and legacy destinations; Details, Locations, Staff, Policies, Activity | F18–F19; use actual clinic-navigation redirects, not new duplicate pages. |
| `/doctor/clinics`, `/doctor/branches`, `/doctor/users` | Clinics / Staff / Booking QR; assigned vs network clinics; users aliases to Staff | F18, F20; network text is already concise/disclosed. |
| `/admin/staff`, `/admin/doctors` | SA only; Doctors alias → staff Doctors tab | F20; CA guard does not grant global staff access. |
| `/admin/users`, `/admin/permissions`, `/admin/system-users` | SA Users tabs: Roles, Permissions, System users; CA users → clinic Staff | F20–F21; aliases must not receive extra intros. |
| `/admin/availability`, `/doctor/availability`, `/receptionist/availability`; matching `/exceptions` routes | Weekly / Exceptions; day editor and contextual doctor schedule | Existing schedule-layout work; references only, no competing redesign. |
| `/admin/qrs`, `/doctor/qrs`, `/receptionist/qrs` | Role/clinic-scoped QR listings and embedded QR section | F19; readiness and regenerated-link consequences protected. |
| `/admin/reports` | SA/CA Live Reports, Templates, Communication Usage and details | F22; preserve metrics and usage limitations. |
| `/admin/templates` | SA/CA notification activation/templates, scope/channel/event controls, preview/edit drawer | F23; separate from report templates and bell updates. |
| `/admin/communication` | SA Email Settings / SMS Settings / Notification Logs, log detail and test receipt | F23–F24; no live sends. |
| `/admin/settings`, `/admin/masters`, `/admin/audit`, `/admin/demo`, `/admin/integrations` | SA Settings: Platform, Integrations, Reference data, Audit log, Demo clinic; legacy redirects | F21, F23–F24; CA restricted pages remain blocked. |
| `/doctor/settings`, `/receptionist/settings`, `/patient/settings` | Retired settings redirect to existing permitted destination | Keep no new intermediary text. |
| `/admin/profile`, `/doctor/profile`, `/receptionist/profile`, `/patient/profile` | Account/professional/address, staff contacts; P visit records | F17/F20; keep verification and inactive-profile restrictions. |

### Public, linked and authentication routes

| Routes / destination | Evidence and disposition |
| --- | --- |
| `/` | S/U in normal app; fictional mounts load its styles but are not a landing-page audit. Existing concise hero plus marketing sections; no removal proposed. |
| `/guest-booking` | V1 plus S: keep “Choose a clinic and location to book a visit.”; dependent placeholder is contextual, not a banner to remove. |
| `/scan-qr`, `/check-in` | S/U: scanner instructions, camera/link/error handling; preserve “Scanning only verifies the ticket” and explicit consultation check-in distinction. |
| `/book/:reference`, `/:clinicSlug`, `/:clinicSlug/:branchSlug`, `/display/:reference` | S/U: public booking, directory/location, care team, opening hours and token-only display. F01–F08/F19 where shared; retain revoked/offline/not-ready results and privacy boundaries. |
| `/sign-in/*?`, `/patient-login`, `/demo-login`, `/register-doctor` | S/U: staff password, patient code, fictional-demo warning and invitation-only provider entry. F25; existing brief intros retained. |
| `/register-clinic/*?`, `/onboarding` | S/U: owner details/review/verification, clinic identity/locations/hours/practice/team/review/completion; patient profile or provider-invitation branch. F25; do not hide consent, URL permanence or uncertain-creation recovery. |
| `/forgot-password`, `/set-password`, `/reset-password`, `/sign-up/*?` | S/U: reset/invitation, password rules and token-aware aliases; retain nondisclosing outcomes and expired-link recovery. |
| `/login`, `/register`, `/admin`, `/doctor`, `/receptionist`, `/patient`, unmatched route | S/U: aliases/role redirects/404; no extra informational page recommended. |

### Nested states, dialogs and dropdown inventory

All are S/U except the shared session/bell fixtures R1/R2:

- **Booking:** location pin/context; booking-mode help; care search and selected-label loading; multi/sole/removed session; review details; visit-mobile guidance; privacy/consent; cancellation policy; confirmation pending/error/uncertain receipt; manage-schedule drawer; same-account owner recovery.
- **Appointments:** list/calendar and day panel; status/date/doctor filters; row menu and hidden columns; move/reschedule/cancel/requeue/absent confirmation; private ticket preview/download; selected/all-filtered export and partial-failure states.
- **Queue:** doctor switch chips; operational vs booking session selector; historical saved sessions; presence controls; call-in-progress notice; stale/offline lock; session metrics; estimated wait help; duration editor and guest requests.
- **Clinic:** Details/Locations/Staff/Policies/Activity History, clinic and location editors, contact inheritance, consulting locations, format preview/confirmation, copy-hours confirmation, QR download/regenerate/public links.
- **Staff/Users:** Clinic Admin/Doctor/Receptionist categories; Personal/Professional/Assignment and inherited defaults; add/edit/role-switch dirty confirmation; status and recovery; contact verification; removal impact/handoff/receipt dialogs. Preserve scope and destructive consequences.
- **Patient drawer:** Timeline/Activity/Documents; upload restrictions, private download, delete confirmation; patient Profile → Your Visit Records.
- **Reports:** live grouping/ranges, trend/detail drawers, saved configuration/template actions, sharing/columns; communication usage coverage/breakdown/export.
- **Notifications administration:** activation, channel/event/recipient, scope overrides, template preview/editor/reset/publish, unsaved edits; provider source/settings, credentials, test password confirmation and manual receipt; log filters/details and retained/legacy gaps.
- **Shell/shared dropdowns:** notification All/Appointments/Queue/System; search and results; profile/workspace switch; location menu; favorites/recents; row menu; CareLookup, ResourceLookup, SearchableSelect/MultiSelect, phone country, timezone, date/range controls, columns and saved views.

The preceding inventory extends the earlier concise-copy checklist to operational content. The active schedule-editor layout and form-control uniformity work own control sizing, editor tab layout and device autofill/contrast coverage. This report does **not** reopen them; only later approved message/reveal changes should coordinate with their shared controls.

## 3. Finding register

Each row gives current behavior, purpose, action, proposed copy, priority and its safety boundary. **Keep** means no change recommended; it is an intentional audit outcome. P1 = first implementation batch; P2 = next bounded cleanup; P3 = optional refinement, not a release blocker.

| ID / evidence | Surface and trigger; current text/layout | Why / recommended action and exact copy | Priority / safety |
| --- | --- | --- | --- |
| F01 · S2/R1/E1 | Multi-session choice: `{hours} · {N} places remaining · Advance appointments and walk-ins · The queue has not opened yet.` all in one string | **Shorten + structure.** Primary time, secondary capacity and status; see §4. Closed control shows time, not the full sentence. Eligibility reason remains separate and accessible. | P1; no label-derived eligibility. |
| F02 · S2 | Sole session uses a paragraph with time/mode/reason, unlike multi-session dropdown | **Consolidate** presentation: `Session` + time; `{N} places left · {status}`; keep explicit “Select this session” recovery when required. | P1; never silently replace an invalid explicit session. |
| F03 · S2/E1/R1 | Discovery says “Select a consulting session to continue.” and disabled footer repeats it; before context, “Choose a location, doctor and date to see sessions.” | **Consolidate** to one state instruction near the affected control, referenced by the footer's disabled primary action: `Choose a session to continue.` For earlier stages use the first missing selection, e.g. `Choose a doctor to see sessions.` | P1; keep a discoverable reason for disabled Continue; do not leave a nonfocusable button as sole explanation. |
| F04 · S2/E1/R1 | Walk-in strip always describes today-only, timezone, queue opening, breaks, modes and no future suggestions | **Shorten + disclose.** Near mode/date show `Walk-ins: today only ({timezone}).` One “About walk-ins” help: `Walk-ins use today's date at this location. Queue opening times, breaks and session booking modes still apply.` Show the actual current blocker in context instead of all restrictions as a persistent banner. | P1; relevant current blocker remains visible, even if mode help is closed. |
| F05 · S2/E1/R1 | Discovery always shows “Your ticket shows a session range, not an exact consultation time. Availability is checked again when you confirm.” | **Relocate/consolidate**, not erase: before Confirm Booking: `Your ticket shows a session range, not an exact consultation time. Availability is checked again when you confirm.` General explanation may be in help earlier. | P1; visible at final review; no guaranteed consultation time or reservation implied. |
| F06 · S2 | Selected availability repeats time/capacity already in selector; reason may appear there and in selector/error/footer | **Consolidate:** selected summary owns capacity/timezone and current reason once. Example `8 places left · Asia/Kolkata`; time remains in selected control. Keep HoursWarning once when present. | P1; unknown/server reasons cannot be dropped to meet a character limit. |
| F07 · S2 | Session fetch can produce selector error/Retry names, ErrorNotice/Retry Sessions and discovery failure; no-session wording exists in selector and discovery | **Consolidate caller feedback:** one section alert `Could not load sessions. Your choices are kept.` + `Retry sessions`; no sessions: `No doctor sessions on {date}. Try another date.` One optional help explains other dates/hours distinction. | P1; keep retries, retained choices, stale lock and field association; shared name-load errors still need their own handling elsewhere. |
| F08 · S2 | Next-date result says found date, review, nothing booked; no-match result includes search range and later-date caveat | **Shorten selectively:** success `Found {date}. Review its sessions; nothing is booked yet.` No match `No eligible advance sessions found from {from} to {to}. Later dates may be available.` Keep actual bounds/window help and review action. | P2; search is up to 14 later days, not an exhaustive “no availability”; never change a deliberate date or auto-book. |
| F09 · S3/R2 | Bell rows show full body, clipped title and full-size “Mark as Read” beside body | **Shorten + disclose:** title, two-line body preview, timestamp, explicit `Details`; small independently aligned read action. Full proposal §5. | P1; full event text reachable without marking read. |
| F10 · S3/R2 | Bell long unbroken body overflows; read button stretches with row; titles/timestamps lose width | **Layout containment:** wrap unbroken text, flexible text column, non-stretching action; stack action line on narrow screens. Do not apply nowrap to whole row. | P1; full copy not destroyed; touch targets stay usable. |
| F11 · S3/R2 | Long scope footer and “Mark All as Read”; tab-empty says “in the last 30 days” without bounded-list qualifier | **Shorten visible scope:** `Unread counts cover this recent list only.` Action `Mark recent list as read`. One “List limits” disclosure holds exact limits (§5). Tab empty: `No {type} updates in this recent list.` | P1; action covers whole returned recent list, not only selected tab and not all historical records. |
| F12 · S1 | Dashboard empty activity says “No operational updates yet. Bookings, check-ins and schedule changes appear here.” Stat captions repeat label concepts | **Shorten optional filler:** `No recent operational updates.` Optionally remove “Visits scheduled for today” under Today's Appointments and “Visits checked out today” under Completed Visits. Keep average-wait definition help. | P3; retain null/unavailable vs zero, configured “today” timezone and stale-overview warning. |
| F13 · S1/S5 | Shared listings/filters, calendar day panels, saved views/columns already use brief hints and contextual empties | **Keep** clear/no-match actions and existing one-line introductions. Do not add a blanket blue “Use filters…” banner. Shared CapabilityView exception F26. | P2; preserve filter scope, export failures, unsaved view changes and private ticket access. |
| F14 · S1 | Queue summary repeats “Whole session” below Waiting, Completed and Session Total | **Consolidate** once above metrics: `Session totals` with one help explaining listing filters do not change totals. Retain current/next token labels. | P2; do not confuse token number with list position or filter count. |
| F15 · S1 | Queue footer: “Last successful response … · Refresh requested every 30 seconds … · Times in …”; presence says future bookings unchanged | **Shorten/disclose:** `Updated {timestamp} · {timezone}` plus active `Refreshing…`; put requested refresh interval in adjacent help. Presence secondary text: `Live status only; future bookings are unchanged.` | P2; keep last-success wording when refresh fails; no “Live” guarantee while offline. |
| F16 · S1 | Queue “Requesting call… awaiting server confirmation. This does not start consultation”; absent-reservation blocker; paused-calling notice | **Keep** these visible, including pending/failure distinctions, explicit check-in and absent reason. Keep historical session cannot receive bookings. | P1 retain; operational consequences, not optional tutorial. |
| F17 · S1/S5 | Doctor patient-list registration restriction; private documents accepted types/10 MB/private storage; visit records introduction | **Shorten only restriction prose if needed:** `Only receptionists and administrators can register patients. Ask clinic staff.` **Keep** upload limits and private-storage indication by Upload. | P2; do not imply physician registration/upload powers or hide delete confirmation. |
| F18 · S1 | Clinic Policies generic “Saved notification preferences and delivery policies remain in effect.”; clinic-wide badge and actual policy values | **Disclose** generic notification sentence under existing policy-vs-platform help. Keep saved horizon/cutoff visible. Keep scope badge; do not duplicate it with a new banner. | P3; retain any actual delivery-disabled warning and owner locks. |
| F19 · S1/S5 | QR readiness hint; regenerate confirmation; missing public address; extended doctor hours warning | **Keep** readiness and printed-copy invalidation. Avoid repeating same readiness paragraph in parent and embedded QR section. Short link may be `Review schedule`. | P2; never imply QR existence proves booking readiness or that extended hours are unbookable. |
| F20 · S1/S5 | Staff editors/recovery, profile verification and consulting-profile status; long schedule-management link in booking | Existing brief staff sections **keep**. Shorten booking link to `Manage doctor schedule`, with location in drawer heading/context. Recovery disclosure already suitable. | P2; retain saved scope, assignment proof, no-email recovery fact, contact verification and inactive-profile limits. |
| F21 · S1/S5 | Roles/permissions policy help is long; conflict banners explain another admin changed data and edits retained | **Keep** conflict/reload consequences visible. Existing optional rule explanation may stay one info disclosure with paragraphs/lists; no second bubble on same heading. | P2 retain; base-role restrictions and most-restrictive-wins semantics must remain intact. |
| F22 · S1/S5 | Reports/Templates introductions already concise; communication usage explains observed acceptance vs billing/delivery and coverage gaps | **Keep** `Open a live report or reuse a saved configuration.` and metric/usage caveats. Do not shorten usage to “Messages sent” or “Delivery confirmed.” | P1 retain; current vs cumulative/partial data distinctions are substantive. |
| F23 · S1/S5 | Notification administration: disabled delivery, security separate, save vs activation vs test, inherited/source/override detail | **Keep** current gate/result warnings; optional background already in NotificationInfo. Consolidate only exact repeats within the same active scope. Example short saved result only where true: `Saved. No test message was sent.` | P1 retain; not evidence of delivery, not a change to security activation or clinic overrides. |
| F24 · S1 | SMTP test result says provider acceptance does not confirm inbox delivery; logs warn legacy/missing secure detail; integration editing locked without encryption key | **Keep** result/limitations visible. Optional operator setup mechanics may be disclosed after `Provider editing is locked. Ask your server operator to configure encryption.` | P2; readiness is not a successful probe, historical gaps cannot be reconstructed, no live test authorization inferred. |
| F25 · S1/S5 | Authentication/registration already brief; password/verification expiry, consent, demo warning, permanent clinic URL and uncertain completion feedback | **Keep** essential limits. No new generic “secure account” banner. Remove no material consent or error text merely because it is long. | P1 retain; no auth, account, verification or onboarding behavior change. |
| F26 · S4/R2 | CapabilityView error heading “Notifications Could Not Load” repeats body “Notifications could not be loaded.” Empty heading “No Notifications Yet” with tab-specific recent-list text | **Consolidate** shared heading/body contract. Bell: `Could not load notifications.` + `Retry`; empty: `No recent notifications.` Filtered empty uses F11. Caller must be able to provide distinct actionable body text. | P2; error/unavailable/forbidden must not collapse to empty. Avoid global string replacement in unrelated callers. |
| F27 · S4 | SearchableSelect long labels wrap, selected full labels wrap unless compact opt-in; options expose only label/disabled/selectedLabel, no separate reason slot | **Extend shared presentation only after approval:** structured primary/secondary/status/reason fields or a bounded render slot; keep plain-label callers unchanged. Same audit for MultiSelect selected chips and result rows. | P1 dependency for F01; no automatic truncation across every selector, no loss of search terms or ID/scope freshness. |
| F28 · S4 | Care/resource retained selections may be disabled; UnavailableAction uses disabled button + title/aria-description despite comment claiming visible reason | **Keep/disclose actual reason access:** visible reason or separately focusable detail control next to disabled action. Do not rely on native title or a disabled row receiving focus. | P1 accessibility boundary; audit actual consumers before rollout, not a claim every disabled button currently fails. |
| F29 · S4 | Phone country and timezone options have useful code/offset disambiguation; profile/location menus and row actions have different interaction contracts | **Keep** country code, timezone/offset, status and disambiguating location. Ellipsize only long names with measured full-value access. Do not replace every menu with a search picker. | P2; do not remove distinctions that prevent selecting wrong care scope. |

## 4. Book Appointment: concrete before/after

### Before (E1 and current component source)

`9:00 AM–1:00 PM · 8 places remaining · Advance appointments and walk-ins · The queue has not opened yet.`

The same screen shows a selection prompt, a long walk-in policy strip, ticket guidance, a long schedule link and the same selection prompt beside Continue. Shrinking the font would not resolve that hierarchy.

### Proposed after — presentation only

```text
Booking source    Phone / advance    [Walk-in today]  (About walk-ins)
Walk-ins: today only (Asia/Kolkata).

Doctor       Visit date       Session
                             Choose a session…
                             ┌───────────────────────────────────┐
                             │ 9:00 AM–1:00 PM                    │
                             │ 8 places left · Queue not open    │
                             │ Reason / details                  │
                             │ 7:00 PM–10:00 PM                   │
                             │ 9 places left · Queue not open    │
                             │ Reason / details                  │
                             └───────────────────────────────────┘
Choose a session to continue.     [one instruction, not a banner]
Refresh availability             Manage doctor schedule

                                     [Continue to patient details]
```

The diagram is a copy/layout recommendation, **not a new rendered UI**. Time format remains inherited from the clinic; do not force AM/PM for a 24-hour clinic. “Places left” means remaining bookable capacity, not number currently waiting. A neutral fact like time/capacity does not need blue notice styling.

In the actual shown state **both sessions are blocked**. Prefer the single instruction `These queues have not opened yet. Choose another booking mode or return after queue opening.` only if both current reasons and the availability of that mode switch support it. Otherwise use `No session can be selected in this booking mode. Review the session reasons.` Do not tell the user simply to select a disabled option. Per-row reason remains available.

Closed selected control: `9:00 AM–1:00 PM`. Under it, one selected-session summary: `8 places left · Asia/Kolkata`. If availability changes, show its actual current reason and keep the explicit selection visible until the user acts; do not auto-switch to a different session.

At final review, above Confirm Booking, keep the ticket/availability sentence from F05 and all consent/cancellation consequences. Earlier optional “About this ticket” help can expose it without a persistent banner. Existing GuestBooking review already has a similar “Nothing is booked…” paragraph: compose one review message, not both paragraphs.

### Status vocabulary — do not invent eligibility

| Actual source state / precedence | Compact visible status | Full explanation / safety |
| --- | --- | --- |
| Available, capacity > 0, no current mode/time issue | `{N} places left` with optional mode badge `Advance + walk-in` | Do not say “Open now” solely from `available`; consultation may not have started. Allowed modes remain available in details. |
| Walk-in before queueOpenTime (fallback startTime) | `Queue not open` | `Walk-in booking opens at {queueOpenTime} ({timezone}).` Show a time only when the source makes it authoritative. “Session not started” is not an equivalent reason. Advance booking may still be allowed; do not disable it from this fact. |
| Consultation starts later but advance booking is allowed | `Advance booking` if needed | Time range already communicates the future session. Do **not** invent a start-time blocker; queue opening may precede session start. |
| remainingTokens ≤ 0, no higher-priority unavailable reason | `Full` | `No places remain in this session. Choose another session or date.` |
| Walk-in during defined break, no earlier issue | `On break` | `The doctor is on a break.` Add `until {breakEnd}` only with authoritative time. Keep distinct from full or not opened. |
| Advance attempt on walkInsOnly | `Walk-ins only` | `This session accepts walk-ins only. Choose another session or date for advance booking.` |
| Walk-in attempt on appointmentsOnly | `Advance only` | `This session accepts advance appointments only. Change booking mode or choose another session.` |
| Walk-in on non-today date | `Today only` | `Walk-ins are today-only in the location timezone.` Do not apply browser-local day. |
| Server says queue booking closed | `Booking closed` | Keep `Queue booking has closed`; do not label full, break or not-started. |
| Server says session past | `Ended` / `Past session` | Keep authoritative reason; don't offer a current queue. |
| Dated closure, location closed, timezone mismatch, booking horizon or other server reason | `Unavailable` or precise known status | Display full source reason in details and current selected-state warning. Do not infer a code by fragile text matching or overwrite custom closure explanation. |
| Fetching, failed or stale data | `Checking…`, `Could not load sessions`, or `Refresh availability` | These are readiness states, not evidence a session is unavailable. Preserve action locks and retry. |

Current client ordering is unavailable → capacity → incompatible mode → walk-in date → queue opening → break. Server `reason` can take display precedence. Approved presentation must preserve that behavior; introducing reason codes would be a separately approved API change, not part of this audit. Unknown reasons fall back to full original text.

Keep a short blocker visible in disabled rows; provide the complete reason through a separately reachable detail action or an adjacent “Session details” area. Hover/focus/tap can reveal supporting text, but a cmdk disabled item is not a reliable keyboard target. Detail interaction must not select the session or nest competing buttons inside an option without an accessible interaction design. Retain search across the full label and mode, not only the compact trigger value.

## 5. Notification bell: concrete proposal

### Row hierarchy

```text
Notifications                                      Close
All   Appointments   Queue   System

● Booked · Token 12
  Patient / doctor / reference preview…             [Details]
  26 Oct 2026, 12:00 PM                       [Mark as read]

Unread counts cover this recent list only.          (List limits)
[Mark recent list as read]
```

- Title: existing event title, maximum two visual lines where needed. Keep unread dot plus existing unread state, not color alone.
- Body: two-line **visual clamp**, not destructive substring replacement. Use safe word wrapping including unbroken names/references (`overflow-wrap:anywhere`, shrinkable text column). No horizontal scroll just to read a notification.
- Timestamp: secondary line with configured date/time/zone behavior; preserve the complete timestamp in details. It must not consume the title's entire width.
- `Details` opens the full title, body and timestamp in an expanded row or accessible detail dialog. It is not a promise of a new notification-history page. For appointment-linked items, offer a separate existing authorized appointment destination only after verifying its route and permission; do not invent links for system items.
- Full details **must not mark read automatically**, navigate away unexpectedly or invoke a read mutation. Preserve the separate persisted read action.
- Per-row action: `Mark as read` or a compact check icon with that accessible name and a single help label. Align to start or a short action line (`align-self:start`), not stretched to body height. Use at least a 44 px touch hit area without making the visible button a full-height block. Do not stack a title tooltip and a second adjacent bubble containing the same text.
- Bulk action: `Mark recent list as read`; while pending disable duplicate submission and label `Marking…`. Keep read-update failure `Could not update read state. Try again.` visible and retryable, without claiming success.

### Footer scope — must remain accurate

Visible: **“Unread counts cover this recent list only.”**

Disclosure **“List limits”**: **“Up to 60 appointment and queue updates combined, plus up to 30 system updates, from the last 30 days. Unread counts cover this recent list. ‘Mark recent list as read’ applies across all tabs to the currently eligible recent list, not all notification history.”**

The 60 is combined, **not 60 of each type**. The server applies role/scope and personal in-app preferences; do not promise every user receives system items. Mark-all recomputes the eligible recent list on the server across tabs, not just rows in the selected tab or currently scrolled viewport. New eligible events can arrive between loading and clicking; the action is not a frozen snapshot of loaded IDs. Do not silently change those semantics. The label deliberately makes no claim about email/SMS delivery.

### Empty, loading, error and containment

- Empty overall: `No recent notifications.` Optional one-line “New updates appear here” is unnecessary.
- Empty filtered tab: `No {type} updates in this recent list.` Not “No notifications in the last 30 days” as if history was exhaustively searched.
- Loading: a compact skeleton or `Loading notifications…`; never show “0 unread” as a verified historical count while loading/error. Keep actual loaded-list scope.
- Read failure remains in footer near the action; fetch failure remains in body with Retry. No duplicated heading/body failure sentence.
- Preserve existing desktop max-width/max-height and narrow-screen fixed margins: the **outer panel was already contained** at tested widths. Fix inner wrapping and action layout rather than claiming the entire mobile panel is offscreen.
- Keep header/close and scope/action footer reachable, body `min-height:0` and vertically scrollable; avoid nested horizontal scroll. At short landscape/zoom, allow footer to flow/scroll instead of consuming all body space. Test dynamic viewport and onscreen keyboard before approval is considered implemented.
- The current panel has Escape/outside-click and explicit close, but custom dialog composition does not itself prove initial focus, focus order, outside tap or focus restoration on every path. Prefer a coherent nonmodal popover/dialog focus contract; opening should lead to a useful first control, Escape/Close restores bell focus, tabs remain keyboard-operable. Do not add an unnecessary focus trap to a nonmodal panel.

## 6. Shared reveal and message-purpose rules

### Disclosure input contract

1. Use measured clipping for full-value help, not an arbitrary “long enough” test. `OverflowText` already provides hover/focus/tap; preserve that contract rather than adding a parallel tooltip library.
2. Hover and keyboard focus expose the same full text; Enter/Space can pin/toggle where appropriate; Escape dismisses and focus remains predictable. On touch, first tap opens details, second/outside tap dismisses without triggering a booking/read action.
3. One reveal per purpose. Explanatory help, clipped-value help and NotificationInfo must coordinate through existing mutual dismissal. No native title plus custom tooltip, no duplicate icon next to an already revealing value.
4. Essential reasons are not hover-only. Disabled choices keep a visible short reason and a separately keyboard/touch-accessible route to details. Do not make an option focusable/selectable merely to expose help if that compromises disabled semantics.
5. Long explanatory content should be an expanded section/dialog, not a tiny tooltip containing interactive controls. Preserve full values in the accessible name/description without announcing the same paragraph twice.
6. Avoid broad CSS hiding all `.notice` or all `role=status/alert` content. Decide purpose at the caller and render the necessary message once.

### System-wide retain list

| Must remain visible in the relevant state | Examples / reason |
| --- | --- |
| Errors and recovery | Failed reads/saves/exports; no network, partial or uncertain outcomes; Retry/Refresh and retained-draft feedback. |
| Permission and assignment limits | Owner-only edits, restricted patient creation/documents, inactive clinical profile, fresh schedule assignment checks, unavailable handoff targets. |
| Consent and verification | Contact permission, OTP expiry/attempts/resend limits, staff-owned proof, private booking receipt recovery. |
| Destructive/irreversible effects | Delete/handoff blockers and shared records retained; discard changes; role changes clearing assignments; regenerated QR invalidates printed copies; permanent clinic address. |
| Stale/readiness limitations | Stale queue locks, current availability recheck, no doctor sessions vs location opening hours, bounded next-date search, incomplete provider/usage evidence. |
| Consequential booking/queue rules | Today in location timezone, actual blocking mode/opening/break/full/closed reason, session range not appointment guarantee, cancellation consequences, pending call is not consultation check-in, paused queue, historical session cannot receive new bookings. |
| Delivery/data interpretation | Security vs operational activation, saving does not test/send, provider acceptance not inbox delivery, manual receipt not future assurance, legacy/missing history and usage not billing. |
| Privacy and fictional/demo separation | No real patient information in demo; private documents/tickets, no account inferred from guest visit and no public exposure of staff/patient details. |

Optional background explanation includes how the bounded search works, requested refresh intervals, general queue-mode definitions, saved-view mechanics and neutral section introductions. These can be disclosed once. An action-blocking reason or consequential warning is not converted to optional background just because it is lengthy.

## 7. Approval checklist and ownership

**No boxes are implemented. Approval should select bounded batches, not authorize a system-wide rewrite.**

### Batch A — shared components (P1)

- [ ] Agree structured option presentation and disabled-reason access for SearchableSelect; preserve plain-label callers, full-text search, ID/scope retention, required/error states and remote paging.
- [ ] Reuse existing full-value/help behavior and mutual dismissal. Check keyboard, Escape, actual touch, unbroken words, short values and duplicate help.
- [ ] Fix bell row hierarchy/wrapping/action alignment in NotificationsPanel/workspace-surfaces, with full details and unchanged read semantics.
- [ ] Keep bell outer containment; verify 320/390/desktop, short landscape, 200% zoom and dynamic viewport.
- [ ] Adjust CapabilityView heading/body composition only where caller copy repeats; preserve distinct error/empty/forbidden/unavailable states.

### Batch B — booking callers (P1/P2)

- [ ] Apply compact multi/sole session copy and status vocabulary without changing eligibility, priority, timings or auto-selection.
- [ ] Make BookingDiscovery and BookingStageActions share one current instruction/reason while retaining disabled-action accessibility.
- [ ] Consolidate session retry/no-session feedback; retain context fetch vs session fetch failure distinctions and stale guards.
- [ ] Put today/timezone beside walk-in mode; keep active blocker visible. Place ticket expectation/recheck once at final review, including GuestBooking.
- [ ] Shorten manage-schedule link and next-date result; keep actual bounds, retained booking draft and server-verified schedule access.

### Batch C — individual callers (P2/P3, separately selectable)

- [ ] Review F12/F14/F15 dashboard and queue repetition; keep data definitions and refresh failure warnings.
- [ ] Review F17/F18/F19 patient restriction/clinic policy/embedded QR copy; no ownership or permission change.
- [ ] Leave existing concise Reports, auth, registration and staff introductions alone unless a specific duplicate is shown.
- [ ] Preserve all delivery/usage/security caveats and destructive confirmations; audit each proposed removal against §6.

### Acceptance after a separately approved implementation

- [ ] Fictional fixture matrix: mixed eligible/disabled sessions, all blocked, sole/removed selection, full, break, queue not open vs future consultation, advance/walk-in restriction, stale/error/loading/empty, custom server reason.
- [ ] Bell long/short/unbroken content, all tabs, empty/loading/fetch/read error, retained unread states, list-wide mark-all while a filtered tab is selected.
- [ ] Real keyboard and touch full-detail/reason access; no accidental selection, read mutation or duplicated tooltip.
- [ ] Compare protected warning copy/visibility and disabled actions before/after. Tests must assert behavior and recoverability, not only string absence.
- [ ] Reuse existing concise-description/workspace/listing tests where applicable; do not claim those source checks prove viewport or device behavior.

### Decisions needed before implementation

1. **Approve vocabulary:** “places left”, “Advance only”, “Queue not open” and “Mark recent list as read”. Alternatives must preserve the distinctions in §§4–5.
2. **Choose bell details presentation:** expanded row or dialog. Both preserve explicit read action; neither requires creating history navigation.
3. **Approve guidance placement:** ticket expectation moves from the persistent visit-stage strip to visible final review; current blocker and today/timezone stay inline.
4. **Select batches A/B/C.** Schedule editor layout/form uniformity and their device tests remain with their existing work; no delivery, eligibility, timing, authentication or permission work is authorized by this report.

## Final status

Audit delivered; recommendations **not applied**. Source coverage is system-wide by the route/child inventory above; rendered coverage is deliberately limited and labeled. No real-role, UAT or production write, notification send, provider probe, deployment or publishing occurred.
