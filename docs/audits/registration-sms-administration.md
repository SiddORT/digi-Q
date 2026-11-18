# Registration SMS administration: configuration, preservation and rollout

## Environment and evidence boundary

On **2026-11-18**, this work inspected and configured the ordinary workspace
development database used by Preview. It did **not** deploy, connect to or write
the separately hosted `https://uat.digi-q.in` environment.

The supplied UAT screenshot (`Screenshot_2026-11-18_at_6.08.35_PM_1795005518743.png`)
shows registration defaults without published DLT IDs, alongside separate disabled
staff mobile-verification entries. A fresh workspace inspection also found both
registration pairs at revision 0, source `default`, with no drafts/publications.
The resolver uses authoring defaults when the platform record has no published
content. That explains these **current workspace defaults**, not how records
disappeared or what is currently in UAT.

[The earlier publication report](registration-sms-publication.md) describes a
different saved database snapshot. Neither that report nor this checkout is
evidence that UAT received those configuration records. No historical deletion,
restoration or deployment cause has been established.

## Workspace configuration result

At approximately **12:56 UTC**, the explicit installer published only these pairs,
through the normal validated `saveTemplate` path and a real active non-demo
Superadmin audit actor:

| Event | Recipient | DLT Template ID | Revision | Published | Enabled | Application readiness |
|---|---|---|---|---|---|---|
| `registration_mobile_otp` | `clinicAdmin` | `1777179491541503439` | 1 | Yes | Yes | Ready, no blocked reasons |
| `registration_mobile_otp` | `patient` | `1777179491551752035` | 1 | Yes | Yes | Ready, no blocked reasons |

Exact Clinic Admin body:

```text
Dear Clinic, Your Digi-Q clinic registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team
```

Exact Patient body:

```text
Dear Clinic, Your Digi-Q patient registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team
```

The patient salutation **Dear Clinic** and the no-space **anyone.–** were not
normalized. These are explicit installation data, **not runtime code defaults**.
Neither startup nor `lib/db/seed.mjs` installs, publishes or activates them.

Fresh inspection after restarting the API and frontend found the same two exact
published, enabled, Ready records. Applying a fresh check plan then returned
`installed: 0`, retaining revision 1 and unchanged unrelated records.

### Preservation evidence

Before/after the real workspace publication:

| Check | Before | After |
|---|---|---|
| Unrelated settings records | 141 | 141 |
| Published template records within that unrelated set | 36 | 36 |
| Entire unrelated settings fingerprint | `af7515951f7012b8005861b958282c33067f9da1eb328050576d146b22e10f87` | Identical |
| Entire encrypted provider-record fingerprint | `d8a803fc0c31c36ca3308d86f8be89cda5ad362d126ce025f7d40d3d00bb90c9` | Identical |

The comparison includes **all** unrelated saved content, drafts, activation fields,
IDs and revisions—not only patient login. No provider credentials or contacts were
printed. The two target records and the explicit installation receipt are the
only settings excluded from that comparison. Normal publication audit entries
are intentionally added to the audit log.

Patient SMS login remains `patient_login_otp` / `patient`, with its existing
DLT ID `1777179188450254576` and body:

```text
Dear User, your Digi-Q login OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.
```

No unrelated template, gate, opt-out, reminder, staff notification, welcome or
onboarding activation was changed.

## Shared administration, independent security

`/admin/templates` now projects registration and signed-in staff phone proof into
one **Mobile verification** section. Each recipient has one heading. Clinic Admin
has two explicitly labelled contexts:

- **Registration phone proof**: pre-account public-owner and Superadmin-led
  owner setup; the approved clinic-registration ID.
- **Existing-account contact proof**: authenticated account's saved mobile;
  its own staff-verification event, wording, approval and activation.

Patient has registration proof; System Admin, Doctor and Receptionist have
existing-account proof. Patient SMS login stays in its own login section.
Purpose-specific Edit and activation controls still use their original event
identities. The two original bulk actions remain available as explicitly
labelled registration and existing-account switches within the shared section;
each uses its full unfiltered original event and existing batch handler.
There is deliberately no ambiguous combined switch that enables both
purposes together. Scope locks, permission checks, revision checks, drawer
discard protection, search and filters are retained. Mobile-proof list previews
show published wording and its DLT ID; preserved unpublished drafts remain
available in Edit. Other events retain their existing preview behavior.

This consolidation does **not** certify or configure a staff contact-verification
DLT approval. Reusing the supplied registration wording/IDs for existing-account
proof would require separate applicable approval. Missing published staff
wording remains blocked; all existing staff activation is unchanged.
In the actual workspace, the four staff rows resolve to default-on but
**On, Blocked**, with no approved publication/DLT ID. The supplied UAT screenshot
instead shows them off. This difference was retained—not synchronized—and does
not justify enabling, disabling or publishing any staff pair.

