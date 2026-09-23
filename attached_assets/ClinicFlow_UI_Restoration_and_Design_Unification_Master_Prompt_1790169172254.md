# CLINICFLOW — UI RESTORATION, DESIGN UNIFICATION & PRODUCTION POLISH
## MASTER IMPLEMENTATION PROMPT FOR REPLIT AI

### IMPORTANT
This is an **implementation task, not another audit**.

The attached screenshots show the current result after the previous UI changes. The current result is not acceptable: contrast has been pushed too far, search fields look broken/misaligned, dropdowns are inconsistent and browser-like, spacing is uneven, some controls are oversized, pagination looks unfinished, and there are spelling/terminology issues.

**Do not redesign ClinicFlow from scratch. Restore and refine the existing ClinicFlow visual identity.**

The target is:

> **Calm + refined + modern + readable + consistent + robust**

NOT:

> Heavy + boxy + forced contrast + inconsistent + browser-like

---

# 1. CORE OBJECTIVE

ClinicFlow already has a good visual identity. Preserve:

- ClinicFlow branding
- Existing teal identity
- Calm healthcare aesthetic
- Existing navigation
- Existing business workflows
- Existing role model
- Existing authentication
- Existing appointment/queue/QR/check-in logic

Improve the entire system so every screen feels like it was designed as part of the **same product**.

The screenshots are visual evidence of system-wide component problems. Do not fix only those exact pages.

---

# 2. MOST IMPORTANT CHANGE — REBALANCE THE CONTRAST

The previous implementation increased contrast too aggressively.

**Do not increase contrast further. Reduce/rebalance the current excessive contrast.**

Use:

- Soft neutral borders
- Clear but subtle field boundaries
- Comfortable text contrast
- Subtle teal focus states
- Light surfaces
- Calm hierarchy
- Minimal shadows

Avoid:

- Heavy dark outlines around fields
- Dark rectangles around filter sections
- Thick/high-contrast focus rings
- Overly saturated controls
- Black-looking borders
- Visually aggressive UI

The application should remain readable without looking harsh.

Contrast must be purposeful and measured, not forced.

---

# 3. ONE SHARED DESIGN SYSTEM

Create and enforce one visual system for:

- Text inputs
- Search inputs
- Single selects
- Multi-selects
- Date inputs
- Filter controls
- Buttons
- Icon buttons
- Tables
- Modals
- Pagination
- Tabs
- Status badges
- Loading states
- Error states
- Empty states
- Toasts
- Form labels
- Helper text

If multiple implementations exist for the same control:

1. Identify the canonical/shared implementation.
2. Improve it.
3. Migrate all consumers.
4. Remove obsolete/conflicting implementations.

Do not solve global problems with page-specific CSS hacks.

---

# 4. DESIGN TOKENS

Consolidate shared tokens for:

### Surfaces
- Page
- Card
- Input
- Dropdown
- Modal

### Text
- Primary
- Secondary
- Muted
- Placeholder
- Disabled
- Error
- Success
- Warning

### Borders
- Default
- Hover
- Focus
- Error
- Disabled

### Brand
- Primary teal
- Hover
- Pressed
- Soft teal

### Layout
- Spacing scale
- Radius scale
- Field heights
- Button heights
- Shadows

Fix invalid/mismatched token references such as undefined input-related variables.

Do not introduce arbitrary one-off values when a shared token should be used.

---

# 5. SPACING — MAJOR PRIORITY

The screenshots show inconsistent and excessive spacing.

Create a consistent spacing rhythm, for example:

    4 / 8 / 12 / 16 / 20 / 24 / 32

Use the shared spacing scale for:

- Page sections
- Filter fields
- Form fields
- Cards
- Tables
- Modal sections
- Buttons
- Pagination
- Headings

Do not randomly use different margins on every page.

The layout must feel intentional.

---

# 6. SEARCH BAR — FIX THE SHARED COMPONENT

The current search bars are visually broken/inconsistent.

Create/use one shared `SearchInput`.

It must have:

- Correct search icon position
- Correct left padding
- Proper vertical alignment
- Meaningful placeholder
- Clear button when text exists
- Consistent height
- Consistent border/radius
- Subtle focus state
- Responsive width
- Debounced search where appropriate

Target:

    +--------------------------------------------+
    |  🔍  Search branches...                 ×  |
    +--------------------------------------------+

