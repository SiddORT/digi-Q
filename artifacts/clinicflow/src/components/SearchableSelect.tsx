import React, { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectProps extends Pick<React.AriaAttributes, "aria-describedby" | "aria-invalid" | "aria-required" | "aria-labelledby"> {
  options: { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  onSearchChange?: (search: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  required?: boolean;
  /** Shown as a Retry action in the error state; the selected value is kept. */
  onRetry?: () => void;
  id?: string;
  /** Test id applied to the trigger button. */
  testId?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  label,
  disabled = false,
  loading = false,
  error,
  onSearchChange,
  onLoadMore,
  hasMore = false,
  required = false,
  onRetry,
  id,
  testId,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-required": ariaRequired,
  "aria-labelledby": labelledBy,
}: SearchableSelectProps) {
  const generatedId = React.useId();
  const controlId = id || `select-${generatedId}`;
  const popupId = `${controlId}-popup`;
  const errorId = `${controlId}-error`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Preserve selected label even if it's not in the current options list (e.g. after search)
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      return;
    }
    const option = options.find((opt) => opt.value === value);
    if (option) {
      setSelectedLabel(option.label);
    }
  }, [value, options]);

  const handleSearch = (term: string) => {
    setSearch(term);
    onSearchChange?.(term);
  };

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0,
    });

    observer.observe(element);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [handleObserver, open]);

  // If we are filtering locally (no onSearchChange), we should filter the options
  const displayOptions = onSearchChange
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div className="searchable-select-field flex min-w-0 max-w-full flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={controlId} className="text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "searchable-select-control relative flex min-w-0 max-w-full min-h-[43px] w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-sm transition-all focus-within:border-primary focus-within:ring-primary/15",
            disabled && "opacity-50 cursor-not-allowed bg-slate-50",
            error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/15"
          )}
        >
          <PopoverTrigger asChild>
            <button
              data-testid={testId}
              type="button"
              id={controlId}
              aria-haspopup="dialog"
              aria-controls={open ? popupId : undefined}
              aria-expanded={open}
              aria-required={ariaRequired ?? required}
              aria-invalid={invalid ?? !!error}
              aria-describedby={[describedBy, value ? `${controlId}-value` : undefined, error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
              aria-labelledby={labelledBy}
              disabled={disabled}
              className="absolute inset-0 z-0 h-full w-full rounded-lg bg-transparent outline-none cursor-pointer"
              aria-label={
                value
                  ? `${label || "Selected item"}: ${selectedLabel || value}`
                  : label || placeholder
              }
            />
          </PopoverTrigger>

          <span
            id={`${controlId}-value`}
            className={cn(
              "relative z-10 min-w-0 break-words flex-1 text-left mr-2 pointer-events-none",
              !value ? "text-muted-foreground" : "text-foreground font-medium"
            )}
          >
            {value ? selectedLabel || value : placeholder}
          </span>

          <div className="relative z-20 flex items-center gap-1 shrink-0 px-1">
            {value && !disabled && (
              <button
                type="button"
                className="searchable-select-clear flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors border-none p-0"
                style={{ minHeight: "auto" }} // Override global buttons
                onClick={(e) => {
                  e.preventDefault();
                  onChange("");
                }}
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex h-6 w-6 items-center justify-center text-muted-foreground pointer-events-none">
              {loading && !open ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
              )}
            </div>
          </div>
        </div>
        
        <PopoverContent 
          id={popupId}
          aria-label={label || placeholder}
          className="searchable-select-popup p-0 bg-white border border-border shadow-lg rounded-lg z-[100] overflow-hidden"
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command label={label ? `Search ${label}` : "Search options"} shouldFilter={!onSearchChange} className="searchable-select-options max-h-[var(--radix-popover-content-available-height,300px)]">
            <CommandInput
              placeholder={label ? `Search ${label.toLowerCase()}…` : (placeholder?.startsWith("Search") ? placeholder : "Search…")}
              value={search}
              onValueChange={handleSearch}
              className="h-10 text-sm border-none focus:ring-0"
            />
            <CommandList className="min-h-0 max-h-[250px] overflow-y-auto">
              <CommandEmpty>
                {error && onRetry && !loading ? <span className="flex flex-col items-center gap-2">Unable to load options.<button type="button" className="button secondary small" onClick={onRetry}>Retry</button></span> : <>{loading ? (search ? "Searching…" : "Loading…") : error ? "Unable to load options." : search ? "No matching results." : "No options available."}</>}
              </CommandEmpty>
              <CommandGroup>
                {displayOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={onSearchChange ? option.value : option.label}
                    disabled={option.disabled}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch("");
                      if (onSearchChange) onSearchChange("");
                    }}
                    className="cursor-pointer min-w-0"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <span className="min-w-0 break-words">{option.label}{value === option.value && <span className="sr-only"> (selected)</span>}</span>
                  </CommandItem>
                ))}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="py-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? <span role="status">Loading more...</span> : <button type="button" className="button secondary small" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }} onClick={onLoadMore}>Load More Options</button>}
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-destructive mt-1">{error}</p>}
    </div>
  );
}

export default SearchableSelect;
