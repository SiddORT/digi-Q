import React, { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectProps {
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
  id?: string;
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
  id,
}: SearchableSelectProps) {
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
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "relative flex min-h-[43px] w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
            disabled && "opacity-50 cursor-not-allowed bg-slate-50",
            error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/15"
          )}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-required={required}
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
            className={cn(
              "relative z-10 truncate flex-1 text-left mr-2 pointer-events-none",
              !value ? "text-muted-foreground" : "text-foreground font-medium"
            )}
          >
            {value ? selectedLabel || value : placeholder}
          </span>

          <div className="relative z-20 flex items-center gap-1 shrink-0 px-1">
            {value && !disabled && (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-slate-100 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors border-none p-0"
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
          className="p-0 bg-white border border-border shadow-lg rounded-lg z-[100] overflow-hidden" 
          align="start"
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command shouldFilter={!onSearchChange} className="max-h-[var(--radix-popover-content-available-height,300px)]">
            <CommandInput
              placeholder={label ? `Search ${label.toLowerCase()}...` : (placeholder?.startsWith("Search") ? placeholder : "Search...")}
              value={search}
              onValueChange={handleSearch}
              className="h-10 text-sm border-none focus:ring-0"
            />
            <CommandList className="max-h-[250px] overflow-y-auto">
              <CommandEmpty>
                {loading ? "Searching..." : "No results found."}
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
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
                {hasMore && (
                  <div
                    ref={loadMoreRef}
                    className="py-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {loading ? "Loading more..." : "Scroll for more"}
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

export default SearchableSelect;
