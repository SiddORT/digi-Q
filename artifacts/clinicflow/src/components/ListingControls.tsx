import React, { useState, useRef, useEffect, createContext, useContext } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchableSelect } from "./SearchableSelect";
import { AppDialog } from "./AppDialog";
import { ResponsiveActionGroup } from "./ResponsiveActionGroup";

// Export useDebouncedValue directly from here for convenience as requested
export { useDebouncedValue };

// --- Pagination ---

/** Approved sizes 10/25/50/100 (spec §3). 20 is retained as the existing default page size. */
export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100] as const;
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
}

export function Pagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  onPageSizeChange,
  resetPageOnSizeChange = true,
  hideTotal = false,
}: PaginationProps) {
  const sizeId = React.useId();
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));

  // Determine the range of items being shown
  const startRecord = (currentPage - 1) * pageSize + 1;
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
    <nav aria-label="Pagination" className="pagination flex flex-wrap items-center justify-between gap-2 py-2 px-3 text-xs text-muted-foreground border-t border-border">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Showing <strong className="text-foreground font-medium">{startRecord}–{endRecord}</strong>{!hideTotal && <> of{" "}
          <strong className="text-foreground font-medium">{total}</strong></>}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <SearchableSelect
              id={sizeId}
               label="Rows per Page"
               value={String(pageSize)}
               onChange={(value) => {
                 if (!value) return;
                 onPageSizeChange(Number(value));
                if (resetPageOnSizeChange) onPageChange(1);
              }}
               options={pageSizeOptions(pageSize).map((size) => ({ value: String(size), label: String(size) }))}
             />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="pagination-current" aria-live="polite">Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors"
          aria-label="First page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
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
          disabled={currentPage === totalPages}
          className="h-8 px-2 flex items-center justify-center gap-1 rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors font-medium"
          aria-label="Next page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <span className="hidden sm:inline-block pl-1 text-xs">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-foreground transition-colors"
          aria-label="Last page"
          style={{ minHeight: "auto", margin: 0 }}
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
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
export interface ListPageTitle { title: React.ReactNode; eyebrow?: React.ReactNode; owner: React.MutableRefObject<string | null> }
export const ListPageTitleContext = createContext<ListPageTitle | null>(null);
function usePageTitleOwnership() {
  const ctx = useContext(ListPageTitleContext);
  const id = React.useId();
  if (ctx && !ctx.owner.current) ctx.owner.current = id;
  const owns = !!ctx && ctx.owner.current === id;
  useEffect(() => () => { if (ctx && ctx.owner.current === id) ctx.owner.current = null; }, [ctx, id]);
  return owns ? ctx : null;
}

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
}

export interface FilterBarProps {
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
  /** Header actions on the first row, right side: Export / secondary actions then the primary Add/Book action. */
  actions?: React.ReactNode;
  /** Secondary actions (Export, Columns, Saved Views, Recovery). Inline at 1280px+, behind "More" from 901px to 1279px. */
  secondary?: React.ReactNode;
  label?: string;
  onOpen?: () => void;
  /** Return false to keep the drawer open (e.g. caller-side validation failed). */
  onApply?: () => boolean | void;
  /** Header title (left of the search). Typically the record type and result count. */
  title?: React.ReactNode;
  /** Status tabs on the second row. */
  status?: React.ReactNode;
  /** Second-row scope/range, sort, last-updated and help controls, aligned with Filters. */
  meta?: React.ReactNode;
  /** Explicit drawer active-filter count when chips do not use the "adv:" key prefix. */
  activeCount?: number;
  /** Common filters exposed under the search row (e.g. date range and status as independent controls). */
  filters?: React.ReactNode;
}

/** Shared list header. Row 1: title, wide search, actions. Row 2 (only when needed): status tabs, scope/meta, Filters/Clear.
 *  Row 1 is always rendered first and in the same position so the search input never remounts while typing. */