The icon must never overlap the text.

The text must never sit too close to the icon.

The clear button must not collide with the text.

Do not allow different pages to create different search-bar designs.

---

# 7. SEARCH BAR WIDTH

Do not stretch search fields unnecessarily.

Desktop:
- Use a sensible max width.
- Allow filters/actions to occupy remaining space.

Tablet:
- Wrap naturally.

Mobile:
- Full width.

Do not create huge blank areas around a small search field.

---

# 8. SEARCH PLACEHOLDERS

Use meaningful wording:

- `Search branches...`
- `Search clinics...`
- `Search doctors by name, email or specialization...`
- `Search patients by name, email or mobile...`
- `Search appointments by patient or reference...`
- `Search receptionists by name, email or mobile...`

Do not use vague `Search...` where context is known.

---

# 9. ONE SHARED DROPDOWN COMPONENT

This is a critical requirement.

There must be one shared ClinicFlow visual/interaction pattern for dropdowns.

All dynamic selectors should use it.

Standardise:

- Trigger height
- Padding
- Border
- Radius
- Typography
- Chevron
- Focus
- Hover
- Selected state
- Menu surface
- Option height
- Search field
- Loading state
- No-results state
- Clear action
- Positioning
- Keyboard navigation

The dropdown must look like ClinicFlow, not the browser.

---

# 10. NO NATIVE-LOOKING DYNAMIC DROPDOWNS

Do not use raw browser `<select>` controls for dynamic application data.

Dynamic selectors include:

- Clinic
- Branch
- Doctor
- Receptionist
- Clinic Admin
- Patient
- Managing Admin
- Session
- Specialization
- Qualification
- Language
- Other dynamic relations

Small fixed enums may remain simple selects when search provides no value, but they must still use the same ClinicFlow styling.

---

# 11. SEARCHABLE DROPDOWNS

Dynamic dropdowns must support:

- Search
- Selected value
- Clear
- Keyboard navigation
- Loading
- No results
- Proper focus
- Proper hover
- Selected-state indication

Opened dropdown example:

    +--------------------------------------+
    | 🔍 Search clinics...                  |
    +--------------------------------------+
    | Fortis                               |
    | Apollo Care Clinic                   |
    | Sunshine Multispeciality Clinic      |
    | Harmony Health Clinic                |
    +--------------------------------------+

The search field must be integrated into the dropdown.

---

# 12. DROPDOWN POSITIONING

Dropdowns must:

- Stay within the viewport
- Flip upward when necessary
- Never be clipped by modals
- Never extend off-screen
- Have sensible maximum height
- Have one intentional internal scroll region
- Align exactly with the trigger

Avoid nested scrollbars and detached-looking menus.

---

# 13. MULTI-SELECT / CLINIC FIELD

The current Clinic field that looks like a checkbox list is not acceptable.

Use the shared polished multi-select.

Selected values should appear as chips:

    Clinics *

    +-------------------------------------------+
    | Sunshine Multispeciality Clinic        ×  |
    | Apollo Care Clinic                     ×  |
    +-------------------------------------------+

Opening it may show:

    Search clinics...

    □ Fortis
    ☑ Apollo Care Clinic
    ☑ Sunshine Multispeciality Clinic
    □ Harmony Health Clinic

Support:

- Search
- Multiple selection
- Selected state
- Individual removal
- Clear All
- Keyboard navigation
- Loading
- No results

---

# 14. CORRECT ENTITY TYPES

Never populate selectors from an unrelated global Users dataset.

Examples:

- Doctor selector → doctors only
- Receptionist selector → receptionists only
- Clinic Admin selector → clinic admins only
- Patient selector → patients only
- Clinic selector → clinics only
- Branch selector → branches belonging to selected clinic

Patients must never appear in staff selectors.

Server-side authorization remains authoritative.

---

# 15. DEPENDENT DROPDOWNS

For:

    Clinic → Branch

when Clinic changes:

- Clear invalid Branch.
- Reload Branches.
- Show only valid branches.
- Never retain stale values.

Apply the same principle to:

- Clinic → Doctor
- Clinic + Branch → Doctor
- Other parent/child selectors

If no options exist, explain why.

---

# 16. FILTER PANELS — RESTORE BALANCE

The screenshots show filter panels that are too tall, too heavy and contain awkward empty space.

Use a compact responsive grid.

