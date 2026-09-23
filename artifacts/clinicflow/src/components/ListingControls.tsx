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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 text-sm text-muted-foreground border-t border-border mt-4">
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
          className="h-[43px] w-full rounded-lg border border-border bg-white pl-10 pr-9 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
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

export interface FilterBarProps {
  children: React.ReactNode;
  onReset?: () => void;
  active?: boolean;
}

export function FilterBar({ children, onReset, active }: FilterBarProps) {
  return (
    <div className="bg-slate-50 border border-border rounded-xl p-4 sm:p-5 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground border-b border-border/60 pb-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        Filters
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end gap-4 [&>*]:min-w-0">
        {children}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={!active}
            className="h-[43px] px-4 text-sm font-medium border border-border rounded-lg bg-white text-foreground hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors justify-self-start shadow-sm"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
