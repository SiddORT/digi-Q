# Booking lookup privacy regression

Run independently from the broader backend suite:

```sh
pnpm --filter @workspace/api-server test:booking-lookup-privacy
```

This starts an ephemeral HTTP server with the real public, appointments, and
resources routers against an in-memory PGlite database. It applies the checked-in
Drizzle migration journal, including ownership constraints, and inserts only
fictional test-owned records. No development/customer database, SMTP provider, or
object storage is used. The server, database, and generated bundle are cleaned up.

Coverage:

- Public `selectedIds` reads exclude inactive clinics, clinics without active
  locations, inactive locations, and locations within inactive clinics.
- Public doctor labels exclude inactive profiles/accounts, unassigned doctors,
  and doctors whose only clinical membership is inactive.
- Location selections intersect selected IDs with clinic and doctor membership.
- Doctor selections intersect selected IDs with clinic and location on the same
  clinical membership, including a doctor assigned to two different clinics.
- Both blocked-only and mixed permitted/blocked selections assert exact results,
  totals, absence of excluded names anywhere in the response, and human labels
  for permitted selections.
- Invalid selection counts and pagination return 400 without fixture names.
- Real native session cookies enforce patient ownership for appointment detail
  labels, appointment lists, and patient resource reads. Foreign detail requests
  return 403; anonymous appointment detail returns 401. The owner's labels remain
  readable, and failures contain no foreign fixture names.

The browser selector-name acceptance uses intercepted fixtures; this regression
adds live router/SQL/session authorization evidence, not browser rendering
evidence. Appointment labels use `/appointments/:id`; the appointment list API
does not declare `selectedIds`, so its additional ownership checks use the
supported `patientId` filter. Production authorization rules are unchanged.
