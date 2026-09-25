import React, { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

// Export useDebouncedValue directly from here for convenience as requested
export { useDebouncedValue };

// --- Pagination ---

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  page,
  pageSize = 20,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(1, Math.min(page, totalPages));

  // Determine the range of items being shown
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, total);

  const getPageNumbers = () => {
    const delta = 2;
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2.5 px-3 text-sm text-muted-foreground border-t border-border">
      <div className="flex items-center gap-4">
        <span>
          Showing <strong className="text-foreground font-medium">{startRecord}–{endRecord}</strong> of{" "}
          <strong className="text-foreground font-medium">{total}</strong>
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // Reset to page 1 on size change
              }}
              className="h-8 w-auto rounded-md border border-border bg-white px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-foreground"
              style={{ minHeight: "auto", margin: 0, paddingRight: "28px" }}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
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

        <div className="hidden md:flex items-center gap-1 mx-2">
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
    </div>
  );
}

// --- SearchInput ---

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchInput({ value, onChange, placeholder = "Search...", label }: SearchInputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full md:max-w-sm">
      {label && <label className="text-sm font-semibold text-foreground">{label}</label>}
      <div className="relative flex items-center group">
        <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-[38px] w-full rounded-lg border border-border bg-white pl-10 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
          style={{ margin: 0 }}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground border-none bg-transparent hover:bg-slate-100 rounded-md transition-colors"
            style={{ minHeight: "auto", padding: 0 }}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- FilterBar ---

export interface FilterChip {
  key: string;
  label: string;
  onRemove?: () => void;
}

export interface FilterBarProps {
  /** Primary controls. Always visible (required selections such as queue/booking context belong here). */
  children?: React.ReactNode;
  /** Secondary controls, collapsed behind an "More filters" toggle. */
  advanced?: React.ReactNode;
  onReset?: () => void;
  active?: boolean;
  /** Active filter chips shown under the toolbar. */
  chips?: FilterChip[];
  defaultAdvancedOpen?: boolean;
  /** Optional trailing actions (e.g. export). */
  actions?: React.ReactNode;
  label?: string;
}

export function FilterBar({ children, advanced, onReset, active, chips = [], defaultAdvancedOpen, actions, label = "Filters" }: FilterBarProps) {
  const advancedActiveCount = chips.filter(c => c.key.startsWith("adv:")).length;
  const [open, setOpen] = useState(!!defaultAdvancedOpen);
  const panelId = React.useId();
  useEffect(() => { if (advancedActiveCount > 0 && defaultAdvancedOpen) setOpen(true); }, [advancedActiveCount, defaultAdvancedOpen]);
  return (
    <section className="filter-bar" aria-label={label}>
      <div className="filter-bar-row">
        <span className="filter-bar-title"><Filter aria-hidden className="h-3.5 w-3.5" />{label}</span>
        {children && <div className="filter-bar-primary">{children}</div>}
        <div className="filter-bar-tools">
          {advanced && (
            <button type="button" className="filter-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)} data-testid="button-toggle-advanced-filters">
              {open ? "Fewer filters" : "More filters"}
              {advancedActiveCount > 0 && <span className="filter-count" aria-label={`${advancedActiveCount} active`}>{advancedActiveCount}</span>}
            </button>
          )}
          {actions}
          {onReset && (
            <button type="button" className="filter-clear" onClick={onReset} disabled={!active} data-testid="button-clear-filters">
              Clear filters
            </button>
          )}
        </div>
      </div>
      {advanced && open && <div id={panelId} className="filter-bar-advanced">{advanced}</div>}
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
