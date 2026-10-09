# Schedule-to-booking verification evidence

Target: disposable server `http://127.0.0.1:8099` only. No workspace DB or live clinic used.

## Authored rendered regression (fixture-intercepted)

Command: `pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts booking-discovery.spec.ts --project workspace`

Result: **11 passed**. These rendered-component tests intercept `/api/**` with deterministic fictional HTTP fixtures; they are not real persistence or identity evidence. Two test-only selector corrections were needed: the session picker trigger is a button (not a combobox), and rendered session time is 12-hour (`9:00 AM–12:00 PM`). No application code changed.

## Resumed real disposable app — after the 8099 rebuild

The earlier run observed a false empty-location notice on schedule-editor reopen (`fnvoz2`). After the fix/rebuild, the same disposable server and existing test data were used again. Fresh navigation and subsequent reopen checks hydrated Lakeview Clinic / Lakeview Main correctly; the prior Super Admin Saturday value persisted. The added filtered regression also passed (see below).

All staff identities were checked by same-origin browser `GET /api/me` before booking/schedule actions. All tests stayed on `http://127.0.0.1:8099`, fictional c1/b1/d1. Staff dates are distinct future dates relative to 2026-10-09:

| Role / identity | Date and saved weekday edit | Reopen verification | Issued ticket |
|---|---|---|---|
| Super Admin `sa` / `superAdmin` | 2026-10-10 (Sat), 09:00→10:00 | Fixed c1/b1/d1 scope hydrated; selected Saturday showed 10:00–12:00, Save disabled | Fictional Booking Patient sa; B-01, `CF-C695EEFB6E744B62` |
| Clinic Admin `adm` / `clinicAdmin` | 2026-10-11 (Sun), 09:00→10:00 | Fixed scope hydrated; selected Sunday showed 10:00–12:00, Save disabled | Fictional Booking Patient adm; B-01, `CF-77200AB6B01E4917` |
| Doctor `docu` / `doctor`, doctorId d1 | 2026-10-12 (Mon), 09:00→10:00 | Fixed scope hydrated; Monday showed 10:00–12:00, Save disabled | Fictional Booking Patient docu; B-01, `CF-E6CB3C78064249A7` |
| Receptionist `rec` / `receptionist` | 2026-10-13 (Tue), 09:00→10:00 | Fixed scope hydrated; Tuesday showed 10:00–12:00, Save disabled | Fictional Booking Patient rec; B-01, `CF-437B20FE7C194BCE` |

Each editor save for adm/docu/rec showed “1 of 1 saved” and its retained booking page refreshed to 10:00–12:00 with 30 places; no second save was used for reopen verification. The Super Admin schedule write occurred only in the earlier run; it was not repeated.

Receptionist walk-in constraint check: while in the same `rec` context, selecting Walk-in today forced 2026-10-09, disabled the visit-date input and date picker, removed Find Next Available Date, and displayed “Walk-ins are today-only”; no walk-in was submitted. Phone / advance was restored and the original 2026-10-13 draft re-entered before ticketing.

Patient continuation used a new isolated context and the public seeded native-session fixture only: the sha256/base64url-derived `digiq_session` cookie was scoped to `/api` and never logged or captured. Same-origin `/api/me` returned HTTP 200, userId `patu`, role `patient`, patientId `p1`; this is **not** evidence of patient code login. On `/patient/book?...date=2026-10-14`, next-date discovery found 2026-10-15; Review sessions selected it without reservation. The patient saw Ravi Kumar, no management link, and received B-01 `CF-B9A539557F334170` for 2026-10-15 09:00–12:00 UTC.

Guest continuation used a fresh signed-out context on `/book/booking-discovery-fixture`, with no cookies or management action. Next-date discovery found 2026-10-10 and Review sessions selected the 10:00–12:00 UTC Saturday session; no reservation occurred before confirmation. Optional contacts remained blank, the required permission was checked, and the unique name was `Fictional Browser Guest hQ_TSKIK`. Confirm immediately displayed a Booked guest ticket (no reception approval step): B-02, `CF-ABA0D0B42E074E58`. Email notifications were disabled in the app; no external email was sent.

## Regression evidence

- Original authored rendered suite: **11 passed** after two selector-only changes (picker trigger is a button; the option renders 12-hour time). It intercepts `/api/**` with deterministic fixtures and is not persistence/identity evidence.
- Requested added regression only: `pnpm exec playwright test --config artifacts/clinicflow/workspace-regression/playwright.config.ts booking-discovery.spec.ts --project workspace --grep "contextual schedule reopen"` — **1 passed**.
- No application code was changed by this testing run; only the allowed test selector corrections in `artifacts/clinicflow/workspace-regression/tests/booking-discovery.spec.ts`.
- Staff explicit next-date search/review was not repeated during the narrowed resumed scope; each staff direct assigned-date session was observed and booked. Patient and guest shared next-date discovery/review were exercised. An incompatible-session mode restriction was not exercised.

Screenshots were automatically captured by the browser tool and are attached/referenced by observation IDs in the response: repaired Super Admin reopen `gc4lbc`, Super Admin ticket `eodi4c`; Clinic Admin reopen/ticket `o9azyt` / `8bezp1`; Doctor reopen/ticket `2hq3i5` / `6krl8w`; Receptionist reopen, walk-in, ticket `qnug1o` / `pne9cj` / `1yil9m`; patient search/review/ticket `ef9fh7` / `5l5oz9` / `9xfnre`; guest search/review/ticket `naw0eb` / `2xllu0` / `kzoyf1`. The capture tool does not expose a supported way to copy its screenshot artifacts into this directory, so this report is the only file saved here; screenshots are attached via browser evidence IDs, not recreated.
