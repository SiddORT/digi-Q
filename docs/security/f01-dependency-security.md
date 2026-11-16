# F01 — dependency-security baseline and remediation

Date: 2026-11-13. Scope: existing ClinicFlow API, UI, project deck, mockup
and workspace tooling. React / Express / Drizzle / PostgreSQL are retained.
This is a lockfile and isolated-development verification, **not a production
exploit assessment, deployment, migration, or delivery authorization**.

## Reproducible evidence

- `f01-audit-before.json` and `f01-audit-after.json` retain the exact lockfile
  hashes, package/version inventories, advisory IDs, severities, affected/fixed
  ranges and registry-reported dependency paths.
- `node scripts/dependency-audit-evidence.mjs before|after` captures those
  snapshots using `pnpm audit --json`. A registry/network error is fatal, not
  interpreted as a clean audit.
- `pnpm test:dependency-security` exercises real packages offline: Express
  parsing and proxy trust, Nodemailer MIME/PDF composition and recipient parsing,
  Google storage construction/XML metadata, IP parsing and browser DOMPurify.
- `node scripts/check-security-codegen.mjs` copies the real spec, config and
  libraries to `generated-artifacts/`, runs the real codegen script and its
  generated-library typecheck, and reports output differences without changing
  checked-in clients or validators.
- Detailed local command logs use `generated-artifacts/f01-*`. These generated
  files are intentionally excluded from Git and deployments; substantive
  results and limitations are retained here and in the audit JSON.

Node 24.22.1; pnpm 10.26.1; TypeScript 5.9.3. The original lockfile hash is
`a1d64efe183274b0f4419bfbad79e3c0d4e697f9738705ecda2d793b14c75302`,
matching the supplied snapshot (651 package versions). The fresh npm audit
returned **40 advisory entries across 17 packages: 2 critical, 11 high,
20 moderate, 7 low**. The independent OSV-based dependency scanner returned
35 entries (2 critical, 11 high, 17 moderate, 5 low). Scanner/advisory-feed
differences are retained rather than treating one count as authoritative.
Neither count proves production exploitation.

## Update policy and compatibility

Release versions, dependency ranges and engine declarations were checked with
`pnpm view <package>[@version] version dependencies engines time --json`.
The fixed-version ranges and advisory links are in the audit snapshots.
No minimum-release-age, build-script allowlist, platform exclusions,
esbuild pin, filesystem restrictions or SMTP access/TLS restrictions were
relaxed.

- Express stays on major 5. Its compatible parent update accepts patched
  body-parser 2.x, proxy-addr 2.x and qs 6.x.
- Google storage stays on major 8. The newer parent uses gaxios 7.x and Google
  auth 11.x, removing the old gaxios 6 → uuid 9 chain without overriding uuid
  across an incompatible major. No Google API calls are made by verification.
- Orval stays on major 8. Its newer parent removes TypeDoc and the vulnerable
  minimatch 10 / brace-expansion / markdown-it chain. Do not force minimatch 11
  under TypeDoc's `^10.2.5` range. Generated validation remains on the existing
  Zod 3 configuration for F01; F02 owns the validation migration.
- Vite stays on major 7, shared by UI, deck and mockup via the catalog.
  Tailwind stays on its existing major.
- ProseMirror View receives its compatible 1.x security patch in the deck.
  Its newly resolved model initially differed from the deck's pinned model,
  producing genuine cross-model type errors. Updating the direct model to
  1.25.13 deduplicated it and restored the typecheck. No casts were used.
- jsPDF remains on 4.2.1; its existing optional DOMPurify range accepts the
  patched 3.4.17 release in both UI and API.
- **Narrow override:** latest verified `@tailwindcss/typography` 0.5.20 still
  pins `postcss-selector-parser` to vulnerable 6.0.10. The override is scoped
  only to this parent and selects **6.1.5**, a same-major fix, not parser 7.
  Remove it once the parent accepts a patched parser natively. No blanket
  transitive-major overrides were added.

