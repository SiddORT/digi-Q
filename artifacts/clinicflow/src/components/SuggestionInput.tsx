import { useEffect, useId, useRef, useState, type AriaAttributes } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

type SuggestionInputProps = Pick<AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid" | "aria-required"> & {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  /** Retry action shown with the error; typed value is kept. */
  onRetry?: () => void;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  clearLabel?: string;
};

/**
 * A bounded suggestion list for fields that deliberately accept both catalog
 * values and free text. Unlike a select, typing never requires choosing a row.
 */
export function SuggestionInput({
  value,
  onChange,
  options,
  placeholder,
  loading = false,
  error,
  emptyMessage = "No matching suggestions. You can keep your own text.",
  onRetry,
  onSearchChange,
  disabled = false,
  id,
  clearLabel = "Clear text",
  "aria-label": accessibleLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  "aria-required": required,
}: SuggestionInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-suggestions`;
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setActiveIndex(-1);
    optionRefs.current = optionRefs.current.slice(0, options.length);
  }, [options]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const choose = (option: string) => {
    onChange(option);
    onSearchChange?.(option);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <div className="min-w-0 max-w-full w-full">
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              id={inputId}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open && !disabled}
              aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              aria-label={accessibleLabel || (labelledBy ? undefined : placeholder)}
              aria-labelledby={labelledBy}
              aria-required={required}
              aria-invalid={invalid ?? !!error}
              aria-describedby={[describedBy, error ? `${inputId}-error` : undefined].filter(Boolean).join(" ") || undefined}
              disabled={disabled}
              value={value}
              placeholder={placeholder}
              className={cn("w-full pl-9", value || loading ? "pr-16" : "pr-9", error && "border-destructive")}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onChange={event => {
                onChange(event.target.value);
                onSearchChange?.(event.target.value);
                setOpen(true);
              }}
              onKeyDown={event => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (!options.length) return;
                  setOpen(true);
                  setActiveIndex(index => Math.min(index + 1, options.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!options.length) return;
                  setOpen(true);
                  setActiveIndex(index => index <= 0 ? Math.max(options.length - 1, 0) : index - 1);
                } else if (event.key === "Enter" && open && activeIndex >= 0) {
                  event.preventDefault();
                  choose(options[activeIndex]);
                } else if (event.key === "Escape" && open) {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                } else if (event.key === "Tab") {
                  setOpen(false);
                  setActiveIndex(-1);
                }
              }}
            />
            <span className="absolute right-2 flex items-center gap-1">
              {value && !disabled && (
                <button
                  type="button"
                  aria-label={clearLabel}
                  className="rounded-sm border-0 bg-transparent p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                  onPointerDown={event => event.preventDefault()}
                  onClick={() => {
                    onChange("");
                    onSearchChange?.("");
                    setOpen(true);
                    inputRef.current?.focus();
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading suggestions" />}
            </span>
          </div>
        </PopoverAnchor>
        {error && <p id={`${inputId}-error`} className="field-error" role="alert">{error}{onRetry && <> <button type="button" className="text-link" onClick={onRetry}>Retry</button></>}</p>}
      </div>
      <PopoverContent
        id={listId}
        role="listbox"
        align="start"
        collisionPadding={12}
        className="z-[100] w-[--radix-popover-trigger-width] max-w-[calc(100vw-1.5rem)] max-h-[min(14rem,var(--radix-popover-content-available-height))] overflow-y-auto p-1"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        onInteractOutside={event => {
          if (event.target instanceof Node && inputRef.current?.parentElement?.contains(event.target)) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={event => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          inputRef.current?.focus();
        }}
      >
        {options.length ? options.map((option, index) => (
          <button
            ref={element => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={option === value}
            id={`${listId}-${index}`}
            key={option}
            className={cn("flex w-full min-w-0 items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50", index === activeIndex && "bg-slate-50")}
            onPointerDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <Check className={cn("mr-2 h-4 w-4", option === value ? "opacity-100" : "opacity-0")} />
            <span className="min-w-0 break-words">{option}</span>
          </button>
        )) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {loading ? "Loading suggestions…" : error ? "Suggestions are unavailable. Retry above or enter your own text." : emptyMessage}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}