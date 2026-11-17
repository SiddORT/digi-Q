# Clinic-owner mobile verification: implementation and UAT handoff

## Scope and evidence boundary

This change requires explicit phone proof **before account details** in the
existing public owner form and Super Admin's existing Create Clinic form.
It does not replace either form, add business fields, change ownership, make
email optional, add mobile login or change patient/team-member signup.
Clinic and location phones may still be landlines.

The supplied UAT onboarding history had 20 records: 17 immediate
`no_recipient`, one `provider_rejected` after dispatch and two immediate
`disabled`. The supplied current Clinic Admin/Super Admin onboarding
publications were enabled, revision 3, ready with no blocked reasons.
Those facts identify different failure stages, **not the exact historical
account-field cause**. The former admin-created password-account path already
validated its administrator mobile. This change makes proof and future
diagnostics explicit; it does not rewrite historical reasons.

Only local, fictional database records and fake/intercepted transports were used.
No UAT changes, real sends, template publication, deployment, provider changes,
historical replay or data backfill are authorized by this implementation.
Preview's existing automatic onboarding no-send restriction remains intact.

## What Git supplies

- Shared strict, country-aware account-mobile validation, opt-in only on these
  owner controls and the Super Admin's own profile. Empty controls default to
  India. India needs exactly ten valid mobile digits, not a landline or a trunk
  zero. Other countries retain their own mobile rules. International paste
  keeps one calling code; extra digits are rejected, not truncated.
- In-place country/mobile, explicit Send SMS and code confirmation before the
  existing name/email/password and clinic fields. Draft details remain intact
  behind the gate; password/code/proof capabilities are not saved in drafts.
- The smallest essential pre-account extension to the **existing**
  `auth_challenges` store. Existing registration proof was email-bound, so it
  could not securely precede email without this extension. There is no new
  verification service, account, placeholder email identity or database table.
  An owner-phone challenge has no account email identity. It is bound to an
  HttpOnly, Secure, SameSite Strict guest-intent cookie or the active Super
  Admin actor, the flow and the exact canonical mobile.
- Existing challenge hashes, rate limits, five-guess limit, ten-minute OTP
  expiry, transactional locking, explicit resend and attempt retirement.
  Disabled, unpublished, rejected and unknown sends cannot confer proof.
  Number edits retire the exact bound attempt; stale retirement cannot erase a
  different newly issued challenge. Uncertain transport is never retried
  automatically.
- Public phone proof does not authenticate. Required email proof still creates
  the account. Correcting email can retain the same unchanged phone proof only
  within the current cookie-bound, unconsumed registration; it replaces the old
  email challenge. The linked attempt has a thirty-minute absolute cap.
  Completed/expired/other registration intents cannot reuse it.
- Admin-led creation consumes proof and saves the verified account mobile
  transactionally with clinic setup, before onboarding notification capture.
  Setup rollback leaves neither a partial account/clinic nor welcome dispatch.
  The owner, not the administrator, must supply the received code.
- Existing completion receipts remain authoritative. Proof is excluded from
  the setup digest so reading/retrying an already-completed result does not
  require another code or create another clinic/message.
- Existing Super Admin My Profile and Contact verification support saving and
  proving the account's own mobile. A changed/cleared number loses its proof and
  old codes. Missing proof never blocks existing login or password recovery.
- Event controls separately show configuration readiness and actual eligible
  account contacts. Future onboarding SMS checks active account, strict mobile
  and matching staff-style proof at capture and again at dispatch. No clinic
  contact substitutes for the account number. Legacy numbers are not certified.
- Existing history/status mechanisms retain safe future recipient,
  activation/preparation and whitelisted provider-rejection explanations.
  Provider text, credentials, phone numbers, codes and rendered security
  messages are not added to diagnostic reasons. Old generic reasons remain
  generic. Opt-ins, channel independence and at-most-once occurrence claims
  remain unchanged.

## Required per-environment prerequisites — not supplied by Git

### Administrator configuration handoff

Once the application change is deployed through a separately authorized rollout,
compatible wording/ID changes need only the existing controls; no new page,
provider, environment variable, migration or further implementation is needed:

1. As a real Superadmin, open **Notifications → System Default**. Find
   **Registration mobile verification → SMS → Clinic Admin → Edit**. This row
   serves both public clinic-owner signup and Superadmin-led owner setup.
   The Patient row is separate optional phone proof during email registration.
   Do not configure Patient login OTP, Staff mobile verification, Clinic Admin
   registration **email**, or Clinic onboarding (the post-creation welcome).
