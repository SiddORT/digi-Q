# Frontend flow audit

## Scope and evidence

Controlled changes to the existing ClinicFlow frontend; no new booking engine, queue, database model, OTP service, or layout. Read the complete supplied end-to-end audit request, existing system documentation (booking, appointment, dashboard and queue sections), backend integration notes, generated client contracts, and current resource/public/appointment/queue authorization implementations before changing the affected flows. Current code takes precedence over older documentation.

Source pointers below are relative to `artifacts/clinicflow/src` unless explicitly prefixed otherwise.

## Confirmed issues and corrections

| Before (confirmed by source inspection) | After | Source |
| --- | --- | --- |
| Generic relation editors loaded unrelated branches and doctors; upstream assignment changes retained incompatible IDs. | Branches follow selected clinic(s); schedule/QR doctors follow clinic and branch assignments; exception branches follow the selected doctor. Invalid dependent selections are cleared after the relevant lookup completes. Multi-select blank entries are excluded from requests. | `resources.tsx`, `RelationInput`, `Editor` |
| Clearing optional QR doctor/branch fields omitted them from the update, retaining the old persisted context. | Nullable QR fields explicitly send `null`, consistent with existing `QrInput`; generate/download/regenerate/deactivate actions remain unchanged. | `resources.tsx`, `resources.qrs`, `Editor` |
| Staff booking and queue lookups used public, platform-wide directories. | Staff use authenticated scoped clinic/branch/doctor endpoints; patient discovery continues to use safe public endpoints. Queue branches are restricted to selected doctor's assignments; doctors cannot switch to another doctor. | `clinic.tsx`, `Booking`, `Queue` |
| Staff patient dropdown loaded all readable patients, independent of selected location, with no booking-form search. | Patient entity queries include selected clinic/branch and existing name/mobile search; inactive patients are excluded. Changing location clears the selected patient. Inline registration is attached to the chosen booking location. | `clinic.tsx`, `Booking` |
| Every non-patient booking was submitted as `walkIn`, including future visits. | Same form/service now distinguishes Phone / advance booking from Walk-in. Walk-in date follows the availability timezone, is fixed to today, and explains existing mode/open/close/break restrictions. Other bookings remain ordinary online/QR/phone bookings. | `clinic.tsx`, `Booking` |
| Confirmation always instructed check-in even when a booking was already queued. | Confirmation displays persisted status and gives booked-versus-queued guidance; links to existing appointment history. Backend worker owns walk-in checkIn→enqueue behavior. | `clinic.tsx`, booking success |
| Clinic+doctor QR with no branch lost its fixed doctor when an unrestricted branch changed. | Fixed doctor is retained, selectable branches follow that doctor, and only unencoded fields remain editable. QR route changes remount the form; QR validity and availability refresh every 30 seconds; an errored QR resolution no longer renders a cached booking form. | `clinic.tsx`, `PublicBooking`, `Booking` |
| Confirmation could be submitted after known unavailability; dashboard could remain stale indefinitely in another session. | Both Continue and Confirm require current compatible records and available session. Dashboard now polls persisted server data every 30 seconds, matching existing appointment/queue polling. | `clinic.tsx`, `Booking`, `Dashboard` |
| Patient queue date changes retained a different date's appointment; clearing the dropdown retained its queue identifiers. | Date/appointment clearing clears dependent identifiers, disables the queue request, and removes stale results. Patient appointment choices poll. | `clinic.tsx`, `Queue` |
| Call next stayed enabled for empty/active/invalid-date queues; called patients were labeled as already consulting. | Call next requires server-provided allowed `call` actions and no current token. This preserves server current-date/timezone eligibility rather than reimplementing date policy. Current token label says Called / in consultation. | `clinic.tsx`, `Queue` |
| Frontend rendered queue entries whenever returned, even for patients. | Patient view explicitly never renders staff entry rows; own entry and aggregate tokens remain. Waiting time is clearly labeled an estimate. | `clinic.tsx`, `Queue` |
| Admin schedule/exception and receptionist QR APIs existed but their routes were unreachable. | Existing modules are linked and routed for those authorized roles. Clinic-admin platform restrictions remain. | `App.tsx`, routes; `clinic.tsx`, navConfig; backend `routes/resources.ts`, `authorizeWrite` |
| Doctor patient list and booking exposed new-patient registration despite the existing backend prohibition. | Doctor patient-list Add and booking Register actions/forms are hidden; a notice directs doctors to reception/admin for registration. Authorized staff registration remains unchanged. | `clinic.tsx`, `Portal`, `Booking`; `resources.tsx`, `ResourcePage` |

