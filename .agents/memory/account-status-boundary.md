---
name: Account status boundary
description: Status changes must not normalize or expand staff assignment scope.
---
Treat account activation and deactivation as access changes, not assignment reconciliation.

**Why:** A disposable fixture showed that rewriting an unchanged branch-only assignment also inserted a clinic-wide assignment. Identical displayed clinic and branch lists do not prove that the underlying scope stayed unchanged.

**How to apply:** Verify exact assignment rows survive status changes. Only reconcile mappings when assignment fields are explicitly supplied; keep existing ownership validation and session revocation.
