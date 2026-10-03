---
name: ClinicFlow visual cascade verification
description: Why shared UI fixes need rendered checks against legacy CSS
---

When changing ClinicFlow controls, verify computed styles and rendered layout rather than trusting utility class names or a passing typecheck.

**Why:** An earlier restoration added correct-looking padding utilities but legacy unlayered input rules still won the cascade. A later responsive flex override also stacked full-width filter children at desktop sizes despite a correct tablet grid.

**How to apply:** Keep legacy base styles, component styles, and utility precedence deliberate. Check search padding, semantic button hover colors, and filter layout at both tablet and desktop widths after shared style changes. Avoid blanket `!important` fixes.

For narrow export documents, compare text and table internal scroll widths with their client widths, not only the document width.

**Why:** A ticket container with hidden overflow can make the page appear to fit while silently clipping a long patient name.

**How to apply:** Check child bounds inside the exported HTML as well as the on-screen component; exercise downloaded documents and print popups separately.

Isolated component browser harnesses must explicitly scan the application's source for Tailwind utilities, not just import its stylesheet and Vite plugin.

**Why:** An isolated harness passed interaction checks while rendering stacked pagination, duplicate mobile navigation and misplaced search icons because it did not generate utilities from the real application files. These were initially confused with production cascade problems.

**How to apply:** Match the real CSS compiler and explicitly include external component sources in scanning. Assert computed flex/hidden styles before trusting visual evidence; then distinguish genuine selector mismatches and specificity problems from harness omissions.

Keep the clinic administration interface compact-only and reserve tabs for status filtering. Consolidate overlapping management surfaces around one editor per record type.

**Why:** The user explicitly rejected density choices, tab-like section navigation, and pages that repeat most of the same controls with only a few differences. The goal is fewer competing places to manage information, not merely smaller spacing.

**How to apply:** Use section navigation for configuration, labelled toggles for binary staff activation and column arrows for sorting. Reuse canonical editors from contextual entry points while preserving role scopes, unique actions, historical links and distinct appointment/queue workflows.

Apply the screenshot-inspired compactness across all pages, with reduced padding and overall sizing. Listing headers should use the left and right sections rather than waste extra rows.

**Why:** The user reiterated that compactness must not be limited to one page and felt the previously described compact UI could still be smaller.

**How to apply:** Check final computed spacing and each listing's control arrangement. Shared compact styles and functional navigation tests alone do not prove that every page meets the requested density.