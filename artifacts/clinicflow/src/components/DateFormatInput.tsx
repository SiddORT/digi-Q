import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { formatDate, formatTime, parseDateInput, parseTimeInput, type DateTimePreferences } from "../lib/date-time";
import { useDateTimePreferences } from "./DateTimePreferences";
import { daysInMonth, jumpTo, calendarKeyTarget, initialFocus, isOutOfRange, monthGrid, placePanel, timeOptions } from "../lib/date-picker-logic";
import "./date-time-picker.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: string; onChange: (canonical: string) => void; preferences?: Partial<DateTimePreferences>;
  /** Canonical YYYY-MM-DD bounds (HH:mm for time inputs), never display strings. */
  min?: string; max?: string;
  onValidityChange?: (valid: boolean) => void;
  /** Minute step for the time picker list only; typing always accepts any exact minute. */
  minuteStep?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function todayCanonical() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Month calendar grid. Keyboard: arrows move a day/week, PageUp/PageDown move a month, Enter selects, Escape closes. */
function CalendarPanel({ value, min, max, onPick, onClose, prefs }: { value: string; min?: string; max?: string; onPick: (v: string) => void; onClose: () => void; prefs: DateTimePreferences }) {
  const [focus, setFocus] = useState(() => initialFocus(value, todayCanonical(), min, max));
  const [y, m] = [Number(focus.slice(0, 4)), Number(focus.slice(5, 7)) - 1];
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus(); }, [focus]);
  const disabled = (d: string) => isOutOfRange(d, min, max);
  const shiftMonth = (delta: number) => setFocus(calendarKeyTarget(focus, delta < 0 ? "PageUp" : "PageDown", min, max) || focus);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); return; }
    const next = calendarKeyTarget(focus, e.key, min, max);
    if (next) { e.preventDefault(); e.stopPropagation(); setFocus(next); }
  };
  const cells = monthGrid(y, m);
  // Month/year shortcut views so distant dates (e.g. date of birth) need a few clicks, not hundreds.
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const yearStart = y - (y % 12);
  const jump = (year: number, month: number) => setFocus(jumpTo(focus, year, month, min, max));
  const monthDisabled = (year: number, month: number) => !!(min && `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}` < min) || !!(max && `${year}-${pad(month + 1)}-01` > max);
  const yearDisabled = (year: number) => !!(min && `${year}-12-31` < min) || !!(max && `${year}-01-01` > max);
  if (view !== "days") return <div className="dtp-panel" role="dialog" aria-label={view === "months" ? "Choose month" : "Choose year"} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setView("days"); } }}>
    <div className="dtp-head">
      <button type="button" className="dtp-nav" aria-label={view === "months" ? "Previous year" : "Previous 12 years"} onClick={() => jump(view === "months" ? y - 1 : y - 12, m)} data-testid="button-picker-prev-range"><ChevronLeft size={16} aria-hidden /></button>
      <button type="button" className="dtp-title" onClick={() => setView(view === "months" ? "years" : "days")} data-testid="button-picker-view-toggle">{view === "months" ? y : `${yearStart}–${yearStart + 11}`}</button>
      <button type="button" className="dtp-nav" aria-label={view === "months" ? "Next year" : "Next 12 years"} onClick={() => jump(view === "months" ? y + 1 : y + 12, m)} data-testid="button-picker-next-range"><ChevronRight size={16} aria-hidden /></button>
    </div>
    <div className="dtp-grid dtp-grid-3">
      {view === "months"
        ? MONTHS.map((name, i) => <button key={name} type="button" className={`dtp-day${i === m ? " selected" : ""}`} disabled={monthDisabled(y, i)} onClick={() => { jump(y, i); setView("days"); }} data-testid={`button-picker-month-${i + 1}`}>{name.slice(0, 3)}</button>)
        : Array.from({ length: 12 }, (_, i) => yearStart + i).map(year => <button key={year} type="button" className={`dtp-day${year === y ? " selected" : ""}`} disabled={yearDisabled(year)} onClick={() => { jump(year, m); setView("months"); }} data-testid={`button-picker-year-${year}`}>{year}</button>)}
    </div>
  </div>;
  const today = todayCanonical();
  return <div className="dtp-panel" role="dialog" aria-label="Choose date" onKeyDown={onKey}>
    <div className="dtp-head">
      <button type="button" className="dtp-nav" aria-label="Previous month" onClick={() => shiftMonth(-1)} data-testid="button-picker-prev-month"><ChevronLeft size={16} aria-hidden /></button>
      <button type="button" className="dtp-title" aria-live="polite" aria-label={`${MONTHS[m]} ${y}, choose month or year`} onClick={() => setView("months")} data-testid="button-picker-view-toggle">{MONTHS[m]} {y}</button>
      <button type="button" className="dtp-nav" aria-label="Next month" onClick={() => shiftMonth(1)} data-testid="button-picker-next-month"><ChevronRight size={16} aria-hidden /></button>
    </div>
    <div className="dtp-grid" role="grid" ref={gridRef}>
      {WEEKDAYS.map(d => <span key={d} className="dtp-dow" role="columnheader">{d}</span>)}
      {cells.map((d, i) => d ? <button key={d} type="button" role="gridcell" data-date={d} tabIndex={d === focus ? 0 : -1}
        className={`dtp-day${d === value ? " selected" : ""}${d === today ? " today" : ""}`} disabled={disabled(d)}
        aria-selected={d === value} aria-label={formatDate(d, prefs)} onClick={() => onPick(d)} data-testid={`button-picker-day-${d}`}>{Number(d.slice(8))}</button>
        : <span key={`e${i}`} />)}
    </div>
    <div className="dtp-foot">
      {!disabled(today) && <button type="button" className="dtp-link" onClick={() => onPick(today)} data-testid="button-picker-today">Today</button>}
      <button type="button" className="dtp-link" onClick={onClose} data-testid="button-picker-close">Close</button>
    </div>
  </div>;
}

