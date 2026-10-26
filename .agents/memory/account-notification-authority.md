---
name: Account notification authority
description: Manual sharing cannot substitute patient-record or visit mobile for an account's notification contact.
---

Manual booking-status SMS requires the current valid account notification mobile.
Do not fall back to a separate patient-record or visit number when it is absent.

**Why:** Those records can diverge; account-level consent cannot authorize a stale
or reassigned number from another record.

**How to apply:** Block preview and send when the account mobile is missing or
invalid, even if the patient or visit still contains a valid number. Keep a
regression fixture with deliberately different values across these records.
