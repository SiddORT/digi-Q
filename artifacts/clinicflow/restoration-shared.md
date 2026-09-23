# ClinicFlow UI Restoration Notes

## Token Consolidation & Contrast Reduction
- Softened `--border` and `--input` tokens from `160 10% 47%` to `160 22% 84%` to remove aggressive dark rectangles.
- Calmed `--muted-foreground` and text colors for better readability without harsh contrast.
- Reduced box-shadows globally, replacing heavy focus rings with a soft teal `rgba(19, 120, 111, 0.15)` focus offset.

## Shared Components Restored

### SearchInput
- Fixed icon/padding overlap by adjusting relative positioning and padding (`pl-10 pr-9`).
- Replaced custom margins and strict heights with a unified `min-h-[43px]` height scaling.
- Implemented a clear clear-button inside the field, preventing text clipping.

### SearchableSelect & SearchableMultiSelect
- Fully replaced generic native-looking borders with custom `focus-within` styling so they look like one unified ClinicFlow input.
- Added viewport flipping (`align="start"` with custom Radix Popover boundaries) and max-height logic for dropdowns to prevent clipping.
- Fixed chip styling for `SearchableMultiSelect` to use soft teal wrapping chips (`bg-teal-50 border-teal-100 text-teal-800`), fulfilling the "wrapping chips" and "no check list" requests.
- Integrated clear button directly in the trigger area.

### Pagination
- Restored "Showing X-Y of Z" logic without showing 0-0 of 0 (returns `null` when `total === 0`).
- Redesigned pagination controls to include clear `Previous` and `Next` labels alongside chevrons for improved usability.
- Added soft unified button styling for pagination chips with disabled state comprehension.

### FilterBar
- Redesigned to use a responsive wrapping grid (`xl:flex-wrap`) and light background (`bg-slate-50/50` vs heavy dark backgrounds).
- Standardized the "Clear filters" action position.

### AppDialog
- Unified modal padding (`p-6 md:p-8`) with a clear single-scrollable body, fixing nested scrollbar risks.
- Added proper tracking to dialog headers.