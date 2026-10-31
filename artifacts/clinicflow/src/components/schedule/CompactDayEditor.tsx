import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Plus, Trash2, Lock, ArrowRight, Copy } from "lucide-react";
import "./compact-day.css";
import { IconAction } from "../IconAction";
import { TimeFormatInput } from "../DateFormatInput";
import { SearchableSelect } from "../SearchableSelect";
import { TimezoneSelect } from "../TimezoneSelect";
import { useConfirm } from "../ConfirmDialog";
import { formatTime } from "../../lib/date-time";
import { queueModeLabel } from "../../lib/schedule-facts";
import { DAYS, ORDER, type OpeningHour } from "./week-days";
import { addCopiedSlot, copyDay, dayErrors, dayWarnings, draftKey, outsideHours, type DraftDay, type DraftSession, type ScheduleRow, type SessionSettings } from "./week-plan";
import { WEEK_DURATIONS, applyWeekDuration, ensureWeekDuration, needsWeekDurationChoice, weekDuration } from "./week-duration";

const QUEUE_MODES = [["mixed", "Appointments and walk-ins"], ["appointmentsOnly", "Appointments only"], ["walkInsOnly", "Walk-ins only"]];
type CopyState = { source: string; mode: "day" | "slot"; slotKey: string };
const NO_COPY: CopyState = { source: "", mode: "day", slotKey: "" };

