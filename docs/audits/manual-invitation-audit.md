# Manual real invitation audit

**Status:** pending-manual-acceptance
**Generated:** 2026-09-23T06:03:49.217Z
**Result:** 12 passed, 0 failed.

## Expected assignment

- Role: Receptionist
- Clinic: Sunshine Multispeciality Clinic
- Branch: Sunshine Multispeciality Clinic – Baner Branch
- Scope: only the exact clinic and branch above.

## Evidence

| Outcome | Classification | Assertion | Evidence |
|---|---|---|---|
| PASS | read-only | Exact clinic uniquely matched and active | Exactly one active clinic matched the approved name. |
| PASS | read-only | Exact branch uniquely matched and active | Exactly one active branch matched inside the exact clinic. |
| PASS | read-only | Existing Clinic Admin ownership is valid | The exact clinic has one active Clinic Admin owner; no owner or mapping was changed. |
| PASS | read-only | Approved inbox absent from app users | No app user matched the private approved inbox. |
| PASS | read-only | Approved inbox absent from Clerk identities | No Clerk identity matched the private approved inbox. |
| PASS | read-only | Approved inbox has no pending invitation | No pending Clerk invitation matched the private approved inbox. |
| PASS | read-only | Pre-write scope and inbox guard revalidated | Immediately before writes, exact scope remained active/unique and the approved inbox remained unused. |
| PASS | live-api | Temporary isolated actor established guarded proof | A synthetic Super Admin bootstrap was used only to authorize the existing creation path; no real account session or mapping was touched. Status 200. |
| PASS | live-api | Existing app creation/invitation path accepted temporary Receptionist | POST /users returned 201 with role Receptionist, invitationStatus sent, and only the exact approved clinic and branch. Status 201. |
| PASS | read-only | Persisted assignment scope is exact | Only the approved clinic membership and approved branch assignment exist for the temporary Receptionist. |
| PASS | live-provider | Clerk accepted exactly one real invitation | The supported helper used notify:true, app role/clinic metadata, bounded configured expiry, and the current DEVELOPMENT /set-password redirect. |
| PASS | live-provider | Provider reports invitation pending | Exactly one provider invitation is pending. This proves accepted send state only; inbox delivery is not claimed. |

## Provider and browser status

- Clerk accepted one notify:true invitation and reports it pending. Inbox receipt is not yet claimed.
- No browser automation was performed. CAPTCHA, password setup, login, and used-link behavior await the user.
- The approved inbox, credentials, provider IDs, and invitation URL are retained only in the mode-0600 private manifest.

## Cleanup plan

- After the user completes receipt, CAPTCHA, password setup, login, and used-link checks, discover the target only by exact private-manifest email and Clerk linkage.
- Revoke only a still-pending owned invitation; Clerk may retain revoked/used invitation history.
- Remove only the temporary target assignments, target user and linked owned Clerk identity, temporary actor proof/session/user/identity, and audit rows created by their owned IDs.
- Require the normalized database snapshot to exactly equal the private pre-write baseline and independently verify zero marker rows before removing the manifest.
