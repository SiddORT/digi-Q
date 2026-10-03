import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchableSelect } from "./SearchableSelect";
import { AppDialog } from "./AppDialog";

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
}

export function Pagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  total,
  onPageChange,
  onPageSizeChange,
  resetPageOnSizeChange = true,
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
          Showing <strong className="text-foreground font-medium">{startRecord}–{endRecord}</strong> of{" "}
          <strong className="text-foreground font-medium">{total}</strong>
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <SearchableSelect
              id={sizeId}
               label="Rows per page"
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

// --- FilterBar ---

export interface FilterChip {
  key: string;
  label: string;
  onRemove?: () => void;
}

export interface FilterBarProps {
  /** Primary controls. Always visible inline (search, required queue/booking scope). Never hidden. */
  children?: React.ReactNode;
  /** Secondary controls, shown in a compact popup opened from the filter icon. */
  advanced?: React.ReactNode;
  onReset?: () => void;
  active?: boolean;
  /** Active filter chips shown under the toolbar (only rendered when present). */
  chips?: FilterChip[];
  /** Kept for API compatibility; the panel never auto-opens on state changes. */
  defaultAdvancedOpen?: boolean;
  /** Optional trailing actions (e.g. export, add). Aligned on the same row. */
  actions?: React.ReactNode;
  label?: string;
  onOpen?: () => void;
  onApply?: () => void;
  /** Compact toolbar title (left). Typically the record type and result count. */
  title?: React.ReactNode;
  /** Status filter (Active / Inactive / All), placed on the toolbar row before search. */
  status?: React.ReactNode;
}

export function FilterBar({ children, advanced, onReset, active, chips = [], defaultAdvancedOpen, actions, label = "Filters", onOpen, onApply, title, status }: FilterBarProps) {
  const advancedActiveCount = chips.filter(c => c.key.startsWith("adv:")).length;
  const [open, setOpen] = useState(!!defaultAdvancedOpen);
  const panelId = React.useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeFilters = () => {
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  };

  return (
    <section className="filter-bar" aria-label={label}>
      <div className={cn("filter-bar-row", (title || status) && "has-title")}>
        {title && <div className="filter-bar-title" data-testid="text-listing-title">{title}</div>}
        {status && <div className="filter-bar-status">{status}</div>}
        {children && <div className="filter-bar-primary">{children}</div>}
        <div className="filter-bar-tools">
          {advanced && (
            <div className="filter-pop">
              <button type="button" ref={toggleRef} className={cn("filter-toggle", advancedActiveCount > 0 && "has-active")}
                aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog"
                aria-label={`${label}${advancedActiveCount ? `, ${advancedActiveCount} active` : ""}`}
                onClick={() => { if (!open) onOpen?.(); setOpen(v => !v); }} data-testid="button-toggle-advanced-filters">
                <Filter aria-hidden className="h-4 w-4" />
                <span className="filter-toggle-text">Filters</span>
                {advancedActiveCount > 0 && <span className="filter-count" aria-hidden>{advancedActiveCount}</span>}
              </button>
              <AppDialog open={open} onClose={closeFilters} title={label} variant="drawer">
                <div id={panelId} className="filter-drawer-content">
                  <div className="filter-panel-fields">{advanced}</div>
                  <div className="filter-panel-foot">
                    {onReset && <button type="button" className="filter-clear" onClick={() => { onReset(); closeFilters(); }} disabled={!active && !onApply} data-testid="button-clear-filters-panel">Reset</button>}
                    <button type="button" className="filter-done" onClick={() => { onApply?.(); closeFilters(); }} data-testid="button-close-filters">{onApply ? "Apply filters" : "Done"}</button>
                  </div>
                </div>
              </AppDialog>
            </div>
          )}
          {onReset && active && (
            <button type="button" className="filter-clear" onClick={onReset} data-testid="button-clear-filters">
              <X aria-hidden className="h-3.5 w-3.5" />Clear
            </button>
          )}
          {actions}
        </div>
      </div>
      {chips.length > 0 && (
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
      )}
    </section>
  );
}
