import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Plus, Trash2, Lock, Pencil } from "lucide-react";
import { IconAction } from "../IconAction";
import { TimeRangeSlider } from "../ClinicRegistrationHours";
import { TimeFormatInput } from "../DateFormatInput";
import { SearchableSelect } from "../SearchableSelect";
import { AppDialog } from "../AppDialog";
import { HelpTip } from "../HelpTip";
import { useConfirm } from "../ConfirmDialog";
import { formatTime } from "../../lib/date-time";
import { friendlyError } from "../../lib/friendly-error";
import { notifyBulk } from "../../lib/notify";
import { useDateTimePreferences } from "../DateTimePreferences";
import { buildWeek, canOpenDetails, openDetails, copyDay, dayErrors, dayWarnings, draftKey, executePlan, outsideHours, planWeek, reconcileDraft, weekSummary, SUGGESTED_SESSIONS_PER_DAY, type DraftDay, type DraftSession, type ScheduleRow } from "./week-plan";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
type Hours = { startTime: string; endTime: string }[];

function adjustToHours(s: DraftSession, hours: Hours): DraftSession {
  const overlap = hours.find(h => h.startTime < s.endTime && s.startTime < h.endTime) || hours[0];
  if (!overlap) return s;
  return { ...s, startTime: s.startTime < overlap.startTime || s.startTime >= overlap.endTime ? overlap.startTime : s.startTime, endTime: s.endTime > overlap.endTime || s.endTime <= overlap.startTime ? overlap.endTime : s.endTime };
}

