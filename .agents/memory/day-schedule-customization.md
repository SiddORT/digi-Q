---
name: Day schedule customization
description: Product boundary for custom weekdays versus whole-location clinic-hours links
---

Direct schedule edits customize the complete selected doctor's weekday at one
location, including all inherited intervals and explicit non-working intent.
They must not unlink the entire location or edit clinic opening hours as a side
effect. Custom days off must survive future clinic-hour synchronization.

**Why:** The user explicitly approved day-scoped customization with a comparison
against actual clinic hours and confirmation that other days and clinic hours
remain unchanged. A session's unlinked marker alone does not express a day off.

**How to apply:** Preserve custom-day intent across later link configuration
changes. Restoring a day to following clinic hours is a separate product decision,
not an implicit consequence of re-enabling a location-wide link.
