# Healthcare catalog responsiveness

## Reproduce

From the repository root:

```sh
# Before behavior, without editing any application source:
CATALOG_BASELINE=1 pnpm exec playwright test --config artifacts/clinicflow/catalog-benchmark/playwright.config.ts --grep 'catalog responsiveness'
# Optimized behavior plus traversal, labels, custom entry and retry checks:
pnpm exec playwright test --config artifacts/clinicflow/catalog-benchmark/playwright.config.ts
# Real route contract and ownership/registration regressions, disposable DB only:
pnpm test:clinic-metadata
```

The fixture intercepts API requests and uses 10,000 fictional categories,
10,000 specialities and 10,000 qualifications. It never seeds the workspace
database, signs into an account, delivers notifications or calls production.
Generated Playwright metrics are written under ignored `generated-artifacts/`.
The baseline Vite transform is restricted to the isolated benchmark config.
The application build does not contain the transform.

## Measurements

Measured 2026-10-21 using local Chromium in the development environment,
with the application's actual CSS compiler/source scanning enabled:

| Metric | Laptop 1366×768 before | Laptop after | Mobile size 390×844 before | Mobile size after |
| --- | ---: | ---: | ---: | ---: |
| Initial metadata form visible (navigation included) | 1,424 ms | 1,282 ms | 760 ms | 526 ms |
| Open category dropdown to first option visible | 3,280 ms | 145 ms | 5,080 ms | 134 ms |
| Search category for the final catalog option | 6,577 ms | 31 ms | 7,161 ms | 22 ms |
| Open and search speciality for final catalog option | 11,545 ms | 186 ms | 10,780 ms | 118 ms |
| Mounted category options | 10,001 | 75 | 10,001 | 75 |

Payload: **1,880,052 JSON bytes** for 30,000 fictional options. Compressing the
same fixture with gzip produces **158,259 bytes**, but that is a size comparison,
**not** evidence the API/proxy enables HTTP compression. The embedded-database
integration test separately measures the real endpoint's full response, proves
all 30,000 added options are present and removes them from its disposable DB.
That test returned **2,476,504 JSON bytes in 148 ms**; its longer fixture IDs
and pre-existing test vocabulary account for the larger payload. Its 30,000-row
setup/cleanup time is not included in endpoint latency.

These are single-run development measurements, including Playwright polling
and action overhead, not statistical production benchmarks. Mobile here means
viewport size, not an emulated slow CPU, mobile browser or network. Fonts are
loaded as the app normally loads them. Initial form visibility is not a measure
of server query time or of downloading the catalog on a cellular connection.

## Decision and bounds

The measured bottleneck was mounting thousands of cmdk options and filtering
them again inside cmdk. Opt-in local paging mounts at most 75 choices, searches
the **whole** catalog, and disables redundant cmdk filtering for these callers.
The search results have explicit Previous/Next controls and a result range;
they are never truncated to the first 75 matches. Paging replaces the mounted
page rather than accumulating thousands of nodes. Searching resets the page;
selected names still come from the full catalog, independently of the page.
IDs (not potentially duplicated names) identify paged choices.

The optional custom category is first on the initial page so catalog growth
does not move it behind hundreds of pages. Saved inactive labels remain readable
but disabled. Standard and custom clinic specialities can still be mixed.
Doctor specialization/qualifications use the same rendering bound in the setup
wizard but remain independent fields with no clinic-custom options.
Other users of the shared selectors and existing remote paging are opt-out
by default and retain their previous contracts.

No API schema/route/ownership changes were necessary: the complete active-option
response remains backward compatible. **Transport size and local search work
still grow linearly with catalog size.** This change bounds DOM/rendering work,
not an arbitrarily large network payload. At the measured catalog size the
initial form rendered in 0.5–1.3 seconds locally; that does not establish a slow
network budget. Server paging, selected-ID name hydration and the setup callers
must be changed together if a future transport budget requires it. Do not
silently cap the current endpoint or hide the rest of a catalog.

Regression budgets in the benchmark allow 1.5 seconds to open Category and
1 second to search its final option, alongside the strict 75-row DOM ceiling.
The smaller 151-entry traversal case checks **every** category and speciality
across page boundaries, keyboard activation, retained/disabled historical names,
and no-match states. Empty/error tests retry while preserving custom drafts.
