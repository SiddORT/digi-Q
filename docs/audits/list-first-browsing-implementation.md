# List-first browsing implementation

## Approval and scope

The original inventory in `.local/audits/list-first-browsing.md` was audit-only.
The user subsequently explicitly approved implementation: “do that first, make
it, so we can test it later.” This document records the implementation rather
than treating earlier regression checks as evidence that proposals were shipped.

No deployment, saved-workspace change, live queue operation, provider
configuration change or clinical-data migration is included.

## Browsing contract

- Staff Overview, Appointments, Patients, Weekly/Exceptions Schedule and
  Live/Operational Reports no longer require a remembered location before
  browsing. Existing server authorization and server-saved clinic workspace
  continue to limit every request.
- The authorized-location lookup still distinguishes loading, failure and no
  assignments; failure does not become permission to display unrestricted data.
- Browse-page location pins no longer silently replace optional filters or
  override explicit detail links. Booking and editing retain their own required
  context and unsaved-change protections.
- Existing date/status defaults remain: Today for Overview/Queue, existing
  Today & Upcoming appointments, existing report dates and communication-usage
  scope. No directory is converted into an all-history fetch.
- Existing staff, clinic, QR and template listings remain list-first rather than
  being redesigned.

## Queue

`GET /api/queue-sessions` is a new authenticated staff-only, paginated read for
one required date. Optional clinic/location/doctor/name-search filters only
narrow the actor's effective workspace. Maximum page size is 100.

The overview includes empty scheduled sessions, dated extra/closed sessions and
persisted appointment-session snapshots, deduplicated by the operational
doctor/location/start identity. A single read snapshot supplies counts and page
totals without obtaining operational queue locks or making one request per
doctor. Only summary counts and identifying care context are returned: no
patient identities, references, rosters, tokens or private ticket URLs.

Doctor scope remains own-doctor; receptionist scope remains assigned locations;
Clinic Admin scope remains owned clinics; Super Admin retains existing global
access. Current clinical membership is checked before returning a session.
Inactive/revoked memberships do not gain a new operational access path.

`available` describes an open session template, **not** booking eligibility or
authority to call a patient. Booking eligibility, presence, freshness and
same-day queue actions remain enforced by existing detail APIs.

The staff Queue landing lists session summaries. Explicit session or appointment
links open the existing operational queue. There are no overview Call Next,
check-in, presence or bulk queue actions. Remembered sessions require an explicit
Resume action rather than automatic restoration.

Overview filter URLs explicitly retain the session-list view, so choosing both
a doctor and location does not accidentally enter a queue. Existing exact-care
deep links remain compatible. Open links preserve a validated overview return
query, and both staff and patients have explicit links back to their lists.

Patient My Queue starts with the patient's own visit cards; it never calls the
staff overview endpoint. Private tickets and guest receipts retain their existing
ownership boundaries.

## Other browsing surfaces

- Schedule browsing and weekly editing are distinct; choosing a doctor does not
  itself authorize a write or require mounting an editor.
- Context-free clinic management lists authorized clinics and opens the existing
  clinic-specific section.
- Notification scope browsing is read-only. System Default remains distinct from
  per-clinic values; all actual changes still use the existing exact-scope
  settings, draft and activation guards.
- Guest Booking lists public clinics and their public locations, with bounded
  public reads and existing slug-based booking destinations. Shared public query
  cancellation, actor keys and selected-label handling are preserved. No private
  staff endpoints or availability fan-out are used for discovery.

## Verification and limits

- OpenAPI generation and shared-library typecheck passed.
- API-server typecheck and build passed.
- Frontend typecheck and production build passed. The build used the artifact's
  configured `PORT`/`BASE_PATH`; the first standalone attempt lacked those
  required non-secret process settings. Existing large-chunk warnings remain.
- The three focused public-directory/location helper files passed 32 tests.
  Obsolete guest auto-selection expectations were replaced with explicit
  paginated-list expectations; shared public-query and handoff assertions remain.
- Seven new isolated PostgreSQL checks passed: empty sessions; doctor and
  receptionist boundaries; patient denial; foreign clinic exclusion; bounded
  pagination/search and invalid input; historical timing snapshots; extra/closed
  sessions, inactive membership and read-only behavior.
- Tests use disposable data only, not development clinical records or live
  delivery.
- Full authenticated role-by-role browser acceptance is deferred at the user's
  request. A build or public Preview capture must not be described as that test.
- The configured completion regression run passed 155 browser cases but caught
  the new Super Admin notification scope browser pushing the existing compact
  event controls down. The optional browser was moved after the existing matrix
  instead of loosening the layout assertion. The three configured backend
  regression suites and completion review passed in that run.
- API and web managed workflows were restarted successfully. API health returned
  HTTP 200; unauthenticated access to the new staff overview returned HTTP 401.
  A fresh real Guest Booking Preview capture showed the new clinic listing and
  search, not the old mandatory pickers, without browser exceptions.
- Prior intermittent booking-save assertion failures are recorded separately in
  `list-first-browsing-retest.md`; they are not proof that the new browsing
  behavior is incorrect or that it is release-ready.

This is development work in the task workspace, not a live release certification.
