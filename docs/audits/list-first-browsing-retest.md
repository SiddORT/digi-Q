# List-first browsing: post-merge retest

Date: 2026-10-27. User requested another test before a possible live release.

## Decision

**Hold the release recommendation.** The first workflow run passed 156 browser
tests, but the subsequent required completion check passed 155 and failed one
appointment-save test. The other three required suites and Preview checks passed.
Authenticated live-role browsing and production behavior were not verified.
No deployment was performed.

This report records verification, not implementation approval. List-first browsing
was an audit/change specification; the optional-location browsing and session
overview proposals must not be described as shipped.

## Latest requested retest

### Final required completion result

After the passing workflow result below was documented, the required completion
validation ran again and failed `pnpm test:tickets`: **155 passed, one failed**
in approximately 4.6 minutes. The backend suites and completion code review passed.

The failing test was `edit: validation, keyboard, save payload uses start revision,
persisted in details and row` in
`artifacts/clinicflow/ticket-regression/tests/booking-tab.spec.ts`. Its immediate
`expect(s.patch).toMatchObject(...)` assertion received undefined. The edit-conflict
test passed in this run.

This is a different assertion in the same save-request capture area as the
previous failure. A passing run followed by a failing run does not establish a
reliable release pass. Investigation must distinguish asynchronous interception
timing from an actual missing submission; neither test nor application source was
changed to suppress the failure. The assigned task did not complete because the
required command failed.

### Earlier passing workflow result in this retest

The existing running workflows were allowed to finish before recording results;
no duplicate browser run was started manually.

| Check | Latest result |
|---|---|
| `pnpm test:tickets` | **156 passed**, approximately 4.9 minutes |
| Appointment edit-conflict / polling snapshot case | Passed within that full suite |
| `pnpm --filter @workspace/api-server test:queue-contention` | **20 passed** |
| `node --test artifacts/api-server/src/appointment-movement.test.mjs` | **19 passed** |
| `pnpm test:communication-usage` | **72 passed** |
| Development Preview `/` | HTTP 200 |
| `/api/healthz` | HTTP 200; `status: ok` |
| Unauthenticated `/api/me` | HTTP 401, as expected |
| Public clinic first page | HTTP 200; total four; no private data reported |
| Real Preview `/guest-booking` screenshot | Rendered successfully; Clinic picker and dependent disabled Location picker visible; no browser exceptions captured |

API and web managed workflows were running. No restart or application/test change
was needed. The prior edit-conflict failure has not been repaired or proven
resolved: this passing run establishes the current result, not that the
intermittency cannot recur.

The checks did not authenticate staff or patients, exercise live queue actions,
send messages, change saved settings or publish the app.

## Previous failed retest retained for comparison

## What was checked

| Check | Observation | Limit |
|---|---|---|
| Development Preview `/` | HTTP 200 | Not a production or signed-in verification |
| `/api/healthz` | HTTP 200, `status: ok` | Basic API health only |
| `/api/public/clinics?page=1&pageSize=20` | HTTP 200; four rows in the first page and total four | Only response metadata was reported; no clinical records fetched |
| Unauthenticated `/api/me` | HTTP 401 | No authenticated role established |
| Real Preview `/guest-booking` | Page rendered Clinic and disabled Location selectors; no visible error or browser exception in the capture | Confirms current sequential picker flow, not the proposed list-first discovery |
| Existing running ticket workflow | Allowed to finish without duplication or restart: 139 passed, 8 failed | Run began before this inspection; diagnostics differ from current merged source, so not eight confirmed current application defects |
| Fresh `pnpm test:tickets` during required completion validation | **155 passed, 1 failed**, approximately five minutes | Release-blocking non-green required check |
| `pnpm --filter @workspace/api-server test:queue-contention` | Passed in fresh completion validation | Does not prove real-role UI behavior |
| `node --test artifacts/api-server/src/appointment-movement.test.mjs` | Passed in fresh completion validation | Does not prove real-role UI behavior |
| `pnpm test:communication-usage` | Passed in fresh completion validation | Does not prove live delivery or provider readiness |

Managed API/web workflow entries showed earlier port-in-use failures even though
existing processes served the Preview. No competing process was started and no
existing process was killed. This is not evidence of a production outage.

## Fresh remaining failure

File: `artifacts/clinicflow/ticket-regression/tests/booking-tab.spec.ts`

Test: **edit conflict keeps the draft and polling does not replace the snapshot**

The test failed at `expect(s.patch.expectedRevision).toBe(1)` because `s.patch` was
undefined. The click had not yielded a captured patch at the point of assertion.
The same test passed in the earlier running workflow and failed during the fresh
full run. An earlier audit-session isolated rerun also passed.

Those observations suggest a timing-sensitive test or save-path problem, but do
not prove which one. Do not dismiss the failure as harmless or change the
expected revision to make it pass.

Next authorized investigation should examine the failed browser trace and actual
save request, distinguish a missing/blocked submission from an assertion racing
request interception, and preserve these checks:

- The submitted expected revision is the edit-start revision.
- A conflict remains visible.
- The draft is retained.
- Polling does not replace the edit snapshot.

If the problem is assertion synchronization, await an observable request or
captured-patch condition before reading it. If submission is blocked or missing,
fix that cause rather than weakening the assertion.

No application or test source was changed in this retest.

## Earlier overlapping workflow failures

The earlier workflow failed these groups:

- Hidden appointment values in Details without repeated Booking metadata.
- Denied exact-ID refresh hiding cached details and QR in row, linked and calendar
  contexts.
- Booking default, keyboard sections, fields, history and refresh stability.
- Changing appointment resetting tabs/copy feedback and empty history.
- Shared row/link/calendar tabs and close/reopen behavior.
- Reference-copy visibility without a repeated summary.

The diagnostic line numbers and reference-count expectation did not match the
source inspected after merging. The fresh run then passed those checks and left
only the edit-conflict failure above. Use the fresh result for the current
regression decision; do not claim all eight earlier failures are current defects.

## Browsing findings and boundaries

The detailed audit remains at `.local/audits/list-first-browsing.md`. Its main
source-confirmed findings remain proposals:

- Queue waits for doctor/location/session; the intended staff landing is a
  paginated session overview, not a merged patient queue.
- The shared location gate/pin affects staff Overview, Appointments, Patients,
  Weekly/Exceptions Schedule, and the Live/Operational Reports tabs.
- Clinics, staff directories, QR listings, report templates and communication
  usage are not uniformly picker-blocked.
- System Default notification configuration is distinct from clinic overrides;
  editing remains scoped.
- Public Guest Booking still uses sequential pickers. Existing public clinic
  URLs already offer public-safe directories.

No authenticated Super Admin, Clinic Admin, doctor, receptionist or patient
session was established during this retest. Actual signed-in initial states,
assignment/ownership boundaries, reset/Back behavior and contextual deep links
remain unverified in the running Preview. Fixture tests cannot substitute for
that evidence. Patient access must remain own-appointment/ticket only; public
discovery must not expose staff queues or private records.

## Integrity and next action

Only documentation was authored for this retest. No settings, clinical records,
queue operations, notification activation/providers, public URLs or deployment
were changed.

The completion check also reported that the `.local` report was absent from its
committed diff. This tracked report preserves the actual observations and
verification limits independently of that ignored local directory.

**Next step for approval:** investigate the appointment-save request-capture
failures, resolve the actual cause without weakening revision/draft assertions,
and obtain a reliable required regression pass. Authorized read-only signed-in
checks for the release scope and production verification also remain outstanding.
This document does not certify production readiness.
