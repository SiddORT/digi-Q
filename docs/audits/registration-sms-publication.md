# Approved registration SMS publication — workspace/Preview

> Historical snapshot evidence. For the later missing-record reconciliation,
> repeatable installer, preservation checks and separate UAT rollout procedure,
> see [Registration SMS administration](registration-sms-administration.md).

Verified on **2026-11-18 at 11:49:44 UTC** against the workspace's development
database. This is a saved configuration change, not a deployment or a code-default
replacement. No separate hosted UAT or production environment was changed.

## Authorized scope and saved pairs

Only the two platform **SMS** `registration_mobile_otp` recipient rows were
published. Approval did not extend to staff setup/completion wording, welcome,
email or operational templates. `clinic_registration_otp` is the separate email
event and was not changed.

### Clinic Admin

- DLT Template ID: `1777179491541503439`
- Exact published body:

```text
Dear Clinic, Your Digi-Q clinic registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team
```

This recipient serves required public and Superadmin-led clinic-owner mobile
proof. Publication does not change verification requirements.

### Patient

- DLT Template ID: `1777179491551752035`
- Exact published body:

```text
Dear Clinic, Your Digi-Q patient registration OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.– Digi-Q Team
```

The patient salutation **Dear Clinic** and the no-space **anyone.–** sequence
were deliberately preserved. This recipient serves optional registration mobile
proof, not patient login. The two supplied numeric variable slots map in order
to `otp` and `expiry_minutes`.

## Before and after

Fresh reads found both targets at revision 0, active but using unpublished
defaults with empty DLT IDs and no drafts. Shared Keep in Touch configuration
passed application checks.

Both pairs were published through the existing administrator `saveTemplate`
mechanism, with a real active non-demo Superadmin audit actor. The operation used
the ordinary publication validation and revision checks, per-template advisory
locks and one outer transaction for the two rows. It rechecked the inspected
records before writing, retained other content fields, and requested draft
preservation rather than replacing any concurrent draft.

| Platform recipient | Saved revision | Published revision | Source | Active | Wording published | Delivery control | Blocked reasons |
|---|---:|---:|---|---|---|---|---|
| `clinicAdmin` | 1 | 1 | platform | yes | yes | Ready | `[]` |
| `patient` | 1 | 1 | platform | yes | yes | Ready | `[]` |

Fresh committed reads verified the exact bodies and matching DLT IDs. For each
recipient, checks passed for:

- Required security activation and published-wording provenance.
- SMS content schema, event-supported placeholders and required code/expiry.
- Shared provider configuration and provider-specific sender/DLT metadata.
- Fictional-only template preparation and Keep in Touch payload construction,
  including the rendered text and correct event-specific template ID.

Fictional values were the literal sample code `123456`, expiry `10` and a
reserved fictional recipient number. No code-generation or authentication action
was invoked. Payloads, headers and credentials were not logged or persisted.
An initial non-sending payload check rejected the chosen fictional UK number;
the transaction rolled back before any publication. A reserved US fictional
number passed the same unmodified validation for the successful operation.

## Preserved baseline

The entire effective patient-login template and its stored record remained
identical, not merely its DLT ID:

- Event/recipient: `patient_login_otp` / `patient`.
- DLT Template ID: `1777179188450254576`.
- Revision 1, active and published.
- Body unchanged:

```text
Dear User, your Digi-Q login OTP is {{otp}}. It is valid for {{expiry_minutes}} minutes. Do not share this OTP with anyone.
```

Database-side fingerprints confirmed all **141 unrelated settings records** were
unchanged across publication. All provider configuration records were also
unchanged. No email, staff, welcome, operational, clinic-gate or verification
setting was edited. The ordinary publication audit entries were created.

The running Preview rendered the expected staff sign-in boundary when the
protected template page was opened without authentication. That screenshot does
not verify the signed-in editor; the saved configuration and readiness evidence
above came from the application's actual resolver, delivery-control and
preparation functions against the development database.

## Evidence limits

**Ready means application readiness only.** It does not establish provider-side
DLT approval, account unblocking, provider acceptance or handset delivery.

- Live SMS sends: **0**.
- OTP requests or generated OTPs: **0**.
- Historical replay: **none**.
- Provider account, credentials or Sender ID changes: **none**.
- Provider-side status verification or handset tests: **not performed**.
- Deployment or separately hosted UAT update: **not performed**.

These database configuration records are not source-code defaults. Merging this
report does not publish the pairs into a separately hosted database.