/** Time list in the configured clock format; exact minutes remain typeable in the text field. */
function TimePanel({ value, min, max, step, onPick, onClose, prefs }: { value: string; min?: string; max?: string; step: number; onPick: (v: string) => void; onClose: () => void; prefs: DateTimePreferences }) {
  const listRef = useRef<HTMLDivElement>(null);
  const options = timeOptions(step, min, max, value);
  useEffect(() => {
    const target = value || options.find(o => o >= "09:00") || options[0];
    listRef.current?.querySelector<HTMLButtonElement>(`[data-time="${target}"]`)?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = (e: KeyboardEvent) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button") || []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]?.focus(); }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
  };
  return <div className="dtp-panel dtp-time" role="dialog" aria-label="Choose time" onKeyDown={onKey}>
    <div className="dtp-times" role="listbox" ref={listRef}>
      {options.map(o => <button key={o} type="button" role="option" data-time={o} aria-selected={o === value} className={`dtp-time-opt${o === value ? " selected" : ""}`} onClick={() => onPick(o)} data-testid={`button-picker-time-${o.replace(":", "")}`}>{formatTime(o, prefs)}</button>)}
      {!options.length && <p className="dtp-empty">No times within the allowed range.</p>}
    </div>
    <p className="dtp-hint">Type any exact minute in the field.</p>
  </div>;
}


/** Portals the panel to the nearest dialog content (so Radix focus trap, outside-click and Escape
 *  handling still treat it as inside) or to document.body, escaping overflow clipping in drawer
 *  bodies, table wrappers and cards. Position is recomputed on scroll/resize. */
function PickerPopover({ anchorRef, panelRef, children }: { anchorRef: RefObject<HTMLElement | null>; panelRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "absolute", top: 0, left: 0, visibility: "hidden" });
  useLayoutEffect(() => {
    setHost((anchorRef.current?.closest('[role="dialog"],[role="alertdialog"]') as HTMLElement | null) || document.body);
  }, [anchorRef]);
  useLayoutEffect(() => {
    if (!host) return;
    const update = () => {
      const anchor = anchorRef.current, panel = panelRef.current;
      if (!anchor || !panel) return;
      const isBody = host === document.body;
      const container = isBody ? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth, width: window.innerWidth, height: window.innerHeight } : host.getBoundingClientRect();
      const pos = placePanel(anchor.getBoundingClientRect(), container, { width: panel.offsetWidth, height: panel.offsetHeight }, 4, 8,
        isBody ? { x: window.scrollX, y: window.scrollY } : { x: host.scrollLeft, y: host.scrollTop });
      setStyle({ position: "absolute", top: pos.top, left: pos.left, visibility: "visible" });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [host, anchorRef, panelRef]);
  if (!host) return null;
  return createPortal(<div ref={panelRef} className="dtp-popover" style={style} data-testid="picker-popover">{children}</div>, host);
}

/** Controlled canonical value with local typed text plus a picker; invalid input never escapes as storage data. */
function FormattedInput({ value, onChange, preferences, mode, min, max, onValidityChange, minuteStep = 15, ...props }: Props & { mode: "date" | "time" }) {
  const inherited = useDateTimePreferences(), prefs = { ...inherited, ...preferences } as DateTimePreferences;
  const formatter = mode === "date" ? formatDate : formatTime;
  const parser = mode === "date" ? parseDateInput : parseTimeInput;
  const [text, setText] = useState(value ? formatter(value, prefs) : "");
  const [open, setOpen] = useState(false);
  const pendingEcho = useRef<string | null>(null);
  const lastFormat = useRef(`${prefs.dateFormat}:${prefs.timeFormat}:${mode}`);
  const wrapRef = useRef<HTMLSpanElement>(null), inputRef = useRef<HTMLInputElement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null), panelRef = useRef<HTMLDivElement | null>(null);
  const parsed = text ? parser(text, prefs) : null;
  const invalid = text ? parsed === null || !!(min && parsed < min) || !!(max && parsed > max) : !!props.required;
  const id = useId(), errorId = `${id}-error`;
  useEffect(() => {
    const format = `${prefs.dateFormat}:${prefs.timeFormat}:${mode}`;
    if (pendingEcho.current === value && lastFormat.current === format) { pendingEcho.current = null; return; }
    pendingEcho.current = null;
    lastFormat.current = format;
    setText(value ? formatter(value, prefs) : "");
  }, [value, prefs.dateFormat, prefs.timeFormat, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const validityRef = useRef(onValidityChange); validityRef.current = onValidityChange;
  useEffect(() => { validityRef.current?.(!invalid); }, [invalid]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { const t = e.target as Node; if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const example = formatter(mode === "date" ? "2026-09-30" : "09:00", prefs);
  const error = !text && props.required ? "This field is required."
    : parsed && min && parsed < min ? `Enter a ${mode} on or after ${formatter(min, prefs)}.`
    : parsed && max && parsed > max ? `Enter a ${mode} on or before ${formatter(max, prefs)}.`
    : `Enter a valid ${mode}, for example ${example}.`;
  const commit = (next: string) => {
    setText(next);
    const p = parser(next, prefs);
    const canonical = p !== null && !(min && p < min) && !(max && p > max) ? p : "";
    // Clear the canonical form value immediately, but retain invalid text for correction.
    pendingEcho.current = canonical;
    onChange(canonical);
  };
  const close = () => { setOpen(false); requestAnimationFrame(() => inputRef.current?.focus()); };
  const pick = (canonical: string) => { commit(formatter(canonical, prefs)); close(); };
  const Icon = mode === "date" ? CalendarDays : Clock;
  const testBase = (props["data-testid" as keyof typeof props] as string | undefined) || `input-${mode}`;
  return <span className={`dtp-field${invalid ? " is-invalid" : ""}`} ref={wrapRef} data-dtp-open={open || undefined}
    // Escape from any focus inside the field, trigger or (portaled, React-bubbling) panel closes only the picker.
    onKeyDown={e => { if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } }}>
    <span className="dtp-control" ref={anchorRef}>
      <input {...props} type="text" inputMode={mode === "date" && prefs.dateFormat !== "DD MMM YYYY" ? "numeric" : "text"} autoComplete="off"
        value={text} placeholder={props.placeholder ?? example} aria-invalid={invalid || props["aria-invalid"]}
        aria-describedby={[props["aria-describedby"], invalid ? errorId : ""].filter(Boolean).join(" ") || undefined}
        onKeyDown={e => { if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } else if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } props.onKeyDown?.(e); }}
        onChange={event => commit(event.target.value)}
        ref={element => { inputRef.current = element; element?.setCustomValidity(invalid ? error : ""); }} />
      <button type="button" className="dtp-trigger" disabled={props.disabled || props.readOnly} aria-haspopup="dialog" aria-expanded={open}
        aria-label={mode === "date" ? "Open calendar" : "Open time list"} onClick={() => setOpen(v => !v)} data-testid={`${testBase}-picker`}>
        <Icon size={16} aria-hidden />
      </button>
    </span>
    {open && <PickerPopover anchorRef={anchorRef} panelRef={panelRef}>{mode === "date"
      ? <CalendarPanel value={parsed && !invalid ? parsed : ""} min={min} max={max} prefs={prefs} onPick={pick} onClose={close} />
      : <TimePanel value={parsed && !invalid ? parsed : ""} min={min} max={max} step={Math.max(1, minuteStep)} prefs={prefs} onPick={pick} onClose={close} />}</PickerPopover>}
    {invalid && <span id={errorId} role="alert" className="field-error">{error}</span>}
  </span>;
}
export function DateFormatInput(props: Props) { return <FormattedInput {...props} mode="date" />; }
export function TimeFormatInput(props: Props) { return <FormattedInput {...props} mode="time" />; }