/** Monday–Sunday editor over the existing one-record-per-session schedule model. Saves are per session, not atomic. */
export function WeeklyScheduleEditor({ doctorId, branchId, onEdit, onDirtyChange }: { doctorId: string; branchId: string; onEdit: (row: any) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const client = useQueryClient();
  const confirmation = useConfirm();
  const inherited = useDateTimePreferences();
  const branch = api.useGetBranch(branchId, { query: { queryKey: api.getGetBranchQueryKey(branchId), enabled: !!branchId } });
  const q = useQuery<{ items: ScheduleRow[] }>({ queryKey: ["weekly-overview", doctorId, branchId], queryFn: async () => { const items: any[] = []; for (let page = 1; page < 50; page++) { const res: any = await api.listSchedules({ doctorId, branchId, page, pageSize: 100 } as any); items.push(...res.items); if (items.length >= res.total || !res.items.length) break; } return { items }; } });
  const rows = useMemo(() => (q.data?.items || []).filter(r => r.status !== "inactive"), [q.data]);
  const [week, setWeek] = useState<DraftDay[]>(() => buildWeek([]));
  const [targets, setTargets] = useState<Record<number, number[]>>({});
  const [defaults, setDefaults] = useState({ tokenPrefix: "", maxTokens: "", consultationMinutes: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [outside, setOutside] = useState<{ day: number; key: string }[] | null>(null);
  const initialized = useRef<string>("");
  const preserveDraft = useRef(false);
  const dirtyRef = useRef(onDirtyChange); dirtyRef.current = onDirtyChange;

  useEffect(() => { const sig = JSON.stringify(rows.map(r => [r.id, r.dayOfWeek, r.startTime, r.endTime, r.isOpen])); if (q.data && initialized.current !== sig) { initialized.current = sig; if (preserveDraft.current) preserveDraft.current = false; else setWeek(buildWeek(rows)); } }, [q.data, rows]);

  const preferences = (rows[0] as any) || branch.data || inherited;
  const fmt = (t: string) => formatTime(t, preferences);
  const opening: (Hours[number] & { dayOfWeek: number })[] | null = Array.isArray(branch.data?.openingHours) ? branch.data!.openingHours! : null;
  const hoursFor = (day: number): Hours => (opening || []).filter(h => h.dayOfWeek === day);
  const baseline = useMemo(() => JSON.stringify(buildWeek(rows).map(d => [d.isOpen, d.sessions.map(s => [s.id, s.startTime, s.endTime])])), [rows]);
  const dirty = JSON.stringify(week.map(d => [d.isOpen, d.isOpen ? d.sessions.map(s => [s.id, s.startTime, s.endTime]) : []])) !== baseline;
  useEffect(() => { dirtyRef.current?.(dirty); }, [dirty]);

  const template = rows[0] ? (rows[0] as Record<string, unknown>) : branch.data && defaults.tokenPrefix.trim() && Number(defaults.maxTokens) >= 1 && Number(defaults.consultationMinutes) >= 1 ? { doctorId, branchId, clinicId: branch.data.clinicId, timezone: branch.data.timezone, tokenPrefix: defaults.tokenPrefix.trim(), maxTokens: Number(defaults.maxTokens), consultationMinutes: Number(defaults.consultationMinutes), queueMode: "mixed" } : undefined;
  const errors = week.map(dayErrors);
  const hasErrors = errors.some(e => e.length);
  const plan = planWeek(rows, week, template, SHORT);
  const needsTemplate = !rows.length && week.some(d => d.isOpen && d.sessions.length);

  const setDay = (day: DraftDay) => { setResult(""); setWeek(w => w.map(d => d.dayOfWeek === day.dayOfWeek ? day : d)); };
  const newSession = (day: number): DraftSession => { const h = hoursFor(day)[0]; const prev = week[day].sessions[week[day].sessions.length - 1]; return { key: draftKey(), startTime: prev ? prev.endTime : h?.startTime || "09:00", endTime: prev ? "" : h?.endTime || "13:00" }; };

  const execute = async () => {
    if (busy) return;
    const p = planWeek(rows, week, template, SHORT);
    const total = p.creates.length + p.updates.length + p.deactivations.length;
    if (!total) { if (p.adopt.length) setWeek(w => reconcileDraft(w, Object.fromEntries(p.adopt.map(x => [x.key, x.id])))); setResult("No changes to save."); return; }
    if (p.deactivations.length && !await confirmation.ask({ title: "Deactivate Removed Sessions?", description: `${p.deactivations.length} session${p.deactivations.length > 1 ? "s" : ""} (${p.deactivations.map(d => d.label).join(", ")}) will be deactivated, not deleted. Past appointments and history stay. Deactivation runs last, and only if every other change saved. Each change is checked by the server's existing rules and may be refused.`, confirmLabel: "Deactivate and Save", tone: "danger" })) return;
    setBusy(true); setResult("");
    const draftAtSave = week;
    const r = await executePlan(p, { update: (id, body) => api.updateSchedule(id, body), create: body => api.createSchedule(body), deactivate: id => api.deleteSchedule(id), message: e => friendlyError(e, "save") });
    notifyBulk(r.outcomes.filter(o => !o.skipped), "saved");
    const failed = r.outcomes.filter(o => !o.ok);
    if (failed.length) {
      // Keep the whole draft, including failed edits, so the user can correct and retry. Saved records get their ids.
      preserveDraft.current = true;
      setWeek(reconcileDraft(draftAtSave, r.savedIds));
      setResult(`Partly saved: ${r.outcomes.length - failed.length} of ${r.outcomes.length} changes saved. Not saved: ${failed.map(f => `${f.label} (${f.message})`).join("; ")}. Your unsaved edits are still in the editor; correct them and save again.`);
    } else setResult(`Saved ${r.outcomes.length} change${r.outcomes.length > 1 ? "s" : ""}.`);
    await client.invalidateQueries({ queryKey: ["weekly-overview", doctorId, branchId] });
    void client.invalidateQueries();
    setBusy(false);
  };
  const save = () => {
    if (hasErrors || busy) return;
    const out: { day: number; key: string }[] = [];
    for (const d of week) if (d.isOpen) for (const s of d.sessions) if (!s.locked && outsideHours(s, hoursFor(d.dayOfWeek))) out.push({ day: d.dayOfWeek, key: s.key });
    if (out.length) { setOutside(out); return; }
    void execute();
  };

  if (q.isLoading) return <div className="skeleton" role="status">Loading weekly schedule…</div>;
  if (q.error) return <div className="error-box" role="alert">{friendlyError(q.error, "load")} <button type="button" onClick={() => void q.refetch()}>Retry</button></div>;
  const clinicName = branch.data?.name || "the clinic";

  return <section className="panel padded" data-testid="panel-weekly-editor" aria-busy={busy}>
    {confirmation.dialog}
    <div className="panel-heading section-head"><div><h3>Weekly Schedule</h3><p className="muted">{branch.data ? `Clinic timezone: ${branch.data.timezone}` : "Loading clinic hours…"}</p></div></div>
    {branch.error && <p role="alert">Clinic hours could not be loaded. <button type="button" onClick={() => void branch.refetch()}>Retry Clinic Hours</button></p>}
    <p className="notice" data-testid="text-week-summary">{weekSummary(week, SHORT, fmt)}</p>
    {dirty&&<p className="notice">When hours change, queue closing times beyond the new end are shortened to match. Queue windows that no longer fit are reset to session boundaries; valid early opening times are retained. Review individual settings with Details.</p>}
    <p className="muted">Slide in 15-minute steps or type exact minutes, for example 8:32 PM. Shaded bands show clinic hours. Add as many sessions as needed (more than {SUGGESTED_SESSIONS_PER_DAY} in a day shows a reminder); overnight sessions are not supported. Session names, breaks and capacity per session are edited with Details.</p>
    {needsTemplate && <fieldset className="registration-day" data-testid="fieldset-session-defaults"><legend>Settings for New Sessions</legend><p className="muted">This doctor has no sessions here yet. New sessions use these values; edit each one later with Details.</p><div className="form-grid">
      <label>Token prefix<span className="required"> *</span><input maxLength={8} value={defaults.tokenPrefix} onChange={e => setDefaults(v => ({ ...v, tokenPrefix: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))} data-testid="input-default-token-prefix"/></label>
      <label>Max tokens<span className="required"> *</span><input type="number" min={1} step={1} value={defaults.maxTokens} onChange={e => setDefaults(v => ({ ...v, maxTokens: e.target.value }))} data-testid="input-default-max-tokens"/></label>
      <SearchableSelect label="Expected Consultation Duration" required value={defaults.consultationMinutes} onChange={value => setDefaults(v => ({ ...v, consultationMinutes: value }))} placeholder="Select duration…" options={[20, 30, 60].map(v => ({ value: String(v), label: `${v} minutes` }))}/>
    </div></fieldset>}
    <div className="registration-hours">{ORDER.map(dayIndex => {
      const day = week[dayIndex]; const hours = hoursFor(dayIndex); const errs = errors[dayIndex]; const warns = dayWarnings(day);
      const clinicClosed = opening !== null && !hours.length && !day.sessions.some(s => s.id);
      const closedRows = rows.filter(r => r.dayOfWeek === dayIndex && r.isOpen === false);
      return <section key={dayIndex} className="registration-day" data-testid={`row-day-${dayIndex}`}>
        <div className="registration-day-heading"><strong>{DAYS[dayIndex]}</strong>
          <HelpTip text={clinicClosed ? `${clinicName} is closed on ${DAYS[dayIndex]}. Change clinic opening hours in Clinic settings first.` : day.isOpen ? `Turn off to stop sessions on ${DAYS[dayIndex]}` : `Turn on to add sessions on ${DAYS[dayIndex]}`}>
            <label className="registration-check status-switch day-open-switch"><input type="checkbox" role="switch" aria-checked={day.isOpen} checked={day.isOpen} disabled={busy || clinicClosed || day.sessions.some(s => s.locked)} onChange={e => setDay({ ...day, isOpen: e.target.checked, sessions: e.target.checked && !day.sessions.length ? [newSession(dayIndex)] : day.sessions })} data-testid={`switch-day-${dayIndex}`}/><span className="status-switch-track" aria-hidden="true"/>{day.isOpen ? "Working" : clinicClosed ? "Clinic closed" : "Off"}</label>
          </HelpTip>
          {branch.data && <small className="muted">Clinic: {opening === null ? "No hour limits set" : hours.length ? hours.map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ") : "Closed"}</small>}
        </div>
        {closedRows.length > 0 && <small className="muted">Stored as closed: {closedRows.map(r => canOpenDetails(r) ? <button type="button" className="text-link" key={r.id} onClick={() => openDetails(r, onEdit)}>{fmt(r.startTime)} – {fmt(r.endTime)}</button> : <span key={r.id}>{fmt(r.startTime)} – {fmt(r.endTime)} (linked; managed in Clinic settings) </span>)}</small>}
        {day.isOpen && <div className="registration-sessions">{day.sessions.map((s, index) => {
          const change = (patch: Partial<DraftSession>) => setDay({ ...day, sessions: day.sessions.map(x => x.key === s.key ? { ...x, ...patch } : x) });
          const row = s.id ? rows.find(r => r.id === s.id) : undefined;
          const out = !s.locked && outsideHours(s, hours);
          const label = `${DAYS[dayIndex]} session ${index + 1}`;
          return <div className="registration-session" key={s.key} data-testid={`session-${dayIndex}-${index}`}>
            <strong>Session {index + 1}{s.locked && <span className="badge"> <Lock size={12}/> Follows clinic hours</span>}{out && <span className="badge inactive"> Outside clinic hours</span>}</strong>
            {s.locked ? <p className="muted">{fmt(s.startTime)} – {fmt(s.endTime)}. This session is linked to clinic opening hours; change it through Clinic settings.</p> : <>
              <TimeRangeSlider clinicHours={hours} startTime={s.startTime} endTime={s.endTime} label={label} onChange={change}/>
              {(["startTime", "endTime"] as const).map(key => <label key={key}>{key === "startTime" ? "Start" : "End"}<span className="required"> *</span>
                <TimeFormatInput required value={s[key]} preferences={preferences} aria-invalid={errs.length > 0} aria-describedby={errs.length ? `week-error-${dayIndex}` : undefined} disabled={busy} data-testid={`input-${key}-${dayIndex}-${index}`} onChange={value => change({ [key]: value })}/>
              </label>)}
            </>}
            <div className="row-actions">
              {row && !canOpenDetails(row) && <small className="muted" data-testid={`text-session-linked-${dayIndex}-${index}`}>Details are managed in Clinic settings for linked sessions.</small>}
              {canOpenDetails(row) && <IconAction label={`Edit details for ${label}`} hint="Edit session details" icon={<Pencil size={15} aria-hidden/>} disabled={busy} disabledReason="Wait for the current save to finish." onClick={() => openDetails(row, onEdit)} testId={`button-session-details-${dayIndex}-${index}`}/>}
              {!s.locked && <button type="button" className="text-link" aria-label={`Remove ${label}`} disabled={busy} onClick={() => setDay(day.sessions.length === 1 ? { ...day, isOpen: false, sessions: [] } : { ...day, sessions: day.sessions.filter(x => x.key !== s.key) })} data-testid={`button-remove-session-${dayIndex}-${index}`}><Trash2 size={14}/> Remove</button>}
            </div>
            {out && <p className="notice">This time is outside {clinicName}'s hours ({hours.map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ")}).</p>}
          </div>;
        })}
          <button type="button" className="text-link" disabled={busy} onClick={() => setDay({ ...day, sessions: [...day.sessions, newSession(dayIndex)] })} data-testid={`button-add-session-${dayIndex}`}><Plus size={14}/> Add Session</button>
        </div>}
        {warns.length > 0 && <p className="notice" data-testid={`warning-day-${dayIndex}`}>{warns.join(" ")}</p>}
        {errs.length > 0 && <p id={`week-error-${dayIndex}`} className="field-error" role="alert">{errs.join(" ")}</p>}
        <details><summary>Copy {DAYS[dayIndex]}</summary><div className="registration-inline">{ORDER.filter(t => t !== dayIndex).map(t => <label className="registration-check" key={t}><input type="checkbox" checked={(targets[dayIndex] || []).includes(t)} onChange={e => setTargets(c => ({ ...c, [dayIndex]: e.target.checked ? [...(c[dayIndex] || []), t] : (c[dayIndex] || []).filter(x => x !== t) }))}/>{SHORT[t]}</label>)}</div>
          <button type="button" disabled={busy || errs.length > 0 || !targets[dayIndex]?.length} onClick={() => { setWeek(w => copyDay(w, dayIndex, targets[dayIndex] || [])); setTargets(c => ({ ...c, [dayIndex]: [] })); }} data-testid={`button-copy-selected-${dayIndex}`}>Copy to Selected Days</button>
          <button type="button" disabled={busy || errs.length > 0} onClick={() => setWeek(w => copyDay(w, dayIndex, ORDER.filter(t => t !== dayIndex && !(opening !== null && !hoursFor(t).length))))} data-testid={`button-copy-all-${dayIndex}`}>Copy to All Days</button>
          <small className="muted">Copy replaces editable sessions on the chosen days in this draft only. Clinic-linked sessions are kept; days the clinic is closed are skipped by Copy to all days. Nothing is saved until you select Save weekly schedule.</small>
        </details>
      </section>;
    })}</div>
    {needsTemplate && !template && <p className="field-error" role="alert">Enter token prefix, max tokens and consultation duration for new sessions.</p>}
    <div className="form-footer">
      <button type="button" disabled={busy || !dirty} onClick={() => { setWeek(buildWeek(rows)); setResult(""); }} data-testid="button-reset-week">Discard Changes</button>
      <button type="button" className="button" disabled={busy || !dirty || hasErrors || (needsTemplate && !template)} onClick={save} data-testid="button-save-week">{busy ? "Saving…" : `Save Weekly Schedule${dirty ? ` (${plan.creates.length + plan.updates.length + plan.deactivations.length})` : ""}`}</button>
    </div>
    <small className="muted">Each session is saved separately; this is not an atomic weekly update. Changed and new sessions save first; removed sessions are deactivated (never deleted) only after all of those succeed. If anything fails, successful changes remain, failures are listed and your unsaved edits stay in the editor.</small>
    {result && <p className="notice" role="status" data-testid="status-week-save">{result}</p>}
    {outside && <AppDialog open onClose={() => setOutside(null)} title="Outside Clinic Hours">
      <p>{outside.length} session{outside.length > 1 ? "s are" : " is"} outside {clinicName}'s hours: {outside.map(o => { const s = week[o.day].sessions.find(x => x.key === o.key); return s ? `${SHORT[o.day]} ${fmt(s.startTime)} – ${fmt(s.endTime)} (clinic ${hoursFor(o.day).map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ")})` : ""; }).join("; ")}.</p>
      <p className="muted">Approval for saving weekly sessions outside clinic hours is still on hold, so this editor does not create or change exceptions. "Submit as entered" sends each session as typed; the server's existing rules and your permissions decide whether it is accepted, and any refusal is listed with your edit kept for retry. Existing dated doctor exceptions stay in Date exceptions.</p>
      <div className="form-footer">
        <button type="button" onClick={() => setOutside(null)} data-testid="button-outside-cancel">Cancel</button>
        <button type="button" onClick={() => { setWeek(w => w.map(d => ({ ...d, sessions: d.sessions.map(s => outside.some(o => o.key === s.key) ? adjustToHours(s, hoursFor(d.dayOfWeek)) : s) }))); setOutside(null); }} data-testid="button-outside-adjust">Adjust to Clinic Hours</button>
        <button type="button" className="button" onClick={() => { setOutside(null); void execute(); }} data-testid="button-outside-submit">Submit as Entered</button>
      </div>
    </AppDialog>}
  </section>;
}
