# Opt-in S3-compatible private files

## Boundary and status

S3 is **inactive by default**. No bucket was activated or provisioned, no live
provider writes were performed, no persistent database was migrated, no sources
were deleted, and no production deployment was made. Tests use disposable
databases, temporary local disk, fake S3 commands and an in-process AWS SDK HTTP
handler. They do **not** establish real-provider IAM, encryption, TLS/network,
firewall, retention, consistency, checksum or object-lock behavior.

This adapter extends the existing private-file registry and authorized API.
Stable content URLs remain `/api/files/<id>/content`; legacy authorized
`/api/patient-documents/<id>` links keep working. Neither credentials nor
bucket/key/endpoint locators appear in browser metadata. Reads always pass the
existing current-user, tenant, doctor/patient and policy checks. Downloads are
proxied, bounded to 10 MiB, verified against registry size/SHA-256, marked
`private, no-store`, and served as attachments. They are not redirects.

There is no browser S3 configuration, direct upload, presigned URL, public ACL,
public S3 URL, SDK browser import, bucket administration, provisioning API,
automatic failover, bulk copy or purge endpoint. Presigning adds no value for
bounded 10 MiB authorized downloads and would permit access until expiry after
revocation, so it was deliberately not added.

## Server-only configuration

Use the existing private server environment/secret-store loading mechanism.
Never commit a populated environment file or put any of these settings under a
`VITE_`/public frontend namespace. Do not log the configuration object, SDK errors,
signed requests, headers, credential-provider errors or endpoints. The adapter
returns fixed safe failures without original error/cause values.

All placeholders below are intentionally empty. Copy names, not sample secrets:

```dotenv
FILES_STORAGE=
FILES_S3_BUCKET=
FILES_S3_REGION=
FILES_S3_ENDPOINT=
FILES_S3_UPLOADS_PREFIX=
FILES_S3_FORCE_PATH_STYLE=
FILES_S3_CREDENTIALS=
FILES_S3_ACCESS_KEY_ID=
FILES_S3_SECRET_ACCESS_KEY=
FILES_S3_SESSION_TOKEN=
```

| Setting | Validation and meaning |
| --- | --- |
| `FILES_STORAGE` | Blank inherits `MEDIA_STORAGE`; otherwise `local`, `object` or explicitly `s3`. Only new private uploads use the selection. |
| `FILES_S3_BUCKET` | Required for S3, DNS-style 3–63 character bucket, no IP address/traversal. No access-point ARN, directory bucket or arbitrary URL. |
| `FILES_S3_REGION` | Required signing region, lowercase letters/digits/hyphens. Provider-specific region names are an operator responsibility. |
| `FILES_S3_ENDPOINT` | Optional HTTPS origin only, no user info, path, query or fragment. Blank uses the standard AWS regional endpoint. Only trusted server operators may set it. Never accept it from an HTTP input. |
| `FILES_S3_UPLOADS_PREFIX` | Required, 1–256 characters, slash-separated nonempty alphanumeric/underscore/hyphen segments, no leading/trailing slash. The adapter appends the generated private clinic/entity/purpose/file hierarchy. |
| `FILES_S3_FORCE_PATH_STYLE` | Explicit `true` or `false`, required; do not guess provider addressing behavior. |
| `FILES_S3_CREDENTIALS` | Explicit `role` or `static`, required. |
| `FILES_S3_ACCESS_KEY_ID`, `FILES_S3_SECRET_ACCESS_KEY` | Both required only for `static`, resolved privately from the server secret store/environment. |
| `FILES_S3_SESSION_TOKEN` | Optional secret for temporary static credentials. Renew all temporary fields together. |

`role` leaves credentials to the maintained SDK Node credential-provider chain
(including workload web identity/container/instance roles). This is not a claim
that the SDK excludes every other credential source: the default chain also
recognizes standard AWS environment/shared-profile/process/SSO sources. On a
role-only host, remove static AWS environment credentials, mounted shared
credential profiles and credential-process settings. Standard credential-related
names include `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`,
`AWS_ROLE_ARN`, `AWS_WEB_IDENTITY_TOKEN_FILE`,
`AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`,
`AWS_CONTAINER_CREDENTIALS_FULL_URI` and
`AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE`; their values belong only to private
runtime configuration, not this document. The `FILES_S3_*` static fields must be
absent in role mode. No role or secret values were inspected in this work.
New clients resolve credentials per operation; do not restart the app with
expired temporary static credentials. Role refresh behavior on the intended
host remains unverified.

Selecting S3 with missing/malformed settings fails closed before a registry row
or provider request is created. Stray malformed S3 settings do not affect unused
local/Google operations. Environment configuration is validated lazily when an
S3 operation is requested, not by making startup bucket probes.

