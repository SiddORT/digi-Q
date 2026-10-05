# Density, date range and PDF refinement

Implemented shared compact selection bars, appointment status symbols, visible expansion, compact menus, wider Details with collapsed Ticket & QR beside booking reference, appointment header range selection and aggregate month calendar. Existing saved columns remain preserved; explicitly showing additional columns can still require horizontal scrolling.

PDF downloads now render the self-contained print content into actual PDF pages, including the logo and personal QR. Print remains separate. The downloaded PDFs are image-based, not searchable-text documents. Email attaches a server-generated PDF and requires preview/recipient confirmation; development cannot dispatch. Repeated request IDs use a durable dispatch claim; uncertain SMTP outcomes are not automatically retried. No live mail was sent.

Verification:
- Frontend source suite and frontend/backend typechecks.
- 14 isolated PostgreSQL list/scope/calendar tests; aggregate covers 600 records independently of page size.
- 3 isolated email tests: roles/scope, recipient changes, valid PDF attachment, accepted and unknown idempotency.
- 24 ticket regressions: PDF signatures/pages and QR decoding, print document details, stale/missing QR and API failure cases.
- Fixture-only UI checks in scripts/clinicflow-changed-ui-check.mjs; screenshots in screenshots/clinicflow-focused. Calendar grid, day drilldown, range Apply/Cancel, selection, email recipient states and fake unknown retries, Details toggle, PDF downloads and responsive bounds.

Limits: browser checks use intercepted fictional identities, not proof of live role authorization. No live SMTP provider/inbox delivery was exercised. Server email PDF is independently rendered from current booking data; client downloads preserve screen-print styling. No production publication or real record changes.
