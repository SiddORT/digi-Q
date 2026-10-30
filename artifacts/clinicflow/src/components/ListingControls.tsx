import React, { useState, useRef, useEffect } from "react";
import { APPROVED_PAGE_SIZES, sanitizePageSize, usePageSizePreference } from "../lib/page-size-preference";
import { notifyWarning } from "../lib/notify";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchableSelect } from "./SearchableSelect";
import { AppDialog } from "./AppDialog";
import { ResponsiveActionGroup } from "./ResponsiveActionGroup";
import { HelpTip } from "./HelpTip";
import { LookupReadiness } from "./LookupReadiness";
import "./clinic-listing-toolbar.css";
import { usePageTitleOwnership } from "./PageTitleContext";
export { ListPageTitleContext } from "./PageTitleContext";
export type { ListPageTitle } from "./PageTitleContext";
export { ListingRegion } from "./ListingRegion";
export { PageHeader } from "./PageHeader";

// Export useDebouncedValue directly from here for convenience as requested
export { useDebouncedValue };

// --- Pagination ---

/** Approved sizes 10/25/50/100 (spec §3). 20 is retained as the existing default page size. */
export const PAGE_SIZE_OPTIONS = APPROVED_PAGE_SIZES;
export const DEFAULT_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
/** Options always include the current size so a persisted/URL value never disappears. */
export function pageSizeOptions(current: number): number[] {
  return Array.from(new Set<number>([...PAGE_SIZE_OPTIONS, current])).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  /** Set false when the size callback already resets the page in URL state. */
  resetPageOnSizeChange?: boolean;
  /** Optional, default false: omit "of {total}" when the list heading already shows the total. Range and page controls stay. */
  hideTotal?: boolean;
  /** Schedule lists keep range/size but omit navigation when it has no purpose. */
  hideSinglePageNavigation?: boolean;
  state?: "ready" | "loading" | "error";
}

