import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { VISIT_PRESETS, detectPreset, monthGrid, presetRange, shiftMonth, stepRange, monthStart, type VisitPreset } from "../../lib/visit-range";
import { formatDate } from "../../lib/date-time";
import "./visit-range.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function rangeLabel(from: string, to: string, today: string) {
  const p = detectPreset(from, to, today);
  if (p !== "custom") return VISIT_PRESETS.find(x => x.key === p)!.label;
  if (!from || !to) return from ? `From ${formatDate(from)}` : `Until ${formatDate(to)}`;
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}

/** List-header visit date range: trigger with period steppers, popover with presets and custom calendar (Apply/Cancel).
 *  All dates are ISO strings derived from the clinic's configured today; the browser timezone is never consulted. */
export function VisitRangePicker({ from, to, today, onChange, emptyLabel, emptyIsAll = true }: { from: string; to: string; today: string; onChange: (r: { from: string; to: string }) => void; emptyLabel?: string; emptyIsAll?: boolean }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const [month, setMonth] = useState(monthStart(from || today));
  const root = useRef<HTMLDivElement>(null);
  const active: VisitPreset | null = !from && !to && !emptyIsAll ? null : detectPreset(from, to, today);
  const [y, m] = month.split("-").map(Number);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", down); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", down); window.removeEventListener("keydown", key); };
  }, [open]);
  const toggle = () => { setDraft({ from, to }); setMonth(monthStart(from || today)); setCustom(active === "custom"); setOpen(v => !v); };
  const pick = (p: VisitPreset) => {
    if (p === "custom") { setCustom(true); return; }
    onChange(presetRange(p, today)); setOpen(false);
  };
  const click = (d: string) => setDraft(c => !c.from || c.to ? { from: d, to: "" } : d < c.from ? { from: d, to: c.from } : { from: c.from, to: d });
  const label = !from && !to && emptyLabel ? emptyLabel : rangeLabel(from, to, today);
  return <div className="vrp" ref={root} data-testid="visit-range-picker">
    <div className="vrp-trigger-row">
      {from && to && <button type="button" className="vrp-icon" aria-label="Previous period" onClick={() => onChange(stepRange(from, to, -1))} data-testid="button-range-prev"><ChevronLeft size={15} aria-hidden /></button>}
      <button type="button" className="vrp-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={toggle} data-testid="button-visit-range"><CalendarDays size={15} aria-hidden /><span data-testid="text-range-current">{label}</span><ChevronDown size={14} aria-hidden /></button>
      {from && to && <button type="button" className="vrp-icon" aria-label="Next period" onClick={() => onChange(stepRange(from, to, 1))} data-testid="button-range-next"><ChevronRight size={15} aria-hidden /></button>}
    </div>
    {open && <div className="vrp-pop" role="dialog" aria-label="Visit date range">
      <div className="vrp-presets" role="group" aria-label="Visit date presets">
        {VISIT_PRESETS.map(p => <button type="button" key={p.key} aria-pressed={custom ? p.key === "custom" : active === p.key} onClick={() => pick(p.key)} data-testid={`button-range-${p.key}`}>{p.label}</button>)}
      </div>
      {custom && <div className="vrp-cal">
        <div className="vrp-cal-head">
          <button type="button" className="vrp-icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={15} aria-hidden /></button>
          <select aria-label="Month" value={m} onChange={e => setMonth(`${y}-${String(e.target.value).padStart(2, "0")}-01`)}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
          <select aria-label="Year" value={y} onChange={e => setMonth(`${e.target.value}-${String(m).padStart(2, "0")}-01`)}>{Array.from({ length: 11 }, (_, i) => y - 5 + i).map(v => <option key={v} value={v}>{v}</option>)}</select>
          <button type="button" className="vrp-icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={15} aria-hidden /></button>
        </div>
        <div className="vrp-grid">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => <span key={d} className="vrp-dow" aria-hidden>{d}</span>)}
          {monthGrid(month).map((d, i) => d ? <button type="button" key={d} aria-label={formatDate(d)} aria-pressed={d === draft.from || d === draft.to}
            className={[d === today ? "is-today" : "", draft.from && draft.to && d > draft.from && d < draft.to ? "in-range" : ""].join(" ")} onClick={() => click(d)}>{Number(d.slice(8))}</button> : <span key={`p${i}`} />)}
        </div>
        <p className="vrp-hint">{draft.from ? `${formatDate(draft.from)} – ${draft.to ? formatDate(draft.to) : "select end date"}` : "Select a start date"}</p>
        <div className="vrp-actions">
          <button type="button" onClick={() => { setCustom(false); setOpen(false); }} data-testid="button-range-cancel">Cancel</button>
          <button type="button" className="button small" disabled={!draft.from} onClick={() => { onChange({ from: draft.from, to: draft.to || draft.from }); setOpen(false); }} data-testid="button-range-apply">Apply</button>
        </div>
      </div>}
    </div>}
  </div>;
}
