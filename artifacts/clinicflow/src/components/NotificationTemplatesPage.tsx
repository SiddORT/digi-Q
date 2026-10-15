import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { useConfirm } from "./ConfirmDialog";
import { useWorkspaceLeaveGuard } from "../lib/use-workspace-leave-guard";
import { AppDialog } from "./AppDialog";
import { EmailTemplates, RECIPIENTS } from "./EmailTemplates";
import { FormActions } from "./FormActions";
import { FormField } from "./FormField";
import { ResourceLookup } from "./ResourceLookup";
import { AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { NotificationEventAccordion } from "./NotificationEventAccordion";
import { titleCase } from "../lib/title-case";
import { previewText } from "../lib/template-preview";
import { eventSetupReasons, filterRows, type ListRow } from "../lib/communication-routes";
import { useNotificationManagement } from "./useNotificationManagement";
import "./email-templates.css";
import "./communication.css";
import "./notification-settings.css";

type Row = api.EventControlRow;
const label = (r: string) => RECIPIENTS.find(x => x.value === r)?.label ?? r;
const CHANNELS = ["email", "sms"] as const;

function EventTemplates({ identity, clinicId, onDirty, onPending }: { identity: api.Identity; clinicId: string; onDirty: (v: boolean) => void; onPending: (v: boolean) => void }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [f, setF] = useState({ q: "", channel: "", recipient: "", status: "" });
  const [editing, setEditing] = useState<{ channel: "email" | "sms"; event: string; recipient: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const askRef = useRef(confirm.ask); askRef.current = confirm.ask;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const enabled = superAdmin || !!clinicId;
  const management = useNotificationManagement(clinicId, enabled, superAdmin);
  const controls = management.query;
  const pending = management.pending || busy;
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { onPending(pending); return () => onPending(false); }, [pending, onPending]);
  const combos = (superAdmin ? CHANNELS : ["email"] as const).flatMap(channel => RECIPIENTS.filter(r => superAdmin || r.value !== "superAdmin").map(r => ({ channel, recipient: r.value })));
  const catalogs = useQueries({ queries: combos.map(c => {
    const p = clinicId ? { clinicId, recipient: c.recipient, channel: c.channel } : { recipient: c.recipient, channel: c.channel };
    return { queryKey: api.getGetNotificationTemplatesQueryKey(p), queryFn: () => api.getNotificationTemplates(p), enabled, staleTime: 15000 };
  }) });
  const previews = useMemo(() => {
    const m = new Map<string, string>();
    catalogs.forEach((c, i) => c.data?.items.forEach(it => m.set(`${combos[i].channel}|${it.event}|${combos[i].recipient}`, (it.draft ?? it.content).body)));
    return m;
  }, [catalogs]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = controls.data?.items ?? [];
  const list: (ListRow & { row: Row })[] = items.map(r => ({ row: r, channel: r.channel, event: r.event, recipient: r.recipient, enabled: r.enabled, ready: r.ready && (r.required || controls.data?.notificationsEnabled === true), source: r.source,
    inherited: clinicId ? r.source !== "clinic" : r.source === "default", preview: previews.get(`${r.channel}|${r.event}|${r.recipient}`) ?? "" }));
  const shown = filterRows(list, f) as typeof list;
  const groups = useMemo(() => { const m = new Map<string, typeof shown>(); for (const r of shown) m.set(r.event, [...(m.get(r.event) ?? []), r]); return [...m.entries()]; }, [shown]);
  const filtered = !!(f.q.trim() || f.channel || f.recipient || f.status);
  const expansionKey = JSON.stringify([identity.user?.id, superAdmin, clinicId, f.q.trim(), f.channel, f.recipient, f.status]);
  const closeEditor = () => { setEditing(null); setDirty(false); void controls.refetch(); };
  const [discard, setDiscard] = useState(false);
  useWorkspaceLeaveGuard("/admin/templates", dirty || busy || management.pending, (o: any) => management.locked() || busy ? Promise.resolve(false) : askRef.current(o), () => { setDirty(false); setEditing(null); });
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  const requestClose = () => busy ? undefined : dirty ? setDiscard(true) : closeEditor();
  const sel = (k: keyof typeof f, v: string, opts: [string, string][], name: string) => <select aria-label={name} value={v} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} data-testid={`select-filter-${k}`}><option value="">{name}: all</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  return <section className="panel padded event-controls" data-testid="page-notification-templates">
    {confirm.dialog}
    {management.dialog}
    <p className="muted" data-testid="text-gate-note">The overall gate controls optional delivery for this scope; each row controls one event, channel and recipient. Required security messages ignore optional gates and opt-outs. Wording edits keep saved activation. Personal preferences still apply separately. Provider connections and diagnostics remain in Communication Settings.</p>
    {enabled && !controls.isError && controls.data && <div className="ns">
      <p className="muted" data-testid="text-scope-gate"><span className={`et-chip ${clinicId ? "" : "live"}`} data-testid="chip-scope">{clinicId ? "Clinic" : "Platform"}</span> <strong>{controls.data.scopeName}</strong>{clinicId ? " inherits platform defaults where it has no override." : " (clinics inherit these unless they override)."}</p>
      <label className="ns-gate"><input type="checkbox" role="switch" checked={controls.data.notificationsEnabled} disabled={pending || !!editing || controls.isFetching} onChange={() => void management.change()} data-testid="checkbox-clinic-gate" />{clinicId ? "Clinic" : "Platform"} optional notifications enabled</label>
      <p className="muted" data-testid="text-gate-source">Saved gate: {controls.data.notificationsEnabled ? "On" : "Off"} · {controls.data.inherited ? clinicId ? "Inherited platform value" : "Built-in default" : clinicId ? "Explicit clinic override" : "Explicit platform value"}. {!controls.data.notificationsEnabled && "Optional delivery is blocked even when a template is enabled."}</p>
      {!controls.data.canActivate && <p className="muted">You may manage this clinic’s overall gate and email wording. Event activation, SMS, providers and System Admin recipients are managed by the platform administrator.</p>}
    </div>}
    {management.pending && <p role="status">Waiting for confirmation or saving. Scope and other delivery actions are locked.</p>}
    {management.error && <p className="error-box" role="alert" data-testid="status-management-error">{management.error}</p>}
    {management.notice && <p className="et-notice" role="status" data-testid="status-management-save">{management.notice}</p>}
    <button type="button" className="button secondary cm-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(o => !o)} data-testid="button-toggle-filters">{filtersOpen ? "Hide filters" : "Search and filters"}</button>
    <div className={`cm-filters${filtersOpen ? " open" : ""}`} role="search">
      <input type="search" aria-label="Search events" placeholder="Search events or wording" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} data-testid="input-search-events" />
      {sel("channel", f.channel, [["email", "Email"], ["sms", "SMS"]], "Channel")}
      {sel("recipient", f.recipient, RECIPIENTS.filter(r => superAdmin || r.value !== "superAdmin").map(r => [r.value, r.label]), "Recipient")}
      {sel("status", f.status, [["on", "On and ready"], ["blocked", "On, blocked"], ["off", "Off"]], "Status")}
    </div>
    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its notification templates.</div>
      : controls.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : controls.isError ? <div role="alert" className="error-box" data-testid="state-error">Events could not be loaded. <button type="button" onClick={() => controls.refetch()} data-testid="button-retry">Retry</button></div>
      : !groups.length ? <div className="et-empty" data-testid="state-empty">No events match these filters.</div>
       : <NotificationEventAccordion key={expansionKey} events={groups.map(([event]) => event)} filtered={filtered}>
         {groups.map(([event, rows]) => <AccordionItem key={event} value={event} className="cm-event" data-testid={`group-event-${event}`}>
         <AccordionTrigger className="cm-event-trigger" data-testid={`button-event-${event}`}>
           <span className="cm-event-head"><span className="cm-event-title">{titleCase(event === "onboarding" ? "Clinic onboarding" : event.replaceAll("_", " "))}</span>{rows[0].row.timing && <span className="muted cm-event-timing">{rows[0].row.timing}</span>}</span>
         </AccordionTrigger>
         <AccordionContent className="cm-event-content"><ul className="cm-rows">{rows.map(r => <li key={`${r.channel}|${r.recipient}`} className="cm-row" data-testid={`card-template-${r.channel}-${event}-${r.recipient}`}>
          <div className="cm-row-main">
            <div className="cm-row-meta"><span className="cm-channel">{r.channel === "sms" ? "SMS" : "Email"}</span><span>to {label(r.recipient)}</span>
              <span className={`et-chip ${r.enabled && r.ready ? "live" : ""}`}>{r.row.required ? "Required" : r.enabled ? (r.ready ? "On" : "On, blocked") : "Off"}</span>
              <span className="et-chip">{r.inherited ? clinicId ? "Inherited platform value" : "Built-in default" : "Override"}</span>
              <small>Saved activation: {r.row.required || r.enabled ? "On" : "Off"}</small></div>
            <p className="cm-preview" data-testid={`text-preview-${r.channel}-${event}-${r.recipient}`}>{r.preview ? previewText(r.preview, controls.data?.scopeName ?? "").slice(0, 160) : "Loading preview"}</p>
            {eventSetupReasons(r.row).length > 0 && <ul className="ec-blocked" data-testid={`setup-${r.channel}-${event}-${r.recipient}`}>{eventSetupReasons(r.row).map(b => <li key={b}>{b}</li>)}</ul>}
             {r.row.required ? <p className="muted">Required security message; cannot be switched off and is independent of the optional delivery gate.</p> : controls.data?.notificationsEnabled === false && <p className="muted">Overall optional delivery gate is off.</p>}
          </div>
          <div className="cm-row-actions">
            <input type="checkbox" role="switch" aria-label={`${titleCase(event.replaceAll("_", " "))} ${r.channel === "sms" ? "SMS" : "email"} to ${label(r.recipient)}`} checked={!!r.row.required || r.enabled} disabled={!!r.row.required || !superAdmin || !controls.data?.canActivate || pending || !!editing || controls.isFetching} onChange={() => void management.change(r.row)} data-testid={`switch-${r.channel}-${event}-${r.recipient}`} />
            <button type="button" className="button secondary small" disabled={pending || !!editing} onClick={() => { setEditing({ channel: r.channel, event, recipient: r.recipient }); }} data-testid={`button-edit-${r.channel}-${event}-${r.recipient}`}>Edit</button>
           </div></li>)}</ul></AccordionContent>
       </AccordionItem>)}</NotificationEventAccordion>}
    {editing && <AppDialog open variant="drawer" onClose={requestClose} dirty={false} title="Edit Template" description={`${titleCase(editing.event.replaceAll("_", " "))} / ${editing.channel === "sms" ? "SMS" : "EMAIL"} (${label(editing.recipient)})`}>
      <EmailTemplates key={`${editing.channel}|${editing.event}|${editing.recipient}|${clinicId}`} identity={identity} channel={editing.channel} fixed={{ clinicId, event: editing.event, recipient: editing.recipient as any }} onDirtyChange={setDirty} onBusyChange={setBusy} />
    </AppDialog>}
    <AppDialog open={discard} onClose={() => setDiscard(false)} title="Discard unsaved changes?">
      <div className="et-dialog"><p>You have edits that are not saved. Closing discards them.</p>
        <FormActions wide={false} onCancel={() => setDiscard(false)} cancelLabel="Keep Editing" onSubmit={() => { setDiscard(false); closeEditor(); }} submitClassName="danger" submitLabel="Discard" submitTestId="button-discard-editor" /></div>
    </AppDialog>
  </section>;
}
function ClinicAdminTemplates({ identity }: { identity: api.Identity }) {
  const q = api.useGetMyNotificationSettings({ query: { queryKey: api.getGetMyNotificationSettingsQueryKey(), staleTime: 15000 } });
  if (q.isLoading) return <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>;
  if (q.isError || !q.data) return <div role="alert" className="error-box" data-testid="state-error">Your clinic could not be determined. <button type="button" onClick={() => void q.refetch()} data-testid="button-retry">Retry</button></div>;
  const owned = q.data.clinics;
  const linked = new URLSearchParams(window.location.search).get("clinicId");
  const initial = owned.some(c => c.id === linked) ? linked! : q.data.activeClinicId ?? (owned.length === 1 ? owned[0].id : "");
  return <NotificationScope identity={identity} initial={initial} clinics={owned} />;
}
function NotificationScope({ identity, initial = "", clinics }: { identity: api.Identity; initial?: string; clinics?: { id: string; name: string }[] }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [clinicId, setClinicId] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const confirm = useConfirm();
  const switching = useRef(false);
  const changeScope = async (next: string) => {
    if (next === clinicId || pending || switching.current) return;
    switching.current = true;
    try {
      if (dirty && !await confirm.ask({ title: "Discard unsaved changes?", description: "Switching scope discards unsaved wording. Saved unpublished drafts are kept.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
      setDirty(false); setClinicId(next);
    } finally { switching.current = false; }
  };
  return <>
    {confirm.dialog}
    <section className="panel padded et-scope" aria-label="Notification scope" data-testid="notification-scope">
      <FormField label={superAdmin ? "Scope" : "Clinic Group"} optional={superAdmin} required={!superAdmin} helper={superAdmin ? "Leave empty for platform defaults. This scope applies to the gate, rows and wording editor." : "Only clinics you manage are available."}>
        {a => superAdmin ? <ResourceLookup resource="clinics" {...a} value={clinicId} disabled={pending} onChange={v => void changeScope(v)} placeholder="Platform defaults" />
          : <select {...a} value={clinicId} disabled={pending} onChange={e => void changeScope(e.target.value)} data-testid="select-notification-scope"><option value="" disabled>Choose a clinic</option>{clinics?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      </FormField>
    </section>
    <EventTemplates key={`${identity.user?.id}|${identity.user?.role}|${clinicId}`} identity={identity} clinicId={clinicId} onDirty={setDirty} onPending={setPending} />
  </>;
}
export function NotificationTemplatesPage({ identity }: { identity: api.Identity }) {
  if (!["superAdmin", "clinicAdmin"].includes(identity.user?.role ?? "")) return <p role="alert">You are not authorized to manage notifications.</p>;
  return identity.user?.role === "superAdmin" ? <NotificationScope key={identity.user.id} identity={identity} initial={new URLSearchParams(window.location.search).get("clinicId") ?? ""} /> : <ClinicAdminTemplates key={identity.user?.id} identity={identity} />;
}
export default NotificationTemplatesPage;