2. Obtain wording and its matching DLT Template ID from the separately approved
   wording work. Nothing in this editor certifies provider/DLT approval.
   In the SMS body, replace only the approved DLT variable slots with their
   semantic application equivalents: code → `{{otp}}`, expiry in minutes →
   `{{expiry_minutes}}`. Both are required; no other variables are supported.
   Do not paste provider syntax such as `{#var#}`. Preserve all literal wording,
   case, punctuation, spacing and line breaks; SMS bodies are not auto-trimmed.
   Owner challenges currently last **10 minutes**. Wording without compatible
   code/expiry slots, with unknown variables or literal URLs/email addresses
   must be resolved separately, not silently rewritten or given invented
   expiry semantics. Do not borrow the login template's wording or ID without
   separately established provider-approved registration-purpose coverage.
3. Enter the matching **DLT Template ID** alongside the body. Sender ID comes
   from existing SMS Communication Settings. Keep in Touch requires its
   configured credentials, Client ID, valid Sender ID and country-code format,
   plus this event's Template ID; it does not require an Entity ID. Generic
   providers retain their saved mapping: sender configuration is required,
   and mappings requiring DLT additionally need Sender, Entity and Template IDs.
   Inspect only the destination environment's authorized configuration; never
   copy Preview settings or probe the provider to discover missing values.
4. **Save Draft** is not publication. Requests continue to use the last
   published body/ID, or remain blocked if there is none. Use **Save Template**
   and confirm **Publish**. The Notifications wording action preserves saved
   activation. Explicitly enable the **Clinic Admin SMS row** if it is off.
   Switches do not approve wording, and neither publishing nor enabling sends.
   Optional Delivery and the operational SMS switch do not govern this
   platform-security action; its own activation does. Do not bypass it.
5. With a configured provider and compatible publication, the row becomes
   ready. Readiness is a local configuration check, not proof of DLT approval,
   provider acceptance or handset receipt. Only the next explicit **Send SMS
   code** in either owner flow requests this current body/ID. Account details
   remain locked until the code for that exact mobile succeeds; email identity
   and existing email/password access remain separate.

Local evidence for this configuration work:

- `pnpm --filter @workspace/api-server test:owner-mobile` exercises the actual
  management save/publish/activation routes and owner request/verify routes
  against disposable PostgreSQL with a fake SMS sender. It demonstrates
  draft/unpublished/disabled and invalid content/metadata failures, readiness
  after publication, exact literal text and matching ID on both flows, later
  draft isolation and published replacement on explicit requests, proof gates,
  wrong/expired codes and changed numbers. Patient/login/staff publications
  remain unchanged. No real setting is published by this test.
- `node --test artifacts/clinicflow/src/components/registration-sms-guidance.render.test.mjs`
  renders the actual compact/full editor fields and checks recipient-specific
  instructions, required placeholders, publication and provider prerequisites.
- Configuration preparation verification on 2026-11-17: all 13 owner-mobile
  integration checks, all 49 notification-settings integration checks and both
  new editor-render checks passed. API and frontend TypeScript checks passed.
  Both existing services restarted successfully. A read-only screenshot of
  public registration confirmed the mobile-first page loaded without browser
  errors. Signed-in interactive editor testing was not repeated; its changed
  compact/full field markup was checked through server rendering, and its
  save/publish/activation contracts through the isolated real HTTP routes.
- These checks establish application provisions only. They do not establish
  hosted deployment, provider-purpose coverage, approved live wording, real
  publication, live delivery or UAT acceptance. Those remain separate,
  explicitly authorized actions under the existing wording and rollout work.

