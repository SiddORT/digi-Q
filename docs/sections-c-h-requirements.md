# Approved remaining sections

User authorizes continuous C–H implementation with progress updates. Shared defaults, components, features and styling throughout; no duplicated UI or role-specific flows. Preserve permissions and existing international records.

## C — Address and Phone Controls
- New address country IN, telephone +91; recognize pasted international numbers.
- Compact selected country codes; full names searchable in dropdown.
- Shared address layout across locations, onboarding, patient registration, staff/doctor forms and profiles; wide address lines and content-sized country/state/city/PIN.
- Searchable State/UT and City/Town; filter cities by state, clear incompatible child selections.
- PIN-first or state/city-first assistance; multiple localities selectable. Never silently substitute district/post office for city.
- Manual entry when data missing/service fails; relevant errors, contextual help instead of repeated disclaimers.
- Assess provider coverage, reliability, licensing/limits before integration; cache reference data so routine entry survives outages.

## D — Appointments, Patients and Queue Tables
- Compact distinct Check In/Out icons inside Actions; accessible names, hover/focus tooltips and understandable touch interaction.
- Predictable row-action placement/order; secondary overflow actions.
- No column collisions; intentional responsive sizing.
- Readable essential dates/times/doctor/location; structured lines, not tooltip-only.
- Shared wording, confirmations/outcomes for cancel/reschedule/ticket/status actions from appointments, patient history and queue details, respecting permissions.

## E — Booking and Patient Registration
- Shared Visit details → Patient details → Confirmation → Ticket flow; prefill known data and omit unnecessary inputs without role-specific process.
- Human doctor names, explicit loading/failure, never internal ID labels.
- One compact clinic/location context; compact consistent doctor/date/session/source placement.
- Consistent mobile/email requirements; separate booking contact, notification eligibility and account authentication. Visible consistently enforced clinic prerequisites.
- Shared patient form from Patients and booking; return new patient selected, no permission expansion.
- One actionable unavailable-session message; routine explanations in help, restrictions/errors visible.
- Consistent success/session/ticket actions; booking success distinct from delivery status.

## F — Doctor Schedule, Onboarding and Exceptions
- One schedule editor for weekdays/multiple intervals/capacity/booking settings. Saving establishes schedule without another create-sessions step.
- Reuse from onboarding/profiles/schedule navigation.
- Doctor hours outside ordinary location hours accepted with warning both on save and downstream booking (location 9–5, doctor 8–12 and 3–6).
- Protect invalid ranges, actual conflicts, explicit closures and existing bookings.
- Follow location hours in same editor; distinguish future-follow from copy-once; preserve custom hours.
- Date Exceptions beside Weekly Schedule: day off, changed hours, extra interval; preview booking impact.
- Concise readiness and actual missing requirements; location hours alone never imply availability.

## G — QR Validation and Public Booking
- Quick validation in-app dialog with Close/Back preserving origin.
- Explicitly chosen full public booking opens new tab, clearly labelled; safe return on standalone QR pages, no automatic popup windows.

## H — Cross-Role and Responsive Acceptance
- Same function across permitted roles: consistent layout/terminology/validation/outcomes, authorization preserved.
- Desktop/tablet/mobile/keyboard/touch: compact fields, actions containment, selected values, dialog footers, accessible tooltips.
- Complete journeys: schedule→availability→booking→ticket; registration→return to booking; QR→return; location change→retained or safely reset context.
- Separate implemented, verified and blocked evidence; no live customer mutations/messages during testing.
