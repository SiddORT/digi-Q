import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import type { WorkspaceBranchOption } from "../lib/workspace-branch";

// Two single-line labels fit in a fixed row, so scrolling never needs to
// measure thousands of DOM nodes. Keep this in sync with .loc-option virtual CSS.
const ROW_HEIGHT = 56;
const VIEW_HEIGHT = 280;
const OVERSCAN = 3;

export function LocationMenu({ branches, selectedId, onChoose }: {
  branches: WorkspaceBranchOption[];
  selectedId: string;
  onChoose: (id: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(() => Math.max(0, branches.findIndex(b => b.id === selectedId)));
  const [scrollTop, setScrollTop] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchable = useMemo(() => branches.map(branch => ({
    branch, text: `${branch.name} ${branch.clinicName}`.toLowerCase(),
  })), [branches]);
  const options = useMemo(() => {
    const search = term.trim().toLowerCase();
    return search ? searchable.filter(b => b.text.includes(search)).map(b => b.branch) : branches;
  }, [branches, searchable, term]);
  const activeIndex = Math.max(0, Math.min(active, options.length - 1));

  useLayoutEffect(() => { input.current?.focus(); }, []);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const top = activeIndex * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
    }
    setScrollTop(el.scrollTop);
  }, [activeIndex, options]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(options.length, Math.ceil((scrollTop + VIEW_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const indexes = Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
  // Wheel/touch scrolling can leave the keyboard-active row outside the window.
  // Keep that one row mounted so aria-activedescendant always targets real DOM.
  if (options.length && (activeIndex < start || activeIndex >= end)) indexes.push(activeIndex);
  indexes.sort((a, b) => a - b);

  return <div className="loc-panel" role="dialog" aria-label="Choose location">
    <label className="loc-search"><Search size={14} aria-hidden /><span className="sr-only">Search locations</span>
      <input ref={input} value={term} placeholder="Search locations or clinics…" role="combobox" aria-expanded
        aria-autocomplete="list" aria-controls={listId}
        aria-activedescendant={options[activeIndex] ? `${listId}-${options[activeIndex].id}` : undefined}
        onChange={e => { setTerm(e.target.value); setActive(0); }}
        onKeyDown={e => {
          let next: number | undefined;
          if (e.key === "ArrowDown") next = Math.min(options.length - 1, activeIndex + 1);
          else if (e.key === "ArrowUp") next = Math.max(0, activeIndex - 1);
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = options.length - 1;
          else if (e.key === "PageDown") next = Math.min(options.length - 1, activeIndex + Math.floor(VIEW_HEIGHT / ROW_HEIGHT));
          else if (e.key === "PageUp") next = Math.max(0, activeIndex - Math.floor(VIEW_HEIGHT / ROW_HEIGHT));
          else if (e.key === "Enter" && options[activeIndex]) { e.preventDefault(); onChoose(options[activeIndex].id); }
          if (next !== undefined) { e.preventDefault(); setActive(Math.max(0, next)); }
        }}
        data-testid="input-location-search" /></label>
    <ul ref={list} className="loc-list loc-list-virtual" role="listbox" id={listId} aria-label="Locations"
      style={{ height: options.length ? Math.min(VIEW_HEIGHT, options.length * ROW_HEIGHT) : undefined }}
      onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
      {!!options.length && <li role="presentation" className="loc-spacer" style={{ height: options.length * ROW_HEIGHT }} />}
      {indexes.map(i => {
        const b = options[i];
        return <li key={b.id} id={`${listId}-${b.id}`} role="option" aria-selected={b.id === selectedId}
          aria-posinset={i + 1} aria-setsize={options.length}
          className={`loc-option${i === activeIndex ? " is-active" : ""}`}
          style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
          onMouseEnter={() => setActive(i)} onClick={() => onChoose(b.id)} data-testid={`option-location-${b.id}`}
          title={`${b.name} · ${b.clinicName}`}>
          <span><strong>{b.name}</strong><small>{b.clinicName}</small></span>{b.id === selectedId && <Check size={15} aria-hidden />}
        </li>;
      })}
      {!options.length && <li className="loc-empty" role="presentation">No matching locations.</li>}
    </ul>
  </div>;
}