Additional parent-scoped resolutions select DOMPurify 3.4.17 (jsPDF
`^3.3.1`), fast-xml-parser 5.12.0 (storage `^5.3.4`), ip-address 10.7.6
(rate-limit `^10.2.0`), fast-uri 3.1.9 (Ajv `^3.0.1`) and source-map-js
1.2.2 (PostCSS and Tailwind node `^1.2.1`). These are all **within** the
parents' ranges, not incompatible transitive replacements. Named parent
refreshes retained the vulnerable resolutions, so these explicit constraints
also prevent clean installs from selecting them again. The XML parser's
5.12.1 release was rejected by the existing 24-hour release-age gate;
**5.12.0**, published 2026-11-03 and fixed according to the advisory, was
selected instead. The release-age gate and exclusions are unchanged.

Vite's optional peer contexts also needed alignment after the parent refresh:
tsx 4.23.15 in the shared catalog and the deck's YAML 2.9.1 remove duplicate
Vite plugin type identities. The initial updated mockup typecheck failed on
plugin compatibility, while the baseline had passed. That regression was
repaired through compatible dependency alignment, not `any`, `skipLibCheck`,
or disabling a check. The final root typecheck passed all workspace packages.
The updated Scalar tooling brings its own **patched Zod 4.6.7** as a transitive
development dependency; application imports, the 3.25.76 catalog pin and the
generator's Zod-3 target are deliberately unchanged.

## Exact affected versions and reachability

| Package | Baseline → resolved | Dependency path and reachability |
| --- | --- | --- |
| body-parser | 2.3.0 → **2.4.0** | Express 5.3.0 in API and public-pages server; JSON and extended-form middleware run before routes. Compressed body handling is reachable. |
| proxy-addr | 2.0.7 → **2.0.8** | Express in API/public-pages server. The application uses a validated numeric trusted-hop count, not the advisory's malformed subnet configuration; library regression is tested separately. |
| DOMPurify | 3.4.16 → **3.4.17** | Optional jsPDF dependency in both API and UI. Current UI tickets use html2canvas → PNG → jsPDF and API uses PDF text, not jsPDF's HTML sanitization entry point. The vulnerable library path was nevertheless reproduced and patched. |
| brace-expansion | 5.0.9 → **removed** | Orval → TypeDoc → minimatch; development/codegen chain removed by Orval 8.47.0. |
| fast-uri | 3.1.7 → **3.1.9** | Orval → Scalar parser/validator → Ajv; local spec validation/codegen, not patient-request runtime. |
| fast-xml-parser | 5.11.2 → **5.12.0** | Google storage 8.4.0 parses storage XML responses. Runtime dependency, although no storage provider is contacted by these tests. |
| ip-address | 10.7.2 → **10.7.6** | express-rate-limit 8.7.4; runtime IPv6 key handling. Normal HTTP headers cannot carry the newline payload; direct parser robustness is also checked. |
| markdown-it | 14.3.1 → **removed** | Orval → TypeDoc documentation generation; not application runtime. |
| minimatch | 10.2.6 → **removed** | Orval → TypeDoc; removed with its parent, not forcibly replaced with major 11. |
| Nodemailer | 10.0.11 → **10.5.0** | API authentication/operational/ticket email runtime. Existing auth transport, template and ticket tests plus real in-memory MIME/PDF composition; no SMTP connection. |
| postcss-selector-parser | 6.0.10 → **6.1.5** | UI → typography; build/tool dependency. The typography package is installed, but no active typography plugin declaration was found in the current CSS. |
| prosemirror-view | 1.41.6 → **1.42.3** | Deck's internal text editor; browser fixture mounts, edits and undoes with actual editor packages. Model aligned 1.25.4 → 1.25.13. |
| qs | 6.16.0 → **6.17.1** | Express/body-parser extended forms; runtime parsing remains covered. App does not use the advisory's comma-array stringify path. |
| source-map-js | 1.2.1 → **1.2.2** | Vite → PostCSS and Tailwind Vite → Tailwind node in all three frontend artifacts; build/dev tooling. |
| uuid | 9.0.1 → **removed** | Google storage → gaxios 6.7.1. Storage 8.4.0 uses existing gaxios 7.3.1; no unsafe uuid-major override. |
| Vite | 7.3.6 → **7.3.8** | Shared catalog for UI/deck/mockup. Dev servers and builds use the patched 7.x branch; public HTML middleware uses custom HTML transformation, making the custom-middleware advisory relevant in development. |
| Zod | 3.25.76 → **3.25.76** application pin | **Remaining high finding**, handled by F02; see remaining boundary below. Patched 4.6.7 also exists in the independent Scalar tooling graph. |

