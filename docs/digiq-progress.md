# DigiQ implementation progress — 2 October 2026

## Overall status
In progress. The 137-item programme is NOT complete. UAT is unchanged; no production deployment or database migration was performed.

## Completed in this batch
- Full source audit: 107 individually numbered findings, 11 required summary sections, schedule review and listing inventory (docs/digiq-ui-qa-report.md).
- Environment-only integration configuration and placeholder template: config/integrations.env.example; instructions: docs/integrations-configuration.md.
- Super Admin-only integration readiness and test-email UI/API. No credential readback/editing. Test success means provider acceptance, not confirmed inbox delivery.
- Explicit JWT session option using a dedicated signing key, strict signature/claim checks and existing database-backed revocation/active-user checks. Existing default native mode retained until deliberate activation; no silent JWT-to-native fallback.
- Password setup/reset minimum 8 characters with letters and numbers; existing password hashes/account IDs/roles/Clinic ownership and assignments preserved.
- Shared AppDialog custom discard confirmation, value retention and saving-state close protection.
- Ticket regression fixtures updated for existing CSRF bootstrap requests (test fixtures only).

## Verification
- Root TypeScript check: passed.
- Authentication/JWT/real HTTPS native-transport suite: 16 passed; JWT-specific middleware tests use isolated mocks, not live UAT login.
- Integration configuration/permission, demo, invitation, status-count and dialog decision tests: 20 passed. SMTP transport is fake; non-SuperAdmin access denied in isolated tests.
- Ticket browser regression: 22 passed in suite, last failing fixture corrected and its targeted test passed. No claim of a second full 23-test pass.
- Focused browser UI pass: mocked Super Admin SMTP loading/success/error, Clinic Admin panel exclusion, discard/keep/Escape/backdrop/value retention and mobile layout passed. Saving close control verified disabled; pending-save Escape had a timing race, so not independently verified in browser.
- Homepage screenshot: renders without manifest breakage. API and web workflows restarted and serving.

## Limits and remaining work
- JWT_SIGNING_KEY is not configured; JWT mode not activated. Current fixed 12-hour session policy is preserved. Short-lived access/rotating refresh, key overlap rotation and other auth hardening remain pending.
- Real SMTP delivery not exercised; no real email was sent. SMTP test endpoint limits are process-local; shared multi-instance enforcement remains a release hardening item.
- Authenticated browser tests used API fixtures, not live accounts. Complete role-to-feature/Clinic isolation regression and UAT reconciliation remain outstanding.
- Broader tokens/date-time inheritance, onboarding, schedules, listing changes and remaining S/F findings are pending; Q/P behavior stays approval-held.
- Test workflow status may still show the prior ticket-suite failure; the remaining targeted fixture test passed separately.

## Safety
No account/password reset, role reassignment, Clinic ownership change, production secrets change or live UAT action was performed. Do not deploy over manually modified UAT authentication without reconciliation.
