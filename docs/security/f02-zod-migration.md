# F02 — patched validation and code generation

Verified 2026-11-16 with Node 24.22.1, pnpm 10.26.1 and TypeScript 5.9.3.
This is isolated development verification, **not production acceptance**.
No deployment, live database query/migration, or real email/SMS/storage operation
was performed. Native PostgreSQL and PGlite tests use disposable synthetic data.

## Dependency and generator decisions

| Dependency | Before → after | Compatibility evidence |
| --- | --- | --- |
| Zod | **3.25.76 → 4.6.7** | Workspace catalog and all five direct consumer packages resolve 4.6.7. GHSA-mrhx-c7xc-m3w5 reports affected `<4.6.6`; the current independent OSV scan and npm audit both report zero findings after migration. |
| `@hookform/resolvers` | **3.10.0 → 7.0.6** | Updated ClinicFlow and Canvas together. Published peers accept Zod `^3.25.0 \|\| ^4.0.0` and react-hook-form `^7.55.0`. Both actual installed resolvers were tested with Zod 4 transforms, nested errors, strict-field errors and nullable/optional distinctions. |
| `@standard-schema/utils` | **absent → 0.3.0** | Resolver's declared dependency, not an application validation replacement. |
| Orval | **8.47.0 → 8.47.0** | Existing maintained release supports Zod 4. Explicit generator target changed from **3 to 4**, avoiding package-local auto-detection. No unrelated generator update was required. |
| drizzle-zod | **0.8.3 → 0.8.3** | Published peer range accepts Zod `^3.25.0 \|\| ^4.0.0` and Drizzle `>=0.36.0`. All **28** actual PostgreSQL tables build insert, select and update validators. Current application table definitions do not import drizzle-zod; the installed adapter is nevertheless verified. |
| react-hook-form | **7.87.0 → 7.87.0** resolved | Satisfies the new resolver's peer range. No current application or Canvas source imports `zodResolver`; the adapter is updated and tested so future use cannot retain the incompatible version-3-only path. |

Zod 4.6.7 was published 2026-10-12; resolver 7.0.6 on 2026-11-11.
Both satisfy the unchanged 24-hour minimum-release-age policy.
React **19.1.4**, Express **5.3.0**, Drizzle ORM **0.45.2**, pg **8.23.0**,
PostgreSQL, all package-firewall/install protections, existing security
resolutions, build allowlists and platform exclusions are preserved.
The regenerated lockfile contains no Zod 3 package entry; cached historical
packages are not part of the application dependency graph.

## Contract compatibility

- Both clients and validators were freshly generated from the unchanged
  OpenAPI document. Generated type/comment formatting changes come from the
  already-installed Orval release, whose checked-in outputs were stale after
  F01. A second, independent generation in a disposable workspace produces
  **zero differences** in either generated package.
- The root Zod barrel still exports **423 runtime validators**, including all
  explicit path-validator exports that disambiguate same-named query types.
  The five existing auxiliary subpath exports were not renamed or removed.
  Root library and leaf-package checks cover public-pages, API, ClinicFlow,
  Canvas, the deck and scripts.
- Zod 3 `uuid()` accepted generic UUID-shaped identifiers without requiring RFC
  version/variant bits. Zod 4's default UUID validator is narrower. To avoid
  rejecting saved idempotency/recovery identifiers, the validator-only Orval
  transformer emits the original hexadecimal 8-4-4-4-12 pattern. Handwritten
  validators use Zod 4's supported **`guid()`**, not a Zod-3 compatibility shim.
  The published OpenAPI/client schemas retain their UUID format. Uppercase and
  legacy non-versioned identifiers are tested; malformed identifiers still fail.
  The transformer fails explicitly rather than overwriting an explicit pattern.
- Body/response date coercion, query/parameter numeric/string coercion, query
  defaults, HTTP calendar validation/normalization, update omission versus null,
  enum values, existing unknown-field stripping, strict object rejection and
  custom draft transformations remain covered. No blanket passthrough,
  permissive union, type cast, skipped check or validation bypass was added.
- The synthetic pre-migration capture checked **12,116 cases across all 423
  exported validators**, with **387 accepted seed objects**. The final comparison
  has **zero unexpected acceptance/output/issue-path differences**.
  `f02-contract-evidence.json` records its baseline hash and exact guard changes.
  The seed generator is deliberately bounded and not a claim of exhaustive
  validation equivalence.
- **87 empty-object cases** now report absent required coerced strings rather
  than manufacturing the literal string `"undefined"`. The comparison allows
  only this exact, non-broadening change for required coerced string fields;
  other changed outputs fail. Express cannot route a missing required path
  segment, and the existing HTTP query helper already rejects this sentinel.
  No unsafe preprocessing adapter was added to restore the old artifact.
- HTTP validation retains status **400**, code **`VALIDATION_ERROR`**, the
  `Invalid input:` prefix and field paths without echoing submitted values.
  Native Zod diagnostic wording/issue codes are version-specific, not frozen
  to Zod 3's English text. Form adapters consume the new issue structure.
  Application-owned password error code/message and custom policies are intact.
- Password tests cover 8-character minimum, ASCII letters and digits,
  **1024 UTF-8 bytes** accepted, 1025 bytes rejected, and multibyte boundaries.
  OTP checks retain the generated 4–8 ASCII-digit contract and existing
  purpose-specific six-digit/expiry/attempt/single-use enforcement.
