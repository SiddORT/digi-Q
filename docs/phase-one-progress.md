# ClinicFlow Phase 1 — implementation and verification

Status: 0/40 completed and verified. Work is underway.

Only verified items receive a green tick. Existing functionality does not count as verification.
Statuses: Not started / In progress / Completed and verified / Blocked.

## Approved policies

- Preserve current branding, colors, fonts and navigation; compact operational UI rather than a redesign.
- Expected duration is configured per doctor within a clinic (20/30/60 minutes). Approximate wait is patients ahead × expected duration, updated with queue events, not a countdown.
- Authorized staff choose future-only duration changes or explicitly confirm applying a change to a running session after a warning.
- Ordinary later bookings and walk-ins do not displace an earlier reservation. Temporary departure does not cancel a booking.
- Reception chooses a returning absent patient's position and must record a reason. Keep the booking/token and audit the action; never interrupt a current consultation.
- Patients may reschedule before check-in to another doctor/branch within the same clinic, subject to the cancellation cutoff. Preserve reference/history and issue a destination-session token. Failure leaves the original untouched.
- Email OTP is accepted. SMS, custom SMTP, notification delivery, advanced calendar grids, billing, clinical records, family accounts and ratings are excluded.
- Stop and ask about consequential unresolved business policy before implementing it.

## Checklist

| # | Requirement | Status | Evidence / remaining checks |
|---|---|---|---|
| 1 | Preserve appearance | In progress | |
| 2 | Compact spacing | In progress | |
| 3 | Primary search/filter toolbar | In progress | |
| 4 | Collapsible advanced filters, chips, clear | In progress | |
| 5 | Role-aware defaults | In progress | |
| 6 | Readable 10+ desktop rows and pagination | In progress | |
| 7 | Sticky headings, status badges, actions | In progress | |
| 8 | Responsive/accessibility/context preservation | In progress | |
| 9 | Per-doctor-per-clinic duration | In progress | |
| 10 | Explicit duration-edit effects | In progress | Approved staff choice with running-session warning |
| 11 | Weekly availability, breaks, capacity, exceptions UX | Not started | |
| 12 | Sessions, remaining/full states | Not started | |
| 13 | Concurrency, duplicate and capacity integrity | In progress | |
| 14 | QR/link through email verification | Not started | |
| 15 | Assisted bookings and walk-ins | Not started | |
| 16 | Ticket view | Not started | |
| 17 | Complete ticket information | Not started | |
| 18 | QR validation and manual token lookup | Not started | |
| 19 | Token distinct from position | In progress | |
| 20 | Approximate wait without countdown | In progress | |
| 21 | All lifecycle statuses | In progress | |
| 22 | Upcoming/past, reopen and print ticket | Not started | |
| 23 | Honest stale/pause/delay/privacy messaging | Not started | |
| 24 | Reserved versus arrived/active queue remotely | In progress | |
| 25 | Stable reservation order | In progress | |
| 26 | Agreed absence/re-entry | In progress | Reception selects position, mandatory reason |
| 27 | Event-based ETA | In progress | |
| 28 | Current/next/call controls | In progress | |
| 29 | Safe concurrent start/complete transitions | In progress | |
| 30 | Authorized/audited skip, priority and re-entry | In progress | |
| 31 | Cancellation | Not started | |
| 32 | Atomic rescheduling | In progress | Approved policy above |
| 33 | Doctor compact current/next/list/details | Not started | |
| 34 | Reception switch, summary, search, check-in, walk-ins | Not started | |
| 35 | Clinic admin compact scoped management/duration | Not started | |
| 36 | Superadmin compact oversight | Not started | |
| 37 | Auth, roles, tenant privacy, provider-free messages | Not started | |
| 38 | Ticket/queue/report consistency, audits and retry recovery | Not started | |
| 39 | End-to-end absence/cancel/reschedule workflow | Not started | |
| 40 | Desktop/mobile acceptance and release summary | Not started | |

## Verification log

- Initial read-only inspection completed; no checklist acceptance checks have run yet.