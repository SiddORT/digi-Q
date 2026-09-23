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
                value
                  ? `${label || "Selected item"}: ${selectedLabel || value}`
                  : label || placeholder
              }
            />
          </PopoverTrigger>

          {/* Foreground content: text, clear button, chevron */}
          <div className="relative z-10 flex min-h-[43px] w-full items-center justify-between pointer-events-none px-3 py-2">
            <span
              className={cn(
                "truncate flex-1 text-left mr-2 pointer-events-none",
                !value && "text-muted-foreground"
              )}
            >
              {value ? selectedLabel || value : placeholder}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {value && !disabled && (
                <button
                  type="button"
                  className="pointer-events-auto rounded-sm p-0.5 hover:bg-slate-200 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange("");
                  }}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5 pointer-events-none" />
                </button>
              )}
              <div className="pointer-events-none flex items-center justify-center opacity-50">
                {loading && !open ? (
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
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
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
