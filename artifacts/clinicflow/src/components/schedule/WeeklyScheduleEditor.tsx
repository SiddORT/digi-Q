import { FormActions } from "../FormActions";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import "../weekly-day-rows.css";
import { CompactDayEditor } from "./CompactDayEditor";
import { SHORT } from "./WeeklyDraftDays";
import { FollowLocationHours } from "./FollowLocationHours";
import { SearchableSelect } from "../SearchableSelect";
import { AppDialog, useAppDialogClose } from "../AppDialog";
import { HelpTip } from "../HelpTip";
import { useConfirm } from "../ConfirmDialog";
import { formatTime } from "../../lib/date-time";
import { friendlyError } from "../../lib/friendly-error";
import { notifyBulk } from "../../lib/notify";
import { useDateTimePreferences } from "../DateTimePreferences";
import { useRegisterUnsaved } from "../WorkspaceBranch";
import { Link, useLocation, useSearch } from "wouter";
import { buildWeek, dayErrors, draftSignature, executePlan, outsideHours, planWeek, scheduleReadiness, reconcileDraft, scheduleSnapshot, weekSummary, prefillFromHours, applyWeekTo, SUGGESTED_SESSIONS_PER_DAY, type DraftDay, type DraftSession, type ScheduleRow } from "./week-plan";

type Hours = { startTime: string; endTime: string }[];

function adjustToHours(s: DraftSession, hours: Hours): DraftSession {
  const overlap = hours.find(h => h.startTime < s.endTime && s.startTime < h.endTime) || hours[0];
  if (!overlap) return s;
  return { ...s, startTime: s.startTime < overlap.startTime || s.startTime >= overlap.endTime ? overlap.startTime : s.startTime, endTime: s.endTime > overlap.endTime || s.endTime <= overlap.startTime ? overlap.endTime : s.endTime };
}

