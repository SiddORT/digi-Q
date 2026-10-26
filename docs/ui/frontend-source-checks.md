# Whole-frontend checks

## Run the complete suite

From the workspace root:

```sh
pnpm test:frontend
```

This is the canonical **source-suite** command. It:

1. Runs the normal OpenAPI code generator and builds shared-library declarations.
   A failed generation/build stops the command before testing; generated
   contracts are ignored by Git and must not be assumed present in a checkout.
2. Discovers **every** `*.test.mjs` recursively under `artifacts/clinicflow/src`,
   sorts the paths, then runs Node's test runner with concurrency 1 and TAP output.
   There is no failure allowlist, filename exclusion, retry-to-green, or skipped test.
3. Propagates generation, compilation, test failures and process termination as
   nonzero exits. New test files are included without editing a command list.

Prerequisites: workspace dependencies installed with pnpm, the project's Node 24
runtime, and `/repl/tools/bin/chromium` for the existing isolated rendered
registration fixture. The suite bundles real application TypeScript with esbuild;
it does not assume Node's TypeScript support resolves bundler-style imports.
It needs no running application server, database credentials, real account,
provider connection or live notification. Browser fixture data and endpoints are
fictional/local. Screenshots produced by the existing fixture remain in ignored
`generated-artifacts/registration-confirmation/`.

For one file while editing (after code generation), use
`node --test path/to/file.test.mjs`. This is a focused check, not whole-suite
acceptance. The root command intentionally repeats generation to remain safe on
fresh checkouts. TypeScript and the production build remain separate checks:

```sh
pnpm --filter @workspace/clinicflow run typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build
```

## Reproduction and failure classification

The starting run used the current checkout, after
`pnpm --filter @workspace/api-spec run codegen` (which also builds library
declarations), then every `artifacts/clinicflow/src/**/*.test.mjs` file, sorted,
with Node's test runner and `--test-concurrency=1`. It reported **704 tests,
639 passed, 65 failed**. This is a current-checkout reproduction, not a
comparison with a checkout missing generated contracts.

Before changing assertions, the failures were classified below. Names identify
the failed checks within each file; multiple entries on a row are separate
failures. “Composition” means inspect the current owner/contract, not remove the
guarantee. “Harness” means the check cannot yet establish an application defect.

| Test file (relative to `src/`) | Failed checks | Initial classification |
| --- | --- | --- |
| auth/security-notifications.render | required event rules | Composition: event controls moved/grouped |
| components/accessibility-sweep | reset focus; account copy/reschedule | Composition: reset handler and server-owned reschedule eligibility |
| components/admin-listing-ui | missing sessions | Composition: guidance moved to shared booking state |
| components/appointments/filtered-export | queue clear-all | Composition: optional filter chip wiring |
| components/appointments/information-density | operational tokens | Composition: adjacent help wording |
| components/compact-listing | wrapping toolbar | Composition: count ownership |
| components/email-consolidation | real email panel | Composition: secondary diagnostics explanation in help |
| components/email-input | shared fields; guest validation | Composition: extracted staff editor and form validation |
| components/email-templates | recipient-aware | Composition: explanatory wording |
| components/enterprise-interactions | navigation preferences | Composition: additional scope argument |
| components/form-standard | dedicated forms; reschedule dirty | Composition: extracted staff editor and expanded reschedule draft |
| components/keep-in-touch-settings | saved provider; custom API | Render harness: advanced fields are collapsed |
| components/linked-schedules-ui | copy hours; section navigation; embedded management; legacy routes; appointment/report filters; old branch edit; copy/follow controls; legacy links | Composition: extracted navigation/schedule/report owners; legacy function evaluation lacks imported dependency |
| components/onboarding-resource | reset mutation; registration resend | Composition: reset wrapper and help wording |
| components/overflow-text | focus/hover/tap/keys | Composition: coordinated overlay handlers |
| components/permissions-logo | restriction semantics | Composition: Super Admin read-only, not removed from role choices |
| components/queue/queue-layout | heading/entry points | Composition: page heading ownership condition |
| components/registration-address.render | confirmation actions; admin advance; lookup failure; admin whitespace | Harness: focus target assumption and missing current required admin identity input |
| components/resource-controls | drafted sort | Composition: default sort helper |
| components/responsive-action-group | FilterBar tools | Composition: additional optional props |
| components/saved-scope | live profile | Composition: additional shared editor prop |
| components/search-links | file fails before tests | Harness: parse/load failure |
| components/section-a-consistency | editor guidance; shared footer; closure recovery | Composition: extracted guidance/footer and reports |
| components/section-b-locations | B11 count; B13 toolbar; B15 editor | Composition: location listing/editor moved |
| components/sections-c-g | phone; selected labels; hours warning; patient editor; staged guest confirmation | Composition: compact phone labels, stricter no-ID fallback, shared booking fields and stronger confirmation guard |
| components/sms-settings | settings; template controls; close/anchors | Composition: advanced settings and shared leave guard/control ownership |
| components/style-ownership | notification duplicates; search flex | CSS: inspect responsive override scope, not global text counts |
| components/uniform-controls | phone/timestamps | Composition: inherited preferences object |
| components/uniformity | file fails before tests | Harness: parse/load failure |
| components/workspace-branch | wiring; doctor Users | Composition: explicit requested clinic and consolidated doctor navigation |
| enterprise-tokens | font sizes; spacing/height; spacing/radius | CSS: distinguish actual off-scale declarations from governed icon/readout geometry |
| lib/clinic-address | persisted draft | Contract: current draft normalization adds metadata defaults |
| lib/communication-contract | diagnostics | Composition: secondary guidance moved to help |
| workspace-style-tokens | typography; dimensions; geometry exclusion | CSS harness: exact-selector matching misses `:is()`/logical-property rules |

