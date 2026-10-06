# DigiQ exact-case acceptance

## Scope and evidence boundary

Browser testing uses the actual built application, native password login and a private disposable PostgreSQL cluster with full migrations. Normal authorization and CSRF middleware remain active. The workspace database is not connected. Nodemailer is replaced with a transport that rejects delivery. This is workspace acceptance, not proof of UAT deployment or real inbox delivery.

The browser verified `/api/me` separately for clinic admin, doctor, receptionist and super admin. Appointment mutations used normal UI/API calls. Old hand-inserted feature fixtures are not suitable evidence for appointment snapshots, token display or check-in timestamps.

## Completed observations

| Findings | Result | Evidence |
|---|---|---|
| 24, 125 | Pass | Schedule navigation reached weekly availability; Add Schedule opened and saved. |
| 53, 54, 76 | Pass | Saved Friday and Sunday sessions appeared for those dates. Closed Saturday returned no session and disabled continuation. Sunday-only booking succeeded. |
| 108, 109, 111, 129 | Tested picker interactions pass | Schedule time menu and booking calendar opened. Selecting dates updated availability. Not every historical screenshot state is reproduced by this observation. |
| 90, 121 | Staff family-booking path passes | Fictional family patient registered and booked without mobile. A second fresh booking confirmed persisted mobile was null. Patient self-service family-account management was not exercised. |
| 60, 127 | Pass on fresh booking | Ticket, list and detail showed the generated token; saved visit note matched the API response. |
| 59 | Pass for tested scope | All Visits displayed five records and pagination/count of five. |
| 94 | Pass on fresh booking | A real booking followed by Check In stored checkedInAt, consultationStartedAt and history. The detail dialog displayed the corresponding time and transition. |
| Review / Apply | Pass for location hours | Review preview returned allowed with no conflicts; applying the reviewed hours persisted them and preserved other weekdays. |
| 61 | Partial | Patient created successfully from Patients list; booking selection was not reached before interruption. |
| 69 | Partial prevention evidence | A same-doctor overlapping session at a second location was rejected with HTTP 409. Actual concurrent cross-location check-in was not exercised. |
| 83, 84 | Defect found; fixed with regression coverage | Oversized input was accepted. Form now limits these fields to four numeric characters, validates Max Tokens 1–1000 and Buffer Minutes 0–1440, and explains the bounds. API schedule create/update and exception capacity schemas enforce corresponding limits. Boundary/overflow regression tests pass. |

## Continuation results

| Findings | Result | Evidence |
|---|---|---|
| 57, 61 | Pass for tested patient picker | Active persisted patients appeared and selecting an existing patient populated the booking form and enabled Review. An inactive patient was excluded. |
| 75 | Pass for eligible Waiting booking | Future booking rescheduled through UI to another session/day, retained Waiting status and saved the change reason. A separate past-date attempt correctly failed the cancellation cutoff; not evidence of a reschedule bug. |
| 80 | Pass in disposable environment | Call Next, Check In and Check Out updated the patient and queue. This does not establish deployed latency. |
| 82 | Pass in UI | A closed Date Exception saved with Session unselected / All sessions, appeared in the list and showed success. Independent GET confirmation was not obtained because the tester guessed the wrong read endpoint. |
| 85, 86, 133 | Pass for exercised Doctor grouping/filter combination | Selected clinic/location/doctor/date returned 3 visits: 1 completed, 1 absent, 1 other, matching fresh bookings. Clinic grouping itself was not separately exercised. |
| 96 | Pass | Completed visit remained in All Visits but did not offer View Ticket. Details explicitly explained that completed visits do not need tickets. |
| Cross-location copying | Pass | Copied hours from another owned location, reviewed without conflicts and applied. Readback confirmed destination hours. Existing session conflicts were respected rather than bypassed. |
| 83, 84 | Browser confirmation of fix | Form rejected 1001 tokens and 1441 buffer minutes with range errors; discarding left persisted values unchanged. Text/numeric input is intentional to enforce maxlength=4. API overflow rejection is covered by the separate contract tests. |
| 95 | Partial / expectation distinction | After the called patient was marked absent, next waiting token was visible. Current Token remained empty; the next patient was NOT automatically called. Do not report automatic calling as verified or change that operational policy silently. |
| 85 Clinic grouping | Pass in continuation | Clinic Group option displayed Lakeview Clinic with four visits: one completed, one absent and two other; totals reconciled. |
| 70 / 71 current-session display | Pass for single available current session | Changing queue date to actual UTC today automatically selected the sole session and labeled it Currently running. Multiple-session label discrimination was not exercised. |
| Doctor assignment | Pass | Changed the fictional doctor's assignment to one legal owned group/location, saved successfully and confirmed the assignment summary. |
| Staff status | Pass | Deactivated a separate fictional receptionist and verified Inactive status/feedback, then restored Active through the UI. No invitation/recovery action was invoked. |
| Scoped Weekly Copy to All | Fixed and browser-retested: pass | Control requires doctor and location filters, not the individual Add/Edit dialog. Copying shorter source hours retained all-day destination queueCloseTime, causing two 400 errors. After fixing the planner, the exact browser retry saved 2 of 2 changes. API readback confirmed Mon/Tue 09:00–10:00, preserved early queue opening, queueCloseTime 10:00, unchanged Wed/Thu and no closed-day/linked records added. Two regression tests cover the reproduced update/create and shifted-window cases. The dirty-state explanatory warning exists in source but was not separately captured in the screenshot. |

## Still not fully closed

- **52:** Same-day after-closing check-in was not exercised; UTC rollover interrupted that setup.
- **69:** Actual cross-location concurrent check-in not exercised; overlapping doctor sessions were correctly rejected at setup.
- **71:** Single-session current labeling passed; duplicate-label behavior with multiple sessions was not exercised.
- **90:** Staff-created family patient booking passed; patient self-service family-account management was not exercised.
- **95:** Next Waiting display passed, but the report's automatic “Called Next” expectation is not fulfilled by the observed behavior.
- **108/109/111/129:** Tested calendar/time controls passed, not every historical screenshot-specific protected form.
- **Final acceptance:** Cross-location hours copy, location Review/Apply, doctor assignment edits, staff status and scoped Copy to All passed. Numeric fields and weekly copy required the fixes described above.

The initial disposable server was lost in a workspace/browser reset. Previously completed observations remain valid; interrupted cases were not marked passing. A managed private console workflow was subsequently started for the remaining checks.

An exploratory parallel booking burst produced errors with the initial harness sharing one PostgreSQL control connection across requests. Sequential real bookings passed. The runner now uses a private connection pool like the application; that burst is not valid evidence of a production concurrency defect, and no pooled-browser contention rerun is claimed.

## Checks after numeric-limit fix

- Both artifact typechecks pass.
- 343 frontend tests pass after both fixes.
- Two new API-contract tests cover capacity/buffer boundaries, overflow, negative/fractional buffer and nullable exception capacity.
- Real app workflows restarted successfully.
