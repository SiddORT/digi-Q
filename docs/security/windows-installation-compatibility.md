# Windows x64 installation compatibility

Verified 2026-11-17 on **Linux x64**, Node **24.22.1**, pnpm **10.26.1**.
This change restores optional native dependency resolution, not application
behavior or a production rollout. **Native Windows installation and builds are
unverified:** this workspace has no available authorized Windows runner. No push
was made to obtain one, and the new pull-request workflow has not run remotely.

## History and authorization

Read-only inspection of the dependency history confirmed:

- `73cf3fd` deliberately removed the four exclusions for local Windows development.
- `50a8f38` reintroduced the Oxide exclusion during dependency-security work and
  truncated the override tail.
- `d68af92` restored that tail during the Zod migration, including the other three
  Windows exclusions. Subsequent history retained them.

These are observed diffs, **not evidence of a documented requirement to block
Windows**. The earlier paused-rebase guidance to preserve a union of platform
exclusions is superseded for these four entries by this explicit restoration.
Future policy-completeness work (including the existing draft “Catch missing
dependency protections before installation”) must keep all four exclusions
**absent**, rather than snapshotting them as required protections.

At implementation start the branch was `main`, HEAD
`bc4c81015f50baef2c5d718538b0769732c3c4d6`. There were no unmerged entries, no
`rebase-merge` or `rebase-apply` directories, and no dependency-file changes.
An unrelated transient contention-test file appeared in initial status and
disappeared as the existing test finished; it was not edited or removed here.
No rebase was started, continued or recreated; an old `REBASE_HEAD` alone would
not establish an active rebase.

## Exact policy and graph changes

Only these parent-scoped `'-'` overrides were removed from
`pnpm-workspace.yaml`; pnpm regenerated the matching lockfile overrides:

| Parent | Restored Windows x64 child | Version | Preserved Linux x64 child |
| --- | --- | --- | --- |
| `@tailwindcss/oxide` | `@tailwindcss/oxide-win32-x64-msvc` | 4.3.5 | `@tailwindcss/oxide-linux-x64-gnu` |
| `esbuild` | `@esbuild/win32-x64` | 0.28.2 | `@esbuild/linux-x64` |
| `lightningcss` | `lightningcss-win32-x64-msvc` | 1.33.0 | `lightningcss-linux-x64-gnu` |
| `rollup` | `@rollup/rollup-win32-x64-msvc` | 4.63.1 | `@rollup/rollup-linux-x64-gnu` |

Resolution command: `pnpm install --lockfile-only --ignore-scripts` (exit 0).
The complete lockfile diff contains only four removed overrides, four added
package records, four added optional snapshots, and four added parent optional
edges. Each Windows package has `os: [win32]`, `cpu: [x64]` and SHA-512 integrity.
Every existing package record, importer, catalog resolution, Linux edge and
unrelated snapshot is unchanged. There is one matching snapshot per parent in
this lockfile; the guard fixtures also cover multiple versions/peer contexts.

Tracked [graph evidence](windows-install-graph-evidence.json) records the
647 → 651 package inventory, four additions, zero removals, security overrides,
resolved catalog, Linux package versions and before/after lockfile hashes.
The comparison parsed both original and regenerated files, asserted equality of
every original package record, removed only the expected additions/edges and
restored only the four override keys in a comparison copy, then asserted
deep equality with the original graph. The parsed workspace policies were equal
after deleting only the four original exclusions. `.npmrc` was byte-identical;
the root manifest was equal after removing the new test command.

All other exclusions/overrides, catalog entries, the **1440-minute** release-age
gate and its two exceptions, peer settings, pnpm-only preinstall guard, root
`pnpm.onlyBuiltDependencies`, workspace `onlyBuiltDependencies` and `allowBuilds`
remain semantically unchanged. No firewall, registry, script approval or security
setting was bypassed. The frozen install reported **ignored esbuild build
scripts** under the existing policy; no approval was added to suppress that
warning. Actual esbuild-backed Linux builds still passed.

## Verification results

Full command logs are local, ignored files under
`generated-artifacts/windows-compat/`. This tracked report and the three JSON
evidence files preserve the substantive results independently of those logs.

| Exact check | Result |
| --- | --- |
| Baseline `pnpm run typecheck` | Exit 0; all libraries, four artifacts and scripts |
| `pnpm install --lockfile-only --ignore-scripts` | Exit 0; only expected four-package graph additions |
| `pnpm install --frozen-lockfile` | Exit 0 on Linux, normal preinstall guard executed, no protection-relaxing flags |
| `pnpm test:windows-dependencies` | Exit 0; structural guard and **92/92** tests passed, including negative mutations |
| Final `pnpm run typecheck` | Exit 0; canonical full workspace check |
| `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/api-server run build` | Exit 0 |
| `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow run build` | Exit 0 |
| `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow-project-deck run build` | Exit 0 |
| `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox run build` | Exit 0 |
| `pnpm test:dependency-security` | Exit 0, **7/7**; actual packages, offline MIME/XML, network-blocked Chromium sanitizer/editor fixtures |
| Additional `pnpm test:zod-migration` | Exit 1, **10/11**; existing schema-count assertion expects **423**, current unchanged contracts export **442** |
| `node --test generated-artifacts/windows-compat/baseline-zod.test.mjs` | Exit 1, same **10/11** and **442 !== 423** using the original test extracted from HEAD |
| Before/after `pnpm audit --json` | Exit 0 both times; **zero advisories at every severity** |
| `git diff --check` | Exit 0 |
| Managed ClinicFlow frontend restart and `/sign-in` visual smoke | Vite 7.3.8 started cleanly; real staff login form rendered, no browser errors |
| Native Windows frozen installation/native-tool/build execution | **Not run; unverified** — no available authorized Windows runner |

