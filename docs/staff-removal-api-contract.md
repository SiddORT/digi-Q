# Staff-removal UI integration contract

All paths are under the existing API base and require a fresh native Superadmin
session. Use the existing authenticated request helper, not raw root URLs.

- GET `/management/system-users/:id/deletion-impact`: existing impact shape plus
  `ready: boolean`, `reviewToken: string|null`, `operationId: string|null`.
- POST `/management/system-users/:id/permanent-removal`: strict body
  `{version, reviewToken, confirmation: "delete"}`. Returns
  `{operationId, accountRemoved:true, state:"complete"|"cleanup_pending",
  files, verifiedFiles, pendingReasons:string[]}`. A response timeout is not proof
  that the account survived: reconcile using the reviewed operationId.
- GET `/management/staff-removals/:operationId`: same receipt. 404 means no
  committed receipt; show uncertain state and allow explicit status retry.
- POST `/management/staff-removals/:operationId/retry-cleanup`: same receipt.
  Never retry account removal to retry files.
- GET `/management/system-users/:id/handoff-options`: `{doctors, admins,
  visits}`. Doctors: `{id,userId,fullName,branches:[{id,clinicId,name}]}`.
  Admins: `{id,fullName,email}`. Visits:
  `{id,patientId,patientName,clinicId,branchId,date,startTime,timezone,revision,
  status,checkedInAt}`. These are options, not eligibility guarantees.
- POST `/management/system-users/:id/handoff-impact`: strict body either
  `{kind:"clinic-responsibilities", replacementId}` or
  `{kind:"visits", moves:[{appointmentId,doctorId,branchId,date,expectedRevision,
  sessionId?,startTime?,reason?}]}`. Returns `{kind,operationId,version,proposal,
  reviewToken,visits?}`. Proposal is server-issued and must be echoed unchanged.
- POST `/management/system-users/:id/handoff`: strict body
  `{kind,proposal,reviewToken}`; returns safe operation receipt with operationId
  and counts. After success refresh all affected caches and deletion impact,
  clear handoff review and typed deletion confirmation.

Offer existing doctor/admin selection and an explicit create-new action that
opens the ordinary staff creation page; never create a placeholder or transfer
automatically. Visit replacements must be reviewed individually with existing
availability controls; the backend retains normal cutoff/capacity/privacy rules.
Overdue, checked-in/in-progress work and pending guest requests need normal
individual queue/request resolution, not automatic transfer.

The shared confirmation must catch errors, stay open on failures, block duplicate
submits/closing while busy, clear stale confirmation, and show committed receipt
even after the target GET becomes 404. Purge selected-label/directory/detail
caches after account removal, then refetch shared operational lists. Pending
cleanup is a successful account removal, not a failed transaction.
