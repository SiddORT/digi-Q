# Compact UI acceptance checklist

Applies to every new or modified ClinicFlow/DigiQ screen, destination and role.
This refines the existing branding; it is not a new design system.

## Before editing
- Read `surface-inventory.json` and `compact-ui-coverage.md`. Regenerate with
  `node scripts/compact-ui-inventory.mjs` after JSX, route or link changes.
- Include linked destinations, public/guest paths, onboarding, hidden tabs and
  conditional editors. A shared CSS change is not proof that consumers work.
- Preserve information, actions, explanations, navigation/history, public links,
  server permissions, saved-label hydration, loading and submission contracts.
- Reuse shared controls. Do not add local dimensions to work around the cascade.
  Record a justified exception below before introducing a new size.

## Geometry and responsive behavior
- Existing size families: 32px compact toolbar/action; 40px ordinary single-line
  field/action; 44px touch; 48px deliberate command/search emphasis.
  Equivalent adjacent controls align, not every field in the app.
- Clinic workspace scope belongs beside its single page heading, outside the
  Staff listing filter. Wrap the inline-labelled scope below the heading when
  needed; never render a second selector or a second page title.
- Add Staff uses paired equal-width account inputs. Contact verification is
  associated helper text below the field, not a flex sibling that reduces one
  input's width. The complete country/number control follows the left account
  column's edges (full width after one-column reflow).
- Assignment value rows share the existing 40px/44px field family. Long fixed
  names and selected chips may grow vertically; do not hide them to force equal
  heights. Single-value role/country controls must not gain extra height from
  touch clear-button padding.
- Staff Type has an inline accessible label and aligns the actual control with
  the compact search/actions family. Its toolbar wraps rather than shrinking
  search to an unusable width. Staff-table status has an intrinsic column floor;
  Actions scrolls with this table instead of covering neighbouring status text.
- Switch track remains 36×20px with a 16px thumb in both positions. Its transparent
  44px target must not collide with neighboring actions. Check/radio remain 18px
  with associated labels. Textareas, multiline selects and chip controls grow.
- Give number/time/OTP controls content-appropriate width; phone country+number
  is one compound field. Long selections, labels, helpers and errors must wrap.
- Use 4/8/12/16/24px spacing tokens; compact headers/cards/actions should not add
  redundant blank rows. Preserve critical warnings. Filters overlay or use the
  existing drawer, never push a listing down.
- Check 390×844, 768px tablet, 1024×640, 1366×768, wide desktop and 200% zoom.
  Assert child/text bounds, not just page overflow. Check sticky footer overlap,
  popup edges, long labels, keyboard scrolling and short-height dialogs.

## State checklist (mark N/A with reason, never silently skip)
| Family | Required applicable states |
|---|---|
| Input/email/password/number/OTP/date/time/phone/address | Empty, populated, placeholder, autofill, hover, focus-visible, invalid+focused, read-only, disabled, secret reveal |
| Native/searchable/multi select | Selected, long/clipped and unclipped, open, keyboard, clear, loading, no-results, failed-load/retry, disabled saved label, chip growth |
| Checkbox/radio/switch | Unchecked, checked, indeterminate where supported, disabled, keyboard, focus, touch |
| Upload | Empty, chosen long filename, progress, failure/retry, completion, remove |
| Form/tabs/nested editor | Multiple short/long errors, hidden-tab correction, dirty/discard, busy/submitting, failure, success |
| Navigation/sidebar/menu | Full/collapsed desktop, mobile, long label, current, selected, expanded/collapsed, hover, pressed, disabled, focus-visible |
| Links/breadcrumb/pagination | Recognizable, focus, current/visited where applicable, browser Back, external destination behavior |
| Dialog/drawer/popover | Anchoring/edge clamp, internal scroll, focus trap/return, Escape, touch outside, busy/dirty protection |

## Feedback
- Reuse semantic error/warning/success/info foreground, background and border
  tokens from `compact-ui.css`. Normal text contrast must meet 4.5:1.
  Errors use 13px/1.5 readable type, compact 8×12px card padding and 4px field gap.
- Message text must identify the correction or state, not color alone. Preserve
  existing accessible error associations and status/alert announcements. Do not
  make required corrections or consequential warnings tooltip-only or toast-only.
- Keep invalid borders visible together with the blue focus outline; no geometry
  change for invalid, hover, disabled or focused state. Icons are 16px and do not
  shrink. Test long unbroken values and simultaneous errors.

## Help, overlays and hover
- Explanatory help/full-value reveals share 13px/1.5 navy high-contrast styling,
  8×12px padding, 8px radius, bounded width and viewport-safe stacking.
  Interactive light popovers/hover cards remain visually distinct.
- Full-value reveals require measured clipping. All tooltip implementations
  participate in shared dismissal; never show competing bubbles.
- Check hover, keyboard focus, Escape, pointer travel onto content, real touch
  toggle/outside dismissal and **settled no-reopen** after compatibility events.
- Hover never changes border width, weight or layout. Current/selected stays
  distinct from pressed; noninteractive content must not gain a pointer cursor.
  Keyboard/touch must expose every essential action. Respect reduced motion.

## Completion gate
- Run inventory freshness, frontend typecheck/build and relevant family suites.
- Use real application CSS **including form-standard.css and compact-ui.css**;
  fixture compiler must scan application sources for utilities.
- Save representative screenshots and computed geometry/state results. Identify
  fictional role fixtures versus authenticated identity evidence. Assert mapped
  role/scope before making role-specific claims.
- Update the coverage matrix with actual commands/results. Report untested paths,
  don't mark them complete. UI work is not accepted on typecheck alone.
- No production/UAT writes, live messages, exported PDF/table redesign or owner
  booking recovery rebuild is authorized by this checklist.

## Justified exceptions
- Public hero artwork and reception display typography are presentation surfaces,
  not fields; preserve their content-appropriate scale.
- Check/radio/switch track geometry is deliberately smaller than touch targets.
- Multiline controls, chips, file names and error/help text grow rather than clip.
- Existing calendar cells and time-list rows retain their dedicated picker sizing;
  verify them as a family instead of forcing ordinary input height onto them.
- Ticket/export/PDF and project-deck/canvas styling is outside this checklist's
  current remediation scope; don't modify print geometry through global selectors.
