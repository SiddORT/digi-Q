import { useEffect, useId, useRef, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";
import "./live-search.css";
import { visibleSearchMatches, type SearchSuggestion } from "./live-search-state";
export type { SearchSuggestion } from "./live-search-state";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  suggestions?: SearchSuggestion[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  total?: number;
  scopeKey?: string;
  /** Query string associated with the current response, not the raw input. */
  settledQuery?: string;
}

/** Suggestions are supplied by the same authorized query as the listing.
 * No separate global endpoint, cached cross-clinic records, or fabricated matches. */
export function SearchInput({
  value, onChange, placeholder = "Search…", label, suggestions, loading = false,
  error, onRetry, total, scopeKey = "", settledQuery,
}: SearchInputProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [requestedOpen, setRequestedOpen] = useState(false);
  const [openedScope, setOpenedScope] = useState(scopeKey);
  const [active, setActive] = useState(-1);
  const { pending: queryPending, matches } = visibleSearchMatches({ value, settledQuery, loading, error, suggestions });
  const open = requestedOpen && openedScope === scopeKey && !!value.trim() && suggestions !== undefined;
  const listId = `${id}-matches`;
  const signature = matches.map(s => `${s.id}:${s.value}`).join("|");
  useEffect(() => setActive(-1), [value, scopeKey, signature, queryPending]);
  useEffect(() => {
    if (active >= 0 && open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  const show = () => { setOpenedScope(scopeKey); setRequestedOpen(true); };
  const choose = (suggestion: SearchSuggestion) => {
    onChange(suggestion.value);
    setRequestedOpen(false);
    setActive(-1);
    input.current?.focus();
  };
  const activeOption = open && active >= 0 && active < matches.length ? `${id}-option-${active}` : undefined;
  const title = label || placeholder.replace(/…|\.\.\.$/, "");

  return <Popover open={open} onOpenChange={setRequestedOpen}>
    <PopoverAnchor asChild>
      <div ref={anchor} className="workspace-search live-search-field">
        {label && <label htmlFor={id}>{label}</label>}
        <div className="live-search-anchor">
          <Search aria-hidden="true" size={16} className="live-search-icon" />
          <input ref={input} id={id} type="search" value={value} placeholder={placeholder}
            style={{ paddingInlineStart: 34, paddingInlineEnd: 48 }}
            autoComplete="off" aria-label={label ? undefined : title}
            role={suggestions !== undefined ? "combobox" : undefined}
            aria-autocomplete={suggestions !== undefined ? "list" : undefined}
            aria-expanded={suggestions !== undefined ? open : undefined}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={activeOption}
            onFocus={show}
            onChange={e => { onChange(e.target.value); setActive(-1); show(); }}
            onKeyDown={e => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape" && open) {
                e.preventDefault(); e.stopPropagation(); setRequestedOpen(false);
              } else if (suggestions !== undefined && (e.key === "ArrowDown" || e.key === "ArrowUp") && value.trim()) {
                e.preventDefault(); show();
                if (matches.length) setActive(i => e.key === "ArrowDown"
                  ? (i + 1) % matches.length : i <= 0 ? matches.length - 1 : i - 1);
              } else if (e.key === "Enter" && open) {
                e.preventDefault();
                if (activeOption) choose(matches[active]);
                else setRequestedOpen(false);
              }
            }} />
          {value && <button type="button" className="live-search-clear" aria-label="Clear search"
            onClick={() => { onChange(""); setRequestedOpen(false); setActive(-1); input.current?.focus(); }}>
            <X aria-hidden="true" size={15} />
          </button>}
        </div>
      </div>
    </PopoverAnchor>
    <PopoverContent align="start" sideOffset={5} collisionPadding={12} className="live-search-results"
      onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
      onInteractOutside={e => { if (anchor.current?.contains(e.target as Node)) e.preventDefault(); }}>
      <div className="live-search-summary" role="status" aria-live="polite">
        {queryPending ? <><Loader2 size={14} className="live-search-spinner" aria-hidden="true" />Searching…</>
          : error ? "Search could not be loaded"
          : matches.length ? `${total ?? matches.length} matching ${(total ?? matches.length) === 1 ? "result" : "results"}`
          : "No matching results"}
      </div>
      <div id={listId} role="listbox" aria-label={`${title} suggestions`} aria-busy={queryPending}>
        {matches.map((suggestion, index) => <div key={`${suggestion.id}-${index}`} id={`${id}-option-${index}`}
          role="option" aria-selected={active === index} className="live-search-option"
          onMouseEnter={() => setActive(index)}
          onMouseDown={e => e.preventDefault()}
          onClick={() => choose(suggestion)}>
          <strong>{suggestion.label}</strong>
          {suggestion.description && <span>{suggestion.description}</span>}
        </div>)}
      </div>
      {!queryPending && error && <div className="live-search-message" role="alert">
        <p>{error}</p>{onRetry && <button type="button" onClick={onRetry}>Retry Search</button>}
      </div>}
      {!queryPending && !error && !matches.length && <p className="live-search-message">Try a different search or review the applied filters.</p>}
      {!queryPending && !error && matches.length > 0 && <button type="button" className="live-search-all"
        onClick={() => { setRequestedOpen(false); input.current?.focus(); }}>
        View all matching results in the listing
      </button>}
    </PopoverContent>
  </Popover>;
}