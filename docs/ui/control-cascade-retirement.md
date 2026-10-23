# Legacy control declaration retirement

`compact-ui.md` remains the acceptance authority. This is a behavior-preserving
ownership cleanup, not a new sizing or branding specification.

## Retirement ledger

The pre-edit rendered baseline was captured before any application CSS changes.
Each group below is represented in that baseline and in the final paired
comparison. Only superseded declarations were removed; mixed rules retain their
effective declarations.

| Source | Retired declarations | Retained owner / reason |
|---|---|---|
| `index.css` | Earlier native focus border/shadow and button/link/tab focus-visible outline | Later blue-system rules in the same components layer; final semantic invalid+focus treatment remains in `compact-ui.css` |
| `index.css` | Workspace/dialog help and error font sizes; workspace help/error top margin | Final semantic help/error rules, including subgrid error placement |
| `index.css` | Screen workspace native-field font size, radius and top margin | Existing workspace native fallback rule and final field families |
| `index.css` | Screen workspace search inline padding, search font sizes, workspace/dialog password right padding | Existing search family rules and final password compound-field rules |
| `compact-workspace.css` | Status/day switch input positioning, opacity, size and margin copies | Final shared hidden-input rule; tracks, thumbs and activation states were not rewritten |
| `compact-workspace.css` | Earlier small-button minimum height and textarea minimum height | Later existing small-button rule and final scoped multiline family |
| `compact-workspace.css` | Searchable-select minimum height, vertical padding, line height and duplicate touch minimum-height selectors | Final ordinary/toolbar/touch family rules; legacy horizontal padding remains |
| `form-standard.css` | Help/error font size and line height; repeated editor label minimum height | Final semantic feedback typography; existing shared label baseline |
| `components/uniformity.css` | Earlier portal-menu minimum height and padding | Later existing portal-menu row rule |

### Effective rules deliberately retained

- The screen-only workspace native-field **4px vertical padding is active**.
  Removing it changed file/multiple-select geometry and downstream layout. The
  initial comparison rejected that removal; the declaration was retained, and
  the final comparison has no differences.
- Broad native fallback rules still serve range, color, file, hidden and multiline
  families. Similar-looking selectors are not evidence that a whole rule is dead.
- Keep specificity, screen/print ancestry, and horizontal/vertical padding
  separate when evaluating a declaration. No new override or `!important` was
  added to force equality.
- Command/search emphasis, picker cells, check/radio sizes, switch tracks/thumbs,
  pseudo-element touch targets, feedback colours and exported documents remain
  unchanged. No JSX, route, navigation, API or role-scope contract changed.

## Reproducible paired evidence

Start the existing isolated workspace harness:

```sh
pnpm --dir artifacts/clinicflow exec vite --config workspace-regression/vite.config.ts
```

On the pre-edit source run `node scripts/control-cascade-evidence.mjs record`.
With the same ignored evidence directory and the candidate CSS, run
`node scripts/control-cascade-evidence.mjs compare`. Do not record a new baseline
from the candidate and call that a before/after comparison.

The script loads real application CSS with application-source Tailwind scanning.
It rejects non-GET API requests and uses fictional data only. It compares exact
geometry and 30 computed properties on elements and both pseudo-elements:

- Five viewport sizes: 390×844, 768×900, 1024×640, 1366×768 and 1920×1080.
- An additional 1024×640 coarse/touch-pointer profile.
- Initial, checked+invalid+focused, disabled, readonly, modal and drawer states.
- Native probes in unscoped, workspace, dialog, auth, registration, toolbar,
  listing, form-grid and editor ancestry, including excluded native input types.

Final result: **54 state/viewport profiles, 19,410 element samples, zero computed
style or geometry differences**. Screenshots, both JSON snapshots and the empty
`differences.json` are in `generated-artifacts/control-cascade/` (ignored by Git
and deployment). Representative images include the 390px and 1366px initial,
dialog and drawer pairs. The real signed-out mobile screen was also inspected.

The first comparison was intentionally not accepted: it exposed the active
padding declaration described above. The passing result uses the original
pre-edit baseline, not a replacement.

## Verification and limits

See `compact-ui-coverage.md` for final commands/results and the existing broader
fixture limitations. These measurements are Chromium family evidence, **not**
authenticated role evidence. Safari/Firefox, actual autofill, camera permissions
and every populated role/route combination remain outside this pass.

This is not a claim that the entire historical stylesheet has been removed.
Rules without demonstrated supersession are retained. The final production CSS
bundle is 410.26 kB (72.20 kB gzip); the purpose is safer ownership, not a large
payload reduction.

The full completion suite exposed an unrelated strict fractional-position
assertion in the notification-management fixture. The untouched original source
reproduced the identical position. See the coverage record for the bounded
half-pixel fixture correction; production geometry was not adjusted to satisfy it.
