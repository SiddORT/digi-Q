# ClinicFlow — consolidated clinic expansion

Approved scope: 31 items. Status: feature implementation complete; core protected and anonymous browser flows verified, remaining acceptance scoped below. **Production release blocked** by custom-function delivery; not release-approved. See [release gate](clinic-expansion-release.md).
Existing queue/guest/QR functionality is reused; no separate parallel booking engine.

## Browser test isolation correction

The browser worker edited an existing clinic instead of an isolated fixture. This
violated test isolation and is not acceptance evidence. The authorized correction
restored only the phone field using a compare-and-set against the test-written
value, after confirming the latest settings audit belonged to the isolated DEV
Super Admin. The restored value was verified in the transaction; the original
audit was retained and a separate correction audit added. Fixture identities were
subsequently removed after follow-up (audit-retention exception below). Fixture-actor audit review found no other
existing-record edits: remaining events were fixture provisioning and password
verification. Non-secret evidence manifest:
`/tmp/clinicflow-test-isolation-correction.json`.
Further browser tests must confirm the intended role and use fixture-owned records.

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
| 2 | Guided onboarding, back/next, retained answers | Implemented | Actual six-step authenticated wizard submitted; exhaustive back/next retention cases not claimed |
| 3 | First Clinic Admin account and atomic clinic creation | Implemented | Existing isolated Clerk identity completed app registration; atomic clinic setup and settings reload 200 verified; new Clerk signup/email delivery not verified |
| 4 | Solo doctor/admin one-account capability | Implemented | Browser ownDoctor setup preserved Clinic Admin role and operated consultations; exact-trigger SQL checks |
| 5 | Clinic name/category/specialities/address | Implemented | Full UI acceptance pending |
| 6 | Main clinic contacts | Implemented | Super Admin phone update 200; fresh authenticated owner read same persisted phone |
| 7 | Single/multiple location setup paths | Implemented | Two-branch wizard submission and atomic registration verified; separate single-location path not newly retested |
| 8 | Branch-specific identities and addresses | Implemented | Public API/render checked; staff editing pending |
| 9 | Independent live phone/email inheritance | Implemented | Full multi-actor UI acceptance pending |
| 10 | Accordion branch editing | Implemented | Protected browser acceptance pending |
| 11 | Weekly branch opening hours, multiple intervals/copy days | Implemented | All-closed domain regression; staff UI pending |
| 12 | Referral code distinct from clinic ID | Implemented | Protected browser acceptance pending |
| 13 | Doctor profiles/assignments and real active doctor counts | Implemented | Live fixture count checked; staff UI pending |
| 14 | Separate consultation sessions/capacity and actual average TAT | Implemented | Browser AM/PM isolation, tokens and capacity verified; actual TAT remains SQL/domain evidence |
| 15 | Live doctor presence | Implemented | Browser On break/Away disables Call next; Available restores calling |
| 16 | Existing staff creation/invitations and final onboarding review | Implemented, optional staff setup reuses Staff management after creation | Protected browser acceptance pending |
| 17 | One live source of clinic data | Implemented | Fresh owner/Super Admin browser sessions read same persisted contact; scoped SQL patient/visit/count checks |
| 18 | Shared clinic-settings surface for both admin roles | Implemented | Fresh authenticated Super Admin update and owner read verified; authenticated foreign owner settings 403 |
| 19 | Separate restricted platform settings | Implemented | Source/permission checks; browser pending |
| 20 | Consistent associations and clinic privacy boundaries | Implemented | Authenticated foreign owner settings 403 and clinic list 200 excludes target; public token feed contains no leaked PII; SQL ownership checks |
| 21 | Freshness/invalidation across views and active sessions | Implemented | Cross-role settings read/reload verified; query scope/invalidation/polling reviewed; uninterrupted background-to-foreground propagation not exhaustively tested |
| 22 | Consistent calculations, permission rules and audits | Implemented | Automated checks; full UI acceptance pending |
| 23 | Direct booking/display/QR-management navigation | Implemented | Public booking render checked; staff menus pending |
| 24 | Compact workspace headers/toolbars | Implemented | Protected browser acceptance pending |
| 25 | Filter icon, active count/reset and essential context | Implemented | Owner mobile Clinics filter popup fits viewport; all count/reset interactions not newly verified |
| 26 | Clean grouped role-specific navigation | Implemented | Protected browser acceptance pending |
| 27 | Compact aligned tables and conditional bulk controls | Implemented | Mobile owner Clinics has no horizontal overflow; label collision CSS fix awaits final screenshot; bulk controls not newly verified |
| 28 | Grouped queue actions and secondary administrative tools | Implemented | Browser call-next/check-in/checkout and automatic next call verified; secondary tools not exhaustively tested |
| 29 | Overflow-safe accessible tooltips, dialogs and responsiveness | Implemented | Public branch booking renders at 390px; owner mobile Clinics/filter fits; final mobile/table verification passed; broader keyboard/tap cases pending |
| 30 | Cross-role, end-to-end and responsive acceptance | Partial; protected sign-in blocker resolved | Core registration, owner queue, anonymous approval and cross-role settings/privacy verified; not every legacy Phase 1 case verified |
| 31 | Clinic/branch web addresses and shared public booking/display | Implemented | Fresh anonymous request/owner approval uses existing booking; public token privacy and 390px branch booking render verified; not all navigation paths retested |

