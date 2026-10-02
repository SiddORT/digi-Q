# DigiQ remaining accessibility / listing source sweep

## Evidence boundary

This scoped sweep reads the audit's **Current disposition register — all 137 items**, shared-standard reconciliation and `digiq-final-status.md`. It does not replace their dispositions or certify release/UAT. Missing full approved JSON does not prevent the concrete repairs below; exact token/pixel certification remains unavailable.

**Executed:** the new `accessibility-sweep.test.mjs` source-contract suite, **8/8 passed**, and syntax-only TypeScript transpilation of the ten changed TSX files, with no diagnostics. These are not interactive keyboard, screen-reader or zoom tests, nor a project-wide semantic typecheck. No tester, workflows, global tests, account mutations or API work were run.

**Actual browser:** one initial, unauthenticated screenshot of the already-running `/sign-in` preview at **390 × 844**. The visible login form fits that viewport; the page continues below it. No typing, keyboard traversal, popup opening, signed-in screen or 200% browser zoom was exercised. Prior browser evidence cited below belongs to the existing final-status report, not this sweep.

## Source repairs

- Single/multiple searchable controls generate control IDs when callers omit them, associate visible labels, forward external validation/help/required/label references, describe retained selected values and associate inline error alerts. `FormField` now supplies an explicit visible-label identity, preventing a generic custom-control name from overriding its label. Resource lookups retain these accessibility props.
- Selection openers are buttons opening a named dialog containing cmdk's searchable combobox, rather than a second incomplete combobox without a listbox relationship. cmdk receives a meaningful search label. Its own input/listbox IDs and keyboard implementation remain intact.
- Remote results retain observer pagination **and** expose keyboard-operable Load more buttons. Enter/Space on those buttons do not bubble into cmdk's active-option selection.
- Selected labels, chips and option labels wrap instead of being truncated. Multiple selection gets intrinsic-width constraints, full selected-value descriptions and touch-size remove/clear targets. Popups remain viewport-bounded and their option area can shrink/scroll within available height.
- Suggestions carry a usable accessible name, preserve external error/help references, stop referring to unmounted active options and close on Tab without blocking navigation.
- Discard confirmation makes the underlying header as well as form body inert. Its panel can scroll in a short viewport. Existing busy/dirty decisions, Escape handling, focus trap, restoration and form preservation remain unchanged.
- Dialog form controls, phone subcontrols, filter/pagination children and long error/label text gain narrowly scoped intrinsic-width/reflow safeguards. No page-wide overflow suppression, content hiding, new layout, schedule limits or QR/display/ticket geometry changes.
- Filter-panel Reset restores focus to its opener. Disabled phone controls also disable calling-code editing.
- Public QR booking says **“Sign in to your account”** while retaining guest booking. Appointment actions explain unavailable rescheduling only when the existing `canReschedule` expression rejects a called/in-consultation visit; eligibility and server permissions are unchanged.

## Screen / surface coverage

“Source” means static caller/control/CSS inspection, not rendered verification. Shared fixes apply at callers but do not prove every screen's interactive behavior.