`MEDIA_STORAGE` still accepts only the existing local/object logo drivers.
`MEDIA_URL` is only the existing deliberate sanitized-logo publication route,
never a static mount of private bytes. Keeping logos on object storage and private
attachments on S3 is supported. Local historical reads still require their
original `MEDIA_ROOT`, even when S3 is selected for new files.

## Historical location and operation behavior

Registry version 1 S3 locators hold an authority hash, original bucket and full
key, not a URL or credentials. The hash binds the normalized endpoint origin
(or standard AWS selection) and region. Saved locators are server-generated and
immutable under the existing database trigger; client filenames, contact details,
browser provider/endpoints/paths and client keys never select an S3 location.

Changing the selected driver, default bucket, upload prefix or path-style flag
does not rewrite existing metadata. Historical S3 reads use the original saved
bucket/key through the S3 adapter even if the selected writer is local/Google.
The current credentials must retain access to those original buckets. The
adapter does not list buckets or expand permissions automatically.

Keep the original endpoint/region configured while any associated S3 files
remain. Changing either **fails closed** for those saved locators; a different
endpoint cannot silently serve same-key content. Multiple simultaneous
endpoint/region profiles and cross-authority migrations require separately
approved work; this adapter does not infer an old endpoint from a locator.
Keep original local/Google configuration and access for historical files too.
SDK-global endpoint environment/shared-profile overrides are explicitly ignored;
only the validated `FILES_S3_ENDPOINT` may replace the standard AWS authority.

Uploads create the durable staging row first and use single-object PutObject
with `If-None-Match: *`, a SHA-256 checksum and no public ACL. Success moves the
file to quarantine, never automatically to approved. Existing exact-digest
offline security review is still required. SDK automatic retries are disabled
(`maxAttempts: 1`) because a timeout can follow provider commit. Connection and
request timeouts are 3 and 15 seconds, within a 20-second end-to-end operation
deadline that also bounds credential resolution and streamed-body consumption.
Clients are destroyed and streams are aborted/destroyed on completion/failure.
No multipart state or resumable upload session is created.

Head returns only validated bounded size and content type. Read checks declared
length before buffering, enforces actual length and the 10 MiB maximum while
streaming, and the file service verifies digest/size against the registry.
Missing, denied, malformed/truncated, timeout and provider failures remain safe
explicit failures, not fallback reads from another driver.

HTTP deletion is still authorization-checked **soft deletion**. Retained bytes
are checked when deleting/restoring, and restoring quarantine does not approve
it. The internal adapter has a delete primitive that requires a successful
server-side authorizer before any provider request; **nothing wires that
primitive to automatic cleanup, account erasure or an HTTP purge endpoint**.
Tests delete only fake objects. IAM DeleteObject permission is unnecessary for
normal use and should be withheld until a separate purge policy is approved.

### Interrupted/uncertain upload recovery

If the process survives an upload error, the registry row becomes hidden
`failed`; a process crash may instead leave `staging`. Neither can be downloaded,
approved via the normal review endpoint or silently overwritten. An object may
exist even though the caller saw an error. Keep its exact immutable locator and
digest for reconciliation; do not automatically delete/retry over it.

An authorized operator can inventory the failed/staging receipt, perform a
bounded Head/Get using its saved locator and compare size/SHA-256 to establish
whether bytes committed. Such evidence is not security approval. The normal
user retry creates a new ID/key and goes through quarantine, while the old
receipt/source remains hidden for separately authorized reconciliation/retention.
There is deliberately no new "repair/approve failed row" endpoint or blanket
garbage collector. If the registry update itself fails, the original staging
receipt still provides the location. Retain coherent database/object backups.

## Provider, IAM and encryption assumptions (not remotely verified)

- Use a dedicated private bucket/prefix. AWS Block Public Access/bucket-owner
  enforced ownership, or provider equivalents, must be configured independently.
  Not sending a public ACL does **not** prove an already-public bucket is private.
- Scope the service role/key to GetObject (including Head) and PutObject on
  approved upload prefixes in current and retained historical buckets. No
  ListAllMyBuckets, bucket administration or broad account access is needed.
  Do not grant DeleteObject for ordinary soft deletion. Separate migration
  credentials and approval are required for any eventual copy/purge.
- Require HTTPS and provider-side encryption through bucket policy/defaults.
  The adapter does not provision encryption or force an AWS-specific
  ServerSideEncryption header that compatible providers might reject.
  Operators must verify encryption at rest, key custody/rotation and backup
  encryption. For SSE-KMS, separately review the required KMS grants and audit
  logs. Do not claim KMS/SSE was validated by the fake tests.