This suite is not signed-in browser acceptance, hosted/UAT acceptance, native
zoom acceptance, or backend regression coverage. Existing UI evidence retains
its own recorded limits.

## Resolution and retained guarantees

- Both file-load failures were **module-loader defects**, not absent generated
  API fixtures in this reproduction. The generated files existed; direct Node
  imports could not resolve their extensionless TypeScript dependencies.
  An in-memory CommonJS bundling helper now preserves one React/Query runtime.
  The visit-contact fixture also no longer leaves generated CSS in source folders.
- Navigation checks exercise the actual clinic URL helpers and preserve clinic
  identity, location selection and legacy destinations. Exact JSX slices no
  longer assume that every report is named `Reports` or that imported redirect
  helpers are absent.
- Real rendered shared headers confirm that the page title replaces fallback
  list headings, retaining exactly one heading. Rendered staff and booking fields
  cover create-only passwords, separate contact verification, optional email and
  linked validation. Reschedule draft comparison is executed for unchanged,
  whitespace-only and every changed field, including the selected session.
- Registration browser fixtures now distinguish the **single-page administrator
  form** from the self-registration wizard. Both retain URL validation,
  automatic address selection, conflict handling, explicit retry and stable
  request identity. The administrator fixture also proves required credentials
  and password exclusion from saved drafts. Confirmation links retain their
  destinations, icons, keyboard focus, visible focus indication and containment
  at desktop/tablet/phone widths; the fixture tabs past preceding help controls.
- Security-message activation is no longer immutable: the approved Superadmin
  controls at System Default replaced that earlier policy. Checks retain the
  platform ownership and separation from Optional Delivery, not the retired
  “cannot be disabled” wording. No provider was called and no activation changed.
- Help text moved into accessible adjacent help is checked at its owner/trigger,
  not required to appear in initial server-rendered text. Critical warnings,
  provider uncertainty, protected credentials and validation remain checked.

### CSS scope and existing debt

The central scale/token checks remain. Source assertions previously treated every
compact component's spacing as the central scale, mistook responsive overrides
for duplicate owners, and missed `:is()` selectors and the later semantic
stylesheet. The checks now use the current rule owner and scope.

Existing off-scale compact declarations are enumerated by **exact filename,
selector, property and value** in `src/test/compact-css-exceptions.mjs`. This is
an explicit inventory of existing style debt, **not approval or remediation of
those values**. A new off-scale declaration still fails; changing an inventoried
value still fails; stale inventory entries fail. There are no whole-file CSS
exclusions added. This preserves the existing UI instead of turning test repair
into an unapproved visual restyle. Consolidating those values into the central
style families is separate follow-up work.

## Verified outcome

The whole command reports **719 tests passed, 0 failed, 0 skipped**, across
**131 source test files**, with contracts generated first. Frontend TypeScript
and the production build also pass; the existing large-chunk build warning
remains. The suite has not been compared numerically to a different checkout
without generated fixtures. No runtime product or backend behavior was changed.

This result supersedes only the old source-suite-red status in
`app-wide-ui-acceptance.md`; it does not convert that document's outstanding
role/device/hosted or conditional-state acceptance into passes.
