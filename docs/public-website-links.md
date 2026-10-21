# Public website link contract and verification

## Contract

`CLINICFLOW_PUBLIC_ORIGIN` is the only authority for newly generated absolute
public links. The shared validator accepts an HTTPS origin, normalizes surrounding
whitespace and trailing slashes, and rejects credentials (including empty user
information), application paths, query strings and fragments.

Public routes are root-hosted. A frontend's local base prefix is not a canonical
URL prefix. An alternate browser/request host is never used to generate a public
link. Runtime configuration exposes only the validated `publicOrigin`, with
`no-store` caching. Browser consumers share one in-flight request and one
in-memory result, with explicit loading, unavailable and retry states.

See [operator setup and rollout](self-hosting.md#canonical-public-website-address).
Server environment changes require a server restart and open-tab reload, not a
domain-specific frontend rebuild.

## Producers and consumers

| Surface | Implementation | Contract |
| --- | --- | --- |
| Public registration and administrator-led setup | `ClinicRegistrationWizard`, `ClinicRegistrationComplete` | Read-only canonical clinic/location previews, review and completion links; no dependency on the domain to preserve drafts or edit saved details. |
| Booking/display share actions and QR sheets | `resources.tsx`, `AdminListing` | Canonical `/book/:reference`, `/display/:reference` and slug-based routes; no partial selected QR sheet or copied list. |
| Public clinic booking QR and queue display | `PublicClinicPage`, `PublicClinicBookingQr`, `ClinicDisplay` | QR payload and displayed booking URL share the same canonical authority. Live queue data remains local and available independently of public-link configuration. |
| Account-patient tracking | `AppointmentTicket` | Canonical `/patient/queue?appointment=…`; internal workspace status navigation remains local. |
| Patient and staff-issued tickets | `VisitTicket`, `AppointmentQr`, `ticket-export`, `BulkAppointments` | Relative check-in routes become canonical root URLs without changing payloads. Single and bulk print/PDF exports require complete, valid personal QRs. Bulk public-configuration failures stop before preparing any selected record. |
| Fictional demo sharing | `DemoClinicManagement` | Public shares and QR downloads use the same authority. Credentials remain a separate private action; unavailable links are not fabricated. |
| Invitation and password/security messages | `routes/auth.ts`, `routes/resources.ts` | Shared server validation; no request-host inference. Existing preflight and post-commit invitation recovery are retained. |
| Booking notification substitutions | `notification-template-values` | Canonical clinic booking route; an unavailable setting yields no fabricated template value. Existing dispatch validation remains in force. |
| Emailed ticket attachments | `ticket-email` | The same server URL builder resolves the existing relative private check-in route before PDF generation or dispatch claim. |
| Patient scanning | `patient-qr`, `PatientScanner` | Only the local site or runtime-validated canonical authority, and only recognized patient booking routes. Canonical URLs are converted to local navigation, never followed as external redirects. |
| Staff scanning/upload/paste | `staff-qr`, `CheckIn` | Local prefixed or canonical root check-in routes are normalized to the original opaque payload. Untrusted external authorities and patient booking codes are rejected; raw staff payload validation remains server-controlled. |

Do **not** rewrite internal Wouter navigation, relative API/auth requests, cookies,
CSRF, logo/image URLs, uploaded/external assets or stored relative routes. No
clinic/location slug, QR reference, appointment identifier, security token or
creation receipt is migrated. Previously sent messages and printed codes are
unchanged; continuity for an old authority requires separate approval.

## Verification

All fictional fixtures and notification transports used here are isolated.
No live delivery, environment change, DNS/TLS/proxy change or deployment was
performed.

- API generation: `pnpm --filter @workspace/api-spec run codegen` passed.
- Shared-library and full workspace typechecks: `pnpm run typecheck` passed.
- `public-website.test.mjs`: validates production/UAT HTTPS authorities,
  malformed settings, minimal no-store response, request-host independence,
  preserved private routes and both scanners' trust/path-prefix boundaries.
- `ticket-email.test.mjs` plus existing patient QR tests: passed with mocked
  transport and real PDF creation.
- `staff-invitation.integration.test.mjs` and
  `notification-template-values.test.mjs`: all 20 checks passed.
- `auth-http.integration.test.mjs` plus public-origin tests: all nine checks
  passed, including existing HTTPS, native-session and CSRF boundaries.
- Shared registration render suite: all six checks passed for public/admin
  setup, address resolution, review and completion, including responsive
  completion actions. Fictional setup-review and share/ticket/display screenshots
  were inspected.
- Focused browser checks: the seven runtime configuration cases, production
  and UAT single/bulk PDF QR checks, complete-selection retry after a public
  configuration outage, and existing bulk print flow passed. They decode the
  actual screen/export QR images; the browser authority differs from the
  configured authority.
- Running-app endpoint probe confirmed HTTP 200, `Cache-Control: no-store`,
  and exactly one public configuration field, without printing the environment
  value. API and frontend workflows started successfully.

### PDF fixture isolation

The initial broad run exposed eight PDF raster-image differences caused by the
new website fixture eagerly importing global application CSS into unrelated
ticket fixtures. html2canvas measures font metrics in the host document, so
self-contained iframe HTML alone does not isolate those measurements.

The website fixture is now lazy-loaded only in its own mode, like the other
styled fixtures. The production single-ticket HTML and PDF renderer, reference
images, QR assertions and image tolerances are unchanged.
