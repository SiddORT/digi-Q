import React, { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableMultiSelectProps extends Pick<React.AriaAttributes, "aria-describedby" | "aria-invalid" | "aria-required" | "aria-labelledby"> {
  options: { value: string; label: string; hidden?: boolean; disabled?: boolean }[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean; // legacy compat
  loading?: boolean;
  label?: string;
  error?: string;
  onSearchChange?: (search: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  required?: boolean;
  /** Shown as a Retry action in the error state; the selected value is kept. */
  onRetry?: () => void;
  id?: string;
}

export function SearchableMultiSelect({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select...",
  isLoading = false,
  loading = false,
  label,
  error,
  onSearchChange,
  onLoadMore,
  hasMore = false,
  required = false,
  onRetry,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-required": ariaRequired,
  "aria-labelledby": labelledBy,
}: SearchableMultiSelectProps) {
  const generatedId = React.useId();
  const controlId = id || `multiselect-${generatedId}`;
  const popupId = `${controlId}-popup`;
  const errorId = `${controlId}-error`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const isActuallyLoading = isLoading || loading;

  // Maintain a persistent dictionary of selected options to prevent labels disappearing
  // when options are filtered out via remote search
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (value.length === 0) return;
    
    setSelectedLabels((prev) => {
      const next = { ...prev };
      let changed = false;
      
      // Update dictionary from current options
      options.forEach(opt => {
        if (value.includes(opt.value) && prev[opt.value] !== opt.label) {
          next[opt.value] = opt.label;
          changed = true;
        }
      });
      
      return changed ? next : prev;
    });
  }, [value, options]);

  const handleSearch = (term: string) => {
    setSearch(term);
    onSearchChange?.(term);
  };

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !isActuallyLoading && onLoadMore) {
        onLoadMore();
      }
    },
    [hasMore, isActuallyLoading, onLoadMore]
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
  }, [handleObserver, open, search]);

  const displayOptions = onSearchChange
    ? options
    : options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      );

  const toggleValue = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const clearAll = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange([]);
  };

  const removeValue = (e: React.MouseEvent | React.KeyboardEvent, optValue: string) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter((v) => v !== optValue));
  };

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={controlId} className="text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "relative flex min-w-0 max-w-full min-h-[43px] w-full items-center justify-between rounded-lg border border-border bg-white px-2 py-1.5 text-sm shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
            disabled && "opacity-50 cursor-not-allowed bg-slate-50",
            error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/15"
          )}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              id={controlId}
              aria-haspopup="dialog"
              aria-controls={open ? popupId : undefined}
              aria-expanded={open}
              aria-required={ariaRequired ?? required}
              aria-invalid={invalid ?? !!error}
              aria-describedby={[describedBy, value.length ? `${controlId}-value` : undefined, error ? errorId : undefined].filter(Boolean).join(" ") || undefined}
              aria-labelledby={labelledBy}
              disabled={disabled}
              className="absolute inset-0 z-0 h-full w-full rounded-lg bg-transparent outline-none cursor-pointer"
              aria-label={
                value.length > 0
                  ? `${label || "Selected items"}: ${value.map((v) => selectedLabels[v] || v).join(", ")}`
                  : label || placeholder
              }
            />
          </PopoverTrigger>
          <span id={`${controlId}-value`} className="sr-only">{value.length} selected: {value.map(v => selectedLabels[v] || v).join(", ")}</span>

          <div className="relative z-10 flex min-w-0 flex-wrap gap-1.5 flex-1 items-center mr-2 pointer-events-none">
            {value.length === 0 ? (
              <span className="px-1 text-muted-foreground pointer-events-none">
                {placeholder}
              </span>
            ) : (
              value.map((v) => (
                <span
                  key={v}
                  className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-teal-50 border border-teal-100 px-2 py-1 text-xs font-medium text-teal-800 pointer-events-auto"
                >
                  <span className="min-w-0 break-words pointer-events-none">
                    {selectedLabels[v] || v}
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      className="searchable-select-remove ml-0.5 shrink-0 rounded-sm hover:bg-teal-200/50 p-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-colors border-none min-h-0 h-auto"
                      onClick={(e) => removeValue(e, v)}
                      aria-label={`Remove ${selectedLabels[v] || v}`}
                    >
                      <X className="h-3 w-3 pointer-events-none text-teal-600 hover:text-teal-900" />
                    </button>
                  )}
                </span>
              ))
            )}
          </div>

          <div className="relative z-20 flex items-center gap-1 shrink-0 px-1">
            {value.length > 0 && !disabled && (
              <button
                type="button"
                className="searchable-select-clear flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors border-none p-0"
                style={{ minHeight: "auto" }}
                onClick={clearAll}
                aria-label="Clear all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex h-6 w-6 items-center justify-center text-muted-foreground pointer-events-none">
              {isActuallyLoading && !open ? (
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
              placeholder={label ? `Search ${label.toLowerCase()}...` : (placeholder?.startsWith("Search") ? placeholder : "Search...")}
              value={search}
              onValueChange={handleSearch}
              className="h-10 text-sm border-none focus:ring-0"
            />
            <CommandList className="min-h-0 max-h-[250px] overflow-y-auto">
              <CommandEmpty>
                {error && onRetry && !loading ? <span className="flex flex-col items-center gap-2">Unable to load options.<button type="button" className="button secondary small" onClick={onRetry}>Retry</button></span> : <>{isActuallyLoading ? "Searching..." : error ? "Unable to load options." : "No results found."}</>}
              </CommandEmpty>
              <CommandGroup>
                {displayOptions.map((option) => {
                  const isSelected = value.includes(option.value);
                  if (option.hidden && !isSelected) return null;
                  
                  return (
                    <CommandItem
                      key={option.value}
                      value={onSearchChange ? option.value : option.label}
                      disabled={option.disabled}
                      onSelect={() => {
                        toggleValue(option.value);
                      }}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className={cn("h-3 w-3")} />
                      </div>
                      <span className="min-w-0 break-words">{option.label}{isSelected && <span className="sr-only"> (selected)</span>}</span>
                    </CommandItem>
                  );
                })}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="py-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"
                  >
                    {isActuallyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isActuallyLoading ? <span role="status">Loading more...</span> : <button type="button" className="button secondary small" onKeyDown={event => { if (event.key === "Enter" || event.key === " ") event.stopPropagation(); }} onClick={onLoadMore}>Load More Options</button>}
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

export default SearchableMultiSelect;
