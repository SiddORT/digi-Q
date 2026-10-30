import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, Lock } from "lucide-react";
import "./compact-day.css";
import { FormTabs } from "../FormTabs";
import { IconAction } from "../IconAction";
import { TimeFormatInput } from "../DateFormatInput";
import { SearchableSelect } from "../SearchableSelect";
import { TimezoneSelect } from "../TimezoneSelect";
import { useConfirm } from "../ConfirmDialog";
import { formatTime } from "../../lib/date-time";
import { queueModeLabel } from "../../lib/schedule-facts";
import { DAYS, SHORT, ORDER, type OpeningHour } from "./week-days";
import { addCopiedSlot, copyDay, dayErrors, dayWarnings, draftKey, outsideHours, type DraftDay, type DraftSession, type ScheduleRow, type SessionSettings } from "./week-plan";

const DURATIONS = [20, 30, 60];
const QUEUE_MODES = [["mixed", "Appointments and walk-ins"], ["appointmentsOnly", "Appointments only"], ["walkInsOnly", "Walk-ins only"]];

/** One-panel Mon-Sun editor. Pure draft; never saves. */
export function CompactDayEditor({ week, setWeek, opening, preferences, busy = false, rows = [], template, onChange, selected, onSelect, focus, dayStatus, protectedDays = [] }: {
  week: DraftDay[]; setWeek: (update: (week: DraftDay[]) => DraftDay[]) => void; opening: OpeningHour[] | null; preferences: any;
  busy?: boolean; rows?: ScheduleRow[]; template?: Record<string, unknown>; onChange?: () => void; selected: number; onSelect: (day: number) => void;
  focus?: { day: number; index: number; nonce: number } | null;
  dayStatus?: ReactNode;
  protectedDays?: number[];
}) {
  const confirm = useConfirm();
  const copyLabelId=useId();
  const root=useRef<HTMLDivElement>(null);
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<"day" | "slot">("day");
  const [slotKey, setSlotKey] = useState("");
  const day = week[selected];
  const dayLocked = protectedDays.includes(selected) || day.sessions.some(s => s.locked);
  const errors = week.map(d=>dayErrors(d,template));
  const fmt = (t: string) => formatTime(t, preferences);
  const set = (next: DraftDay) => { onChange?.(); setWeek(w => w.map(d => d.dayOfWeek === next.dayOfWeek ? next : d)); };
  const hours = (opening || []).filter(h => h.dayOfWeek === selected);
  const patch = (key: string, p: Partial<DraftSession> | ((s:DraftSession)=>Partial<DraftSession>)) => {
    onChange?.();
    setWeek(w=>w.map(d=>d.dayOfWeek!==selected?d:{...d,sessions:d.sessions.map(x=>x.key!==key?x:{...x,...(typeof p==="function"?p(x):p)})}));
  };
  const setting = (s: DraftSession, k: keyof SessionSettings, v: string | number | null) => patch(s.key, current=>({ settings: { ...current.settings, [k]: v } }));
  useEffect(() => { setSource(""); setSlotKey(""); }, [selected]);
  useEffect(() => {
    if(!focus||focus.day!==selected)return;
    const frame=requestAnimationFrame(()=>{
      const slot=root.current?.querySelector<HTMLElement>(`[data-slot-focus="${focus.index}"]`);
      if(slot)slot.querySelectorAll<HTMLDetailsElement>("details").forEach(d=>{d.open=true;});
      (slot?.querySelector<HTMLElement>('input:not(:disabled),button:not(:disabled)')||slot)?.focus();
    });
    return ()=>cancelAnimationFrame(frame);
  }, [focus, selected]);
  const src = source === "" ? undefined : week[Number(source)];
  const copy = async () => {
    if (!src) return;
    if (mode === "day") {
      const replaces = day.sessions.some(s => !s.locked);
      if (!await confirm.ask({ title: `Copy ${DAYS[src.dayOfWeek]} to ${DAYS[selected]}?`, description: `${replaces ? `This replaces the editable slots on ${DAYS[selected]} in the draft. ` : ""}Working-day state, times and compatible settings are copied. Nothing is saved until you save the schedule; ${DAYS[src.dayOfWeek]} is not changed.`, confirmLabel: "Copy Day" })) return;
      onChange?.(); setWeek(w => copyDay(w, src.dayOfWeek, [selected]));
    } else {
      const slot = src.sessions.find(s => s.key === slotKey); if (!slot) return;
      if (!await confirm.ask({ title: "Add Copied Slot?", description: `${fmt(slot.startTime)} – ${fmt(slot.endTime)} from ${DAYS[src.dayOfWeek]} is added to ${DAYS[selected]} in the draft. Existing slots are kept; conflicts are shown after copying.`, confirmLabel: "Add Slot" })) return;
      onChange?.(); setWeek(w => addCopiedSlot(w, src.dayOfWeek, selected, slotKey));
    }
    setSource(""); setSlotKey("");
  };
  const durationOptions = (s: DraftSession) => {
    const cur = s.settings?.consultationMinutes ?? (s.id ? rows.find(r => r.id === s.id)?.consultationMinutes : undefined);
    const opts = DURATIONS.map(v => ({ value: String(v), label: `${v} min` }));
    if (cur !== undefined && cur !== null && cur !== "" && !DURATIONS.includes(Number(cur))) opts.unshift({ value: String(cur), label: `${cur} min (legacy)` });
    return opts;
  };
  const errs = errors[selected];
  const slotSources = src?.sessions.filter(s => s.startTime && s.endTime) || [];
  const outsideSlots = day.isOpen ? day.sessions.flatMap((s,i)=>outsideHours(s,hours,opening!==null)?[i+1]:[]) : [];
  return <div ref={root} className="cde" data-testid="compact-day-editor">
    {confirm.dialog}
    <FormTabs idPrefix="cde" wide={false} label="Day of week" tabs={ORDER.map(d => SHORT[d])} icons={ORDER.map(() => "weekly")} active={ORDER.indexOf(selected)} onChange={i => onSelect(ORDER[i])} invalid={ORDER.map(d => errors[d].length > 0)}/>
    {dayStatus}
    <div className="cde-controls" role="tabpanel" id="cde-panel" aria-labelledby={`cde-tab-${ORDER.indexOf(selected)}`}>
      <div className="cde-day-controls">
      <strong className="cde-day">{DAYS[selected]}</strong>
      <label className="registration-check"><input type="checkbox" role="switch" checked={day.isOpen} disabled={busy || dayLocked} aria-describedby={dayLocked?"cde-locked-reason":undefined} onChange={e => set({ ...day, isOpen: e.target.checked })} data-testid="toggle-working-day"/>Working day</label>
      </div>
      <div className="cde-day-actions">
      <div className="cde-copy-from"><span id={copyLabelId}>Copy from</span><SearchableSelect aria-labelledby={copyLabelId} value={source} disabled={busy || dayLocked} placeholder="Choose day…" testId="select-copy-from" onChange={v => { setSource(v); setSlotKey(""); }} options={ORDER.filter(d => d !== selected).map(d => ({ value: String(d), label: DAYS[d] }))}/></div>
      <button type="button" className="button secondary field-action" disabled={busy || dayLocked} onClick={() => { set({ ...day, isOpen: true, sessions: [...day.sessions, { key: draftKey(), startTime: "", endTime: "" }] }); }} data-testid="button-add-time-slot"><Plus size={14} aria-hidden/> Add Time Slot</button>
      </div>
    </div>
    {dayLocked&&<p className="muted" id="cde-locked-reason">These sessions follow clinic hours. Ask an authorized doctor or administrator to customize this day.</p>}
    {src && <div className="cde-controls cde-copy" role="group" aria-label="Copy options" data-testid="copy-from-panel">
      <SearchableSelect label="Copy" value={mode} onChange={v => setMode(v === "slot" ? "slot" : "day")} options={[{ value: "day", label: "Entire day" }, { value: "slot", label: "One time slot" }]}/>
      {mode === "slot" && <SearchableSelect label="Source slot" value={slotKey} onChange={setSlotKey} placeholder={slotSources.length ? "Choose slot…" : "No slots on that day"} options={slotSources.map(s => ({ value: s.key, label: `${fmt(s.startTime)} – ${fmt(s.endTime)}` }))}/>}
      <button type="button" className="button secondary small" disabled={busy || dayLocked || (mode === "slot" && !slotKey)} onClick={() => void copy()} data-testid="button-copy-from-apply">Copy</button>
      <button type="button" className="button secondary small" onClick={() => { setSource(""); setSlotKey(""); }}>Cancel Copy</button>
    </div>}
    {!day.isOpen ? <p className="muted" data-testid="text-day-off">Not a working day. Draft slots return if you turn it back on.</p> :
      <div className="cde-rows">
        <div className="cde-row cde-head" aria-hidden><span>Slot</span><span>Start Time</span><span>End Time</span><span>Consultation Duration</span><span/></div>
        {day.sessions.map((s, i) => {
          const rowErrs = errs.filter(e => new RegExp(`(Session ${i + 1}\\b|session ${i + 1}\\b)`).test(e));
          return <div className="cde-row" key={s.key} data-slot-focus={i}>
          <span className="cde-num"><span className="cde-lbl">Slot </span>{i + 1}</span>
           <div className="cde-cell"><span className="cde-lbl" aria-hidden>Start Time</span><TimeFormatInput required value={s.startTime} preferences={preferences} disabled={busy || s.locked} aria-describedby={s.locked?"cde-locked-reason":undefined} aria-label={`Slot ${i + 1} start time`} aria-invalid={rowErrs.length > 0} onChange={value => patch(s.key, { startTime: value })}/></div>
           <div className="cde-cell"><span className="cde-lbl" aria-hidden>End Time</span><TimeFormatInput required value={s.endTime} preferences={preferences} disabled={busy || s.locked} aria-describedby={s.locked?"cde-locked-reason":undefined} aria-label={`Slot ${i + 1} end time`} aria-invalid={rowErrs.length > 0} onChange={value => patch(s.key, { endTime: value })}/></div>
          <div className="cde-cell"><span className="cde-lbl" id={`cde-dur-${s.key}`}>Consultation Duration<span className="sr-only"> for slot {i + 1}</span></span><SearchableSelect aria-labelledby={`cde-dur-${s.key}`} value={String(s.settings?.consultationMinutes ?? "")} disabled={busy || s.locked} placeholder={DURATIONS.includes(Number(template?.consultationMinutes)) ? `${template?.consultationMinutes} min (default)` : "Select…"} onChange={v => setting(s, "consultationMinutes", Number(v))} options={durationOptions(s)}/></div>
          {s.locked ? <span title="Managed in Clinic settings"><Lock size={14} aria-label="Linked to clinic hours"/></span> : <IconAction label={`Remove slot ${i + 1}`} hint="Remove slot" disabled={busy} icon={<Trash2 size={15} aria-hidden/>} onClick={() => busy ? undefined : set({ ...day, sessions: day.sessions.filter(x => x.key !== s.key) })}/>}
          {rowErrs.length > 0 && <small className="field-error cde-warn" role="alert">{rowErrs.join(" ")}</small>}
           <details className="cde-adv" aria-label={`Slot ${i + 1} capacity, breaks and queue settings`}><summary><span className="cde-adv-title">Capacity, breaks and queue settings</span><span className="cde-slot-tag">Slot {i + 1}</span></summary><div className="form-grid" aria-describedby={s.locked?"cde-locked-reason":undefined}>
            <label>Max tokens<input type="number" min={1} max={1000} step={1} disabled={busy || s.locked} value={String(s.settings?.maxTokens ?? "")} placeholder={template?.maxTokens ? String(template.maxTokens) : ""} onChange={e => setting(s, "maxTokens", e.target.value === "" ? "" : Number(e.target.value))}/></label>
            <label>Token prefix<input maxLength={8} disabled={busy || s.locked} value={String(s.settings?.tokenPrefix ?? "")} placeholder={template?.tokenPrefix ? String(template.tokenPrefix) : ""} onChange={e => setting(s, "tokenPrefix", e.target.value.replace(/[^A-Za-z0-9]/g, ""))}/></label>
            <label>Buffer (min)<input type="number" min={0} max={1440} step={1} disabled={busy || s.locked} value={String(s.settings?.bufferMinutes ?? "")} onChange={e => setting(s, "bufferMinutes", e.target.value === "" ? 0 : Number(e.target.value))}/></label>
             <fieldset disabled={busy || s.locked}><legend>Session timezone</legend>
               <label><input type="checkbox" checked={!s.settings?.timezone || s.settings.timezone === preferences.timezone} onChange={e=>setting(s,"timezone",e.target.checked ? preferences.timezone : "UTC")}/>Use location timezone ({preferences.timezone || "not configured"})</label>
               <TimezoneSelect value={String(s.settings?.timezone || preferences.timezone || "")} onChange={v=>setting(s,"timezone",v)}/>
             </fieldset>
             <SearchableSelect label="Queue mode" value={String(s.settings?.queueMode ?? "")} disabled={busy || s.locked} placeholder={queueModeLabel(template?.queueMode)} onChange={v => setting(s, "queueMode", v)} options={QUEUE_MODES.map(([value, label]) => ({ value, label }))}/>
            {(["breakStart", "breakEnd", "queueOpenTime", "queueCloseTime"] as const).map(k => <label key={k}>{{ breakStart: "Break start", breakEnd: "Break end", queueOpenTime: "Queue opens", queueCloseTime: "Queue closes" }[k]}<TimeFormatInput value={String(s.settings?.[k] ?? "")} preferences={preferences} disabled={busy || s.locked} onChange={value => setting(s, k, value || null)} onDraftValidityChange={valid=>patch(s.key,current=>({invalidTimes:valid?current.invalidTimes?.filter(key=>key!==k):[...new Set([...current.invalidTimes||[],k])]}))}/></label>)}
          </div></details>
        </div>; })}
        {!day.sessions.length && <p className="muted">No slots yet. Use Add Time Slot.</p>}
      </div>}
    {!!outsideSlots.length && <p className="cde-warn notice" data-testid="selected-day-outside-hours" role="status">{outsideSlots.length===1?"Slot":"Slots"} {outsideSlots.join(", ")}: Outside usual location hours. Allowed.</p>}
    {dayWarnings(day).map(w => <p key={w} className="notice">{w}</p>)}
    {errs.filter(e => !/ession \d/.test(e)).length > 0 && <p className="field-error" role="alert">{errs.filter(e => !/ession \d/.test(e)).join(" ")}</p>}
    {errors.some((e, d) => d !== selected && e.length) && <p className="field-error" role="alert">Fix errors on: {ORDER.filter(d => d !== selected && errors[d].length).map(d => SHORT[d]).join(", ")}.</p>}
  </div>;
}