function useCompactFilters() {
  const query = "(max-width: 767px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => { const m = window.matchMedia?.(query); if (!m) return; const on = () => setMatch(m.matches); on(); m.addEventListener("change", on); return () => m.removeEventListener("change", on); }, []);
  return match;
}
export function FilterBar({ children, advanced, onReset, active, chips = [], defaultAdvancedOpen, actions, secondary, label = "Filters", onOpen, onApply, title, status, meta, activeCount, filters }: FilterBarProps) {
  const advancedActiveCount = activeCount ?? chips.filter(c => c.key.startsWith("adv:")).length;
  const [open, setOpen] = useState(!!defaultAdvancedOpen);
  const panelId = React.useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeFilters = () => {
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  };
  const formRef = useRef<HTMLFormElement>(null);
  const [invalidMessage, setInvalidMessage] = useState("");
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
    closeFilters();
  };
  const pageTitle = usePageTitleOwnership();
  // Phones: common filters collapse behind a one-line summary instead of stacking full-width controls forever.
  const compactFilters = useCompactFilters();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = React.useId();
  const showClear = !!(onReset && active && chips.length === 0);
  // With a page title on row 1, the record count becomes secondary row-2 metadata (no duplicate heading).
  const countInSub = !!(pageTitle && title);
  // Filters/Clear never sit alone on an otherwise empty second row: without status tabs or a
  // secondary count they join the search row.
  const toolsInline = !status && !countInSub;
  const hasSubRow = !toolsInline && !!(status || meta || advanced || showClear || countInSub);

  const tools = (
    <div className="filter-bar-tools lh-tools">
            {meta && <div className="lh-meta">{meta}</div>}
            {advanced && (
              <div className="filter-pop">
                <button type="button" ref={toggleRef} className={cn("filter-toggle", advancedActiveCount > 0 && "has-active")}
                  aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
                  aria-label={`${label}${advancedActiveCount ? `, ${advancedActiveCount} active` : ""}`}
                  onClick={() => { if (!open) { onOpen?.(); setInvalidMessage(""); } setOpen(v => !v); }} data-testid="button-toggle-advanced-filters">
                  <Filter aria-hidden className="h-4 w-4" />
                  <span className="filter-toggle-text">Filters</span>
                  {advancedActiveCount > 0 && <span className="filter-count" aria-hidden>{advancedActiveCount}</span>}
                </button>
                <AppDialog open={open} onClose={closeFilters} title={label} variant="drawer">
                  <form id={panelId} ref={formRef} className="filter-drawer-content" noValidate data-testid="form-filter-drawer"
                    onSubmit={e => e.preventDefault()}>
                    {invalidMessage && <p role="alert" className="field-error filter-drawer-error" data-testid="text-filter-drawer-error">{invalidMessage}</p>}
                    <div className="filter-panel-fields">{advanced}</div>
                    <div className="filter-panel-foot">
                      {onReset && <button type="button" className="filter-clear" onClick={() => { onReset(); setInvalidMessage(""); closeFilters(); }} disabled={!active && !onApply} data-testid="button-clear-filters-panel">Reset</button>}
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
  // Layout order: 1) header (title + primary action), 2) wide search + filter/table tools, 3) exposed common filters
  // and status tabs, 4) active filter chips with one Clear All. The search row never remounts while typing.
  return (
    <section className="filter-bar list-header" aria-label={label} data-testid="list-header">
      {(pageTitle || title || actions) && <div className={cn("filter-bar-row lh-row lh-top lh-head", (title || status) && "has-title")}>
        {pageTitle ? <div className="lh-page-title">{pageTitle.eyebrow && <span className="eyebrow">{pageTitle.eyebrow}</span>}<h1 data-testid="text-page-title">{pageTitle.title}</h1></div>
          : title && <div className="filter-bar-title lh-title" data-testid="text-listing-title">{title}</div>}
        {actions && <div className="lh-actions" data-testid="list-header-actions"><ResponsiveActionGroup>{actions}</ResponsiveActionGroup></div>}
      </div>}
      <div className="filter-bar-row lh-row lh-top lh-search-row" data-testid="list-header-search-row">
        {children && <div className="filter-bar-primary lh-search">{children}</div>}
        {toolsInline && !!(meta || advanced || showClear) && tools}
        {secondary && <div className="lh-table-tools" data-testid="list-header-table-tools"><ResponsiveActionGroup secondary={secondary} label="Table Tools" /></div>}
      </div>
      {(hasSubRow || filters) && (
        <div className="lh-row lh-sub" data-testid="list-header-subrow">
          {countInSub && <div className="filter-bar-title lh-count" data-testid="text-listing-title">{title}</div>}
          {filters && compactFilters && <button type="button" className="lh-filters-summary" aria-expanded={filtersOpen} aria-controls={filtersId} onClick={() => setFiltersOpen(v => !v)} data-testid="button-toggle-quick-filters"><Filter aria-hidden className="h-4 w-4" /><span>Quick filters</span>{advancedActiveCount > 0 && <span className="filter-count" aria-label={`${advancedActiveCount} active`}>{advancedActiveCount}</span>}<span className="lh-filters-summary-hint">{filtersOpen ? "Hide" : "Show"}</span></button>}
          {filters && <div id={filtersId} className="lh-filters" role="group" aria-label="Common filters" data-testid="list-header-filters" hidden={compactFilters && !filtersOpen}>{filters}</div>}
          {status && <div className="filter-bar-status lh-status">{status}</div>}
          {hasSubRow && tools}
        </div>
      )}
      {chips.length > 0 && (
        <div className="lh-chips-row">
          <ul className="filter-chips" aria-label="Active filters">
            {chips.map(chip => (
              <li key={chip.key}>
                <span>{chip.label}</span>
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
