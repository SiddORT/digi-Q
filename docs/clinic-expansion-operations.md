# Clinic expansion operations integration

## Milestones

- Contract read: clinic settings, contact inheritance, immutable slugs and scoped presence documented in clinic-expansion-api.md.
- Implemented shared generated-API ClinicSettings for Clinic Admin and selected Super Admin clinic. Platform preferences are a Super Admin-only separate tab. Permanent slugs, category/specialities/referral, effective contacts, inheritance, branch opening-hours accordions and one/two shifts with copy-all are editable. Existing weekly schedule remains the capacity/session editor.
- Grouped collapsible navigation; administrative pages no longer receive the global booking button. Own doctor profile attachment and profile navigation do not change role.
- Clinic/branch action menus distinguish public booking, public display, and management of existing QR codes. Single-branch contexts open directly; multi-branch contexts require selection; legacy contexts link to settings.
- Staff/resource lists have 30-second polling and identity-scoped keys. Account recovery is collapsed and removed from row actions.
- Generated sessions endpoint integrated into authenticated booking, guest requests, reschedule, queue selection and exception selection. Session ID follows booking/reschedule/call-next/ticket calls, duration updates and walk-in navigation. Old appointment tickets preserve startTime fallback.
- Queue and patient tickets display backend live presence; own doctors/scoped admins can update it. Reception cannot update it. Call-next is disabled while presence is unavailable.
- Reports distinguish actual average consultation TAT from queue wait and export both.
- Shared FilterBar actions now align Add/export with search and primary filters. Resource/staff/appointment selection columns use shared compact col-select styling. Both recovery entry points are collapsed.
- Final session-list contract integrated: generated typed appointment, guest-request and report queries filter before server pagination. Queue guest/search panels are session scoped; appointment/report advanced session selection requires an exact date, branch and doctor. When a snapshot start time is available, list queries deliberately use it rather than requiring a stored sessionId, including legacy rows without IDs. Mutation and live queue calls preserve sessionId and snapshot startTime.
- Follow-up: role-based doctor restrictions now live in consumers (Queue, Booking and appointment filters), not a sanitized identity passed from the portal. A consulting Clinic Admin retains doctor capability and can select/manage other scoped doctors. Five focused tests cover role/capability distinctions and snapshot session identity.
- Staff queue selectors and multi-doctor summaries now use generated `/session-contexts`, including saved appointment sessions after weekly timing edits/deletion. Keys combine sessionId and startTime; ID-only matches with multiple timings require explicit selection. Historical-only sessions cannot launch new booking. Context polling, guest pagination, queue pagination and duration dialog keys preserve the snapshot time.
- Branch hours preserve explicit `[]` as all closed. Unconfigured hours remain omitted on contact-only edits. “Close all days” deliberately writes an empty plan; no automatic opening hours are introduced on load.
- Follow-up verification: clinicflow typecheck passes; all 16 frontend tests pass (11 existing plus 5 focused role/session tests). No browser performed.
- Static verification: clinicflow typecheck passed; 11 existing editor, staff-input and guest-receipt tests passed. Re-run after final backend generation. No browser, workflow, or restart performed.

## Contract gaps / coordination

- App owner has added the consulting Clinic Admin profile route and removed the settings restriction; operational worker did not edit App.tsx.
- `/me` existing doctorId drives own-profile navigation. No speculative capability casts added.
- No remaining generated-client session filter gap. Server filtering was inspected in list-query and guest-requests; live cross-session/browser validation remains outstanding with the main agent.
- Register route and public slug routes are owned by onboarding worker; expected `/register-clinic` and `/:clinicSlug/:branchSlug`.
- Presence write permission documented for own doctor and scoped administration, not reception.
- Shared list styling belongs to design worker. No duplicate resource stylesheet.
- Browser/workflow validation belongs to main agent; this worker performs static/type checks only.