import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { useConfirm } from "./ConfirmDialog";
import { FormField } from "./FormField";
import { ResourceLookup } from "./ResourceLookup";
import { RECIPIENTS } from "./EmailTemplates";
import { titleCase } from "@/lib/title-case";
import { eventSetupReasons } from "@/lib/communication-routes";
import { useRegisterUnsaved, useWorkspaceBranchContext } from "./WorkspaceBranch";
import "./notification-settings.css";

const CHANNELS: { id: api.NotificationPreferenceRowChannel; label: string }[] = [{ id: "email", label: "Email" }, { id: "sms", label: "SMS" }, { id: "inApp", label: "In-app" }];
const eventName = (e: string) => titleCase(e === "onboarding" ? "Clinic onboarding" : e.replaceAll("_", " "));
const status = (e: unknown) => (e as { status?: number } | null)?.status;
const detail = (e: unknown) => { const d = (e as { data?: { error?: unknown } } | null)?.data?.error; return typeof d === "string" && d.trim() ? d : ""; };

/** Saves change delivery, inbox, event controls and template activation views. */
function invalidateDependents(qc: QueryClient) {
  [api.getGetMyNotificationSettingsQueryKey()[0], api.getGetManagedNotificationSettingsQueryKey()[0], api.getGetEventControlsQueryKey()[0], api.getGetNotificationTemplatesQueryKey()[0], api.getListNotificationsQueryKey()[0]]
    .forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
}
function QueryFailure({ what, onRetry }: { what: string; onRetry: () => void }) {
  return <div role="alert" className="error-box" data-testid="state-error">{what} could not be loaded. <button type="button" onClick={onRetry} data-testid="button-retry">Retry</button></div>;
}
function Skeleton() { return <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>; }

type Personal = UseQueryResult<api.PersonalNotificationSettings | undefined, unknown>;