/** Monday–Sunday editor over the existing one-record-per-session schedule model. Saves are per session, not atomic. */
export function WeeklyScheduleEditor({ doctorId, branchId, onEdit, onDirtyChange, onBusyChange, onExceptions, onSaved, canDelete=false, doctorName, contextual=false }: { doctorId: string; branchId: string; onEdit: (row: any) => void; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; onExceptions?:()=>void; onSaved?:()=>void; canDelete?:boolean; doctorName?:string; contextual?:boolean; compact?:boolean }) {
  const client = useQueryClient();
  const confirmation = useConfirm();
  const inherited = useDateTimePreferences();
  const branch = api.useGetBranch(branchId, { query: { queryKey: api.getGetBranchQueryKey(branchId), enabled: !!branchId } });
  const fetchRows = async (): Promise<ScheduleRow[]> => { const items: any[] = []; for (let page = 1; page < 50; page++) { const res: any = await api.listSchedules({ doctorId, branchId, page, pageSize: 100 } as any); items.push(...res.items); if (items.length >= res.total || !res.items.length) break; } return items; };
  // Loaded once per editor mount: background refetches never rebase the draft or the save snapshots.
  const q = useQuery<{ items: ScheduleRow[] }>({ queryKey: ["weekly-overview", doctorId, branchId], gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false, refetchInterval: false, queryFn: async () => ({ items: await fetchRows() }) });
  const [baseRows, setBaseRows] = useState<ScheduleRow[] | null>(null);
  const rows = useMemo(() => (baseRows || []).filter(r => r.status !== "inactive"), [baseRows]);
  const dialogClose = useAppDialogClose();
  const busyRef = useRef(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [focus, setFocus] = useState<{ day: number; index: number; nonce: number } | null>(null);
  const [week, setWeek] = useState<DraftDay[]>(() => buildWeek([]));
  const [defaults, setDefaults] = useState({ tokenPrefix: "", maxTokens: "", consultationMinutes: "" });
  const [busy, setBusyState] = useState(false);
  const setBusy = (v: boolean) => { busyRef.current = v; setBusyState(v); };
  const [linkedBusy, setLinkedBusy] = useState(false);
  const [linkedDirty, setLinkedDirty] = useState(false);
  useEffect(()=>{onBusyChange?.(busy||linkedBusy);},[busy,linkedBusy,onBusyChange]);
  const [result, setResult] = useState("");
  const [outside, setOutside] = useState<{ day: number; key: string }[] | null>(null);
  const dirtyRef = useRef(onDirtyChange); dirtyRef.current = onDirtyChange;
  useEffect(() => { if (q.data && baseRows === null) { setBaseRows(q.data.items); setWeek(buildWeek(q.data.items.filter(r => r.status !== "inactive"))); } }, [q.data, baseRows]);

  const preferences = (rows[0] as any) || branch.data || inherited;
  const fmt = (t: string) => formatTime(t, preferences);
  const opening: (Hours[number] & { dayOfWeek: number })[] | null = Array.isArray(branch.data?.openingHours) ? branch.data!.openingHours! : null;
  const hoursFor = (day: number): Hours => (opening || []).filter(h => h.dayOfWeek === day);
  const sig = (w: DraftDay[]) => draftSignature(w.map(d => d.isOpen ? d : { ...d, sessions: [] }));
  const baseline = useMemo(() => sig(buildWeek(rows)), [rows]);
  const dirty = baseRows !== null && sig(week) !== baseline;
  useEffect(() => { dirtyRef.current?.(dirty||linkedDirty||!!defaults.tokenPrefix||!!defaults.maxTokens||!!defaults.consultationMinutes); }, [dirty,linkedDirty,defaults]);
  useRegisterUnsaved(dirty);

  const template = rows[0] ? (rows[0] as Record<string, unknown>) : branch.data && defaults.tokenPrefix.trim() && Number(defaults.maxTokens) >= 1 && Number(defaults.consultationMinutes) >= 1 ? { doctorId, branchId, clinicId: branch.data.clinicId, timezone: branch.data.timezone, tokenPrefix: defaults.tokenPrefix.trim(), maxTokens: Number(defaults.maxTokens), consultationMinutes: Number(defaults.consultationMinutes), queueMode: "mixed" } : undefined;
  const [path] = useLocation(); const search = useSearch();
  const copyLocationHours = () => { if (!opening) return; setResult(""); setWeek(w => prefillFromHours(w, opening)); };
  const readiness = scheduleReadiness(rows, branch.data ? opening : undefined);
  const errors = week.map(dayErrors);
  const hasErrors = errors.some(e => e.length);
  const plan = planWeek(rows, week, template, SHORT);
  const needsTemplate = !rows.length && week.some(d => d.isOpen && d.sessions.length);


  // Multi-location copy (restored from the removed drawer): apply this saved week to the doctor's other locations.
  const doctor = useQuery({ queryKey: ["weekly-doctor-locations", doctorId], enabled: !!doctorId, queryFn: () => api.getDoctor(doctorId) });
  const siblingIds = ((doctor.data as any)?.branchIds || []).filter((id: string) => id !== branchId) as string[];
  const siblings = useQuery({ queryKey: ["weekly-sibling-locations", siblingIds.join(",")], enabled: siblingIds.length > 0, queryFn: () => Promise.all(siblingIds.map(id => api.getBranch(id))) });
  const deactivate = (id: string, expectedSnapshot?: string) => (api.deleteSchedule as unknown as (id: string, o?: unknown) => Promise<void>)(id, expectedSnapshot ? { expectedSnapshot } : undefined);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const applyToLocations = async () => {
    if (busyRef.current || dirty || !copyTargets.length || !rows.length) return;
    const base = rows.find(r => !r.linkedBranchId) || rows[0];
    const plans: { name: string; plan: ReturnType<typeof planWeek> }[] = [];
    for (const target of (siblings.data || []).filter(b => copyTargets.includes(b.id))) {
      const items: ScheduleRow[] = []; for (let page = 1; page < 50; page++) { const res: any = await api.listSchedules({ doctorId, branchId: target.id, page, pageSize: 100 } as any); items.push(...res.items); if (items.length >= res.total || !res.items.length) break; }
      const targetRows = items.filter(r => r.status !== "inactive");
      const tpl = { doctorId, branchId: target.id, clinicId: target.clinicId, timezone: target.timezone, tokenPrefix: base.tokenPrefix, maxTokens: base.maxTokens, consultationMinutes: base.consultationMinutes, queueMode: base.queueMode, bufferMinutes: base.bufferMinutes ?? 0, isOpen: true };
      plans.push({ name: target.name, plan: planWeek(targetRows, applyWeekTo(buildWeek(targetRows), week), (targetRows.find(r => !r.linkedBranchId) as any) || tpl, SHORT) });
    }
    const removals = plans.reduce((n, p) => n + p.plan.deactivations.length, 0);
    if (!await confirmation.ask({ title: "Apply to Selected Locations?", description: `This week's own sessions replace the custom sessions at ${plans.map(p => p.name).join(", ")}. Linked sessions there are kept.${removals ? ` ${removals} session${removals > 1 ? "s" : ""} will be deactivated, not deleted.` : ""} Each change is checked by the server.`, confirmLabel: "Apply to Locations" })) return;
    setBusy(true); setResult("");
    const lines: string[] = [];
    for (const { name, plan: p } of plans) {
      const r = await executePlan(p, { update: (id, body) => api.updateSchedule(id, body), create: body => api.createSchedule(body), deactivate: deactivate, message: e => friendlyError(e, "save") });
      const failed = r.outcomes.filter(o => !o.ok);
      lines.push(failed.length ? `${name}: ${r.outcomes.length - failed.length} of ${r.outcomes.length} saved; not saved: ${failed.map(f => `${f.label} (${f.message})`).join("; ")}` : `${name}: ${r.outcomes.length} change${r.outcomes.length === 1 ? "" : "s"} saved`);
    }
    setCopyTargets([]); setResult(lines.join(". ") + ".");
    void client.invalidateQueries();
    setBusy(false);
  };

  const io = { update: (id: string, body: any) => api.updateSchedule(id, body), create: (body: any) => api.createSchedule(body), deactivate, message: (e: unknown) => friendlyError(e, "save") };
  /** Refresh the frozen baseline only for records whose write succeeded; failed records keep their original snapshots. */
  const rebase = (saved: ScheduleRow[], ok: { updated: string[]; created: string[]; deactivated: string[] }) => setBaseRows(old => {
    // Uses the write responses only: a background read could carry another admin's later edits and its snapshot would hide them.
    const byId = new Map(saved.map(r => [r.id, r]));
    const next = (old || []).filter(r => !ok.deactivated.includes(r.id)).map(r => ok.updated.includes(r.id) && byId.has(r.id) ? { ...r, ...byId.get(r.id)! } : r);
    for (const id of ok.created) if (byId.has(id) && !next.some(r => r.id === id)) next.push({ status: "active", ...byId.get(id)! } as ScheduleRow);
    return next;
  });
  const finish = async (p: ReturnType<typeof planWeek>, r: Awaited<ReturnType<typeof executePlan>>, draftAtSave: DraftDay[]) => {
    const failed = r.outcomes.filter(o => !o.ok);
    const ok = { updated: p.updates.filter(u => r.savedIds[u.key] === u.id).map(u => u.id), created: p.creates.filter(c => r.savedIds[c.key]).map(c => r.savedIds[c.key]), deactivated: p.deactivations.filter(d => !r.failedDeactivations.has(d.id)).map(d => d.id) };
    rebase(r.savedRows, ok);
    if (failed.length) {
      setWeek(reconcileDraft(draftAtSave, r.savedIds));
      setResult(`Partly saved: ${r.outcomes.length - failed.length} of ${r.outcomes.length} changes saved. Not saved: ${failed.map(f => `${f.label} (${f.message})`).join("; ")}. Your unsaved edits are still in the editor; correct them and save again.`);
      return false;
    }
    let fresh: ScheduleRow[] | null = null;
    try { fresh = await fetchRows(); } catch { /* the saved records are already in the baseline */ }
    setWeek(fresh ? buildWeek(fresh.filter(x => x.status !== "inactive")) : reconcileDraft(draftAtSave, r.savedIds));
    if (fresh) setBaseRows(fresh);
    setDefaults({ tokenPrefix: "", maxTokens: "", consultationMinutes: "" });
    setResult(`Saved ${r.outcomes.length} change${r.outcomes.length > 1 ? "s" : ""}.`);
    return true;
  };
  const execute = async () => {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const p = planWeek(rows, week, template, SHORT);
      const total = p.creates.length + p.updates.length + p.deactivations.length;
      if (!total) { if (p.adopt.length) setWeek(w => reconcileDraft(w, Object.fromEntries(p.adopt.map(x => [x.key, x.id])))); setWeek(buildWeek(rows)); setResult("No changes to save."); onSaved?.(); return; }
      const durationChanged = p.updates.filter(u => { const row = rows.find(x => x.id === u.id); return row && u.body.consultationMinutes !== undefined && Number(u.body.consultationMinutes) !== Number(row.consultationMinutes); });
      const notes: string[] = [];
      if (durationChanged.length) notes.push(`Consultation duration changes on ${durationChanged.map(d => d.label).join(", ")} apply to future bookings. Existing visits keep their recorded duration.`);
      if (p.deactivations.length) notes.push(`${p.deactivations.length} session${p.deactivations.length > 1 ? "s" : ""} (${p.deactivations.map(d => d.label).join(", ")}) will be deactivated, not deleted. Past appointments and history stay. Deactivation runs last, only if every other change saved.`);
      if (notes.length && !await confirmation.ask({ title: p.deactivations.length ? "Deactivate Removed Sessions?" : "Change Consultation Duration?", description: `${notes.join(" ")} Each change is checked by the server and may be refused.`, confirmLabel: p.deactivations.length ? "Deactivate and Save" : "Save Schedule", tone: p.deactivations.length ? "danger" : undefined })) return;
      setBusy(true); setResult("");
      const draftAtSave = week;
      const r = await executePlan(p, io);
      notifyBulk(r.outcomes.filter(o => !o.skipped), "saved");
      const full = await finish(p, r, draftAtSave);
      void client.invalidateQueries();
      if (full) onSaved?.();
    } finally { setBusy(false); }
  };
  const deleteSchedule = async () => {
    if (busyRef.current || dirty) return;
    const targets = rows.filter(r => !r.linkedBranchId);
    if (!targets.length) return;
    setBusy(true); setResult("");
    try {
    if (!await confirmation.ask({ title: "Delete Schedule?", description: `All ${targets.length} custom session${targets.length > 1 ? "s" : ""} for ${doctorName || "this doctor"} at ${branch.data?.name || "this location"} will be deactivated. Linked clinic sessions stay. Past appointments and history are kept.`, confirmLabel: "Delete Schedule", tone: "danger" })) return;
      const p = { creates: [], updates: [], adopt: [], deactivations: targets.map(r => ({ id: r.id, label: `${SHORT[r.dayOfWeek]} ${r.startTime}–${r.endTime}`, expectedSnapshot: scheduleSnapshot(r) })) } as ReturnType<typeof planWeek>;
      const r = await executePlan(p, io);
      notifyBulk(r.outcomes, "deactivated");
      await finish(p, r, week);
      void client.invalidateQueries();
    } finally { setBusy(false); }
  };
  const cancelDraft=async()=>{
    if(busyRef.current||linkedBusy)return;
    if((dirty||linkedDirty||Object.values(defaults).some(Boolean))&&!await confirmation.ask({
      title:"Discard schedule draft?",description:"Unsaved schedule changes will be discarded. Saved sessions and history are kept.",
      confirmLabel:"Discard Changes",tone:"danger",
    }))return;
    setWeek(buildWeek(rows));setDefaults({tokenPrefix:"",maxTokens:"",consultationMinutes:""});setResult("");
  };
  /** A new session needs real capacity, prefix and a 20/30/60 duration, from the slot's own settings or the saved template; a legacy template duration is never implied. */
  const newSlotIssue = () => {
    for (const d of week) if (d.isOpen) for (const [index, s] of d.sessions.entries()) {
      if (s.id || s.locked) continue;
      const v = { ...(template || {}), ...Object.fromEntries(Object.entries(s.settings || {}).filter(([, x]) => x !== undefined && x !== "")) } as Record<string, unknown>;
      const own = s.settings?.consultationMinutes;
      if (![20, 30, 60].includes(Number(own ?? v.consultationMinutes)) || (own === undefined && !template)) return { day: d.dayOfWeek, index, message: `Slot ${index + 1} on ${SHORT[d.dayOfWeek]}: choose a consultation duration of 20, 30 or 60 minutes.` };
      if (!(Number(v.maxTokens) >= 1) || !String(v.tokenPrefix || "").trim()) return { day: d.dayOfWeek, index, message: `Slot ${index + 1} on ${SHORT[d.dayOfWeek]}: set capacity and token prefix in Advanced.` };
    }
    return null;
  };
  const save = () => {
    if (busyRef.current) return;
    if (hasErrors) {
      const day = errors.findIndex(e => e.length); const msg = errors[day][0]; const n = Number(/ession (\d+)/.exec(msg)?.[1] ?? 0);
      setSelectedDay(day); setFocus({ day, index: n ? n - 1 : 0, nonce: Date.now() }); return;
    }
    const issue = newSlotIssue();
    if (issue) { setSelectedDay(issue.day); setFocus({ day: issue.day, index: issue.index, nonce: Date.now() }); setResult(issue.message); return; }
    if (needsTemplate && !template) { document.querySelector<HTMLElement>('[data-testid="input-default-token-prefix"]')?.focus(); return; }
    const out: { day: number; key: string }[] = [];
    for (const d of week) if (d.isOpen) for (const s of d.sessions) if (!s.locked && outsideHours(s, hoursFor(d.dayOfWeek), opening !== null)) out.push({ day: d.dayOfWeek, key: s.key });
    if (out.length) { setOutside(out); return; }
    void execute();
  };

  if (q.isLoading || (q.data && baseRows === null)) return <div className="skeleton" role="status">Loading weekly schedule…</div>;
  if (q.error && baseRows === null) return <div className="error-box" role="alert">{friendlyError(q.error, "load")} <button type="button" onClick={() => void q.refetch()}>Retry</button></div>;
  const clinicName = branch.data?.name || "the clinic";

  return <section className={contextual?"cde-section":"panel padded"} data-testid="panel-weekly-editor" aria-busy={busy}>
    {confirmation.dialog}
    {q.error && baseRows !== null && <p className="notice" role="alert" data-testid="text-reload-warning">Saved schedule could not be refreshed. Your draft and saved changes are kept. <button type="button" onClick={() => void q.refetch()}>Retry</button></p>}
    {branch.error && <p role="alert">Clinic hours could not be loaded. <button type="button" onClick={() => void branch.refetch()}>Retry Clinic Hours</button></p>}
    {q.data && branch.data && !readiness.ready && <ul className="notice" data-testid="schedule-readiness">{readiness.missing.map(m => <li key={m}>{m}</li>)}</ul>}
    <p className="muted" data-testid="text-week-summary">{weekSummary(week, SHORT, fmt)}</p>
    {needsTemplate && <fieldset className="registration-day" data-testid="fieldset-session-defaults"><legend>Settings for New Sessions</legend><div className="form-grid">
      <label>Token prefix<span className="required"> *</span><input maxLength={8} value={defaults.tokenPrefix} onChange={e => setDefaults(v => ({ ...v, tokenPrefix: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))} data-testid="input-default-token-prefix"/></label>
      <label>Max tokens<span className="required"> *</span><input type="number" min={1} step={1} value={defaults.maxTokens} onChange={e => setDefaults(v => ({ ...v, maxTokens: e.target.value }))} data-testid="input-default-max-tokens"/></label>
      <SearchableSelect label="Expected Consultation Duration" required value={defaults.consultationMinutes} onChange={value => setDefaults(v => ({ ...v, consultationMinutes: value }))} placeholder="Select duration…" options={[20, 30, 60].map(v => ({ value: String(v), label: `${v} minutes` }))}/>
    </div></fieldset>}
    <CompactDayEditor week={week} setWeek={setWeek} opening={opening} preferences={preferences} busy={busy||linkedBusy} rows={rows} template={template} selected={selectedDay} onSelect={setSelectedDay} focus={focus} onChange={() => setResult("")}/>
    {needsTemplate && !template && <p className="field-error" role="alert">Enter token prefix, max tokens and consultation duration for new sessions.</p>}
    <details className="cde-more"><summary>Location hours and exceptions</summary>
      <div className="schedule-source" role="group" aria-label="Location hours" data-testid="schedule-source">
      <button type="button" className="button secondary small" disabled={busy || !opening || !opening.length} onClick={copyLocationHours} data-testid="button-copy-opening-hours">Copy Location Hours Once</button>
      <HelpTip label="About copying location hours" text="Copy once fills this draft with today's location hours as custom sessions. Review capacity, then Save Weekly Schedule. Later location-hour changes do not update copied sessions. Linked sessions are kept."/>
       {branch.data && <FollowLocationHours branch={branch.data} doctorId={doctorId} dirty={dirty} disabled={busy} onBusyChange={setLinkedBusy} onDirtyChange={setLinkedDirty} defaults={{ maxTokens: (rows[0] as any)?.maxTokens, consultationMinutes: (rows[0] as any)?.consultationMinutes, tokenPrefix: (rows[0] as any)?.tokenPrefix, queueMode: (rows[0] as any)?.queueMode }} />}
       {!contextual&&siblingIds.length > 0 && <details className="schedule-copy-locations" data-testid="details-copy-locations"><summary>Copy to Other Locations</summary><div className="registration-inline">
        {(siblings.data || []).map(b => <label className="registration-check" key={b.id}><input type="checkbox" checked={copyTargets.includes(b.id)} disabled={busy} onChange={e => setCopyTargets(c => e.target.checked ? [...c, b.id] : c.filter(x => x !== b.id))} data-testid={`check-copy-location-${b.id}`}/>{b.name}</label>)}
        <button type="button" className="button secondary small" disabled={busy || dirty || !copyTargets.length || !rows.length} title={dirty ? "Save this week first" : undefined} onClick={() => void applyToLocations()} data-testid="button-apply-locations">Apply to Selected Locations</button>
        {dirty && <small className="muted">Save this week first, then apply it.</small>}
      </div></details>}
      </div>
      {onExceptions?<button type="button" className="button secondary small" onClick={onExceptions} data-testid="link-week-exceptions">Date Exceptions for This Doctor</button>:<Link className="button secondary small" href={`${path.replace(/availability$/, "exceptions")}?${search}`} data-testid="link-week-exceptions">Date Exceptions for This Doctor</Link>}
    </details>
    <div className="cde-footer"><FormActions wide={false} onCancel={dialogClose ? undefined : ()=>void cancelDraft()} cancelClosesDialog cancelTestId="button-reset-week" busy={busy||linkedBusy} disabled={!dirty} onSubmit={save} submitTestId="button-save-week" submitLabel="Save Schedule" secondary={canDelete && !!rows.some(r => !r.linkedBranchId) ? <button type="button" className="button secondary small" disabled={busy||linkedBusy||dirty} title={dirty?"Save or cancel your changes first":undefined} onClick={() => void deleteSchedule()} data-testid="button-delete-schedule">Delete Schedule</button> : undefined} /></div>
    {result && <p className="notice" role="status" data-testid="status-week-save">{result}</p>}
    {outside && <AppDialog open onClose={() => setOutside(null)} title="Doctor Hours Beyond Clinic Hours">
      <p>{outside.length} session{outside.length > 1 ? "s are" : " is"} outside {clinicName}'s hours: {outside.map(o => { const s = week[o.day].sessions.find(x => x.key === o.key); return s ? `${SHORT[o.day]} ${fmt(s.startTime)} – ${fmt(s.endTime)} (clinic ${hoursFor(o.day).map(h => `${fmt(h.startTime)} – ${fmt(h.endTime)}`).join(", ") || "usually closed"})` : ""; }).join("; ")}.</p>
      <p className="muted" data-testid="text-outside-hours-warning">This is allowed: clinics may extend hours for a doctor. Patients can book these times, and booking screens show the same warning. Days when the clinic is closed, overlapping sessions and date exceptions are still protected.</p>
      <FormActions wide={false} onCancel={() => setOutside(null)} cancelTestId="button-outside-cancel"
        extra={<button type="button" onClick={() => { setWeek(w => w.map(d => ({ ...d, sessions: d.sessions.map(s => outside.some(o => o.key === s.key) ? adjustToHours(s, hoursFor(d.dayOfWeek)) : s) }))); setOutside(null); }} data-testid="button-outside-adjust">Adjust to Clinic Hours</button>}
        onSubmit={() => { setOutside(null); void execute(); }} submitLabel="Save With Extended Hours" submitTestId="button-outside-submit" />
    </AppDialog>}
  </section>;
}
