# Compact QR acceptance results

Date: 2026-10-30. Target: loopback `127.0.0.1:43720` using the retained
`pnpm test:qr-validation` harness and a disposable migrated PostgreSQL cluster.
No workspace/production appointments, identities or delivery providers were used.

## Final outcome

**All 14 retained scenarios have passed across the initial pass and focused
reruns.** This is not a claim that a new complete 14-test pass was run after every
fixture repair. The final responsive-only run passed in 21.2 seconds; native
200% zoom and the additional four-role direct-link scenario passed separately.

| Scenario | Final result |
|---|---|
| Super Admin: queue session, workspace search, profile menu | Passed, all three entries |
| Clinic Admin: queue session, workspace search, profile menu | Passed, all three entries |
| Doctor: queue session, workspace search, profile menu | Passed, all three entries |
| Receptionist: queue session, workspace search, profile menu | Passed, all three entries |
| Phone-sized printed link → actual password sign-in → retained payload | Passed |
| Existing printed-link destination for all four verified staff roles | Passed |
| Real HTTP signatures, tampering, missing record, role/scope, date/status/queue restrictions, read-only snapshots | Passed |
| Normally created booking → server-issued ticket → validation → explicit consultation; repeat check-in idempotent | Passed |
| Actual PNG decoding, malformed image, foreign/pasted code, retry and repeated scan | Passed |
| Camera denial, unsupported native detector, jsQR video-frame decoding and stopped tracks | Passed |
| Late camera detection, image callback and server response after mode/close/reopen | Passed |
| Unrelated native camera QR continues scanning; resolve/check-in failure, pending close guard and retry | Passed |
| Five viewport sizes × all eight presentation states; focus trap, Escape, URL/filter/selection/scroll preservation | Passed |
| Native Chromium tab zoom set/read at exactly 2.0; upload and verified action reachable | Passed |

Staff evidence uses fictional `.test.invalid` accounts through the actual
password form, native session cookies and `/api/me` role assertions, not a
test-user identity header. Each login clears the prior account's session.
Patient-negative coverage uses an explicitly test-issued patient session and
does **not** claim a real patient authentication journey.

The harness mounts the real auth and appointment routers, migrated database and
native session middleware; it is not a production deployment or a new audit of
the entire application's unchanged middleware.

## Entry-point acceptance

The four role cases each exercised all three existing workspace actions:
queue **session** header, workspace search quick action and profile menu. Each
validated the same ticket, announced **QR verified**, offered a separate explicit
check-in button, retained the originating URL and restored focus to the stable
launcher on close. Database appointment/history/audit snapshots remained equal.
The four-role direct-link case independently rendered the same result without
mutating any appointment. The phone case retained the signed payload across the
real staff sign-in redirect.

Source audit found no additional appointment validator in main navigation,
overflow or More Actions. Public booking/clinic QR actions were excluded rather
than relabelled as staff validation entries.

## Responsive and accessibility evidence

| Chromium viewport | States captured | Additional assertions |
|---|---|---|
| Phone 390×740 | Empty, scanning, camera denied, uploading, resolving, verified, server denied, technical failure | Dialog width ≤480px, fits viewport, no horizontal document overflow |
| Tablet 768×1024 | Same eight | Same |
| Short desktop 1280×520 | Same eight | Same |
| Wide desktop 1920×1080 | Same eight | Same |
| 200% equivalent reflow 640×360 | Same eight | Same |
| Native tab zoom 200%, 1280×720 browser window | Upload, verified | Extension `tabs.setZoom`/`getZoom` returned 2.0; DPR doubled; modal fits; explicit action scrolls into view; Escape restores focus |

At every reflow size the test tabs through controls and confirms focus stays in
the dialog. Escape closes it and focuses the profile launcher. The selected
appointment stays selected, URL (including search/filter state) remains unchanged
and window scroll stays exactly at its **QR action activation** position.
Listing heading geometry stays within half a CSS pixel (fractional font rounding).
One visible shared close control, labelled video preview, mode `aria-pressed`,
status regions, text success/error headings and error alerts supplement these
keyboard checks. This is not a full screen-reader certification.

Screenshots were inspected for compact phone upload/verified states and the
short/native-zoom overflow behavior. All eight-state image sets are retained
under ignored `generated-artifacts/qr-validation/screenshots/`:
`{phone,tablet,short,wide,zoom-200-reflow}-{empty,scanning,camera-denied,uploading,loading,verified,denied,failure}.png`,
plus `native-200-{upload,verified}.png`.

## Reproduced fixes versus repaired test setup

Application fixes: oversized inline workspace replaced by a compact shared
dialog; clear verification headings; camera loop continues after an unrelated
link; native detector failure falls back; live cancellation guards stop late
detection/file work; file and server generations prevent stale results; camera
tracks/animation frames and image URLs are cleaned up; canonical-origin loading
refreshes scanner parsing; mutation pending state guards dismissal/repeats.
No role-specific no-op was reproduced; all existing staff controls worked.

Initial full run: **2 passed / 10 failed**. Its missing persisted patient-name
snapshot, retained login identity, incorrect booking response expectation and
non-emitting/non-configurable camera mocks were test setup failures, not new
backend regressions. An accidentally unfiltered rerun was **7 passed / 5 failed**;
four remaining role cases then passed after recording the opened queue session
as the actual scanner origin.

Responsive setup was repaired to install mocks before loading the actual App.
The apparent `100 → 56` and later `0 → 181` scroll changes occurred while reaching
the off-screen **parent launcher/menu action**, before validator activation.
Recording the baseline immediately before the visible QR action, rather than
before opening its parent menu, proved exact modal scroll preservation. The
test also waits for native zoom layout to settle and tolerates only subpixel
font rounding, not a displaced listing. Final responsive rerun passed.

## Limits and unrelated checks

- Camera permission, native detection and delayed failures are labelled
  simulations. PNG pixels and canvas video frames really run through jsQR.
  No physical phone camera, optics, OS prompt, iOS/Safari or Android hardware
  behavior was verified.
- Native Chromium 200% zoom is verified, separately from viewport simulation.
- QR-focused source/parser regressions: **3 passed**. The two-file source suite
  had **18 passed / 2 failed**; the failures are pre-existing booking progression
  assertions outside this task and were not repaired.
- Frontend typecheck remains blocked by pre-existing shared generated-client
  type mismatches (including booking mobile/template preview fields). No error
  names the changed scanner/dialog/store files. No unrelated toolchain repair.
- Current managed preview's unsigned `/check-in` was screenshotted at 390×740:
  staff sign-in appears, not private appointment content; no browser crash.
- Generated traces/images are ignored, not checked into history. The tracked
  report intentionally excludes credentials and signed bearer payloads.