## Explicit installer/check and UAT procedure

Entrypoint: `scripts/registration-sms-config.mjs`.
Implementation: `artifacts/api-server/src/lib/approved-registration-sms.ts`.

The check is read-only against the database and writes a new non-secret plan file
with exclusive-create semantics. The plan binds the human environment label,
database endpoint fingerprint and complete target-record/receipt fingerprint.
It contains no provider credentials, contacts or draft bodies. Use a new filename
for each check. Run from the repository root with installed workspace dependencies.

**The commands below are a procedure, not authorization to run them on UAT.**
After separate approval for UAT application/configuration:

1. Put the reviewed code on the UAT server through its authorized rollout process.
   Merging source alone does not publish database settings. Do not copy Preview's
   database, contacts, provider records, plan file or credentials into UAT.
2. In the UAT service's existing secure environment, confirm `DATABASE_URL`
   selects **that UAT database**, without printing its value. Keep its saved
   provider/sender settings. If prerequisites are absent, stop and report them;
   this approval does not permit changing provider credentials/senders.
3. Create the protected output directory, then run a non-sending check:

   ```sh
   mkdir -p generated-artifacts/registration-sms
   node --env-file-if-exists=.env scripts/registration-sms-config.mjs check \
     --environment uat \
     --plan generated-artifacts/registration-sms/uat-before.json
   ```

4. Review each target's action, revision, exact-match status and blocked reasons.
   `install` means an untouched default or draft-only record can receive the
   approval while retaining the draft. `keep` means an exact published pair is
   already present; its later activation edits stay unchanged. `conflict` means
   existing publication, activation history or an explicit post-install reset
   needs administrator review; the installer will not overwrite it.
5. Obtain the actual active non-demo UAT Superadmin's internal user ID from their
   authenticated `/api/me` response (no password/token extraction), and put it in
   the local shell variable `ADMIN_ACTOR_ID`. Only after approval and review:

   ```sh
   node --env-file-if-exists=.env scripts/registration-sms-config.mjs apply \
     --environment uat --confirm-environment uat \
     --plan generated-artifacts/registration-sms/uat-before.json \
     --actor-id "$ADMIN_ACTOR_ID"
   ```

   Apply rechecks actor authority, target fingerprints and revisions under
   transaction-scoped template locks. Both publications, the receipt and audit
   entries roll back if either pair fails validation or readiness. Drafts are
   preserved. It neither sends messages nor installs unapproved defaults.
   A plan becomes stale after a successful install; rerun **check**, do not edit
   its hashes. Exact reruns are no-ops. Later wording, activation and reset edits
   are not silently overwritten.
6. Restart/reopen the UAT application as appropriate for that rollout, then run
   `check` with a new `uat-after.json` filename. Verify exact bodies, IDs,
   publication, enabled state, readiness and before/after preservation evidence.
   A previously intentionally disabled exact pair remains off: it needs a
   separate explicit administrator activation decision, not a force-install.
7. As UAT Superadmin, open System Default at `/admin/templates`. Search Mobile
   verification; inspect both registration drawers and independent existing-account
   controls. Check patient login and unrelated approvals. Reopen/reload.
   Do **not** press authentication Request Code or perform live message tests.

Only then may a report claim UAT application/configuration verification.
Provider-side approval, acceptance and handset delivery remain unverified until
separately authorized live testing. Check output is application readiness, not a
provider network probe.

## Duplication inventory (no other merges authorized or performed)

| Similar entries | Actual trigger / recipient context | Redundancy assessment and recommendation |
|---|---|---|
| Registration mobile / staff mobile | Pre-account registration attempt vs signed-in saved-contact proof; Clinic Admin overlaps | Administrative duplication resolved here by recipient grouping; keep distinct event/DLT/activation and challenge purposes. |
| Patient registration SMS / patient SMS login | Optional phone proof on an email registration intent vs login for one uniquely matched existing patient | Distinct purposes, approvals and credentials. Keep separate; registration must not become mandatory phone signup/login. |
| Patient email OTP / clinic-registration email OTP | Patient email login/new-patient identity vs clinic-owner registration identity | Distinct identity journeys. Patient email already shares one event for new/existing patient access; do not add parallel entries. |
| Staff email OTP / clinic-registration email OTP | Authenticated staff saved email vs pre-account owner email proof | Distinct actors and challenge purposes. Future presentation grouping is possible, but needs approval and must retain context controls. |
| Doctor password setup / staff password setup | Single-use emailed setup link for Doctor vs Clinic Admin/Receptionist/System Admin; SMS is an advisory, not the bearer link | Role-specific recipients, shared infrastructure. A future shared recipient-first presentation may reduce repetition without aliasing event identities or approvals. |
| Password setup completed / staff welcome | Notice after password setup vs once-per-contact welcome after that contact is independently verified | May occur close together but distinct lifecycle facts and security meanings. Audit overlap with authorized fictional scenarios before proposing any removal. |
| Clinic onboarding / staff welcome | Clinic registration committed, owning admin plus active System Admin observers vs a new staff account's verified contact | Distinct clinic/account lifecycle events. Keep both; a future explanation/grouping could clarify rather than suppress them. |
| Staff account saved / clinic onboarding observer | Creating administrator's matching verified contact after staff creation vs active platform observers after clinic registration | Different subjects and recipient authority. Not duplicate dispatch of one event. Keep separate. |
| Booking confirmation / manual booking-status link | Automatic booking event vs staff preview and explicit send to an eligible patient | Intentionally different action and approval; never merge automatic and manual delivery. |
| Email / SMS versions of appointment changes | Same booking/reschedule/cancellation/completion/reminder, different independent recipient/channel choices | Deliberate multi-channel delivery, not a duplicate send by consolidation. Existing channel settings and opt-outs remain independent. |