Example:

    Filters

    Search                              From       To
    [ Search...                       ] [date]    [date]

    Status          Clinic             Branch       Doctor
    [select]        [select]           [select]     [select]

    [Clear filters]

Do not stretch every selector across the entire page.

Do not put one tiny field next to a huge blank area.

---

# 17. FILTER PANEL VISUAL STYLE

The filter container should be subtle:

- Light neutral/soft teal surface
- Soft border
- Moderate radius
- Comfortable padding
- Clear heading
- Logical grouping

Do not use the current heavy dark outline.

The filter panel should support the page, not dominate it.

---

# 18. APPOINTMENTS SCREEN

The current appointment filter layout is too vertically stretched.

Use a balanced responsive structure such as:

    Search appointments                 From        To

    Status          Clinic              Branch       Doctor

    Session         Patient type        Sort

    [Clear filters]

All relation selectors must use the shared searchable selector.

Do not change appointment business logic.

---

# 19. LIVE QUEUE SCREEN

The current queue filters are also too tall/full-width.

Prefer:

    Clinic          Branch          Doctor

    Queue status    Queue date     [Clear filters]

Then the queue content.

Preserve all existing queue/session/capacity logic.

Do not redesign queue business rules.

---

# 20. BRANCHES SCREEN

Use:

    Search branches...                              Add branch

    Status          Clinic          Sort            Clear filters

Then the table.

Clinic must use the shared searchable selector.

Do not stretch the Clinic selector unnecessarily.

---

# 21. FORMS

All forms must use one shared structure.

Example:

    Clinic *                    Name *
    [select]                    [input]

    Address *                   City
    [input]                     [input]

    State                       Pincode
    [input]                     [input]

    Phone                       Timezone
    [input]                     [input]

    Status
    [select]

    --------------------------------------------

                            [Save changes]

Use consistent:
- Label
- Required indicator
- Height
- Border
- Radius
- Padding
- Focus
- Error state
- Spacing
- Footer

---

# 22. MODALS

Standardise:

- Width
- Header
- Title
- Close button
- Internal padding
- Form grid
- Footer
- Save/cancel buttons
- Internal scrolling

Avoid unnecessary vertical empty space.

Avoid nested scrollbars.

Use two columns on desktop when appropriate and one column on mobile.

---

# 23. BUTTONS

Use one shared primary button.

Primary actions such as:

- Add branch
- Add receptionist
- Book appointment
- Save changes
- Set up Clinic Admin

must have the same:

- Height
- Radius
- Typography
- Icon spacing
- Teal treatment
- Hover state
- Disabled state

Do not create multiple visually different versions.

---

# 24. ICON BUTTONS

Edit/delete/recovery/etc. must share one icon-button component.

Standardise:

- Size
- Border
- Icon size
- Spacing
- Hover
- Focus
- Tooltip
- Destructive state

---

# 25. TABLES

Tables should be refined and readable.

Avoid:

- Heavy borders
- Very dark separators
- Tiny text
- Excessive whitespace
- Horizontal-scroll-first layouts

Use:

- Soft row separators
- Clear headers
- Comfortable row height
- Wrapped/grouped content
- Consistent actions

---

# 26. NO NORMAL HORIZONTAL SCROLL

This remains a hard requirement.

Do not simply hide the scrollbar.

Do not shrink text.

Instead:

- Group related data
- Wrap long values
- Move secondary data into details
- Use expandable rows where appropriate
- Use responsive cards/stacked rows on smaller screens

This applies to Users, Clinics, Branches, Doctors, Patients, Appointments, Queue, Reports, Masters and other operational tables.

---

# 27. TABLE INFORMATION HIERARCHY

For wide data, group information.

Example:

### Staff member
    Preview Clinic Admin
    email@example.com

### Owned clinics
    Fortis
    Apollo Care Clinic
    Sunshine Multispeciality Clinic
    + 2 more

### Account
    Active
    Password set

### Actions
    [Recovery] [Edit] [Delete]

Do not force every attribute into its own wide column.

---

# 28. PAGINATION

Pagination must look finished.

Current empty-looking boxes are unacceptable.

Use:

    Showing 1–20 of 247

    Rows per page: [20]

    [‹] [Previous] [1] [2] [3] [Next] [›]

Disabled controls must still be visually understandable.

For zero records, do not show confusing:

    Showing 0–0 of 0

Use an appropriate empty state instead.