function PersonalPanel({ q, onDirty }: { q: Personal; onDirty: (d: boolean) => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<{ revision: number; choices: Record<string, boolean | null> } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirtyRef = useRef(onDirty); dirtyRef.current = onDirty;
  const dirty = !!draft;
  useEffect(() => { dirtyRef.current(dirty); }, [dirty]);
  const save = api.useSaveMyNotificationSettings({ mutation: {
    onSuccess: result => { qc.setQueryData(api.getGetMyNotificationSettingsQueryKey(), result); setDraft(null); setError(""); setNotice("Notification preferences saved. Only future eligible messages and pending unclaimed cancellations are affected; messages already sent are never recalled."); invalidateDependents(qc); },
    onError: e => { setNotice(""); setError(status(e) === 409 ? "These settings changed elsewhere. Your draft was kept. Reload the latest settings to continue." : `Preferences were not saved. ${detail(e) || "Please try again."}`); if (status(e) === 409) void q.refetch(); },
  } });
  const data = q.data;
  if (q.isLoading) return <Skeleton />;
  if (q.isError || !data) return <QueryFailure what="Your notification settings" onRetry={() => void q.refetch()} />;
  const conflict = !!draft && draft.revision !== data.revision;
  const stale = conflict || (error.startsWith("These settings changed"));
  const checked = (r: api.NotificationPreferenceRow) => { const c = draft?.choices[r.key]; return c === undefined ? r.selected : c === null ? true : c; };
  const setChoice = (r: api.NotificationPreferenceRow, value: boolean | null) => {
    const choices = { ...(draft?.choices ?? {}) };
    if (value === r.saved) delete choices[r.key]; else choices[r.key] = value;
    setNotice(""); setError("");
    setDraft(Object.keys(choices).length ? { revision: draft?.revision ?? data.revision, choices } : null);
  };
  const events = [...new Set(data.items.map(i => i.event))];
  const cell = (r: api.NotificationPreferenceRow | undefined, label: string) => {
    if (!r) return <span className="muted" aria-label="Unavailable: this channel is not offered for this event and role">Unavailable<small className="ns-unavailable">Not offered for this event and role.</small></span>;
    const locked = r.state === "Required" || r.state === "Unavailable";
    const c = draft?.choices[r.key];
    const savedText = r.saved === null ? "Inherited" : r.saved ? "On" : "Off";
    return <div className="ns-cell" data-testid={`cell-${r.key}`}>
      <label><input type="checkbox" checked={checked(r)} disabled={locked || save.isPending} onChange={e => setChoice(r, e.target.checked)} aria-label={`${eventName(r.event)} by ${label}`} data-testid={`checkbox-${r.key}`} /><span className="ns-chan">{label}</span>
        <span className={`et-chip ${r.state === "On" || r.state === "Required" ? "live" : ""}`} data-testid={`state-${r.key}`}>{r.state}</span></label>
      <small>Saved: {savedText}{r.inherited && r.saved !== null ? " (differs from inherited)" : ""}</small>
      {c !== undefined && <small className="ns-pending">Pending: {c === null ? "restore inherited (On by default)" : c ? "On" : "Off"}</small>}
      {r.saved !== null && c !== null && !locked && <button type="button" className="ns-restore" onClick={() => setChoice(r, null)} data-testid={`button-restore-${r.key}`}>Restore inherited</button>}
      {r.reasons.length > 0 && <ul className="ec-blocked">{r.reasons.map(x => <li key={x}>{x}</li>)}</ul>}
    </div>;
  };
  return <div className="ns" data-testid="panel-personal-notifications">
    <p className="muted">Choose how you receive each event. Saved state is what you chose; the badge is the result the server will actually apply. Security messages are required and cannot be switched off.</p>
    {stale && <div className="ns-banner" role="alert" data-testid="banner-conflict">Settings changed since you began editing. Saving is paused so nothing is overwritten.
      <button type="button" className="button secondary small" onClick={() => { setDraft(null); setError(""); void q.refetch(); }} data-testid="button-reload-personal">Discard my draft and reload</button></div>}
    {q.isRefetching && <small className="muted" role="status">Refreshing…</small>}
    {!data.items.length ? <div className="et-empty" data-testid="state-empty">No notification events are available for your account.</div> :
      <table className="ns-table"><thead><tr><th scope="col">Event</th>{CHANNELS.map(c => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
        <tbody>{events.map(ev => <tr key={ev}><th scope="row">{eventName(ev)}</th>{CHANNELS.map(c => <td key={c.id}>{cell(data.items.find(i => i.event === ev && i.channel === c.id), c.label)}</td>)}</tr>)}</tbody></table>}
    {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
    {error && !stale && <p role="alert" className="error-box" data-testid="status-save-error">{error}</p>}
    <div className="ns-savebar"><button type="button" className="button" disabled={!draft || stale || save.isPending} onClick={() => draft && save.mutate({ data: { revision: draft.revision, choices: Object.entries(draft.choices).map(([key, enabled]) => ({ key, enabled })) } })} data-testid="button-save-personal">{save.isPending ? "Saving…" : "Save"}</button>
      <button type="button" className="button secondary" disabled={!draft || save.isPending} onClick={() => { setDraft(null); setError(""); }} data-testid="button-cancel-personal">Cancel</button>
      {draft && <small className="muted">{Object.keys(draft.choices).length} unsaved change{Object.keys(draft.choices).length === 1 ? "" : "s"}</small>}</div>
  </div>;
}

type MDraft = { revision: number; gate?: boolean; rows: Record<string, { enabled: boolean; revision: number }> };
const rk = (r: { channel: string; event: string; recipient: string }) => `${r.channel}|${r.event}|${r.recipient}`;
const recipientLabel = (r: string) => RECIPIENTS.find(x => x.value === r)?.label ?? r;

function ManagedPanel({ scope, onDirty, onScopeLost }: { scope: string; onDirty: (d: boolean) => void; onScopeLost: () => void }) {
  const qc = useQueryClient();
  const clinicId = scope === "platform" ? undefined : scope;
  const params = clinicId ? { clinicId } : {};
  const q: UseQueryResult<api.ManagedNotificationSettings | undefined, unknown> = api.useGetManagedNotificationSettings(params, { query: { queryKey: api.getGetManagedNotificationSettingsQueryKey(params), staleTime: 15000 } });
  const [draft, setDraft] = useState<MDraft | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();
  const dirtyRef = useRef(onDirty); dirtyRef.current = onDirty;
  useEffect(() => { dirtyRef.current(!!draft); return () => dirtyRef.current(false); }, [!!draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = api.useSaveManagedNotificationSettings({ mutation: {
    onSuccess: result => { qc.setQueryData(api.getGetManagedNotificationSettingsQueryKey(params), result); setDraft(null); setError(""); setNotice("Delivery settings saved. Only future events are affected; past events are never replayed."); invalidateDependents(qc); },
    onError: e => { setNotice(""); setError(status(e) === 409 ? "These settings changed elsewhere. Your draft was kept. Reload the latest settings to continue." : `Delivery settings were not saved. ${detail(e) || "Please try again."}`); if (status(e) === 409) void q.refetch(); },
  } });
  const data = q.data;
  if (q.isLoading) return <Skeleton />;
  if (q.isError && (status(q.error) === 403 || status(q.error) === 404)) return <div role="alert" className="error-box" data-testid="state-scope-unauthorized">You are no longer authorized to manage this scope, or it no longer exists. Nothing was changed. <button type="button" onClick={onScopeLost} data-testid="button-choose-scope">Choose another scope</button></div>;
  if (q.isError || !data) return <QueryFailure what="Delivery settings" onRetry={() => void q.refetch()} />;
  const conflict = !!draft && draft.revision !== data.revision;
  const stale = conflict || error.startsWith("These settings changed");
  const gateOn = draft?.gate ?? data.notificationsEnabled;
  const edit = (fn: (d: MDraft) => void) => { const d: MDraft = { revision: draft?.revision ?? data.revision, gate: draft?.gate, rows: { ...(draft?.rows ?? {}) } }; fn(d); setNotice(""); setError(""); setDraft(d.gate === undefined && !Object.keys(d.rows).length ? null : d); };
  const rowChecked = (r: api.EventControlRow) => draft?.rows[rk(r)]?.enabled ?? r.enabled;
  const events = [...new Set(data.items.map(i => i.event))];
  const needsConfirm = !!draft && ((draft.gate === true && !data.notificationsEnabled) || data.items.some(r => draft.rows[rk(r)]?.enabled === true && !r.enabled));
  const submit = async () => {
    if (!draft) return;
    if (needsConfirm) {
      const on = Object.values(draft.rows).filter(r => r.enabled).length;
      const ok = await confirm.ask({ title: `Activate notifications for ${data.scopeName}?`, description: `${draft.gate === true && !data.notificationsEnabled ? "Clinic notifications will be switched on. " : ""}${on ? `${on} event channel${on === 1 ? "" : "s"} will be switched on. ` : ""}Eligible future events will be delivered for ${data.scopeName}. Past events are never replayed.`, confirmLabel: "Confirm and Save" });
      if (!ok) return;
    }
    save.mutate({ data: { ...(clinicId ? { clinicId } : {}), revision: draft.revision, ...(draft.gate !== undefined ? { notificationsEnabled: draft.gate } : {}), ...(needsConfirm ? { confirmed: true } : {}),
      changes: Object.entries(draft.rows).map(([k, v]) => { const [channel, event, recipient] = k.split("|"); return { channel: channel as api.ManagedActivationChannel, event, recipient, revision: v.revision, enabled: v.enabled }; }) } });
  };
  return <div className="ns" data-testid="panel-managed-notifications">
    {confirm.dialog}
    <p className="muted" data-testid="text-scope-gate"><span className={`et-chip ${clinicId ? "" : "live"}`}>{clinicId ? "Clinic" : "Platform"}</span> <strong>{data.scopeName}</strong>{data.inherited ? " inherits platform defaults where it has no override." : ""}{!data.notificationsEnabled ? " Notifications are off for this scope, so nothing is delivered." : ""}</p>
    {<label className="ns-gate"><input type="checkbox" checked={gateOn} disabled={save.isPending} onChange={e => edit(d => { d.gate = e.target.checked === data.notificationsEnabled ? undefined : e.target.checked; })} data-testid="checkbox-clinic-gate" />{clinicId ? "Clinic notifications enabled" : "Platform notifications enabled"}{draft?.gate !== undefined && <small className="ns-pending">Pending</small>}</label>}
    {!data.canActivate && <p className="muted" data-testid="text-activation-restricted">Event activation is managed by the platform administrator. You can switch the notification gate above.</p>}
    {stale && <div className="ns-banner" role="alert" data-testid="banner-conflict-managed">Settings changed since you began editing. Saving is paused so nothing is overwritten.
      <button type="button" className="button secondary small" onClick={() => { setDraft(null); setError(""); void q.refetch(); }} data-testid="button-reload-managed">Discard my draft and reload</button></div>}
    {!events.length ? <div className="et-empty" data-testid="state-empty">No events are configured for this scope.</div> :
      <table className="ns-table"><thead><tr><th scope="col">Event</th><th scope="col">Channel and recipient</th></tr></thead>
        <tbody>{events.map(ev => <tr key={ev}><th scope="row">{eventName(ev)}{data.items.find(i => i.event === ev)?.timing && <small className="muted"><br />{data.items.find(i => i.event === ev)!.timing}</small>}</th>
          <td><div className="ns-grid" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>{data.items.filter(i => i.event === ev).map(r => {
            const locked = !!r.required || !data.canActivate;
            const on = rowChecked(r); const pend = draft?.rows[rk(r)];
            const reasons = [...eventSetupReasons(r), ...(!gateOn ? ["Notifications are off for this scope"] : [])];
            const state = r.required ? "Required" : r.enabled ? (r.ready && data.notificationsEnabled ? "On" : "On but blocked") : "Off";
            return <div key={rk(r)} className="ns-cell" data-testid={`cell-${rk(r)}`}>
              <label><input type="checkbox" checked={r.required ? true : on} disabled={locked || save.isPending} onChange={e => edit(d => { if (e.target.checked === r.enabled) delete d.rows[rk(r)]; else d.rows[rk(r)] = { enabled: e.target.checked, revision: r.revision }; })} aria-label={`${eventName(ev)} ${r.channel === "sms" ? "SMS" : "email"} to ${recipientLabel(r.recipient)}`} data-testid={`checkbox-${rk(r)}`} />
                {r.channel === "sms" ? "SMS" : "Email"} to {recipientLabel(r.recipient)}</label>
              <span><span className={`et-chip ${state === "On" || state === "Required" ? "live" : ""}`} data-testid={`state-${rk(r)}`}>{state}</span> <small>{/default|inherit/i.test(r.source) ? "Inherited" : "Override"}</small></span>
              {pend && <small className="ns-pending">Pending: {pend.enabled ? "On" : "Off"}</small>}
              {reasons.length > 0 && <ul className="ec-blocked">{reasons.map(x => <li key={x}>{x}</li>)}</ul>}
            </div>; })}</div></td></tr>)}</tbody></table>}
    {notice && <p role="status" className="et-notice" data-testid="status-save-managed">{notice}</p>}
    {error && !stale && <p role="alert" className="error-box" data-testid="status-save-error-managed">{error}</p>}
    <div className="ns-savebar"><button type="button" className="button" disabled={!draft || stale || save.isPending} onClick={() => void submit()} data-testid="button-save-managed">{save.isPending ? "Saving…" : "Save"}</button>
      <button type="button" className="button secondary" disabled={!draft || save.isPending} onClick={() => { setDraft(null); setError(""); }} data-testid="button-cancel-managed">Cancel</button>
      <Link href="/admin/templates" className="text-link" data-testid="link-edit-wording">Edit notification wording</Link></div>
  </div>;
}

export function NotificationSettings({ superAdmin, onDirtyChange }: { superAdmin: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const q: Personal = api.useGetMyNotificationSettings({ query: { queryKey: api.getGetMyNotificationSettingsQueryKey(), staleTime: 15000 } });
  const [sub, setSub] = useState<"personal" | "delivery">("personal");
  const [chosen, setChosen] = useState<string | null>(null);
  const [pDirty, setPDirty] = useState(false);
  const [mDirty, setMDirty] = useState(false);
  useRegisterUnsaved(pDirty || mDirty);
  const workspace = useWorkspaceBranchContext();
  const confirm = useConfirm();
  const cbRef = useRef(onDirtyChange); cbRef.current = onDirtyChange;
  useEffect(() => { cbRef.current(pDirty || mDirty); }, [pDirty, mDirty]);
  const data = q.data;
  const clinics = data?.clinics ?? [];
  const verifiedClinic = workspace.status === "ready" && clinics.some(c => c.id === workspace.pin?.clinicId) ? workspace.pin!.clinicId : null;
  const fallback = data?.activeClinicId ?? verifiedClinic ?? (!superAdmin && clinics.length === 1 ? clinics[0].id : "");
  // A refreshed context may change eligibility, but must not silently move a
  // managed draft to another clinic. The API reauthorizes this deliberate scope.
  useEffect(() => { if (chosen === null && fallback) setChosen(fallback); }, [chosen, fallback]);
  const scope = chosen ?? fallback;
  const canManage = !!data?.canManage;
  const changeScope = async (next: string) => {
    if (next === scope) return;
    if (mDirty && !await confirm.ask({ title: "Switch scope without saving?", description: "Your unsaved delivery changes for the current scope will be discarded.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
    setMDirty(false); setChosen(next);
  };
  const tabs = [{ id: "personal" as const, label: "My notifications" }, ...(canManage ? [{ id: "delivery" as const, label: superAdmin ? "Delivery management" : "Clinic delivery" }] : [])];
  return <section className="panel padded ns" data-testid="page-notification-settings">
    {confirm.dialog}
    {tabs.length > 1 && <div className="workspace-tabs ns-sub" role="tablist" aria-label="Notification areas">{tabs.map(t => <button key={t.id} type="button" role="tab" aria-selected={sub === t.id} tabIndex={sub === t.id ? 0 : -1} onClick={() => setSub(t.id)}
      onKeyDown={e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = tabs[(tabs.findIndex(x => x.id === sub) + 1) % tabs.length]; setSub(n.id); } }} data-testid={`tab-notify-${t.id}`}>{t.label}</button>)}</div>}
    <div hidden={sub !== "personal"}><PersonalPanel q={q} onDirty={setPDirty} /></div>
    {canManage && <div hidden={sub !== "delivery"}>
      {superAdmin ? <fieldset className="ns-scope" style={{ border: 0, padding: 0 }}><legend><strong>Scope</strong></legend>
        <label><input type="radio" name="ns-scope-kind" checked={scope === "platform"} onChange={() => void changeScope("platform")} data-testid="radio-scope-platform" /> Platform defaults</label>
        <label><input type="radio" name="ns-scope-kind" checked={scope !== "platform"} onChange={() => { if (scope === "platform") void changeScope(""); }} data-testid="radio-scope-clinic" /> One clinic</label>
        {scope !== "platform" && <FormField label="Clinic" required helper="Search and choose the clinic to manage.">{a => <ResourceLookup resource="clinics" {...a} value={scope} onChange={v => void changeScope(v)} />}</FormField>}</fieldset>
      : <div className="ns-scope"><label htmlFor="ns-scope-select"><strong>Clinic</strong></label>
        <select id="ns-scope-select" value={scope} onChange={e => void changeScope(e.target.value)} data-testid="select-notification-scope">
          <option value="" disabled>Choose a clinic</option>
          {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
      {scope ? <ManagedPanel key={scope} scope={scope} onDirty={setMDirty} onScopeLost={() => { setMDirty(false); setChosen(""); }} /> : <div className="et-empty" data-testid="state-select-scope">{superAdmin ? "Choose platform defaults or one clinic to manage its delivery." : "Choose a clinic to manage its delivery."}</div>}
    </div>}
  </section>;
}
export default NotificationSettings;