export function Pagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  onPageSizeChange,
  resetPageOnSizeChange = true,
  hideTotal = false,
  hideSinglePageNavigation = false,
  state = "ready",
}: PaginationProps) {
  const sizeId = React.useId();
  const preference = usePageSizePreference();
  const unavailable = state !== "ready";
  total = unavailable ? 0 : Math.max(0, total);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));

  // Determine the range of items being shown
  const startRecord = total ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(currentPage * pageSize, total);

  const getPageNumbers = () => {
    const delta = 1;
    const range = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) range.unshift("...");
    if (currentPage + delta < totalPages - 1) range.push("...");

    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);

    return range;
  };

  return (
    <nav aria-label="Pagination" aria-busy={state === "loading"} className="pagination flex flex-wrap items-center justify-between gap-2 py-2 px-3 text-xs text-muted-foreground border-t border-border">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {unavailable ? state === "loading" ? "Loading results…" : "Results unavailable" : <>Showing <strong className="text-foreground font-medium">{startRecord}–{endRecord}</strong>{!hideTotal && <> of{" "}
          <strong className="text-foreground font-medium">{total}</strong></>}</>}
        </span>
        {onPageSizeChange && (
          <fieldset disabled={unavailable} className="pagination-size flex items-center gap-2">
            <SearchableSelect
              id={sizeId}
               label="Rows per Page"
               value={String(pageSize)}
               onChange={(value) => {
                 if (!value) return;
                 onPageSizeChange(Number(value));
                 if (preference.size !== null && sanitizePageSize(Number(value)) !== null && !preference.save(Number(value))) {
                   notifyWarning("Rows per page changed for this list, but your browser could not remember it.");
                 }
                if (resetPageOnSizeChange) onPageChange(1);
              }}
               options={pageSizeOptions(pageSize).map((size) => ({ value: String(size), label: String(size) }))}
             />
          </fieldset>
        )}
      </div>

      {(!hideSinglePageNavigation || totalPages > 1) && <div className="flex items-center gap-1">
        <span className="pagination-current" aria-live="polite">{unavailable ? "Page unavailable" : `Page ${total ? currentPage : 0} of ${total ? totalPages : 0}`}</span>
        <button
          onClick={() => onPageChange(1)}
          disabled={unavailable || !total || currentPage === 1}
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors"
          aria-label="First page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={unavailable || !total || currentPage === 1}
          className="h-8 px-2 flex items-center justify-center gap-1 rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors font-medium"
          aria-label="Previous page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline-block pr-1 text-xs">Previous</span>
        </button>

        <div className="hidden lg:flex items-center gap-1 mx-1">
          {getPageNumbers().map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <button
                key={p}
                disabled={unavailable || !total}
                onClick={() => onPageChange(p as number)}
                aria-current={currentPage === p ? "page" : undefined}
                className={cn(
                  "h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors border-none",
                  currentPage === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-transparent text-foreground hover:bg-slate-100"
                )}
                style={{ minHeight: "auto", margin: 0 }}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={unavailable || !total || currentPage === totalPages}
          className="h-8 px-2 flex items-center justify-center gap-1 rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors font-medium"
          aria-label="Next page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <span className="hidden sm:inline-block pl-1 text-xs">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={unavailable || !total || currentPage === totalPages}
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors"
          aria-label="Last page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>}
    </nav>
  );
}

// --- SearchInput ---
// The live-search primitive lives in LiveSearchInput.tsx; re-exported so every
// listing keeps importing from ListingControls.
export { SearchInput } from "./LiveSearchInput";
export type { SearchInputProps } from "./LiveSearchInput";

export interface ListingSuggestion { id: string; label: string; description?: string; value: string }
/** Map the rows of the current, already-scoped listing query into search suggestions.
 *  Rows without a backend-searchable value (name/reference) are skipped. */
export function listingSuggestions<T>(rows: readonly T[] | undefined | null, map: (row: T) => ListingSuggestion | null | undefined, limit = 8): ListingSuggestion[] {
  const out: ListingSuggestion[] = [];
  for (const row of rows || []) {
    const item = map(row);
    if (item && item.value) out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

// --- Page title ownership ---
/** The workspace shell provides the page title; the first mounted list header renders it as the page <h1>
 *  on row 1 (beside search and actions) so listing pages do not repeat a separate heading row. */

// --- FilterBar ---

/** Summary line for a drawer whose fields failed constraint validation. Exported for tests. */
export function drawerValidationMessage(form: { querySelectorAll: (s: string) => ArrayLike<unknown> }): string {
  const n = form.querySelectorAll(":invalid:not(form)").length;
  return n > 1 ? `Correct the ${n} highlighted filters before applying.` : "Correct the highlighted filter before applying.";
}

export interface FilterChip {
  key: string;
  label: string;
  onRemove?: () => void;
  /** Opt-in: open the drawer and focus this field/section selector. */
  drawerTarget?: string;
}

export interface FilterBarProps {
  /** @deprecated All headers use the same horizontal composition. Ignored. */
  compactToolbar?: boolean;
  /** Primary controls (search first). Rendered on the header's first row beside the title. Never hidden. */
  children?: React.ReactNode;
  /** Secondary controls, shown in a right-side drawer opened from the Filters button. */
  advanced?: React.ReactNode;
  onReset?: () => void;
  active?: boolean;
  /** Active filter chips shown under the header (only rendered when present). */
  chips?: FilterChip[];
  /** Kept for API compatibility; the panel never auto-opens on state changes. */
  defaultAdvancedOpen?: boolean;
  /** Right side of the shared header: primary Add/Book action. */
  actions?: React.ReactNode;
  /** Existing Export, Columns, Saved Views and Recovery controls, beside primary actions. */
  secondary?: React.ReactNode;
  label?: string;
  onOpen?: () => void;
  /** Return false to keep the drawer open (e.g. caller-side validation failed). */
  onApply?: () => boolean | void;
  /** Optional draft-only reset/cancel for transactional filter drawers. */
  onResetDraft?: () => void;
  onCancel?: () => void;
  /** Header title (left of the search). Typically the record type and result count. */
  title?: React.ReactNode;
  /** Status tabs on the second row. */
  status?: React.ReactNode;
  /** Inline scope/range, sort, last-updated and help controls, aligned with Filters. */
  meta?: React.ReactNode;
  /** Explicit drawer active-filter count when chips do not use the "adv:" key prefix. */
  activeCount?: number;
  /** Common filters exposed under the search row (e.g. date range and status as independent controls). */
  filters?: React.ReactNode;
  /** Reports opt-in: one horizontally scrollable line of editable pills. */
  compactChips?: boolean;
  /** Opt-in drill-down controls may open the same transactional drawer. */
  drawerRequest?: { key: number; target?: string };
}

/** Shared list header. Title, search, tools/export and primary actions always
 * share one flex composition. Optional quick filters/status and chips follow. */
function useCompactFilters() {
  const query = "(max-width: 767px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => { const m = window.matchMedia?.(query); if (!m) return; const on = () => setMatch(m.matches); on(); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);
  return match;
}
export function FilterBar({ children, advanced, onReset, onResetDraft, onCancel, active, chips = [], defaultAdvancedOpen, actions, secondary, label = "Filters", onOpen, onApply, title, status, meta, activeCount, filters, compactChips, drawerRequest }: FilterBarProps) {
  const advancedActiveCount = activeCount ?? chips.filter(c => c.key.startsWith("adv:")).length;
  const [open, setOpen] = useState(!!defaultAdvancedOpen);
  const panelId = React.useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pillOpener = useRef<HTMLButtonElement | null>(null);
  const openFilters = (target?: string, opener?: HTMLButtonElement) => {
    pillOpener.current = opener || null;
    onOpen?.(); setInvalidMessage(""); setOpen(true);
    if (target) requestAnimationFrame(() => {
      const section = formRef.current?.querySelector<HTMLElement>(target);
      const field = section?.matches("input,select,button") ? section : section?.querySelector<HTMLElement>("input:not([disabled]),select:not([disabled]),button:not([disabled])");
      field?.focus();
      section?.scrollIntoView({ block: "nearest" });
    });
  };
  const closeFilters = (cancel = true) => {
    if (cancel) onCancel?.();
    setOpen(false);
    requestAnimationFrame(() => (pillOpener.current || toggleRef.current)?.focus());
  };
  const formRef = useRef<HTMLFormElement>(null);
  const [invalidMessage, setInvalidMessage] = useState("");
  useEffect(() => {
    if (drawerRequest?.key) openFilters(drawerRequest.target);
  }, [drawerRequest?.key]);
  const [draftResetKey, setDraftResetKey] = useState(0);
  /** Apply is gated on the drawer form's constraint validity (DateFormatInput sets custom validity for
   *  malformed, out-of-range or inverted dates) and on the caller's own validation result. */
  const apply = () => {
    const form = formRef.current;
    if (form && !form.checkValidity()) {
      setInvalidMessage(drawerValidationMessage(form));
      form.querySelector<HTMLElement>(":invalid")?.focus();
      return;
    }
    if (onApply?.() === false) { setInvalidMessage("Correct the highlighted filters before applying."); return; }
    setInvalidMessage("");
    closeFilters(false);
  };
  const pageTitle = usePageTitleOwnership();
  // Phones: common filters collapse behind a one-line summary instead of stacking full-width controls forever.
  const compactFilters = useCompactFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = React.useId();
  const showClear = !!(onReset && active && chips.length === 0);
  // With a page title on row 1, the record count becomes secondary row-2 metadata (no duplicate heading).
  // Filters/Clear never sit alone on an otherwise empty second row: without status tabs or a
  // secondary count they join the search row.
   const hasSubRow = !!(status || filters);

   const filterTrigger = <button type="button" ref={toggleRef} className={cn("filter-toggle", "listing-icon-trigger", advancedActiveCount > 0 && "has-active")}
     aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
     aria-label={`${label}${advancedActiveCount ? `, ${advancedActiveCount} active` : ""}`}
      onClick={() => { if (open) closeFilters(); else openFilters(); }} data-testid="button-toggle-advanced-filters">
     <Filter aria-hidden className="h-4 w-4" />
     {advancedActiveCount > 0 && <span className="filter-count" aria-hidden>{advancedActiveCount}</span>}
   </button>;
   const subtitle = pageTitle?.subtitle;
   const titledHeading = React.isValidElement<{children?:React.ReactNode}>(title) && typeof title.type === "string" && /^h[1-6]$/.test(title.type) ? title.props.children : null;
   const titleId = React.isValidElement<{id?:string}>(title) ? title.props.id : undefined;
   const heading = pageTitle ? <div className="lh-page-title">{pageTitle.eyebrow && <span className="eyebrow">{pageTitle.eyebrow}</span>}<h1 id={titleId} data-testid="text-page-title">{titledHeading || pageTitle.title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
     : title && <div className="filter-bar-title lh-title" data-testid="text-listing-title">{title}</div>;
   const primaryActions = actions && <div className="lh-actions" data-testid="list-header-actions"><ResponsiveActionGroup>{actions}</ResponsiveActionGroup></div>;
   const tools = (
    <div className="filter-bar-tools lh-tools">
            {meta && <div className="lh-meta">{meta}</div>}
            {advanced && (
              <div className="filter-pop">
                  <HelpTip text={`${label}. Open the drawer to choose and apply filters${advancedActiveCount ? `; ${advancedActiveCount} active` : ""}.`}>{filterTrigger}</HelpTip>
                  <AppDialog open={open} onClose={() => closeFilters()} title={label} variant="drawer">
                  <form id={panelId} ref={formRef} className="filter-drawer-content" noValidate data-testid="form-filter-drawer"
                    onSubmit={e => e.preventDefault()}>
                    {invalidMessage && <p role="alert" className="field-error filter-drawer-error" data-testid="text-filter-drawer-error">{invalidMessage}</p>}
                    <div className="filter-panel-fields" key={draftResetKey}>{advanced}</div>
                    <div className="filter-panel-foot">
                      {onReset && <button type="button" className="filter-clear" onClick={() => { if (onResetDraft) onResetDraft(); else { onReset(); closeFilters(false); } setDraftResetKey(v => v + 1); setInvalidMessage(""); }} disabled={!active && !onApply} data-testid="button-clear-filters-panel">Reset</button>}
                      {onCancel && <button type="button" className="filter-clear" onClick={() => closeFilters()} data-testid="button-cancel-filters">Cancel</button>}
                      <button type="button" className="filter-done" onClick={apply} data-testid="button-close-filters">{onApply ? "Apply filters" : "Done"}</button>
                    </div>
                  </form>
                </AppDialog>
              </div>
            )}
            {showClear && (
              <button type="button" className="filter-clear" onClick={onReset} data-testid="button-clear-filters">
                <X aria-hidden className="h-3.5 w-3.5" />Clear
              </button>
            )}
          </div>
  );
  // One shared header: title, search, tools/export and primary actions. Existing
  // quick filters/status and active chips remain optional secondary controls.
  return (
      <section className="filter-bar list-header list-header--compact" aria-label={label} data-testid="list-header">
       {!open && advanced && <LookupReadiness>{advanced}</LookupReadiness>}
      <div className="filter-bar-row lh-row lh-top lh-search-row" data-testid="list-header-search-row">
          {heading}
        {children && <div className="filter-bar-primary lh-search">{children}</div>}
         {!!(meta || advanced || showClear) && tools}
          {secondary && <div className="lh-table-tools" data-testid="list-header-table-tools">{secondary}</div>}
          {primaryActions}
      </div>
        {hasSubRow && (
        <div className="lh-row lh-sub" data-testid="list-header-subrow">
          {filters && compactFilters && <button type="button" className="lh-filters-summary" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen(v => !v)} data-testid="button-toggle-quick-filters"><Filter aria-hidden className="h-4 w-4" /><span>Quick filters</span>{advancedActiveCount > 0 && <span className="filter-count" aria-label={`${advancedActiveCount} active`}>{advancedActiveCount}</span>}<span className="lh-filters-summary-hint">{filtersOpen ? "Hide" : "Show"}</span></button>}
          {filters && <div id={filtersId} className="lh-filters" role="group" aria-label="Common filters" data-testid="list-header-filters" hidden={compactFilters && !filtersOpen}>{filters}</div>}
          {status && <div className="filter-bar-status lh-status">{status}</div>}
        </div>
      )}
      {chips.length > 0 && (
        <div className={cn("lh-chips-row", compactChips && "lh-chips-row--compact")}>
          <ul className="filter-chips" aria-label="Active filters">
            {chips.map(chip => (
              <li key={chip.key}>
                {chip.drawerTarget && advanced ? <button type="button" className="filter-chip-edit" aria-label={`Edit filter ${chip.label}`} aria-haspopup="dialog" onClick={e => openFilters(chip.drawerTarget, e.currentTarget)}>{chip.label}</button> : <span>{chip.label}</span>}
                {chip.onRemove && (
                  <button type="button" onClick={chip.onRemove} aria-label={`Remove filter ${chip.label}`} data-testid={`chip-remove-${chip.key}`}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {onReset && <button type="button" className="filter-clear lh-clear-all" onClick={onReset} data-testid="button-clear-all-filters">Clear All</button>}
        </div>
      )}
    </section>
  );
}