---

# 29. REAL SERVER-SIDE PAGINATION

For growing datasets:

DO NOT:

    Fetch everything
    → filter in browser
    → sort in browser
    → slice in browser

Use:

    Search
    + Filters
    + Sort
    + Page
    + Page size

at the data/query layer where appropriate.

Page sizes:

- 10
- 20
- 50
- 100

Default to 20 unless a genuine screen-specific reason exists.

---

# 30. SEARCH + FILTER + SORT + PAGINATION

These must work together.

Example:

    Search = Rahul
    Clinic = Sunshine
    Branch = Baner
    Status = Active
    Sort = Name
    Page = 2
    Page size = 20

The backend must return the correct page for the complete query.

Reset to page 1 when search/filter/sort changes where appropriate.

---

# 31. EMPTY / LOADING / ERROR STATES

Distinguish:

### No records
    No branches have been added yet.

### No matching results
    No branches match the current filters.
    Clear one or more filters to see more results.

### Error
    Unable to load branches.
    Please try again.
    [Retry]

Never show an empty state when the API actually failed.

---

# 32. COPY AND SPELLING AUDIT

Perform a complete UI copy audit.

Check:

- Page titles
- Breadcrumbs
- Buttons
- Labels
- Placeholders
- Table headers
- Filters
- Helper text
- Empty states
- Error messages
- Validation messages
- Status labels
- Modal titles

Correct spelling, grammar and capitalisation.

Use consistent terminology.

Preferred terminology includes:

- Clinic Admin
- Receptionist
- Appointments
- Branches
- Doctors
- Patients
- Filters
- Clear filters
- Save changes

Do not introduce different names for the same business concept without a real reason.

---

# 33. TYPOGRAPHY

Use one hierarchy.

Page title:
- Strong
- Professional
- Not oversized

Section title:
- Clearly subordinate

Labels:
- Consistent and readable

Body:
- Comfortable reading size

Supporting text:
- Muted but readable

Table headers:
- Compact and consistent

Do not make everything bold to compensate for weak hierarchy.

---

# 34. SPACING SYSTEM

Use a consistent rhythm such as:

    4 / 8 / 12 / 16 / 20 / 24 / 32

Apply it across:
- Cards
- Forms
- Filters
- Tables
- Modals
- Buttons
- Pagination
- Page sections

No random spacing hacks.

---

# 35. ROLE CONSISTENCY

The same shared controls and visual language must apply to:

- Super Admin
- Clinic Admin
- Doctor
- Receptionist
- Patient

Permissions/data may differ.

The UI language must not.

---

# 36. DO NOT CHANGE BUSINESS LOGIC

Preserve:

- Staff Email + Password authentication
- Patient Email + OTP authentication
- Clinic ownership rules
- Branch relationships
- Doctor/receptionist mappings
- Appointment logic
- New/follow-up patient logic
- Doctor availability
- Session/capacity model
- Queue
- Appointment QR
- Clinic QR
- Check-in
- Skip/no-show
- Clerk invitation architecture

This task is UI/UX/data-presentation/consistency work.

Do not redesign established business workflows.

---

# 37. DO NOT BREAK AUTHORIZATION

Continue enforcing server-side:

- Role scope
- Clinic scope
- Branch scope
- Ownership scope
- Assignment scope

Frontend filtering must never become the security boundary.

---

# 38. PERFORMANCE

Preserve/implement:

- Server-side filtering
- Server-side sorting
- Server-side pagination
- Bounded searchable option loading
- Batched enrichment
- Stable ordering

Review inappropriate:

- `allPages()`
- Fetch-all-then-slice
- Unbounded dropdown loading
- N+1 queries

Do not weaken authorization to improve performance.

---

# 39. SHARED COMPONENT CONSOLIDATION

Search the codebase for duplicate implementations of:

- SearchInput
- Select
- MultiSelect
- DateInput
- FilterBar
- Pagination
- Modal
- Button
- IconButton
- FormField
- Table

Consolidate them where appropriate.

Do not leave one screen using an old component while the rest uses a new component.

---

# 40. COMPLETE SCREEN MIGRATION

After fixing shared components, migrate ALL relevant screens.

### Users
- Clinic Admins
- Doctors
- Receptionists

### Master data
- Clinics
- Branches
- Doctors
- Patients
- Masters

### Scheduling
- Weekly schedule
- Date exceptions

