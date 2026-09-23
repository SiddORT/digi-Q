---
name: ClinicFlow visual cascade verification
description: Why shared UI fixes need rendered checks against legacy CSS
---

When changing ClinicFlow controls, verify computed styles and rendered layout rather than trusting utility class names or a passing typecheck.

**Why:** An earlier restoration added correct-looking padding utilities but legacy unlayered input rules still won the cascade. A later responsive flex override also stacked full-width filter children at desktop sizes despite a correct tablet grid.

**How to apply:** Keep legacy base styles, component styles, and utility precedence deliberate. Check search padding, semantic button hover colors, and filter layout at both tablet and desktop widths after shared style changes. Avoid blanket `!important` fixes.