---
name: Tooltip input contract
description: Preserve useful help while preventing competing full-value and explanatory overlays.
---

Use measured clipping, not the presence or length of a value, to decide whether full-value help is needed. Explanatory help and full-value reveals must dismiss one another across component/library boundaries.

**Why:** A full preview attached to both text and an adjacent information trigger produced duplicate message bubbles; independently pinned help could also remain open after the pointer or focus moved to another reveal. Removing only the duplicate consumer would leave the cross-component interaction problem.

**How to apply:** New reveal types should participate in the existing shared dismissal contract. Preserve calculation definitions, consequential restrictions, icon-only labels and disabled reasons. Verify short and clipped values separately with focus, Escape and real touch input; ordinary desktop clicks do not establish touch toggle behavior.

Outside-touch verification must check the final settled state, not only that a
pointer-down handler closed the overlay.

**Why:** A mobile browser emitted compatibility mouseenter after an outside touch;
the tooltip closed and immediately reopened even though the outside-pointer
handler worked. Real hover pointer events and touch toggling must stay separate.

**How to apply:** When investigating dismissal, trace both the close and any later
reopen event. Recheck keyboard focus, mouse hover and second-tap toggle after a
touch-related fix; do not replace the shared tooltip infrastructure.

Full-value reveal affordances belong to selected content, not empty picker
placeholders. Preserve an unobstructed way to open the picker.

**Why:** At tablet widths, a clipped placeholder became an interactive reveal
above the actual Session trigger and intercepted the click intended to open the
list. A passing desktop render did not expose the failure.

**How to apply:** Include narrow empty-state picker interaction when opting a
form into compact full-value help; retain complete selected names and detailed
options without making placeholders competing interactive controls.
