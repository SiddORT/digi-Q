import React, { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableMultiSelectProps {
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
  id,
}: SearchableMultiSelectProps) {
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
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "relative w-full rounded-lg border border-border bg-white text-sm shadow-sm transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
            error && "border-destructive"
          )}
        >
          {/* Main trigger button, spanning the entire container */}
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-required={required}
              disabled={disabled}
              className={cn(
                "absolute inset-0 h-full w-full rounded-lg bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                error && "focus-visible:ring-destructive"
              )}
              aria-label={
                value.length > 0
                  ? `${label || "Selected items"}: ${value.map((v) => selectedLabels[v] || v).join(", ")}`
                  : label || placeholder
              }
            />
          </PopoverTrigger>

          {/* Foreground content: text, clear button, chevron */}
          <div className="relative z-10 flex min-h-[43px] w-full items-center justify-between pointer-events-none px-2 py-1.5">
            <div className="flex flex-wrap gap-1.5 flex-1 items-center mr-2">
              {value.length === 0 ? (
                <span className="px-1 text-muted-foreground pointer-events-none">
                  {placeholder}
                </span>
              ) : (
                value.map((v) => (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground pointer-events-auto"
                  >
                    <span className="max-w-[120px] truncate pointer-events-none">
                      {selectedLabels[v] || v}
                    </span>
                    {!disabled && (
                      <button
                        type="button"
                        className="ml-1 rounded-full hover:bg-slate-300 p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={(e) => removeValue(e, v)}
                        aria-label={`Remove ${selectedLabels[v] || v}`}
                      >
                        <X className="h-3 w-3 pointer-events-none" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 px-1">
              {value.length > 0 && !disabled && (
                <button
                  type="button"
                  className="pointer-events-auto rounded-sm p-1 hover:bg-slate-200 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={clearAll}
                  aria-label="Clear all"
                >
                  <X className="h-4 w-4 pointer-events-none" />
                </button>
              )}
              <div className="pointer-events-none flex items-center justify-center opacity-50">
                {isActuallyLoading && !open ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </div>
        </div>

        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-white z-[100]" align="start">
          <Command shouldFilter={!onSearchChange}>
            <CommandInput
              placeholder="Search..."
              value={search}
              onValueChange={handleSearch}
            />
            <CommandList>
              <CommandEmpty>
                {isActuallyLoading ? "Searching..." : "No results found."}
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
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className={cn("h-3 w-3")} />
                      </div>
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  );
                })}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="py-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"
                  >
                    {isActuallyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isActuallyLoading ? "Loading more..." : "Scroll for more"}
                  </div>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs font-medium text-destructive mt-1">{error}</p>}
    </div>
  );
}

export default SearchableMultiSelect;