### Operations
- Appointments
- Live Queue
- QR
- Check-in

### Administration
- Dashboard
- Reports
- Activity
- Security audit presentation
- Settings

### Patient/public
- Login
- Booking
- Clinic selection
- Branch selection
- Doctor selection
- Session selection
- Availability
- Appointment confirmation
- QR
- Check-in

---

# 41. VISUAL QA IS MANDATORY

Do not declare completion just because the code compiles or tests pass.

Inspect every major screen visually.

For every screen ask:

- Are borders too dark?
- Are controls too tall?
- Are controls too wide?
- Is spacing too large?
- Is spacing too tight?
- Does the dropdown look like ClinicFlow?
- Is the search icon aligned?
- Is placeholder text aligned?
- Is the filter grid balanced?
- Is there unnecessary empty space?
- Are buttons consistent?
- Are pagination controls understandable?
- Is text clipped?
- Is any spelling wrong?
- Does this screen look like the same application as the others?

A technically functional control that looks out of place is still unfinished.

---

# 42. RESPONSIVE QA

Test:

- Desktop
- Laptop
- Tablet
- Mobile

Ensure:

- No horizontal page overflow
- No clipped modal
- No broken dropdown
- No dropdown outside viewport
- No overlapping buttons
- No hidden primary actions
- No unreadable tables

---

# 43. REGRESSION TESTING

After the UI changes, test:

### Authentication
- Super Admin
- Clinic Admin
- Doctor
- Receptionist
- Patient

### Authorization
- Role isolation
- Clinic isolation
- Branch isolation
- Ownership isolation

### Users
- Create
- Edit
- Search
- Filter
- Sort
- Pagination
- Mapping
- Dependent selections

### Dropdowns
- Open
- Search
- Select
- Clear
- Reopen
- No results
- Loading
- Keyboard navigation
- Correct scoping

### Tables
- Search
- Filter
- Sort
- Pagination
- Combined query behaviour

### Forms
- Required validation
- Invalid values
- Save
- API failure
- Cancel
- Unsaved changes
- Duplicate submission

### Core clinical workflows
- Appointments
- Availability
- Queue
- QR
- Check-in
- Skip/no-show
- Patient master

---

# 44. DO NOT DO THESE THINGS

Do NOT:

- Increase contrast further.
- Redesign ClinicFlow from scratch.
- Introduce a new colour palette.
- Use multiple competing dropdown implementations.
- Leave native dynamic selects.
- Stretch every field to full width.
- Add random margins/padding.
- Add page-specific CSS hacks for shared problems.
- Hide horizontal scrollbars instead of fixing layout.
- Shrink table text excessively.
- Create fake filters.
- Create fake pagination.
- Fetch entire datasets unnecessarily.
- Change business logic.
- Change authentication.
- Change queue architecture.
- Send unsolicited emails.
- Resend retained invitations.
- Delete security audit events.
- Stop after an audit without implementing.

---

# 45. REQUIRED IMPLEMENTATION SEQUENCE

## Step 1 — Inspect
Inspect shared components, tokens and affected screens.

## Step 2 — Restore design foundation
Reduce the current excessive contrast and consolidate tokens.

## Step 3 — Fix shared components
Fix:
- SearchInput
- SingleSelect
- MultiSelect
- DateInput
- FormField
- FilterBar
- Pagination
- Button
- IconButton
- Modal
- Table

## Step 4 — Migrate all screens
Apply shared components throughout the application.

## Step 5 — Copy audit
Correct spelling, grammar and terminology.

## Step 6 — Data behaviour
Verify search/filter/sort/pagination.

## Step 7 — Responsive pass
Desktop/tablet/mobile.

## Step 8 — Visual QA
Compare against the attached screenshots and ClinicFlow's existing visual identity.

## Step 9 — Regression tests
Authentication, authorization, mappings, appointments, queue, QR, check-in, invitation logic.

## Step 10 — Fix and retest
Do not stop at the first passing run.

---

# 46. FINAL ACCEPTANCE CRITERIA

## Design
- [ ] Existing ClinicFlow identity preserved
- [ ] Current excessive contrast reduced/rebalanced
- [ ] Borders subtle
- [ ] Inputs refined
- [ ] Typography consistent
- [ ] Spacing consistent
- [ ] Buttons consistent
- [ ] Modals consistent
- [ ] Tables consistent