- Provider must support SigV4, chosen region/address style, single-object
  Put/Get/Head/Delete, `If-None-Match: *` without overwrite, SHA-256 upload
  checksums, reliable Content-Length and read-after-write behavior.
  Optional automatic checksum features are disabled for compatibility;
  upload SHA-256 and application registry digests remain mandatory.
  Conditional-put/checksum support must be verified before activation.
- Disable lifecycle expiry/transition rules that could delete quarantined,
  hidden, soft-deleted, failed or retained-source bytes before an approved
  retention policy. Versioning/object lock/legal hold and noncurrent-version
  retention/deletion need provider-specific review. A DeleteObject on a versioned
  bucket may add a marker, not erase bytes; this implementation makes no
  physical-erasure guarantee.
- Verify DNS, TLS certificates, private endpoint routing, egress, firewalls,
  workload identity availability, clock synchronization, regional restrictions,
  replicas and backup recovery in a separately authorized sandbox. HTTPS
  custom endpoints are trusted operator configuration, not an SSRF-safe
  untrusted-user input facility.

## Explicit migration design — not executed or authorized here

1. **Inventory and approval.** Produce a restricted inventory of every registry
   row (including legacy, failed, staging, quarantine and deleted), provider,
   original authority/bucket/key or root, size/digest evidence, owner/clinic,
   scan state, timestamps and erasure fences. Inventory unmatched objects and
   backups separately. Fix unresolved historical configuration; never invent
   missing digests. Obtain scoped copy authorization, destination policy,
   consistency/maintenance strategy and source recovery-window approval.
2. **Authorized copy.** Reauthorize every subject/file against an approved
   migration actor and purpose, honor erasure/retention fences, use separate
   least-privilege credentials, and checkpoint a restricted per-file receipt.
   Use generated destination keys and conditional create-only copies; never
   rewrite file IDs/public API URLs or overwrite destination content. Retry
   interrupted copies only after reconciling the receipt and destination.
3. **Digest and size verification.** Head plus bounded read both sources, compute
   full SHA-256 independently, compare exact sizes/digests and verify destination
   provider controls. An ETag is not a digest, especially for multipart/encrypted
   objects. Missing/mismatched evidence blocks the file and leaves its source
   and registry unchanged. Legacy files require newly verified evidence, not
   backfilled assumptions.
4. **Atomic locator update.** The current immutable trigger intentionally
   **forbids** this today. A separately reviewed migration implementation must
   add a narrow audited capability, not disable the trigger globally. Lock the
   row, recheck identity/lifecycle/byte evidence and erasure state plus exact
   original locator/update baseline, then atomically switch only its verified
   provider/locator with a durable source/destination receipt in the same
   transaction. Preserve scan state, original identity and stable URLs.
   Concurrent changes conflict; no partial pointer change or dual ownership.
5. **Read verification and recovery.** Read the unchanged authorized API URL
   through its new saved adapter as an entitled actor, compare size/digest and
   confirm revoked/other-clinic actors are denied. Checkpoint success. On
   interruption, reconcile copied bytes and transactional receipts before
   continuing. On failed read verification, perform an explicitly authorized,
   audited compare-and-swap restoration to the original locator; retain both
   copies for investigation. Migration must not publish quarantined files.
6. **Retained source recovery window.** Keep original bytes, credentials,
   endpoint/root configuration, receipts and coherent backups for the separately
   approved duration. Do not invent a duration or let lifecycle rules expire
   these sources. Rehearse rollback without resurrecting erased identities.
7. **Separately approved purge.** Only after the window and confirmed read/
   backup recovery evidence, obtain distinct approval and implement a scoped,
   reauthorized idempotent purge with per-object audit and receipts. Recheck
   active references, clinical retention, erasure policy, versions/object lock
   and partial failures. Never delete an entire prefix/bucket as a shortcut.

## Verification

- `pnpm --filter @workspace/api-server test:files:s3`: fake S3 upload/read/
  head/deletion authorization, safe failures/timeouts, strict config, keys,
  endpoint binding, credential redaction, mixed drivers, hidden uncertain rows,
  retries and interrupted-write evidence. Includes the real AWS SDK signing/
  serialization pipeline against a fake HTTP handler, not a remote server.
- `pnpm --filter @workspace/api-server test:files`: includes those tests plus
  existing local/Google, authorization, erasure, quarantine, public-logo and
  migration-upgrade regressions.
- `pnpm test:migrations`: disposable PostgreSQL migration-chain rehearsal, not
  the workspace or production database.
- Dependency selection/audit evidence: [F04 dependency review](security/f04-s3-dependencies.md).

Recorded local verification: all 51 private-file/regression cases passed,
backend/shared-library type checks passed, and all 25 journaled migrations
applied/hash-verified with repeat no-op behavior on disposable PostgreSQL
15.13 and 16.9. No workspace/production schema push was run.