| Screen / surface | Source inspected / conclusion | Actual browser evidence |
|---|---|---|
| Shared form fields, password, phone, timezone, remote single/multi lookup | `FormField`, `PasswordInput`, `PhoneInput`, `TimezoneSelect`, `ResourceLookup`, `CareLookup`, searchable controls, `SuggestionInput`; label/error/keyboard/reflow repairs above. Remote selected records remain scoped; lookup debounce and API pagination unchanged. | No opened controls or screen-reader check. |
| Shared editors and confirmation dialogs | `AppDialog`, `ConfirmDialog`, `app-dialog.css`; scrolling, busy-close protection, discard keyboard isolation and narrow-width controls inspected. | No dialog opened. |
| Listing search, filters, pagination and bulk actions | `ListingControls`, `AdminListing`, `admin-listing.css`, `index.css`; search name, page-local selection labels, filter focus, touch targets, mobile cards and bounded scrolling inspected. | No signed-in list verified. |
| App shell / navigation / check-in | `App.tsx`, `WorkspaceNav`, `CheckIn.tsx` control/route scan; shared wrappers and labelled scan/manual entry paths inspected. | Not exercised. |
| Staff login | Shared `AuthShell`, password/form primitives and stylesheet inspection only. `StaffLogin.tsx` remains another worker's implementation ownership. | This sweep: initial `/sign-in` screenshot, 390 × 844 only. No authentication or interaction. |
| Patient login, demo login and recovery/setup | `PatientLogin`, `DemoLogin`, `AuthAccess`, `PasswordFlows` control scan; labelled native inputs/shared password helpers and auth layout. Demo password remains a labelled native password field, not a missing accessible name. | Not exercised. |
| Registration / account / Locations / Opening hours / onboarding | `ClinicRegistrationWizard`, `ClinicRegistrationHours`, `ClinicAdminOnboarding`, registration CSS/control scan; finite weekday lists and explicit copy actions, minmax form columns, retained validation/phone/lookup paths. Existing minima unchanged; no invented maxima for #83/#84. | This sweep: none. Existing final-status separately reports prior 390 × 844 Locations/Opening-hours fixture checks. |
| Clinic settings / linked schedule impact review / integrations | `ClinicSettings`, `LinkedScheduleControls`, `IntegrationSettings`; associated section/booking-mode controls, finite review impacts, controlled preview/apply and labelled SMTP form. | Not exercised. |
| Availability / scheduling / session setup | `SchedulingWorkspace`, `ClinicSessionSetup`, weekly/hour control scans; fixed seven-day summaries are not remote catalogs. No new session powers or limits. | This sweep: none. Existing final-status separately reports `08:32` fixture entry. |
| Appointment listing / dashboard preview / appointment dialogs | `clinic.tsx`, `AppointmentRows`, appointment stylesheet/action paths; current-filter/sort/page callers and finite preview data. Safe account/reschedule copy repaired. | Not exercised. Existing ticket tests are not rerun or claimed here. |
| Queue / guest requests / duration editor | Queue components and shared status/stylesheet/native-select inventory; status buttons use group/pressed semantics. Duration choices remain the existing 20/30/60 contract and two explicit effects. Queue privacy and pending authoritative response are unchanged. | Not exercised. |
| Reports | `clinic.tsx` report filter/sort/table/pagination paths and shared styles; current scope/count/page controls present. Native sort retains its enclosing visible label. | Not exercised. |
| Public clinic discovery / guest booking | `GuestClinicFinder`, `GuestBooking`, public clinic/booking component control scan; labelled patient/date/consent fields and shared searchable care lookup. Guest entry remains optional-account. | Not exercised. |
| Patient scanner / public queue display / visit ticket / booking QR | Scanner control scan; display/public-live and ticket/QR sizing source review. Preserve curated privacy and all QR/ticket geometry. No public patient directory/export added. | Not exercised. |
| Users and generic resources | Shared control/CSS integration and native-select inventory only. `Users.tsx`, `resources.tsx`, patient columns and location helper are explicitly owned by other workers; no edits here. | Not exercised. |

## Native-select and bounded-preview disposition

Remaining native selectors were inventoried: page size (`ListingControls`), clinic section (`ClinicSettings`), booking mode (`LinkedScheduleControls`), duration/effect (`DurationEditor`), settings area/appointment sort/visit range/report sort (`clinic.tsx`), and the resources sort overlay (other worker).

The owned native selectors have visible associated enclosing labels or a `label`/`htmlFor` pair. Native keyboard interaction and focus styles remain; widths are bounded where shared form/filter styles apply. They contain small finite choices rather than remote datasets. This establishes **source accessibility coverage, not compliance with a literal “every dropdown searchable” rule**. No arbitrary enum conversion or new styling was silently imposed. The resource overlay has an explicit accessible label and focus-state border in source; its owner must verify the invisible native select's actual focus appearance. No critical inaccessible native-selector defect was established in these owned callers.

Dashboard appointments are a bounded preview with a **View all** destination to the full appointment listing. Operational activity remains a bounded feed, not a complete searchable audit directory. Fixed weekdays, linked-impact lists and curated public queue displays likewise remain finite summaries. This sweep does **not** claim these satisfy literal search/sort/page/export requirements for every collection or approve a product exception. No new endpoint, fabricated destination or privacy-expanding public controls were added.

## Remaining verification / ownership limits

- Keyboard and screen-reader operation of nested popovers/dialogs, long values, asynchronous option loading and focus restoration needs interactive verification.
- Actual **200% zoom** and short-height dialog/filter panels on protected screens were not tested. CSS reflow fixes are source evidence only.
- Signed-in Users/resources/role screens were not rendered. Their workers own any caller-specific changes and critical diagnostics.
- Native-select searchable standard interpretation and bounded operational-feed treatment remain explicit standard/product decisions; accessible native behavior alone is not full-token/listing certification.
- Original UAT incidents, provider delivery, production deployment and measured performance are outside this sweep. No finding is promoted to live-verified based on these static assertions.