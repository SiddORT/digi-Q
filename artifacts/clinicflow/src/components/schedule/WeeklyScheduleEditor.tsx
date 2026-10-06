import { FormActions } from "../FormActions";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import "../weekly-day-rows.css";
import { WeeklyDraftDays, SHORT } from "./WeeklyDraftDays";
import { SearchableSelect } from "../SearchableSelect";
import { AppDialog } from "../AppDialog";
import { HelpTip } from "../HelpTip";
import { useConfirm } from "../ConfirmDialog";
import { formatTime } from "../../lib/date-time";
import { friendlyError } from "../../lib/friendly-error";
import { notifyBulk } from "../../lib/notify";
import { useDateTimePreferences } from "../DateTimePreferences";
import { useRegisterUnsaved } from "../WorkspaceBranch";
import { Link, useLocation, useSearch } from "wouter";
import { buildWeek, dayErrors, executePlan, outsideHours, planWeek, scheduleReadiness, reconcileDraft, weekSummary, prefillFromHours, applyWeekTo, SUGGESTED_SESSIONS_PER_DAY, type DraftDay, type DraftSession, type ScheduleRow } from "./week-plan";

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
  useRegisterUnsaved(dirty);

  const template = rows[0] ? (rows[0] as Record<string, unknown>) : branch.data && defaults.tokenPrefix.trim() && Number(defaults.maxTokens) >= 1 && Number(defaults.consultationMinutes) >= 1 ? { doctorId, branchId, clinicId: branch.data.clinicId, timezone: branch.data.timezone, tokenPrefix: defaults.tokenPrefix.trim(), maxTokens: Number(defaults.maxTokens), consultationMinutes: Number(defaults.consultationMinutes), queueMode: "mixed" } : undefined;
  const [path] = useLocation(); const search = useSearch();
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 60000 } });
  const canManageLocation = ["clinicAdmin", "superAdmin"].includes(String(me.data?.user?.role || ""));
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
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const applyToLocations = async () => {
    if (busy || dirty || !copyTargets.length || !rows.length) return;
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
      const r = await executePlan(p, { update: (id, body) => api.updateSchedule(id, body), create: body => api.createSchedule(body), deactivate: id => api.deleteSchedule(id), message: e => friendlyError(e, "save") });
      const failed = r.outcomes.filter(o => !o.ok);
      lines.push(failed.length ? `${name}: ${r.outcomes.length - failed.length} of ${r.outcomes.length} saved; not saved: ${failed.map(f => `${f.label} (${f.message})`).join("; ")}` : `${name}: ${r.outcomes.length} change${r.outcomes.length === 1 ? "" : "s"} saved`);
    }
    setCopyTargets([]); setResult(lines.join(". ") + ".");
    void client.invalidateQueries();
    setBusy(false);
  };

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
    for (const d of week) if (d.isOpen) for (const s of d.sessions) if (!s.locked && outsideHours(s, hoursFor(d.dayOfWeek), opening !== null)) out.push({ day: d.dayOfWeek, key: s.key });
    if (out.length) { setOutside(out); return; }
    void execute();
  };

  if (q.isLoading) return <div className="skeleton" role="status">Loading weekly schedule…</div>;
  if (q.error) return <div className="error-box" role="alert">{friendlyError(q.error, "load")} <button type="button" onClick={() => void q.refetch()}>Retry</button></div>;
  const clinicName = branch.data?.name || "the clinic";

  return <section className="panel padded" data-testid="panel-weekly-editor" aria-busy={busy}>
    {confirmation.dialog}
    <div className="panel-heading section-head"><div><h3>Weekly Schedule</h3><p className="muted">{branch.data ? `Clinic timezone: ${branch.data.timezone || (rows[0] as { timezone?: string } | undefined)?.timezone || (inherited as { timezone?: string }).timezone || "Not set"}` : "Loading clinic hours…"}</p></div></div>
    {branch.error && <p role="alert">Clinic hours could not be loaded. <button type="button" onClick={() => void branch.refetch()}>Retry Clinic Hours</button></p>}
    <div className="readiness" data-testid="schedule-readiness">{q.data && branch.data && (readiness.ready ? <p className="muted">Ready for booking at this location.{readiness.notes.map(n => ` ${n}`).join("")}</p> : <ul className="notice">{readiness.missing.map(m => <li key={m}>{m}</li>)}</ul>)}
      <Link className="button secondary small" href={`${path.replace(/availability$/, "exceptions")}?${search}`} data-testid="link-week-exceptions">Date Exceptions for This Doctor</Link></div>
    {/* Section F: follow vs copy-once live inside the one weekly editor (no separate copy tool). */}
    <div className="schedule-source" role="group" aria-label="Location hours" data-testid="schedule-source">
      <button type="button" className="button secondary small" disabled={busy || !opening || !opening.length} onClick={copyLocationHours} data-testid="button-copy-opening-hours">Copy Location Hours Once</button>
      <HelpTip label="About copying location hours" text="Copy once fills this draft with today's location hours as custom sessions. Review capacity, then Save Weekly Schedule. Later location-hour changes do not update copied sessions. Linked sessions are kept."/>
      {canManageLocation && branch.data && <Link className="button secondary small" href={`/admin/settings?clinicId=${encodeURIComponent(branch.data.clinicId)}&section=locations`} data-testid="link-follow-location-hours">Follow Location Hours (Linked)</Link>}
      {siblingIds.length > 0 && <details className="schedule-copy-locations" data-testid="details-copy-locations"><summary>Copy to Other Locations</summary><div className="registration-inline">
        {(siblings.data || []).map(b => <label className="registration-check" key={b.id}><input type="checkbox" checked={copyTargets.includes(b.id)} disabled={busy} onChange={e => setCopyTargets(c => e.target.checked ? [...c, b.id] : c.filter(x => x !== b.id))} data-testid={`check-copy-location-${b.id}`}/>{b.name}</label>)}
        <button type="button" className="button secondary small" disabled={busy || dirty || !copyTargets.length || !rows.length} title={dirty ? "Save this week first" : undefined} onClick={() => void applyToLocations()} data-testid="button-apply-locations">Apply to Selected Locations</button>
        {dirty && <small className="muted">Save this week first, then apply it.</small>}
      </div></details>}
      {canManageLocation && <HelpTip label="About following location hours" text="Linked sessions keep following future location-hour changes and show a lock here. Link the clinic owner's consultations from the location settings. Custom sessions are preserved."/>}
    </div>
    <p className="notice" data-testid="text-week-summary">{weekSummary(week, SHORT, fmt)}</p>
    {dirty&&<p className="notice">When hours change, queue closing times beyond the new end are shortened to match. Queue windows that no longer fit are reset to session boundaries; valid early opening times are retained. Review individual settings with Details.</p>}
    <p className="muted">Slide in 15-minute steps or type exact minutes, for example 8:32 PM. Shaded bands show clinic hours. Add as many sessions as needed (more than {SUGGESTED_SESSIONS_PER_DAY} in a day shows a reminder); overnight sessions are not supported. Session names, breaks and capacity per session are edited with Details.</p>
    {needsTemplate && <fieldset className="registration-day" data-testid="fieldset-session-defaults"><legend>Settings for New Sessions</legend><p className="muted">This doctor has no sessions here yet. New sessions use these values; edit each one later with Details.</p><div className="form-grid">
      <label>Token prefix<span className="required"> *</span><input maxLength={8} value={defaults.tokenPrefix} onChange={e => setDefaults(v => ({ ...v, tokenPrefix: e.target.value.replace(/[^A-Za-z0-9]/g, "") }))} data-testid="input-default-token-prefix"/></label>
      <label>Max tokens<span className="required"> *</span><input type="number" min={1} step={1} value={defaults.maxTokens} onChange={e => setDefaults(v => ({ ...v, maxTokens: e.target.value }))} data-testid="input-default-max-tokens"/></label>
      <SearchableSelect label="Expected Consultation Duration" required value={defaults.consultationMinutes} onChange={value => setDefaults(v => ({ ...v, consultationMinutes: value }))} placeholder="Select duration…" options={[20, 30, 60].map(v => ({ value: String(v), label: `${v} minutes` }))}/>
    </div></fieldset>}
    <WeeklyDraftDays week={week} setWeek={setWeek} opening={opening} clinicName={clinicName} preferences={preferences} busy={busy} rows={rows} onEdit={onEdit} showClinicHours={!!branch.data} onChange={() => setResult("")}/>
    {needsTemplate && !template && <p className="field-error" role="alert">Enter token prefix, max tokens and consultation duration for new sessions.</p>}
    <FormActions wide={false} onCancel={() => { setWeek(buildWeek(rows)); setResult(""); }} cancelLabel="Discard Changes" cancelDisabled={!dirty} cancelTestId="button-reset-week" busy={busy} disabled={!dirty || hasErrors || (needsTemplate && !template)} onSubmit={save} submitTestId="button-save-week" submitLabel={`Save Weekly Schedule${dirty ? ` (${plan.creates.length + plan.updates.length + plan.deactivations.length})` : ""}`} secondary={<small className="muted field-hint">Saved per session <HelpTip label="How weekly saving works" text="Each session is saved separately; this is not an atomic weekly update. Changed and new sessions save first; removed sessions are deactivated (never deleted) only after all of those succeed. If anything fails, successful changes remain, failures are listed and your unsaved edits stay in the editor." /></small>} />
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