## Reviewed and intentionally preserved

- Appointment lists/actions already use persisted server status, server `allowedActions`, and `expectedStatus`; all mutations invalidate the shared query cache. No frontend status engine added.
- Patient booking already uses `identity.patientId`; staff selection already uses actual patient records, not generic user records.
- Public QR resolution returns location/provider context rather than patient details; booking sends the QR reference for backend revalidation. Session-storage continuation through sign-in/onboarding remains intact.
- QR creation, PNG download, opening the booking URL, regeneration confirmation and deactivation were already implemented; no print/configuration feature added.
- Existing `App.tsx` `CacheReset` listens for identity changes and clears the cache, and explicit sign-out clears it. Preserved; multi-session browser verification is still required.
- Dashboard cards already read the dashboard endpoint; no duplicate count calculation introduced.
- Existing responsive CSS already stacks important booking forms and provides scrollable tables and mobile navigation. A later parent browser pass at 390×844 (screenshot q9odwk) confirmed an unformatted average wait float expanding the dashboard grid beyond the viewport. Average wait now displays one decimal minute without changing persisted statistics. Added minimum-width containment to workspace/dashboard grid items and wrapping for KPI values/labels; no ellipsis or numeric clipping. Preserved the existing table horizontal scroll container and all layouts. This worker inspected the CSS/component and applied the correction; parent owns visual re-verification.
- Existing OTP provider/development-code messaging and API remain; no assertion that production SMS is configured or tested.
- Token issuance at booking is the existing policy; no competing token or queue implementation.

## Verification actually performed

- Frontend TypeScript check: `pnpm --filter @workspace/clinicflow typecheck` passes after the implementation batch.
- Inspected related backend read scopes, resource-write permissions, assignment filtering, nullable QR contract, booking source validation, queue aggregate privacy, availability timezone/mode/open/close fields, and appointment allowed actions.
- No browser test, screenshot, workflow restart, live booking, production SMS delivery, or multi-role/session end-to-end run was performed by this worker. The parent owns the single coordinated browser verification pass. Source inspection is not runtime verification.

## Contract notes and remaining verification

- Availability initially returned `queueMode`, `queueOpenTime`, and `queueCloseTime` without those fields in generated `Availability`. The backend/contract worker has now aligned the generated client. Frontend uses the generated type directly; the temporary local intersection was removed. This frontend worker did not modify spec/backend.
- Availability/queue have no `currentDate` response field. Walk-in defaults use the server-returned session timezone; queue action eligibility uses server `allowedActions`. No new endpoint or date-policy contract invented.
- Backend owns duplicate patient-mobile matching and booking/check-in authorization. UI surfaces its errors and does not create a duplicate matching rule or bypass mobile verification. Cross-location existing-patient handling should be exercised with the backend's actual matching policy.
- Live testing still needed: clinic/branch/doctor and multi-assignment edits; clearing optional QR context; partial QR login continuation and regenerated/deactivated references; staff phone versus today walk-in; patient selection/registration; booked→check-in→waiting→called→consultation→completed; cancellation/no-show; multi-role scope and session switching; persisted dashboard/queue refresh; mobile auth/booking/confirmation.
- Doctor patient creation remains prohibited by the existing backend; its creation controls are now hidden with role-appropriate guidance. Receptionist/admin registration is preserved. This follow-up was inspected and typechecked, not browser-tested.