## Search
- [ ] Search bars visually correct
- [ ] Search icons aligned
- [ ] Text aligned
- [ ] Clear action works
- [ ] Meaningful placeholders
- [ ] Consistent behaviour

## Dropdowns
- [ ] One shared visual pattern
- [ ] Dynamic dropdowns searchable
- [ ] Multi-select polished
- [ ] Selected values visible
- [ ] Clear/remove works
- [ ] Keyboard navigation works
- [ ] Loading/no-results works
- [ ] Correct positioning
- [ ] No native-looking dynamic dropdowns
- [ ] Dependent selections correct

## Filters
- [ ] Consistent filter panel
- [ ] Balanced grid
- [ ] No excessive empty space
- [ ] No oversized controls
- [ ] Clear filters works
- [ ] Filters combine correctly

## Tables
- [ ] No normal horizontal scrolling
- [ ] Long content wraps/groups correctly
- [ ] Actions consistent
- [ ] Tables readable
- [ ] Responsive presentation works

## Pagination
- [ ] Real server-side pagination where appropriate
- [ ] 10/20/50/100 page sizes
- [ ] Accurate counts
- [ ] Correct navigation
- [ ] Correct zero-record state
- [ ] Disabled controls understandable

## Content
- [ ] No spelling mistakes
- [ ] No inconsistent terminology
- [ ] No grammar mistakes
- [ ] Meaningful labels
- [ ] Meaningful empty states
- [ ] Meaningful errors

## Reliability
- [ ] No dead controls
- [ ] No broken search
- [ ] No broken dropdown
- [ ] No stale dependent selections
- [ ] No duplicate submissions
- [ ] Correct loading/error/success states

## Business logic
- [ ] Authentication unchanged
- [ ] Authorization unchanged
- [ ] Clinic ownership unchanged
- [ ] Branch relationships unchanged
- [ ] Appointment logic unchanged
- [ ] Queue logic unchanged
- [ ] QR/check-in unchanged
- [ ] Invitation architecture unchanged

---

# 47. REQUIRED FINAL REPORT

After implementation, report:

## A. Shared components fixed
- Component
- Problem
- Correction
- Screens migrated

## B. Screens completed
List every actual screen changed.

## C. Dropdown audit
For each important dropdown:
- Screen
- Field
- Searchable?
- Single/multi?
- Correctly scoped?
- Dependent?

## D. Search audit
For each major search:
- Screen
- Placeholder
- Clear action
- Debounce
- Query behaviour

## E. Table audit
For every table/list:
- Search
- Filters
- Sort
- Pagination
- Server-side pagination
- Horizontal scrolling removed
- Responsive behaviour

## F. Copy audit
- Spelling corrections
- Terminology standardisation
- Label corrections

## G. Performance
- Fetch-all patterns reviewed
- `allPages()` reviewed
- Server-side filtering
- Server-side sorting
- Server-side pagination
- Bounded option loading
- N+1 issues addressed

## H. Regression testing
- Tests run
- Tests passed
- Tests failed
- Authentication
- Authorization
- Appointments
- Queue
- QR
- Check-in
- Mapping
- Invitation regression

## I. Visual QA
Explicitly confirm:
- Contrast rebalanced
- Search bars corrected
- Dropdowns unified
- Filter spacing corrected
- Modal spacing corrected
- Tables corrected
- Pagination corrected
- Spelling/copy checked
- Responsive layouts checked

## J. Remaining issues
If anything remains:

    Issue:
    Screen:
    Impact:
    Reason:
    Next action:

Do not hide unresolved issues.

---

# 48. ABSOLUTE FINAL INSTRUCTION

**Do not give me another audit or design proposal. Implement the changes.**

The current screenshots show that the previous attempt over-corrected contrast and failed to establish a uniform component system.

The requirement is **not "more contrast".**

The requirement is:

> **Every input, search bar, dropdown, filter, table, modal, button and pagination control must look like it was designed as part of the same ClinicFlow product.**

The final application should feel:

**Professional + Calm + Modern + Consistent + Readable + Robust**

and never:

**Heavy + Boxy + Forced + Inconsistent + Browser-like.**

Preserve the existing ClinicFlow identity and business logic.

**Implement → migrate → test → visually inspect → fix → retest → report.**

Only report completion when both functional behaviour and visual consistency meet the acceptance criteria.