The first completion-validation attempt also ran the configured broader checks.
Queue contention, appointment movement, communication usage, appointment-detail
compatibility, PostgreSQL migrations and live-ticket compatibility passed, as did
completion code review. Its `pnpm test:tickets` invocation exited 1 **before
running tests**, because the pre-existing `ticket-browser-regression` workflow
already owned fixture port 43719. That competing run subsequently reported
163 passed / 2 failed with missing trace/output files, consistent with overlapping
runs sharing the results directory. No ticket code or test was changed; the
required completion validation is retried only after that run has stopped.

The Zod assertion failure is unrelated baseline test drift: the original HEAD
test fails identically against unchanged application/contracts and the same
existing dependency records. It was reproduced after graph restoration, not
claimed as an independently executed pre-change install. Neither its expected
count nor any validator was modified. There were **no full-typecheck, artifact
build or focused dependency-security failures**.

Existing warnings remain visible: deprecated Recharts/node-domexception during
resolution and large UI/deck chunks during builds. No warning threshold was
changed. Only the frontend workflow was explicitly restarted here; the already
running API and other pre-existing test workflows were not started/restarted by
this work. There was no sign-in, application data change, live provider test,
merge, push, deployment or rebase action.

## Security evidence and limitations

- [Before audit](windows-install-audit-before.json) and
  [after audit](windows-install-audit-after.json) retain exact inventories,
  lockfile hashes, capture times and npm-registry audit metadata.
- Baseline lock SHA-256:
  `3c4bdaee6820476a8a317461efa3695f1a23572c47d070444091e3fd07cc15fa`.
- Regenerated lock SHA-256:
  `9c7eaeba536335b2cbdf94b3d324fa3d123db8437be062f3c43fce65603d9f3c`.
- All 647 original resolved package records and security constraints are
  unchanged. In particular Zod remains **4.6.7**, Vite **7.3.8**,
  DOMPurify **3.4.17**, fast-xml-parser **5.12.0**, ip-address **10.7.6**,
  fast-uri **3.1.9**, source-map-js **1.2.2** and typography's
  postcss-selector-parser **6.1.5**.
- No new registry findings are attributable to the restoration; the feed
  returned no findings before or after. This is **one registry's point-in-time
  audit**, not a new independent OSV audit, binary provenance assessment,
  native-Windows execution, exploitation assessment or guarantee of no unknown
  vulnerabilities. Historical F01/F02 audit evidence was not overwritten.

## Prevention mechanism

`pnpm test:windows-dependencies` runs a platform-neutral Node/YAML guard plus
positive and negative fixtures. It fails on restored Windows removal selectors
(including version-scoped parents/global child selectors), workspace/lockfile
override disagreement, missing parents, missing or incorrect optional edges,
package records, integrity, native snapshots, optional flags, OS or CPU metadata.
Every matching parent package/version and peer-context snapshot is checked.
Both Windows x64 and existing Linux x64 records/edges must remain valid.

The synthetic fixtures exercise the second of two parent versions so a guard
that checks only one version cannot pass. They never rewrite real manifests or
lockfiles. Existing YAML tooling is reused; no dependency was added.

`.github/workflows/windows-dependency-policy.yml` runs the frozen install and
guard on pull requests, with read-only repository permissions, no push trigger,
no secrets, and no deployment job. It is a **Linux structural check**, not a
Windows execution check. No GitHub branch-protection requirement was changed.
It can expose future regressions once approved changes reach a pull request;
remote execution is not claimed here.

## Changed files

- `pnpm-workspace.yaml` — exactly four exclusion removals.
- `pnpm-lock.yaml` — pnpm-generated four-package restoration.
- `package.json` — one focused test command; install/security policy unchanged.
- `scripts/check-windows-dependencies.mjs` — structural guard.
- `scripts/windows-dependencies.test.mjs` — positive and negative fixtures.
- `.github/workflows/windows-dependency-policy.yml` — non-deploying PR check.
- `replit.md` — durable Windows exception to old exclusion-union guidance.
- `docs/security/windows-installation-compatibility.md` — this verification report.
- `docs/security/windows-install-audit-before.json`,
  `docs/security/windows-install-audit-after.json`,
  `docs/security/windows-install-graph-evidence.json` — durable evidence.
