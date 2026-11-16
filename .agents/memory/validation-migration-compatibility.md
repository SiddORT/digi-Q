---
name: Validation migration compatibility
description: Non-obvious compatibility boundaries when moving ClinicFlow validation between major versions
---

Preserve UUID-shaped recovery and idempotency identifiers without newly requiring
RFC version/variant bits.

**Why:** The former validator accepted generic hexadecimal 8-4-4-4-12 identifiers.
A library's stricter UUID default can reject previously accepted saved request
identities even when TypeScript still reports the same string type.

**How to apply:** Use supported generic GUID or equivalent explicit-pattern
validation consistently in generated and handwritten boundaries. Test legacy
non-versioned, uppercase and malformed identifiers; do not validate only freshly
generated UUIDs.

Do not restore the literal `"undefined"` for absent required coerced strings.

**Why:** That value was a parser artifact, not a usable identifier; HTTP query
handling already rejected it. Preserving it would require an unsafe adapter.

**How to apply:** Separate exact missing-required-field guard changes from
valid-input/output differences during differential checks. Do not generalize
this exception to optional fields, coercion failures or other changed inputs.