## Evidence and limitations
- No completion count inferred from code existence. Implementation and verification are separate.
- Prior acceptance limitations remain until explicitly retested for this expansion.
- Latest main-agent automated evidence: **120/120 combined unit/regression tests passed** and **full workspace typecheck passed**. Prior **16 real PostgreSQL contention/ownership tests** with historical triggers remain valid evidence, not claimed as freshly rerun. New migration readiness test passes the complete **12-file chain and runner replay** on disposable PostgreSQL.
- Live development checks: public slug/branch/session endpoints, name-only guest HTTP submission, domain confirmation, selected-session-only capacity decrement, no public patient identifiers, and unchanged data across public GETs.
- Live consulting-admin creation and attachment exercised actual database guards. Immediate/deferred foreign-ownership and deactivation rejections verified; isolated verification transaction rolled back.
- Earlier browser helper `/api/me` 401 failures were resolved using the correct route and ready application/network plus actual app password confirmation. Security checks were not weakened. The isolated owner's real Clerk session completed the actual six-step `/register-clinic` wizard with two branches and `ownDoctor:true`; atomic registration retained Clinic Admin role and settings reload returned 200. This is not proof of creating a brand-new Clerk identity or email delivery.
- In the isolated clinic, AM and PM sessions started with five places each. Two staff-assisted name-only PM bookings received tokens 1/2. On break and Away disabled Call next; Available allowed a call into called (not consulting), check-in began consultation, and checkout automatically called the next patient without starting consultation. AM remained five; PM remained three.
- A fresh anonymous request returned 201/pending without reserving capacity. Owner approval allocated PM token 3, leaving PM two and AM five. This was tested separately from the logged-in staff-assisted form. No leaked PII appeared in the public token feed.
- Fresh Super Admin password proof and `/api/me` 200 preceded exact-fixture clinic selection and phone update 200. Fresh owner proof and `/api/me` 200 preceded reading the same phone. Foreign admin denial was tested **after** successful proof and `/api/me` 200: target settings 403, clinic list 200 excluding target. Denial was therefore not merely an unauthenticated response.
- Browser-found staff name-only patient creation 500 was fixed with an existing-record guard; the targeted real-route SQL regression covers new mobile omitted/present and verification preservation only for an unchanged existing mobile.
- Isolated DEV clinical-fixture cleanup is **DONE** and final mobile browser verification passed. Removed the owned clinic, two branches, one doctor, three patients, three appointments, one guest request, two schedules, two QR records, three mappings, two session/token settings, seven appointment-history records, thirty fixture audits, and five session proofs. All three provider identities were deleted and independently returned 404; private credential directories and the browser manifest were removed.
- Audit-retention exception: two local fixture profiles were deleted; one fully anonymized, inactive, provider-unlinked actor row remains solely to preserve the original existing-record edit and correction audits unchanged. Thus zero usable fixture identities and zero owned clinical records remain, but literal zero local fixture rows is blocked by those retained audit foreign keys. No guards were disabled. The existing clinic phone remains restored. Non-secret cleanup counts: `/tmp/clinic-expansion-cleanup-result.json`.
- Public screenshots: `screenshots/clinic-public-page.jpg`, `screenshots/clinic-public-booking.jpg`, `screenshots/clinic-expansion-registration.jpg`. Fixture data is synthetic and its URLs will be removed after verification.
- Review fixes: role-based queue restrictions, explicit empty hours meaning closed rather than legacy unrestricted, read-only queue GET, persisted historical session discovery, and live ownership-trigger compatibility.
- Production remains untouched and **release blocked**: required custom ownership function definitions are absent from the Publish diff. Fresh migration-chain success does not prove managed Publish delivers those functions. See [release gate](clinic-expansion-release.md) for the production/custom-function blocker.