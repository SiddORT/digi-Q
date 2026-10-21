# Production build warning verification

## Scope and cause

Tailwind's automatic detection scanned `workspace-regression/tests/workspace.spec.ts`.
The Playwright locator `[data-testid="list-header"]:visible` was interpreted as an
arbitrary variant with a `visible` utility, producing an invalid
`:is(data-testid="list-header")` selector. `src/index.css` now excludes only
`workspace-regression` from source detection. Application source scanning,
styles, and the test locator itself are unchanged.

The three sourcemap diagnostics were independent of Tailwind. They pointed to the
module-level `'use client'` directives in `command.tsx`, `label.tsx`, and
`tooltip.tsx`. This is a client-only Vite application, not a React Server
Components application. Removing these unnecessary directives eliminated the
diagnostics without changing component implementations or filtering warnings.
No sourcemap generation options were changed.

The real bundle-size warning is intentionally retained at Vite's default
500 kB threshold. The main JavaScript chunk remains 2,355.19 kB (686.45 kB gzip).
Route/dependency splitting is separate work; no warning filters, raised limits,
or manual chunk changes were introduced here.

## Build evidence

Run from the workspace root:

```sh
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinicflow build
```

Both builds exited successfully. Full captured terminal output is in the ignored
`generated-artifacts/build-warnings/before.log` and `after.log`.

### Before

```text
vite v7.3.6 building client environment for production...
transforming...
src/components/ui/command.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
src/components/ui/label.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
src/components/ui/tooltip.tsx (2:0): Error when using sourcemap for reporting an error: Can't resolve original location of error.
✓ 3121 modules transformed.
rendering chunks...
[esbuild css minify]
▲ [WARNING] Unexpected "=" [css-syntax-error]

    <stdin>:4454:59:
      4454 │ ...stid\=\"list-header\"\]\:visible:is(data-testid="list-header") {
           ╵                                                   ^

computing gzip size...
dist/public/index.html                              1.69 kB │ gzip:   0.60 kB
dist/public/assets/index-GpzRF5WJ.css             393.97 kB │ gzip:  69.09 kB
dist/public/assets/purify.es-BPuvlvQ_.js           29.05 kB │ gzip:  11.07 kB
dist/public/assets/index.es-DLUNlMRn.js           158.95 kB │ gzip:  52.94 kB
dist/public/assets/html2canvas.esm-DXEQVQnt.js    201.04 kB │ gzip:  47.07 kB
dist/public/assets/jspdf.es.min-yOzFxn6k.js       386.21 kB │ gzip: 125.01 kB
dist/public/assets/index-C5SXIuKd.js            2,355.19 kB │ gzip: 686.45 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 13.78s
```

### After (final source)

```text
vite v7.3.6 building client environment for production...
transforming...
✓ 3121 modules transformed.
rendering chunks...
computing gzip size...
dist/public/index.html                              1.69 kB │ gzip:   0.60 kB
dist/public/assets/index-fm-fvkuI.css             393.85 kB │ gzip:  69.04 kB
dist/public/assets/purify.es-BPuvlvQ_.js           29.05 kB │ gzip:  11.07 kB
dist/public/assets/index.es-D0JS7DeR.js           158.95 kB │ gzip:  52.94 kB
dist/public/assets/html2canvas.esm-DXEQVQnt.js    201.04 kB │ gzip:  47.07 kB
dist/public/assets/jspdf.es.min-BoJYmXhh.js       386.21 kB │ gzip: 125.01 kB
dist/public/assets/index-CK3ffmdZ.js            2,355.19 kB │ gzip: 686.45 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 11.57s
```

## Rendered checks and limits

- `node --test artifacts/clinicflow/src/components/ui/build-render.test.mjs`:
  all three tests passed. Real component rendering preserves command input/list
  roles and utility classes, label association/disabled styling, and closed
  tooltip trigger semantics. These are server-rendered markup checks, not
  interactive browser coverage of an open menu or tooltip.
- Preview homepage at 1280×720: before and after screenshots visually match;
  no browser errors were reported. The initial capture was
  `/tmp/replit-screenshots/clinicflow_TqXn.jpg`; the retained copy is
  `generated-artifacts/build-warnings/before-home.jpg`.
- Preview `/sign-in` at 390×844: labels, fields and sign-in button render
  within the viewport; no browser errors were reported. No sign-in was attempted.
- After screenshots are retained under `generated-artifacts/build-warnings/` as
  `after-home.jpg` and `after-sign-in-mobile.jpg`.
- The managed frontend workflow was restarted and reported Vite ready with no
  startup errors.

Screenshots are of the development Preview; the production artifact was checked
by building it, not by deploying it. No production deployment, authenticated
workspace journey, or interactive tooltip/menu check was performed for this
build-only change.