The final lockfile has **621 package versions**, SHA256
`9910d31643e8509386b01bd203137e1d02992fad1f7b8e643fa77b8463598a84`.
Both the npm and independent OSV dependency audits report **one high finding
only: Zod**. Thus the **39 non-Zod npm advisory entries across 16 packages**
were remediated or removed; no non-Zod finding is being deferred.

## Baseline behavior and existing failures

Before installing updates:

- Root `pnpm run typecheck` passed across shared libraries, all four artifacts
  and scripts.
- Disposable codegen passed with **zero generated-file differences**.
- `pnpm test:tickets` passed **165/165** browser tests, including real
  printed/downloaded ticket PDFs, QR decoding, bulk completeness and responsive
  layouts. API and all three frontend builds passed before updates.
- Existing focused API run: **42 passed, 1 failed**. The only failure was
  `backend-flow.test.mjs`, during bundling of stale mock exports. Missing exports
  include `inArray`, `isNull`, `lt`, `getTableColumns`, `authRateLimits` and
  other current route dependencies. Task **#52 — Restore the broader backend
  regression suite’s reliability** was inspected and this is its existing
  scope, not new broad repair work.
- Existing integration-settings run: **12 passed, 2 failed**:
  `strict recipient and fixed branded content; user abuse limit` and
  `notification SMS tests are authorized, validated, explicit and report
  sanitized outcomes without activating clinics`. The latter expected
  `provider_accepted` but got `not_dispatched`. These are baseline fixture
  failures, not evidence to enable real delivery.
  The former expected `/DigiQ Doctors/` but the current test message subject
  is `Digi-Q — SMTP configuration test`; this exact mismatch remained after
  updates.
- Newly added isolated security checks reproduced the old proxy subnet trust
  bug and nested-comment recipient misrouting. The browser test reproduced
  the DOMPurify XHTML `attributeName="href"` bypass. These tests intentionally
  failed against the vulnerable baseline.

The focused API command is:

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/backend-flow.test.mjs \
  artifacts/api-server/src/auth-http.integration.test.mjs \
  artifacts/api-server/src/functional-features.integration.test.mjs \
  artifacts/api-server/src/email-template.test.mjs \
  artifacts/api-server/src/email-theme.test.mjs \
  artifacts/api-server/src/ticket-email.test.mjs
```

The integration-settings command is:

```sh
node --test --test-concurrency=1 \
  artifacts/api-server/src/integration-checks.test.mjs \
  artifacts/api-server/src/integrations.integration.test.mjs
