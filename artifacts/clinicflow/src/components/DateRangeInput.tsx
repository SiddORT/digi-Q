import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { DateFormatInput, PickerPopover } from "./DateFormatInput";
import { useDateTimePreferences } from "./DateTimePreferences";
import { formatDate, type DateTimePreferences } from "../lib/date-time";
import { calendarKeyTarget, isOutOfRange, monthGrid, monthOf, rangeClick } from "../lib/date-picker-logic";
import "./date-time-picker.css";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
function todayCanonical() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export type DateRange = { from: string; to: string };
type Props = {
  from: string; to: string; onChange: (range: DateRange) => void;
  fromLabel?: string; toLabel?: string; required?: boolean; min?: string; max?: string;
  preferences?: Partial<DateTimePreferences>;
  fromTestId?: string; toTestId?: string; testId?: string;
  onFromValidityChange?: (valid: boolean) => void; onToValidityChange?: (valid: boolean) => void;
};

/** Two connected months (one on narrow screens). First click sets the start, second the end; hover previews the span.
 *  Keyboard: arrows move a day/week, PageUp/PageDown a month, Enter/Space picks, Escape closes. */
function RangePanel({ value, min, max, prefs, onApply, onClose }: { value: DateRange; min?: string; max?: string; prefs: DateTimePreferences; onApply: (r: DateRange) => void; onClose: () => void }) {
  const today = todayCanonical();
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState("");
  const [focus, setFocus] = useState(() => value.from || (isOutOfRange(today, min, max) ? min || max || today : today));
  const [left, setLeft] = useState(() => monthOf(focus));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focus < left) setLeft(monthOf(focus));
    else if (focus >= monthOf(left, 2)) setLeft(monthOf(focus, -1));
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus());
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const end = draft.to || (draft.from && hover > draft.from ? hover : "");
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    const next = calendarKeyTarget(focus, e.key, min, max);
    if (next) { e.preventDefault(); e.stopPropagation(); setFocus(next); setHover(next); }
  };
  const month = (start: string) => {
    const y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7)) - 1;
    return <div className="dtp-month" key={start}>
      <p className="dtp-month-title" aria-live="polite">{MONTHS[m]} {y}</p>
      <div className="dtp-grid" role="grid" aria-label={`${MONTHS[m]} ${y}`}>
        {WEEKDAYS.map(d => <span key={d} className="dtp-dow" role="columnheader">{d}</span>)}
        {monthGrid(y, m).map((d, i) => d ? <button key={d} type="button" role="gridcell" data-date={d} tabIndex={d === focus ? 0 : -1}
          className={["dtp-day", d === today ? "today" : "", d === draft.from ? "range-start" : "", d === end || (d === draft.from && !end) ? "range-end" : "", draft.from && end && d > draft.from && d < end ? "in-range" : ""].filter(Boolean).join(" ")}
          disabled={isOutOfRange(d, min, max)} aria-selected={d === draft.from || d === draft.to} aria-label={formatDate(d, prefs)}
          onMouseEnter={() => setHover(d)} onFocus={() => setHover(d)} onClick={() => { setFocus(d); setDraft(r => rangeClick(r, d)); }} data-testid={`button-range-day-${d}`}>{Number(d.slice(8))}</button>
          : <span key={`e${start}${i}`} />)}
      </div>
    </div>;
  };
  return <div className="dtp-panel dtp-range-panel" role="dialog" aria-label="Choose date range" onKeyDown={onKey} ref={ref}>
    <div className="dtp-head">
      <button type="button" className="dtp-nav" aria-label="Previous month" onClick={() => setLeft(l => monthOf(l, -1))} data-testid="button-range-prev-month"><ChevronLeft size={16} aria-hidden /></button>
      <p className="dtp-range-summary" data-testid="text-range-summary">{draft.from ? `${formatDate(draft.from, prefs)} – ${draft.to ? formatDate(draft.to, prefs) : "select end date"}` : "Select a start date"}</p>
      <button type="button" className="dtp-nav" aria-label="Next month" onClick={() => setLeft(l => monthOf(l, 1))} data-testid="button-range-next-month"><ChevronRight size={16} aria-hidden /></button>
    </div>
    <div className="dtp-months">{month(left)}{month(monthOf(left, 1))}</div>
    <div className="dtp-foot">
      <button type="button" className="dtp-link" onClick={() => setDraft({ from: "", to: "" })} data-testid="button-range-clear">Clear</button>
      <div className="dtp-range-actions">
        <button type="button" className="dtp-link" onClick={onClose} data-testid="button-range-cancel">Cancel</button>
        <button type="button" className="button small" onClick={() => onApply({ from: draft.from, to: draft.to || draft.from })} data-testid="button-range-apply">Apply</button>
      </div>
    </div>
  </div>;
}

/** Reusable From/To filter: two typeable date fields plus a connected two-month range calendar. Values are canonical YYYY-MM-DD. */
export function DateRangeInput({ from, to, onChange, fromLabel = "From", toLabel = "To", required, min, max, preferences, fromTestId, toTestId, testId = "range", onFromValidityChange, onToValidityChange }: Props) {
  const inherited = useDateTimePreferences(), prefs = { ...inherited, ...preferences } as DateTimePreferences;
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null), panelRef = useRef<HTMLDivElement | null>(null), wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { const t = e.target as Node; if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const close = () => { setOpen(false); requestAnimationFrame(() => anchorRef.current?.focus()); };
  const req = required ? <span className="required" aria-hidden> *</span> : null;
  return <div className="dtp-range" ref={wrapRef} data-testid={`group-${testId}`}
    onKeyDown={e => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); } }}>
    <label>{fromLabel}{req}<DateFormatInput required={required} data-testid={fromTestId} value={from} min={min} max={max} preferences={preferences} onValidityChange={onFromValidityChange} onChange={value => onChange({ from: value, to })} /></label>
    <label>{toLabel}{req}<DateFormatInput required={required} data-testid={toTestId} value={to} min={from || min} max={max} preferences={preferences} onValidityChange={onToValidityChange} onChange={value => onChange({ from, to: value })} /></label>
    <button type="button" ref={anchorRef} className="dtp-range-open" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(v => !v)} data-testid={`button-${testId}-calendar`}>
      <CalendarRange size={15} aria-hidden /> Pick range on calendar
    </button>
    {open && <PickerPopover anchorRef={anchorRef} panelRef={panelRef}>
      <RangePanel value={{ from, to }} min={min} max={max} prefs={prefs} onClose={close} onApply={r => { onChange(r); close(); }} />
    </PickerPopover>}
  </div>;
}