## Verification

Disposable PostgreSQL and fake/intercepted transports exercise:

- Exact registration bodies/IDs, provider prerequisite rejection and publication
  readiness without network dispatch.
- Every unrelated template pair seeded with saved publication, activation, ID and
  draft, compared before/after installation; full workspace-record fingerprints
  separately cover the real saved catalog.
- Installer reruns, wrong environment/database/actor, same-revision draft drift,
  forced failure of the second pair with full rollback, missing provider metadata,
  preserved drafts, intentional later disable and post-install reset conflicts.
- Both public and Superadmin-led owner requests, actor/cookie/number binding,
  single-use codes, expiry, resend throttling, racing requests and no duplicate send.
- Patient optional registration phone proof, no-phone email-only completion,
  missing-publication completion without saving an unproved phone, separate
  existing patient SMS login, and authenticated staff contact proof.
- Ten-minute owner/login and registration-parent lifetimes versus five-minute
  staff proof, wrong-purpose/actor rejection, unchanged template records during
  authentication, missing staff publication blocking without registration fallback.
- Presentation mapping/search targets, editor/activation target retention and
  unchanged role-based security targeting.

### Completed checks

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/owner-mobile.integration.test.mjs \
  artifacts/api-server/src/notification-settings.integration.test.mjs \
  artifacts/clinicflow/src/lib/mobile-verification-administration.test.mjs
```

**67 passed, 0 failed** in the final focused run. API-server and ClinicFlow
TypeScript checks both passed, as did `git diff --check`.

An additional existing frontend-render/helper run passed 16 of 17 checks.
The remaining check,
`onboarding editor applies the declared phone lock and required consent to actual controls`
in `artifacts/clinicflow/src/auth/patient-access.render.test.mjs`, expects a direct
`PhoneInput` source pattern that no longer matches the unchanged resource editor.
Neither that editor nor that test was edited here. This is a source-assertion
limitation, not evidence that a live phone-lock journey failed.

An already-configured ticket regression run observed 164 passing checks and one
expectation for the old `group-event-registration_mobile_otp` section ID. That
expectation has been updated to the shared presentation mapping; all other
canonical sections remain covered. The focused real-browser check below also
verified the new group identity.

### Actual signed-in rendered check

A single non-sending browser pass signed in through the ordinary Preview form,
confirmed the real `/api/me` Superadmin role, and used the actual workspace
configuration—not intercepted catalog fixtures.

- One Mobile verification section, five unique recipient headings and six
  row context controls; no old separate registration/staff section.
- Both registration drawers contained the exact approved bodies and matching
  DLT IDs. Patient login remained a separate section with its original ID.
- Clinic Admin displayed distinct registration and existing-account controls.
  Staff controls retained **On, Blocked / Not published**, unlike the separate
  UAT screenshot; no activation was changed.
- Registration/existing-account searches, Clinic Admin recipient filter,
  blocked/Ready status filters, SMS filter and Clear Filters behaved correctly.
- Local unsaved text → Cancel → Keep Editing → Cancel → Discard preserved and
  then discarded only the local edit. No publish/save/reset request was made.
- Reload/reopen retained the saved configuration. At 1440px and 390px, measured
  document scroll width equalled client width; no horizontal section overflow
  or console errors were observed.
- The test-created session was logged out. No authentication code, contact
  verification, provider test, activation or template write was requested.

The separate anonymous screenshot correctly showed the staff sign-in boundary;
it was not used as evidence of the protected editor. Fictional transport calls
in disposable integration tests are not live deliveries.

After that browser pass, the original two purpose-specific bulk controls were
retained in the shared section to preserve the existing bulk functionality.
Their original target identities/full-catalog membership and existing handler
wiring were checked by focused tests and TypeScript; the real browser pass above
did not toggle them or verify a persisted activation change.

**Live SMS/email sends: 0. Hosted UAT writes/deployments: 0. Historical replay: 0.
Provider-side approval/handset delivery checks: not performed.**