- Collection tests use at most **128 invalid items**, **16 outer groups**, and
  **64 persisted-draft sessions**. Oversized bounded collections fail with one
  size error before item validators execute. In-bound items still validate;
  a separate **32-item unbounded** case documents that unconstrained collections
  still accumulate item errors. These checks do not claim global constant-memory
  parsing or replace existing HTTP body limits.
- Drizzle adapter checks distinguish SQL NOT NULL from JSON literal `null`,
  preserve nullable mobiles, reject null required names and string timestamps,
  retain Date objects, and require defaulted fields in selected rows. SQL
  constraint enforcement remains the database's responsibility, not an inferred
  guarantee from adapter construction.

## Executed checks

Command logs and disposable fixtures are excluded under `generated-artifacts/`;
the substantive results and audit evidence here are tracked.

| Check | Actual result |
| --- | --- |
| Baseline `pnpm run typecheck` | Passed before changing dependencies |
| `pnpm --filter @workspace/api-spec run codegen` | Passed, both output trees regenerated and generated libraries typechecked |
| Final `pnpm run typecheck` | **Passed** across libraries, all artifacts and scripts |
| `node scripts/check-security-codegen.mjs` | **Passed**, zero generated differences in both output trees |
| `node scripts/check-zod-contracts.mjs --record-evidence` | **Passed**, 423 schemas / 12,116 cases / 87 documented required-field guards / 0 unexpected differences |
| `pnpm test:zod-migration` | **11/11 passed**, real schemas, both resolvers, all table adapters, errors, dates, drafts, identifiers and bounded collections |
| Extended API/auth/form/notification run below | **154 tests: 151 passed, 3 failed**; all three reproduced on original source with original cached Zod 3.25.76 |
| Integration-settings baseline recheck below | **14 tests: 12 passed, 2 failed**, identical to F01 |
| `pnpm test:dependency-security` | **7/7 passed**, including actual Express parsing, offline MIME/XML, Chromium sanitizer and deck editor |
| `node scripts/dependency-audit-evidence.mjs after f02` | **Zero advisories**, exact registry result and package inventory in `f02-audit-after.json` |
| Independent OSV dependency audit | **Zero findings**; initial scan before changes had one high Zod finding |
| `git diff --check` | Passed |
| Frontend workflow and visual smoke | Vite 7.3.8 started cleanly; `/sign-in` rendered the real login form |

Extended regression command:

```sh
node --test --test-concurrency=1 \
  scripts/zod-migration.test.mjs \
  artifacts/api-server/src/native-auth.integration.test.mjs \
  artifacts/api-server/src/auth-http.integration.test.mjs \
  artifacts/api-server/src/functional-features.integration.test.mjs \
  artifacts/api-server/src/patient-registration.integration.test.mjs \
  artifacts/api-server/src/registration-onboarding.integration.test.mjs \
  artifacts/api-server/src/appointment-booking.integration.test.mjs \
  artifacts/api-server/src/notification-sms-transport.test.mjs \
  artifacts/api-server/src/booking-status-sms.test.mjs \
  artifacts/api-server/src/notification-templates.test.mjs \
  artifacts/api-server/src/notification-template-values.test.mjs \
  artifacts/clinicflow/src/lib/registration-draft.test.mjs
```

The 137 tests outside `notification-template-values.test.mjs` all passed.
That additional suite passed 14/17 both before and after migration.
The original-source reproduction used `git archive HEAD` in an ignored
disposable directory, reconstructed **only the already-cached original Zod
3.25.76** from pnpm's content store, and pointed fixture-local package links at
that copy. It did not change the application's lockfile/dependencies, contact
a package provider or suppress validation. The original UUID behavior was also
confirmed directly with this cached version.

Integration-settings command:

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/integration-checks.test.mjs \
  artifacts/api-server/src/integrations.integration.test.mjs
```

## Remaining baseline blockers and limits

There are **no remaining dependency advisories** in the two completed audits.
These pre-existing test failures remain explicit; they were not fixed by
weakening schemas, changing approved message content or enabling real delivery:

1. `cancellation reason reaches every SMS and email recipient through queued snapshots`
   expects an email body without the existing branded support footer.
2. `security invitation and completion map exact account roles and reject missing identity, OTP, setup and expiry values using fake transports`
   expects old `DigiQ` role wording, while current branded messages differ.
3. `email previews use sending HTML and fictional security values without dispatch or publication; SMS stays text-only`
   likewise expects a footer-free email body.
4. `strict recipient and fixed branded content; user abuse limit` expects
   `/DigiQ Doctors/`, but the current subject is `Digi-Q — SMTP configuration test`.
5. `notification SMS tests are authorized, validated, explicit and report sanitized outcomes without activating clinics`
   expects `provider_accepted`, but the fixture returns `not_dispatched`.

The broader stale-export `backend-flow.test.mjs` failure already recorded in
F01 was not rerun or repaired. The existing backend-suite reliability work
remains separate.

Orval retains its pre-existing warning that package-local React Query version
auto-detection falls back to v4. This migration changes the Zod target only,
not the existing client's Query target or public hook interfaces. Actual
installed Query is 5.x; current consumers and generated declarations typecheck.

The real API workflow was intentionally **not started**: its normal startup
writes vocabulary data and starts notification workers. Starting it would
violate the no-live-database/provider boundary. Consequently the login smoke
has expected failed API requests (502), and **signed-in UI was not visually
verified**. Actual login/session, CSRF, OTP, permission and database behavior
were exercised against isolated HTTPS/SQL fixtures instead. No hosted repair,
live delivery, exploit assessment or production acceptance is implied.