Obtain separately approved wording/publication through the existing wording
work (Task #140); do not invent message text or registration IDs:

| Purpose | Platform SMS event / recipient |
| --- | --- |
| Both new owner flows | `registration_mobile_otp` / `clinicAdmin` |
| Existing Super Admin's own profile | `staff_mobile_otp` / `superAdmin` |
| Required public email identity | `clinic_registration_otp` / `clinicAdmin`, email |
| Future clinic-created notification | `onboarding` / `clinicAdmin` and `superAdmin` |

Each required security SMS needs an actual approved publication, valid OTP and
expiry variables, security activation and the configured transport's required
sender/DLT metadata. An enabled default or activation toggle is **not**
publication approval. Keep in Touch does not acquire a made-up Entity ID.
Other providers retain their existing metadata rules.

Inspect UAT's own saved provider/sender/DLT configuration without copying
Preview settings, disclosing credentials or probing the provider.
Operational notification choices/gates are separate from mandatory security
OTP activation. Do not bypass disabled security delivery to make onboarding
look available. Missing prerequisites must remain actionable failures.

Existing Super Admin accounts need their **own real account number** entered
through UAT My Profile after authorized rollout, then explicitly verified in
Contact verification. Bootstrap intentionally does not seed a personal mobile.
Do not copy a Preview profile, hardcode a number or mark old contacts verified.

## Rollout and runtime checklist

No new schema migration is introduced. The destination must already have the
tracked native-auth challenge/rate-limit, staff verification, completion receipt
and notification migrations. Use the existing tracked migration/deployment
process; do not run schema generation or destructive schema push as a shortcut.

After separately authorized merge/deployment:

1. Install from the committed lockfile, including the shared validation
   package's phone dependency. Generated OpenAPI validators/clients are committed.
2. Build shared libraries, API and web together; restart all API instances and
   the existing notification-worker runtime using the normal rollout.
   Do not mix the old optional-mobile owner UI/API with the new contract.
   The web build requires the managed `PORT` and `BASE_PATH` variables.
   For a local build-only smoke check, `PORT=3000 BASE_PATH=/ pnpm --filter
   @workspace/clinicflow run build` supplies non-secret build inputs; these are
   not instructions to replace the destination's runtime port.
   A merge brought local `.env` and split-port support. The API now treats that
   file as optional (Node's `--env-file-if-exists`, available in the managed
   Node 24 runtime); existing process secrets retain precedence. The frontend
   uses an explicit local `FRONTEND_PORT` when supplied, otherwise the managed
   `PORT`. Its local API proxy is enabled only for that explicit split-port
   setup. No credentials or environment values are copied into files.
3. Verify API health, normal login/recovery, browser asset version and worker
   startup. Confirm the production worker uses the updated capture/dispatch
   code and its environment's existing settings, without sending a probe.
4. In-flight pre-change owner email challenges lack required phone proof and
   must restart mobile-first. Existing accounts retain access. Owners who
   created an account but never created a clinic can verify their saved mobile
   in the existing profile before resuming clinic setup.
5. For an uncertain completed setup, read the existing completion receipt before
   another create request. Never bypass it, backfill contacts, reset the request
   ID just to resend a welcome or drain old notification records.
6. Rolling code back does not require dropping any schema or rewriting account
   records. Coordinate all instances; an older version will not enforce the new
   prospective proof requirement. Never represent a rollback as retaining it.

## Separately authorized controlled UAT acceptance

Deployment alone does not establish provider acceptance or handset receipt.
Obtain approval for the specific recipient, environment, fresh clinic/event,
expected OTP/onboarding messages and test time before any live action.

- First inspect Event controls for template/configuration and account-contact
  readiness separately. In My Profile, the intended Super Admin saves their own
  mobile, explicitly requests a code, supplies it and sees Verified. Keep
  ordinary sign-in/recovery available if any step is unavailable.
- Exercise one fresh public owner and one fresh administrator-led owner only
  within the authorized allowance. Owner supplies the actual received code.
  Verify required email separately. Confirm one clinic/account/result despite
  a repeated submit or recovery read.
- Correlate the fresh notification-history event/time/recipient role with
  authorized account readiness. Use the existing read-only profile,
  `/api/staff-verification`, `/api/management/event-controls` and notification
  history views; do not export contacts, OTP challenges, decrypted snapshots or
  rendered security messages to logs. Existing reason text for old occurrences
  is not new evidence about their historical account fields.
- Confirm separately: pre-dispatch skip/configuration failure, provider
  rejection (safe category), provider acceptance, unknown dispatch and actual
  handset receipt. HTTP 200 is not delivery proof. Obtain recipient confirmation
  independently; retain only safe outcome/time evidence.
- Do not replay skipped/disabled/rejected history, retry uncertain sends or
  toggle configuration to release an old backlog. A later verified contact
  affects fresh eligible events only.

## Local verification record

- API and frontend TypeScript checks, generated shared-library checks and the
  web/API production builds passed. The web build retained existing bundle-size
  and third-party comment warnings.
- Disposable PostgreSQL owner-mobile integration covers country/length/landline
  rejection, exact guest/actor binding, wrong guesses, expiry, resend, races,
  explicit retirement, required email and corrections, setup rollback, saved
  receipts, profile changes, capture/dispatch proof and sanitized rejection.
  Run it with `pnpm --filter @workspace/api-server test:owner-mobile`.
- Focused native-auth, HTTPS transport, owner-registration, staff-account,
  registration-recovery, notification settings and clinic metadata checks were
  run with fake transports. These do not certify UAT.
- The existing auth-contention harness cannot load its external
  `@workspace/api-zod` TypeScript entry through native Node
  (`ERR_MODULE_NOT_FOUND` for `src/generated/api`), before its tests execute.
  The new proof concurrency checks run in the migrated feature harness instead.
- The existing staff-invitation suite also has an unrelated branding assertion:
  expected `DigiQ Doctor password`, actual `Digi-Q Doctor password`.
  No production branding was changed for this task.
- Rendered mock-only acceptance results are recorded alongside the browser
  specs; screenshot/trace output belongs in ignored `generated-artifacts/`,
  not Git. Live handset delivery and hosted acceptance remain unperformed.
  All four changed-form scenarios passed (public, admin, unavailable delivery,
  Super Admin profile), as did all three existing email-recovery scenarios.
  The public spec initially used a nonexistent combobox selector; using the
  existing country-selector button made the targeted check pass without a
  production UI change.
