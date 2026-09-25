# ClinicFlow

A new multi-clinic appointment and live queue platform. See README.md for the entity model, role matrix, and implementation architecture.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- This is a new system, not a cosmetic update to any previous ClinicFlow demo.
- No role-switching dropdown or demo authentication. Roles belong to authenticated accounts and permissions must be enforced by the API.
- Availability → appointment → token → staff live queue → patient live queue is the core acceptance flow.
- The referenced visual wireframe was not supplied here. The attached text specification is the available journey reference; do not claim pixel-level wireframe conformance.

## UI restoration constraints

- Preserve the established ClinicFlow teal identity and navigation; refine the existing product rather than redesigning it.
- Use calm surfaces, soft neutral boundaries, readable text, subtle focus states, and consistent compact spacing. The earlier dark-outline contrast treatment was explicitly rejected.
- Fix shared components and migrate consumers rather than adding page-specific overrides. Search icons, clear actions, relation selectors, filter grids, and pagination must share one visual language.
- Preserve authentication, ownership, invitations, appointments, capacity, queue, and check-in rules during visual changes. Do not introduce unsupported filters.
- Judge visual acceptance from rendered screens at relevant sizes, not from compilation alone. Separate browser-fixture evidence from live authenticated verification.

## Gotchas

## Phase 1 acceptance and policy

- Track approved work and verification evidence in `docs/phase-one-progress.md`. Do not equate existing code or compilation with a verified workflow.
- Preserve legacy consultation durations until staff deliberately changes them; new duration selections are 20/30/60 minutes per doctor within a clinic. Staff choose future-only changes or explicitly confirm a warning before changing a running session.
- Wait estimates are approximate patients-ahead × expected duration, updated on queue changes, not a countdown or automatically learned consultation duration.
- Ordinary bookings/walk-ins preserve reservation order. Reception chooses an absent patient's re-entry position with a mandatory audited reason; the ticket survives and a current consultation is never interrupted.
- Patient rescheduling is before check-in within the same clinic, including another doctor/branch, subject to the cancellation cutoff. Preserve reference/history, issue a destination-session token, and leave the original untouched on failure.
- Email OTP is accepted for Phase 1. SMS, custom SMTP, automatic notification delivery, advanced calendar grids, billing and clinical records are outside this phase.

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

## Approved queue refresh (supersedes older arrival/check-in terminology)

- Consolidated expansion is tracked in `docs/clinic-expansion-progress.md`. TAT means average actual consultation duration. Doctor in/out is live Available / On break / Away, separate from weekly schedules. Additional staff are added/invited by Clinic Admin, not self-joined.
- Reuse existing booking, guest requests, QR, staff and clinic records. Super Admin and owning Clinic Admin must share clinic-level configuration and data, with server-enforced boundaries; platform settings remain Super Admin only.
- Clinic registration is guided, supports multiple branches with independently inherited email/phone, weekly multi-session hours, referral code metadata, and a consulting-admin doctor capability on the same account. Do not grant a second clinic owner or use a role-switch identity.
- Public clinic/branch slugs must be unique, protect reserved application paths and preserve existing QR links. Public pages expose clinic information and queue tokens, never patient identities/history. Custom-domain DNS and referral payouts are not part of this expansion.

- Contact-optional booking: clinic QR/link guests can request a place without an account, email or phone. Name is required. Reception confirmation creates the appointment/token; pending requests do not reserve capacity. Reception-assisted bookings may omit contact details. Preserve existing authenticated booking separately; guest receipts must not expose patient history or permit public name/token lookup.

- Track this expanded scope separately in `docs/queue-refresh-progress.md`.
- Bookings join their doctor/branch/date waiting queue immediately. Check in means consultation entry; check out means consultation completion and automatic calling of the next waiting patient, not automatic consultation start.
- Explicit absence skip and reason/position-based re-entry remain required. Future bookings never enter today's queue.
- A branch-specific public reception display shows clinic/location, booking QR and separate doctor queues. Expose tokens only, never patient identities, contact information or private ticket references/QRs.
- Rich compact two-line listings support explicit selection, CSV export, QR/ticket print/download, eligible activation/deactivation and reason-confirmed appointment cancellation. Preserve per-record authorization and report partial failures; no bulk deletion or clinical transitions.
- Use icons with accessible labels and hover/focus/tap help. Keep critical instructions visible. Compact dialogs and navigation without removing necessary small-screen/zoom scrolling.

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