/** Full-week Mon-Sun editor. Pure draft; never saves. */
export function CompactDayEditor({ week, setWeek, opening, preferences, busy = false, rows: _rows = [], template, onChange, selected, onSelect, focus, dayStatus, protectedDays = [] }: {
  week: DraftDay[]; setWeek: (update: (week: DraftDay[]) => DraftDay[]) => void; opening: OpeningHour[] | null; preferences: any;
  busy?: boolean; rows?: ScheduleRow[]; template?: Record<string, unknown>; onChange?: () => void; selected?: number; onSelect?: (day: number) => void;
  focus?: { day: number; index: number; field?: string; nonce: number } | null;
  dayStatus?: ReactNode | ((day: number) => ReactNode);
  protectedDays?: number[];
}) {
  const confirm = useConfirm();
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState<Record<number, CopyState>>({});
  const fmt = (t: string) => formatTime(t, preferences);
  const dur = weekDuration(week, template);
  const common = dur.mixed || !WEEK_DURATIONS.includes(Number(dur.value)) ? undefined : Number(dur.value);
  const needChoice = needsWeekDurationChoice(week);
  const touch = (d: number) => { onChange?.(); onSelect?.(d); };
  const setDay = (day: number, update: (current: DraftDay)=>DraftDay) => { touch(day); setWeek(w => w.map(d => d.dayOfWeek === day ? update(d) : d)); };
  const patch = (day: number, key: string, p: Partial<DraftSession> | ((s: DraftSession) => Partial<DraftSession>)) => {
    touch(day);
    setWeek(w => w.map(d => d.dayOfWeek !== day ? d : { ...d, sessions: d.sessions.map(x => x.key !== key ? x : { ...x, ...(typeof p === "function" ? p(x) : p) }) }));
  };
  const setting = (day: number, s: DraftSession, k: keyof SessionSettings, v: string | number | null) => patch(day, s.key, c => ({ settings: { ...c.settings, [k]: v } }));
  const setCopy = (d: number, c: Partial<CopyState> | null) => setCopies(m => ({ ...m, [d]: c ? { ...(m[d] || NO_COPY), ...c } : NO_COPY }));

  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => {
      const slot = root.current?.querySelector<HTMLElement>(`[data-day-row="${focus.day}"] [data-slot-focus="${focus.index}"]`) || root.current?.querySelector<HTMLElement>(`[data-day-row="${focus.day}"]`);
      if (!slot) return;
      const field = focus.field ? slot.querySelector<HTMLElement>(`[data-field="${focus.field}"]`) || root.current?.querySelector<HTMLElement>(`[data-day-row="${focus.day}"] [data-field="${focus.field}"]`) : null;
      if (field) field.closest("details")?.setAttribute("open", "");
      else if (focus.field) slot.querySelectorAll<HTMLDetailsElement>("details").forEach(d => { d.open = true; });
      const target = field?.matches("input,button,select") ? field : field?.querySelector<HTMLElement>("input:not(:disabled),button:not(:disabled)");
      (target || slot.querySelector<HTMLElement>("input:not(:disabled),button:not(:disabled)") || slot).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const chooseDuration = async (v: string) => {
    const n = Number(v); if (!WEEK_DURATIONS.includes(n) || (String(n) === dur.value && !needChoice)) return;
    const offDrafts = week.some(d => !d.isOpen && d.sessions.some(s => !s.locked));
    if (!await confirm.ask({ title: `Use ${n} minutes for the whole week?`, description: `Every editable session in this week${offDrafts ? ", including draft slots kept on days that are off," : ""} will use ${n}-minute consultations.${dur.mixed ? ` Current values (${dur.values.join(", ")} min) are replaced.` : ""} Other settings are unchanged. Nothing is saved until you save the schedule.`, confirmLabel: "Apply to Week" })) return;
    onChange?.(); setWeek(w => applyWeekDuration(w, n));
  };
  const durationOptions = () => {
    const opts: {value:string;label:string;disabled?:boolean}[] = WEEK_DURATIONS.map(v => ({ value: String(v), label: `${v} minutes` }));
    dur.values.filter(v => !WEEK_DURATIONS.includes(v)).forEach(v => opts.unshift({ value: String(v), label: `${v} minutes (legacy)`, disabled:true }));
    return opts;
  };
  const runCopy = async (target: number) => {
    const c = copies[target]; if (!c?.source) return;
    const src = week[Number(c.source)];
    if (dur.mixed) return;
    if (c.mode === "day") {
      const replaces = week[target].sessions.some(s => !s.locked);
      if (!await confirm.ask({ title: `Copy ${DAYS[src.dayOfWeek]} to ${DAYS[target]}?`, description: `${replaces ? `This replaces the editable slots on ${DAYS[target]} in the draft. ` : ""}Working-day state, times and compatible settings are copied. Nothing is saved until you save the schedule; ${DAYS[src.dayOfWeek]} is not changed.`, confirmLabel: "Copy Day" })) return;
      touch(target); setWeek(w => { const n = copyDay(w, src.dayOfWeek, [target]); return common ? ensureWeekDuration(n, common) : n; });
    } else {
      const slot = src.sessions.find(s => s.key === c.slotKey); if (!slot) return;
      if (!await confirm.ask({ title: "Add Copied Slot?", description: `${fmt(slot.startTime)} – ${fmt(slot.endTime)} from ${DAYS[src.dayOfWeek]} is added to ${DAYS[target]} in the draft. Existing slots are kept; conflicts are shown after copying.`, confirmLabel: "Add Slot" })) return;
      touch(target); setWeek(w => { const n = addCopiedSlot(w, src.dayOfWeek, target, c.slotKey); return common ? ensureWeekDuration(n, common) : n; });
    }
    setCopy(target, null);
  };
  const errors = week.map(d => dayErrors(d, template));

  return <div ref={root} className="cde cde-week" data-testid="compact-day-editor">
    {confirm.dialog}
    {dur.mixed && <p className="notice cde-mixed" role="status" data-testid="text-duration-mixed">This week has mixed consultation durations ({dur.values.join(", ")} min). They stay unchanged unless you choose one duration for the week. Copying between days needs one common duration first.</p>}
    {needChoice && !dur.mixed && <p className="field-error cde-mixed" role="alert" data-testid="text-duration-required">New slots need a supported consultation duration (20, 30 or 60 minutes). Choose one for the week{dur.value ? ` instead of the legacy ${dur.value} minutes` : ""}.</p>}
    <div className="cde-grid" role="table" aria-label="Weekly schedule">
      <div className="cde-wrow cde-whead" role="row">
        <span role="columnheader">Day</span><span role="columnheader">Working Day</span><span role="columnheader">Time Slots</span>
        <span role="columnheader">Consultation Duration <small className="cde-hint">Same for the whole week</small></span><span role="columnheader">Actions</span>
      </div>
      {ORDER.map(d => {
        const day = week[d];
        const locked = protectedDays.includes(d) || day.sessions.some(s => s.locked);
        const errs = errors[d];
        const hours = (opening || []).filter(h => h.dayOfWeek === d);
        const outside = day.isOpen ? day.sessions.flatMap((s, i) => outsideHours(s, hours, opening !== null) ? [i + 1] : []) : [];
        const c = copies[d] || NO_COPY;
        const src = c.source === "" ? undefined : week[Number(c.source)];
        const slotSources = src?.sessions.filter(s => s.startTime && s.endTime) || [];
        const status = typeof dayStatus === "function" ? dayStatus(d) : d === selected ? dayStatus : null;
        const durId = `${uid}-dur-${d}`;
        return <div key={d} className={`cde-wrow${errs.length ? " is-invalid" : ""}${d === selected ? " is-selected" : ""}`} role="row" data-day-row={d} data-testid={`row-day-${d}`}>
          <div className="cde-wday" role="cell"><strong>{DAYS[d]}</strong>{status && <div className="cde-day-status">{status}</div>}</div>
          <div role="cell" className="cde-wcell">
            <label className="registration-check cde-switch"><input type="checkbox" role="switch" checked={day.isOpen} disabled={busy || locked} aria-describedby={locked ? `${uid}-locked-${d}` : undefined} onChange={e => { const open=e.target.checked; setDay(d,current=>({ ...current, isOpen: open, sessions: open && !current.sessions.length ? [{ key: draftKey(), startTime: "", endTime: "", settings: common ? { consultationMinutes: common } : undefined }] : current.sessions })); }} data-testid={`toggle-working-day-${d}`} data-field="isOpen"/><span>{day.isOpen ? "Working day" : "Off"}</span><span className="sr-only"> {DAYS[d]}</span></label>
          </div>
          <div role="cell" className="cde-wcell cde-slots">
            {!day.isOpen ? <p className="muted" data-testid={`text-day-off-${d}`}>{day.sessions.length ? "Off. Draft slots return if you turn it back on." : "No slots. Turn on working day to add time slots."}</p> : <>
              {day.sessions.map((s, i) => {
                const rowErrs = errs.filter(e => new RegExp(`[Ss]ession ${i + 1}\\b`).test(e));
                const dis = busy || !!s.locked;
                return <div className="cde-slot" key={s.key} data-slot-focus={i}>
                  <div className="cde-slot-line">
                    <span data-field="startTime"><TimeFormatInput required value={s.startTime} preferences={preferences} disabled={dis} aria-label={`${DAYS[d]} slot ${i + 1} start time`} aria-invalid={rowErrs.length > 0} onChange={v => patch(d, s.key, { startTime: v })}/></span>
                    <ArrowRight size={14} aria-hidden className="cde-arrow"/>
                    <span data-field="endTime"><TimeFormatInput required value={s.endTime} preferences={preferences} disabled={dis} aria-label={`${DAYS[d]} slot ${i + 1} end time`} aria-invalid={rowErrs.length > 0} onChange={v => patch(d, s.key, { endTime: v })}/></span>
                    {s.locked ? <span title="Managed in Clinic settings" className="cde-lock"><Lock size={14} aria-label="Linked to clinic hours"/></span> : <IconAction label={`Remove ${DAYS[d]} slot ${i + 1}`} hint="Remove slot" disabled={busy} icon={<Trash2 size={14} aria-hidden/>} onClick={() => busy ? undefined : setDay(d,current=>({ ...current, sessions: current.sessions.filter(x => x.key !== s.key) }))}/>}
                  </div>
                  {rowErrs.length > 0 && <small className="field-error" role="alert">{rowErrs.join(" ")}</small>}
                  <details className="cde-adv"><summary><span className="cde-adv-title">Advanced settings</span><span className="cde-slot-tag">Slot {i + 1}</span></summary><div className="form-grid">
                    <label data-field="maxTokens">Max tokens<input type="number" min={1} max={1000} step={1} disabled={dis} value={String(s.settings?.maxTokens ?? "")} placeholder={template?.maxTokens ? String(template.maxTokens) : ""} onChange={e => setting(d, s, "maxTokens", e.target.value === "" ? "" : Number(e.target.value))}/></label>
                    <label data-field="tokenPrefix">Token prefix<input maxLength={8} disabled={dis} value={String(s.settings?.tokenPrefix ?? "")} placeholder={template?.tokenPrefix ? String(template.tokenPrefix) : ""} onChange={e => setting(d, s, "tokenPrefix", e.target.value.replace(/[^A-Za-z0-9]/g, ""))}/></label>
                    <label data-field="bufferMinutes">Buffer (min)<input type="number" min={0} max={1440} step={1} disabled={dis} value={String(s.settings?.bufferMinutes ?? "")} onChange={e => setting(d, s, "bufferMinutes", e.target.value === "" ? 0 : Number(e.target.value))}/></label>
                    <fieldset disabled={dis} data-field="timezone"><legend>Session timezone</legend>
                      <label><input type="checkbox" checked={!s.settings?.timezone || s.settings.timezone === preferences.timezone} onChange={e => setting(d, s, "timezone", e.target.checked ? preferences.timezone : "UTC")}/>Use location timezone ({preferences.timezone || "not configured"})</label>
                      <TimezoneSelect value={String(s.settings?.timezone || preferences.timezone || "")} onChange={v => setting(d, s, "timezone", v)}/>
                    </fieldset>
                    <div data-field="queueMode"><SearchableSelect label="Queue mode" value={String(s.settings?.queueMode ?? "")} disabled={dis} placeholder={queueModeLabel(template?.queueMode)} onChange={v => setting(d, s, "queueMode", v)} options={QUEUE_MODES.map(([value, label]) => ({ value, label }))}/></div>
                    {(["breakStart", "breakEnd", "queueOpenTime", "queueCloseTime"] as const).map(k => <label key={k} data-field={k}>{{ breakStart: "Break start", breakEnd: "Break end", queueOpenTime: "Queue opens", queueCloseTime: "Queue closes" }[k]}<TimeFormatInput value={String(s.settings?.[k] ?? "")} preferences={preferences} disabled={dis} onChange={v => setting(d, s, k, v || null)} onDraftValidityChange={ok => patch(d, s.key, cur => ({ invalidTimes: ok ? cur.invalidTimes?.filter(x => x !== k) : [...new Set([...cur.invalidTimes || [], k])] }))}/></label>)}
                  </div></details>
                </div>;
              })}
              <button type="button" className="button secondary small cde-add" disabled={busy || locked} onClick={() => setDay(d,current=>({ ...current, isOpen: true, sessions: [...current.sessions, { key: draftKey(), startTime: "", endTime: "", settings: common ? { consultationMinutes: common } : undefined }] }))} data-testid={`button-add-time-slot-${d}`}><Plus size={14} aria-hidden/> Add Time Slot</button>
            </>}
            {locked && <p className="muted cde-note" id={`${uid}-locked-${d}`}>These sessions follow clinic hours. Ask an authorized doctor or administrator to customize this day.</p>}
            {!!outside.length && <p className="cde-note notice" role="status" data-testid={`text-outside-hours-${d}`}>{outside.length === 1 ? "Slot" : "Slots"} {outside.join(", ")}: Outside usual location hours. Allowed.</p>}
            {dayWarnings(day).map(w => <p key={w} className="notice cde-note">{w}</p>)}
            {errs.filter(e => !/ession \d/.test(e)).length > 0 && <p className="field-error cde-note" role="alert">{errs.filter(e => !/ession \d/.test(e)).join(" ")}</p>}
          </div>
          <div role="cell" className="cde-wcell" data-field="consultationMinutes">
            {day.isOpen && day.sessions.length ? <>
              <small className="cde-mobile-label">Consultation duration · whole week</small>
              <span className="sr-only" id={durId}>Consultation duration, same choice for the whole week ({DAYS[d]} row)</span>
              <SearchableSelect aria-labelledby={durId} clearable={false} value={dur.value} disabled={busy || week.some(day=>day.sessions.some(s=>s.locked))} placeholder={dur.mixed ? "Mixed" : "Select…"} onChange={v => void chooseDuration(v)} options={durationOptions()} testId={`select-duration-${d}`}/>
            </> : <span className="muted">--</span>}
          </div>
          <div role="cell" className="cde-wcell cde-actions">
            <span className="sr-only" id={`${uid}-copy-${d}`}>Copy to {DAYS[d]} from</span>
            <SearchableSelect aria-labelledby={`${uid}-copy-${d}`} value={c.source} disabled={busy || locked} placeholder="Copy from" testId={`select-copy-from-${d}`} onChange={v => setCopy(d, { source: v, slotKey: "" })} options={ORDER.filter(x => x !== d).map(x => ({ value: String(x), label: DAYS[x] }))}/>
            {src && <div className="cde-copy" role="group" aria-label={`Copy options for ${DAYS[d]}`} data-testid={`copy-from-panel-${d}`}>
              <SearchableSelect label="Copy" value={c.mode} onChange={v => setCopy(d, { mode: v === "slot" ? "slot" : "day" })} options={[{ value: "day", label: "Entire day" }, { value: "slot", label: "One time slot" }]}/>
              {c.mode === "slot" && <SearchableSelect label="Source slot" value={c.slotKey} onChange={v => setCopy(d, { slotKey: v })} placeholder={slotSources.length ? "Choose slot…" : "No slots on that day"} options={slotSources.map(s => ({ value: s.key, label: `${fmt(s.startTime)} – ${fmt(s.endTime)}` }))}/>}
              {dur.mixed && <small className="field-error">Choose one consultation duration for the week before copying.</small>}
              <div className="cde-copy-btns">
                <button type="button" className="button secondary small" onClick={() => setCopy(d, null)} data-testid={`button-copy-cancel-${d}`}>Cancel</button>
                <button type="button" className="button small" disabled={busy || locked || dur.mixed || (c.mode === "slot" && !c.slotKey)} onClick={() => void runCopy(d)} data-testid={`button-copy-from-apply-${d}`}><Copy size={13} aria-hidden/> Copy</button>
              </div>
            </div>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}
