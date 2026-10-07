---
name: ClinicFlow visual cascade verification
description: Why shared UI fixes need rendered checks against legacy CSS
---

When changing ClinicFlow controls, verify computed styles and rendered layout rather than trusting utility class names or a passing typecheck.

**Why:** An earlier restoration added correct-looking padding utilities but legacy unlayered input rules still won the cascade. A later responsive flex override also stacked full-width filter children at desktop sizes despite a correct tablet grid.

**How to apply:** Keep legacy base styles, component styles, and utility precedence deliberate. Check search padding, semantic button hover colors, and filter layout at both tablet and desktop widths after shared style changes. Avoid blanket `!important` fixes.

Compact layouts must size compound controls by the whole interaction, not by the input type alone, and verify child bounds against cards and footers.

**Why:** Country-plus-phone controls were squeezed by otherwise valid compact grids, and a legacy sticky footer covered mobile inputs even when document overflow was zero.

**How to apply:** Check composite fields at actual container widths, footer overlap, and action rows within their cards. Page-level horizontal-overflow checks alone do not establish readable controls.

For narrow export documents, compare text and table internal scroll widths with their client widths, not only the document width.

**Why:** A ticket container with hidden overflow can make the page appear to fit while silently clipping a long patient name.

**How to apply:** Check child bounds inside the exported HTML as well as the on-screen component; exercise downloaded documents and print popups separately.

For rasterised ticket PDFs, verify readability on the rendered PDF, not text extraction or the pre-export HTML, and keep the reference-rendering environment stable.

**Why:** Low-resolution inspection can make an intact QR undecodable; source assertions cannot detect missing Unicode glyphs, clipping during capture, or oversized PDF image streams.

**How to apply:** Use print-resolution rasterisation for QR checks, visually review new reference images before accepting them, and distinguish rendering-tool/font changes from document regressions.

Isolated component browser harnesses must explicitly scan the application's source for Tailwind utilities, not just import its stylesheet and Vite plugin.

**Why:** An isolated harness passed interaction checks while rendering stacked pagination, duplicate mobile navigation and misplaced search icons because it did not generate utilities from the real application files. These were initially confused with production cascade problems.

**How to apply:** Match the real CSS compiler and explicitly include external component sources in scanning. Assert computed flex/hidden styles before trusting visual evidence; then distinguish genuine selector mismatches and specificity problems from harness omissions.

Keep the clinic administration interface compact-only and reserve tabs for status filtering. Consolidate overlapping management surfaces around one editor per record type.

**Why:** The user explicitly rejected density choices, tab-like section navigation, and pages that repeat most of the same controls with only a few differences. The goal is fewer competing places to manage information, not merely smaller spacing.

**How to apply:** Use section navigation for configuration, labelled toggles for binary staff activation and column arrows for sorting. Reuse canonical editors from contextual entry points while preserving role scopes, unique actions, historical links and distinct appointment/queue workflows.

Apply the screenshot-inspired compactness across all pages, with reduced padding and overall sizing. Listing headers should use the left and right sections rather than waste extra rows.

**Why:** The user reiterated that compactness must not be limited to one page and felt the previously described compact UI could still be smaller.

**How to apply:** Check final computed spacing and each listing's control arrangement. Shared compact styles and functional navigation tests alone do not prove that every page meets the requested density.

Density verification must assert toolbar height as well as page overflow.

**Why:** A fixed filter-group width can stack controls into a tall column while the page still passes overflow and control-size checks.

**How to apply:** Measure representative simple and multi-filter toolbars at desktop widths, and inspect their child arrangement. Keep legitimate narrow-screen wrapping instead of forcing every toolbar into one row.

Popup and toolbar checks must inspect visible text bounds, not only element boxes or document scroll width.

**Why:** A toolbar passed box-overlap checks while its long label spilled over another control; an anchored popup was clipped off-screen without causing document overflow.

**How to apply:** Check label containment and popup edges at narrow widths, including actual touch input. A clean horizontal-scroll check alone does not establish usability.

Filters and contextual pop-ups must overlay the page or open in a right-side drawer, not push the listing down. Searches should show matching permitted records while typing.

**Why:** The user explicitly added these requirements to the app-wide compact-layout scope.

**How to apply:** Preserve scope, actual data, keyboard navigation and unsaved edits. Judge density by the entire pre-listing area, including metadata/export/help outside the toolbar, not just smaller controls.

Reduce visible information, not only spacing: technical references and repeated metadata do not belong beneath every record. Keep operational tokens visible in queues and tickets.

**Why:** The user rejected lists with two or three lines of database-oriented information and duplicate status explanations, even after the spacing pass.

**How to apply:** Default to the information needed to identify and act on the record. Preserve hidden fields in storage, search and Details; use accessible focus/tap pop-ups for secondary non-sensitive context. Do not hide critical patient identification or warnings.

Ticket compactness and the current representation review must preserve all existing information, links, actions, QR codes and explanations.

**Why:** The user explicitly clarified: "do not remove any info or links or anything from it" when discussing the shorter ticket and revised header layout.

**How to apply:** Improve grouping, alignment and spacing without dropping content, shrinking text to fit or clipping overflow. Target a ticket that fits typical desktop viewports, while retaining scrolling when small screens or long content require it.

Use wide search beside listing titles, with Export beside the primary Add/Book action. Header actions should have matching outer heights and a clearly emphasized primary action. Appointment details belong in a structured right-side drawer; tickets remain centred documents.

**Why:** The user approved this representation across all pages after the previous compactness pass still left stacked toolbars and unstructured popup contents.

**How to apply:** Apply the common header to relevant listings, while retaining page-specific scope controls, responsive wrapping, full content and existing behavior. Improve grouping inside overlays rather than just changing where the old vertical list opens.

For responsive verification, wait for viewport-resize layout to settle and assert overlay/control bounds, not only page scroll width or CSS declarations. Tablet tables need intrinsic column floors; fixed-layout declared widths alone can still shrink under competing column rules.

**Why:** Repeated layout passes left date headers clipped and mobile ticket contents off-screen while page-overflow and hierarchy assertions passed. An immediate post-resize capture also retained old dialog geometry.

**How to apply:** Check actual header/control rectangles and text containment at desktop, tablet and phone sizes; constrain dialogs to the viewport and keep table scrolling internal. Preserve screenshots of corrected states, not only passing source tests.