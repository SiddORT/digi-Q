# Review older notification history

Superadmins can open **System Users → Review permanent removal** and use
**Notification history evidence** when historical ownership is blocked.
Unknown ownership is a system-wide safety blocker, not an assertion that a
record belongs to the selected staff account.

## Sources that can be accepted

An original archived database record, exported as JSON `{ "id": "...", "data":
{ ... } }`, with its original valid version-2 capture proof. An array of up to
ten such records is also accepted, but all must agree and exactly cover the
record being reviewed. Use trusted backups or original exports; this screen
does not generate original capture proofs.

Verification authenticates the source's original MAC and checks every field,
contact hash, current envelope and historical snapshot against the current
record. Every encrypted envelope must be readable/authentic. Proofs from
another record, unsigned legacy backups, partial snapshots, current contact
matches, current outbox metadata and conflicting subject sets are insufficient.
An old record created before capture proofs existed may have no recoverable
proof and must remain unresolved. There is no automatic inference or backfill.
All originally captured staff accounts must still exist and are held through
the write. Archives involving already removed identities stay unresolved.

The only harmless difference accepted is removal of a boolean
`provenanceUnavailable: true` marker when the original source has no such marker.
Restoration copies the original MAC; it never signs today's partial metadata.

## Review and confirmation

1. Scan the bounded pages and select a blocked record. Pages can contain no
   blockers but still offer a next page.
2. Paste or load original archive JSON locally. Evidence stays in memory, is
   never logged, and is not saved in browser storage or the database.
3. **Check evidence** is read-only. It explains whether the captured subjects
   include the selected staff account; a subject can be a clinician or actor,
   not only a recipient.
4. An eligible result needs an explicit confirmation before **Restore verified
   original proof**. The five-minute review binds the native session, actor,
   selected staff account, full current record and exact verified evidence.
5. Changed records, expired/replayed reviews and active writers fail closed.
   Reread the review rather than retrying a lost write blindly.
6. If evidence is unavailable, save a fixed unresolved reason. The original
   record is untouched and the deletion blocker remains.

Only anonymous, strictly shaped decision receipts and ordinary audit events
are retained. Source JSON, native subject IDs, message contents and encrypted
archive copies are not duplicated. Malformed receipts block removal.

This process deletes no notification, account, patient record or document.
Account removal still requires its own fresh impact review and explicit
`delete` confirmation. Implementing this feature does not authorize live
cleanup, source imports, provider sends or publishing.

Evidence is limited to 100,000 characters and a safe 120 KB encoded request
budget within the existing 128 KiB API body limit. Oversized originals remain
unresolved; do not truncate an archive to make verification pass.