```

The database checks above use disposable PGlite/native PostgreSQL fixtures
with synthetic identities. Mail/SMS are fake transports; the new real
Nodemailer test uses in-memory stream composition, not SMTP. The browser
sanitizer fixture blocks all network requests. Real credentials are neither
read nor printed by these checks.

## Final verification results

| Check | Before | After |
| --- | --- | --- |
| Root `pnpm run typecheck` | Passed | **Passed**, including deck and mockup after resolving the two introduced dependency-identity regressions |
| `node scripts/check-security-codegen.mjs` | Passed, 0 output differences | **Passed**: generated libraries typecheck; 2 client files and 61 Zod/type files differ under Orval 8.47.0 |
| `pnpm test:dependency-security` | Proxy, recipient and sanitizer flaws reproduced in isolated tests | **7/7 passed**, including actual editor edit/undo and network-blocked sanitizer |
| `pnpm test:tickets` | **165/165 passed** | **165/165 passed** (5.1 minutes), with no retries |
| Focused existing API command above | 42 pass / 1 existing fixture failure | **42 pass / same 1 fixture failure** |
| Integration-settings command above | 12 pass / 2 existing assertion failures | **12 pass / same 2 assertion failures** |
| API build | Passed | **Passed** |
| ClinicFlow build | Passed | **Passed** |
| Deck build | Passed | **Passed** |
| Mockup build | Passed | **Passed** |
| `validate-slides` | Baseline checked-in manifest was empty with an unreferenced slide | **Blocked by unchanged content**: `Orphaned slide file: src/pages/slides/Slide01.tsx (not referenced in manifest)` |
| npm and OSV audits | Counts above | **1 high Zod finding; no non-Zod findings** |

The build smoke commands used
`PORT=3000 BASE_PATH=/ pnpm --filter @workspace/<package> run build` for
`api-server`, `clinicflow`, `clinicflow-project-deck` and `mockup-sandbox`.
Actual development workflow checks used each managed artifact's own routing
and environment. The UI/deck retain existing large-chunk warnings; no warning
or threshold was suppressed.

The updated generator was intentionally verified in a disposable copy rather
than overwriting 63 checked-in generated files merely to test a security
update. Current application builds still use their existing generated
contracts; generated-library compatibility is not a claim that all consumers
have adopted the new generator output. F02 can review/regenerate those files
alongside its already-planned validation migration.

Bundle reachability was checked against the built API source map and imports:
body-parser 2.4.0, proxy-addr 2.0.8, qs 6.17.1, ip-address 10.7.6 and DOMPurify
3.4.17 are included. Nodemailer and Google storage remain **external runtime
imports**, so their resolved package versions must be shipped from the frozen
lockfile as well as the API bundle. Old uuid 9 is absent. The UI build emits
jsPDF and patched DOMPurify chunks. These observations distinguish runtime
bundling, runtime external packages and codegen/build-only dependencies; no
production image was built or inspected.

## Supported limits on verification

- The focused API run after the security updates again returned **42 passed /
  1 failed**, exclusively the same pre-existing backend fixture bundling
  failure. The integration-settings run again returned **12 passed / 2 failed**
  with the same subject and fake-SMS expectation mismatches. The task does not
  claim that the broad backend suite or those stale fixtures are repaired.
  Existing task #52 retains the broad-suite repair scope; do not duplicate it.
- The normal API workflow was **not started**: its startup provisions
  vocabulary and starts notification workers, so starting it against the
  workspace database would not be an isolated read-only check. API behavior
  was checked through the disposable/fake-transport harnesses instead.
- All three frontend workflows started on Vite 7.3.8. The public landing-page
  screenshot rendered normally; its API requests returned 502 because the API
  service was intentionally not started. **Live signed-in UI was not verified.**
- The deck preview was blank both at its root and a slide route. The
  **pre-existing checked-in slides manifest is `[]`**, despite the artifact
  description mentioning a larger deck. This is not caused by these dependency
  updates, and no slides/manifest/router were rewritten. The genuine editor
  packages were instead exercised in an offline browser fixture, including
  edit and undo. Dependency build/type checks do not prove authored deck
  content exists.

Next actions for these non-security verification limits: retain the existing
broad-suite repair task rather than duplicating it; align the two integration
fixture expectations with approved subject/delivery-gate behavior in the
existing test-maintenance scope, never by enabling live transport; and restore
an authored slide manifest only if deck-content work is separately approved.
None of these limits conceals a deferred non-Zod vulnerability.

## Remaining boundary

Zod 3.25.76 is deliberately unchanged. Its oversized-array resource-consumption
advisory is assigned to **F02 — Migrate validation and code generation to
patched Zod**, not silently declared fixed here. The existing API JSON body
limit is 128 KiB, which bounds input bytes but is **not** a complete mitigation
for issue amplification or a reason to defer F02 indefinitely. Do not claim
the project is vulnerability-free while that finding remains.
