# ClinicFlow — consolidated clinic expansion

Approved scope: 31 items. Status: feature implementation complete; final acceptance partially blocked, not release-approved.
Existing queue/guest/QR functionality is reused; no separate parallel booking engine.

## Confirmed rules
- TAT means actual average consultation duration, not queue wait or total visit time.
- Doctor in/out means live Available / On break / Away. Existing scheduled hours remain a separate concept.
- Clinic Admin adds or invites additional staff; no unapproved staff self-joining.
- One admin owns each clinic. A consulting admin uses a doctor capability/profile on the same account, not a second login or role-switch impersonation.
- Super Admin and owning Clinic Admin share the same persisted clinic configuration and records; platform controls remain Super Admin only.
- Root clinic URL and branch paths are public, token-only and privacy-preserving. Custom domains/DNS and commissions are future scope.

## Checklist

| # | Item | Implementation | Verification |
|---|---|---|---|
| 1 | Branded Register a Clinic entry points | Implemented | Public render checked |
| 2 | Guided onboarding, back/next, retained answers | Implemented | Wizard rendered; complete authenticated submission pending |
| 3 | First Clinic Admin account and atomic clinic creation | Implemented | SQL/domain checks; real Clerk signup pending |
| 4 | Solo doctor/admin one-account capability | Implemented | Live DEV and exact-trigger SQL checks; browser pending |
| 5 | Clinic name/category/specialities/address | Implemented | Full UI acceptance pending |
| 6 | Main clinic contacts | Implemented | Full UI acceptance pending |
| 7 | Single/multiple location setup paths | Implemented | Atomic multi-branch domain fixture; UI submission pending |
| 8 | Branch-specific identities and addresses | Implemented | Public API/render checked; staff editing pending |
| 9 | Independent live phone/email inheritance | Implemented | Full multi-actor UI acceptance pending |
| 10 | Accordion branch editing | Implemented | Protected browser acceptance pending |
| 11 | Weekly branch opening hours, multiple intervals/copy days | Implemented | All-closed domain regression; staff UI pending |
| 12 | Referral code distinct from clinic ID | Implemented | Protected browser acceptance pending |
| 13 | Doctor profiles/assignments and real active doctor counts | Implemented | Live fixture count checked; staff UI pending |
| 14 | Separate consultation sessions/capacity and actual average TAT | Implemented | SQL/contention/public API checks; staff UI pending |
| 15 | Live doctor presence | Implemented | Automated/public projection checks; staff UI pending |
| 16 | Existing staff creation/invitations and final onboarding review | Implemented, optional staff setup reuses Staff management after creation | Protected browser acceptance pending |
| 17 | One live source of clinic data | Implemented | Source/contract review; dual-role browser pending |
| 18 | Shared clinic-settings surface for both admin roles | Implemented | Permission checks; dual-role browser pending |
| 19 | Separate restricted platform settings | Implemented | Source/permission checks; browser pending |
| 20 | Consistent associations and clinic privacy boundaries | Implemented | SQL ownership/privacy checks; browser pending |
| 21 | Freshness/invalidation across views and active sessions | Implemented | Public polling checked; protected multi-actor pending |
| 22 | Consistent calculations, permission rules and audits | Implemented | Automated checks; full UI acceptance pending |
| 23 | Direct booking/display/QR-management navigation | Implemented | Public booking render checked; staff menus pending |
| 24 | Compact workspace headers/toolbars | Implemented | Protected browser acceptance pending |
| 25 | Filter icon, active count/reset and essential context | Implemented | Protected browser acceptance pending |
| 26 | Clean grouped role-specific navigation | Implemented | Protected browser acceptance pending |
| 27 | Compact aligned tables and conditional bulk controls | Implemented | Protected browser acceptance pending |
| 28 | Grouped queue actions and secondary administrative tools | Implemented | Protected browser acceptance pending |
| 29 | Overflow-safe accessible tooltips, dialogs and responsiveness | Implemented | Public mobile render checked; protected keyboard/tap pending |
| 30 | Cross-role, end-to-end and responsive acceptance | Partial; blocked on protected browser sign-in | Not complete |
| 31 | Clinic/branch web addresses and shared public booking/display | Implemented | Live public API and desktop/mobile renders; full interaction acceptance pending |

## Evidence and limitations
- No completion count inferred from code existence. Implementation and verification are separate.
- Prior acceptance limitations remain until explicitly retested for this expansion.
- Final automated evidence: full workspace typecheck passed; 16 frontend tests passed; 88 backend/domain/auth tests passed; 16 real PostgreSQL contention/ownership tests passed with historical triggers installed.
- Live development checks: public slug/branch/session endpoints, name-only guest HTTP submission, domain confirmation, selected-session-only capacity decrement, no public patient identifiers, and unchanged data across public GETs.
- Live consulting-admin creation and attachment exercised actual database guards. Immediate/deferred foreign-ownership and deactivation rejections verified; isolated verification transaction rolled back.
- Browser helper sign-in failed in two fresh contexts with `/api/me` 401. No protected admin/browser flow or real Clerk signup is claimed verified. Unsaved registration wizard rendered, but that does not prove registration submission.
- Public screenshots: `screenshots/clinic-public-page.jpg`, `screenshots/clinic-public-booking.jpg`, `screenshots/clinic-expansion-registration.jpg`. Fixture data is synthetic and its URLs will be removed after verification.
- Review fixes: role-based queue restrictions, explicit empty hours meaning closed rather than legacy unrestricted, read-only queue GET, persisted historical session discovery, and live ownership-trigger compatibility.
- Development migrations only. Production untouched. Publishing requires the checked-in schema/index/ownership migration chain; do not assume the new code alone updates database triggers.