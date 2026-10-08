---
name: Role test authentication isolation
description: Avoiding false authorization conclusions during multi-account browser verification
---

Use a fresh isolated browser context per role, explicitly select the intended fixture identity, and confirm both the browser identity and `/me` role before evaluating a protected flow.

**Why:** A browser-helper handshake initially left the patient view unauthenticated during the flow audit. Fresh-context identity checks established the correct patient session without any application authentication change. A helper's apparent sign-in success alone was insufficient evidence.

**How to apply:** Compare loaded/signed-in state, the intended versus actual non-secret user identifier, and the mapped application role. Do not record cookies, JWTs, passwords, or other credentials. Keep API-authenticated and browser-authenticated verification results distinct.

Confirm the observation tool is capturing the same page being driven, and recheck identity after helper reattachment.

**Why:** A multi-page acceptance run drove the patient page while screenshots still captured the original admin page. Reattaching the helper later produced an unmapped identity instead of the intended existing fixture. A helper/raw-probe context mismatch also produced misleading 401 evidence while the observable app subsequently authenticated successfully.

**How to apply:** Prefer one observable page per testing pass where tooling cannot switch reliably. Wait for loaded, signed-in state and inspect that page's actual app network responses; confirm `/me` again after reattachment rather than treating a separate raw probe as equivalent. A real isolated DEV provider identity with a random password supports registration and app-owned password confirmation; helper identity authentication alone does not establish staff password proof or email delivery. Treat context mismatches as test-tool limitations, not successful role login or application failures; never bypass authentication. Verify the intended role and fixture ownership before each mutation, and never edit an existing customer record as a substitute for creating test-owned data.

Create booking fixtures through the real booking API when testing queue summaries.

**Why:** Hand-inserted rows lacking generated token data produced blank current/next summaries and a false application-bug report even though row transitions worked. Real API bookings passed the same checks.

**How to apply:** Use database setup only for identities, assignments and prerequisite configuration; exercise appointment creation through the API and compare raw queue responses with the displayed state before attributing a mismatch to the app.

Use independent database connections for concurrent requests to a disposable full-app server.

**Why:** An acceptance server using the migration/control connection for all HTTP requests produced parallel-booking failures while sequential bookings succeeded. That setup does not model the application's pooled transactions.

**How to apply:** Keep migration setup separate from the request pool. Diagnose fixture-connection sharing before attributing concurrent failures to production behavior.

Use normal browser sign-in and browser-origin requests for the HTTP-loopback acceptance target, rather than assuming a separate request client's cookie handling matches Chromium.

**Why:** Chromium accepted the application's secure cookies on loopback, while a separate request client failed native login despite supplying the CSRF header and Origin. Those request failures were not authentication regressions.

**How to apply:** Sign in through the UI and issue protected verification requests from that authenticated page. Never weaken production cookie or CSRF policies to accommodate a test client.

Do not infer the workspace database target from `REPLIT_ENVIRONMENT` alone.

**Why:** This workspace reported a production environment label while its database
connection matched the explicitly queried development database rather than production.

**How to apply:** Before creating temporary auth fixtures, compare a read-only
database fingerprint through the actual workspace connection against explicitly
selected development and production query results. Prefer a disposable database.
Stop on ambiguity; never print credentials or reset existing users.

In intercepted browser tests, register specific CSRF responses after broad API
handlers and verify the response consumed by the app itself.

**Why:** Broad fixture routes repeatedly returned list/status envelopes for the
app's CSRF request, creating false missing-token failures even when a separate
direct fetch appeared correct. Playwright's last matching handler takes priority.

**How to apply:** Match the actual app-page request and expected response shape;
fix fixture precedence rather than weakening CSRF checks or declaring a backend
failure. Intercepted mutations do not prove real email delivery or authentication.

Assert visible page content and the absence of an error boundary, not just the absence of browser `pageerror` events or horizontal overflow.

**Why:** React caught malformed-fixture errors without emitting `pageerror`; the error page also fit a mobile viewport. Those assertions alone could falsely pass a broken template screen.

**How to apply:** Confirm the intended form/table is visible before checking layout. Reconcile fixture response shapes and accessible control names with real contracts before attributing a failure to the application.

Keep independently runnable browser regression suites in distinct output directories.

**Why:** A workspace browser run overlapped an existing ticket-test workflow; Playwright's startup cleanup removed the other run's active traces and produced missing-file failures unrelated to the application.

**How to apply:** Scope each suite's output directory independently before running alongside managed test workflows. Do not attribute trace/report cleanup failures to product behavior or re-run unrelated flows to compensate.

Treat eligible-option cardinality as part of a browser fixture's behavioral contract.

**Why:** Picker regressions initially looked like stale accessible names, but the fixtures offered only one eligible location, intentionally selecting the read-only journey instead of the searchable journey. Changing selectors alone could not repair that mismatch.

**How to apply:** Give searchable-choice tests multiple eligible options within the actual parent scope. Keep sole-option tests separate; never disable automatic selection or weaken selected-value, save/reopen, or scope assertions to make a picker test pass.