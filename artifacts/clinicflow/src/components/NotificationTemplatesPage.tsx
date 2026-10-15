import { useEffect, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from "react";
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
import { notificationGroup } from "../lib/notification-groups";
import { Switch } from "./ui/switch";
import { NotificationInfo } from "./NotificationInfo";
import "./email-templates.css";
import "./communication.css";
import "./notification-settings.css";

type Row = api.EventControlRow;
const label = (r: string) => RECIPIENTS.find(x => x.value === r)?.label ?? r;
const CHANNELS = ["email", "sms"] as const;

function EventTemplates({ identity, clinicId, onDirty, onPending, scopeControl, interactionLock, scopeChanging }: { identity: api.Identity; clinicId: string; onDirty: (v: boolean) => void; onPending: (v: boolean) => void; scopeControl: ReactNode; interactionLock: MutableRefObject<boolean>; scopeChanging: boolean }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [f, setF] = useState({ q: "", channel: "", recipient: "", status: "" });
  const [editing, setEditing] = useState<{ channel: "email" | "sms"; event: string; recipient: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const askRef = useRef(confirm.ask); askRef.current = confirm.ask;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const enabled = superAdmin || !!clinicId;
  const management = useNotificationManagement(clinicId, enabled, superAdmin, interactionLock, () => busy || !!editing || scopeChanging);
  const controls = management.query;
  const pending = management.pending || busy || scopeChanging;
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
    <header className="cm-notification-toolbar">
      <div className="cm-notification-heading"><h2>Notifications</h2><NotificationInfo label="About notification controls">
        The overall gate controls optional delivery; activation is saved separately for each event, channel and recipient. Required security messages ignore optional gates and opt-outs. Wording edits keep activation; personal preferences still apply. Provider connections and diagnostics are in Communication Settings. Only future eligible events change; past events are never replayed.
      </NotificationInfo></div>
      {scopeControl}
    </header>
    {enabled && !controls.isError && controls.data && <div className="ns cm-notification-gate">
      <div className="ns-bar">
        <div className="ns-scope" data-testid="text-scope-gate"><span className={`et-chip ${clinicId ? "" : "live"}`} data-testid="chip-scope">{clinicId ? "Clinic" : "Platform"}</span><strong className="cm-scope-name">{controls.data.scopeName}</strong>
          <NotificationInfo label="Scope and inheritance">{clinicId ? "Clinics inherit platform values unless overridden." : "Clinics inherit these platform defaults unless overridden."} Gate, activation and wording use this scope. Unchanged options retain their inheritance.</NotificationInfo>
        </div>
        <div className="ns-gate"><Switch className="cm-switch" id="notification-delivery-gate" aria-describedby="notification-gate-source" checked={controls.data.notificationsEnabled} disabled={pending || !!editing || controls.isFetching} onCheckedChange={() => void management.change()} data-testid="checkbox-clinic-gate" /><label htmlFor="notification-delivery-gate">Optional delivery {controls.data.notificationsEnabled ? "on" : "off"}</label></div>
      </div>
      <p id="notification-gate-source" className="muted" data-testid="text-gate-source">{controls.data.inherited ? clinicId ? "Inherited platform value" : "Built-in default" : clinicId ? "Explicit clinic override" : "Explicit platform value"}{!controls.data.notificationsEnabled && <strong className="cm-gate-off"> · Gate off: optional delivery blocked even when a template is enabled.</strong>}</p>
      {!controls.data.canActivate && <p id="notification-activation-permission" className="muted">Activation is read-only: only the platform administrator can change it. You can manage this gate and email wording.</p>}
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
         {groups.map(([event, rows]) => {
           const group = notificationGroup(items, event);
           const title = titleCase(event === "onboarding" ? "Clinic onboarding" : event.replaceAll("_", " "));
           return <AccordionItem key={event} value={event} className="cm-event" data-testid={`group-event-${event}`}>
         <div className="cm-event-toolbar">
         <AccordionTrigger className="cm-event-trigger" data-testid={`button-event-${event}`}>
           <span className="cm-event-title">{title}</span>
         </AccordionTrigger>
         <NotificationInfo label={`About ${title}`}>
           {rows[0].row.timing && <>{rows[0].row.timing} </>}
           {group.optional.length ? `Saved activation across all ${group.optional.length} optional channel/recipient options, including those hidden by filters. Custom means mixed: switch on to enable all; from Enabled, switch off to disable all. This does not change the overall gate or confirm delivery readiness. Required rows are excluded.` : "Required security messages cannot be disabled and ignore the optional delivery gate."}
         </NotificationInfo>
         <span className={`et-chip cm-group-status ${group.checked ? "live" : ""}`} data-testid={`status-event-${event}`}>{group.status}</span>
         {group.optional.length > 0 && <Switch className="cm-switch" aria-label={`${title}: all ${group.optional.length} optional options`} aria-describedby={!controls.data?.canActivate ? "notification-activation-permission" : undefined} checked={group.checked} disabled={!superAdmin || !controls.data?.canActivate || pending || !!editing || controls.isFetching} onCheckedChange={() => void management.changeGroup(event)} data-testid={`switch-group-${event}`} />}
         </div>
         <AccordionContent className="cm-event-content"><ul className="cm-rows">{rows.map(r => <li key={`${r.channel}|${r.recipient}`} className="cm-row" data-testid={`card-template-${r.channel}-${event}-${r.recipient}`}>
          <div className="cm-row-main">
            <div className="cm-row-meta"><span className="cm-channel">{r.channel === "sms" ? "SMS" : "Email"}</span><span>to {label(r.recipient)}</span>
              <span className={`et-chip ${r.enabled && r.ready ? "live" : ""}`}>{r.row.required ? "Required" : r.enabled ? (r.ready ? "On" : "On, blocked") : "Off"}</span>
              <span className="et-chip">{r.inherited ? clinicId ? "Inherited platform value" : "Built-in default" : "Override"}</span>
              </div>
            <p className="cm-preview" data-testid={`text-preview-${r.channel}-${event}-${r.recipient}`}>{r.preview ? previewText(r.preview, controls.data?.scopeName ?? "").slice(0, 160) : "Loading preview"}</p>
            {eventSetupReasons(r.row).length > 0 && <ul className="ec-blocked" data-testid={`setup-${r.channel}-${event}-${r.recipient}`}>{eventSetupReasons(r.row).map(b => <li key={b}>{b}</li>)}</ul>}
          </div>
          <div className="cm-row-actions">
            <Switch className="cm-switch" aria-label={`${titleCase(event.replaceAll("_", " "))} ${r.channel === "sms" ? "SMS" : "email"} to ${label(r.recipient)}${r.row.required ? " (required; cannot be disabled)" : ""}`} aria-describedby={!controls.data?.canActivate ? "notification-activation-permission" : undefined} checked={!!r.row.required || r.enabled} disabled={!!r.row.required || !superAdmin || !controls.data?.canActivate || pending || !!editing || controls.isFetching} onCheckedChange={() => void management.change(r.row)} data-testid={`switch-${r.channel}-${event}-${r.recipient}`} />
            <button type="button" className="button secondary small" disabled={pending || !!editing} onClick={() => { if (!management.locked()) setEditing({ channel: r.channel, event, recipient: r.recipient }); }} data-testid={`button-edit-${r.channel}-${event}-${r.recipient}`}>Edit</button>
           </div></li>)}</ul></AccordionContent>
       </AccordionItem>; })}</NotificationEventAccordion>}
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
  const interactionLock = useRef(false);
  const [scopeChanging, setScopeChanging] = useState(false);
  const changeScope = async (next: string) => {
    if (next === clinicId || pending || switching.current || interactionLock.current) return;
    switching.current = true; interactionLock.current = true; setScopeChanging(true);
    try {
      if (dirty && !await confirm.ask({ title: "Discard unsaved changes?", description: "Switching scope discards unsaved wording. Saved unpublished drafts are kept.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
      setDirty(false); setClinicId(next);
    } finally { switching.current = false; interactionLock.current = false; setScopeChanging(false); }
  };
  return <>
    {confirm.dialog}
    <EventTemplates key={`${identity.user?.id}|${identity.user?.role}|${clinicId}`} identity={identity} clinicId={clinicId} onDirty={setDirty} onPending={setPending} interactionLock={interactionLock} scopeChanging={scopeChanging} scopeControl={
      <div className="cm-notification-scope" aria-label="Notification scope" data-testid="notification-scope">
        <FormField label={superAdmin ? "Scope" : "Clinic Group"} optional={superAdmin} required={!superAdmin}>
          {a => superAdmin ? <ResourceLookup resource="clinics" {...a} value={clinicId} disabled={pending || scopeChanging} onChange={v => void changeScope(v)} placeholder="Platform defaults" />
            : <select {...a} value={clinicId} disabled={pending || scopeChanging} onChange={e => void changeScope(e.target.value)} data-testid="select-notification-scope"><option value="" disabled>Choose a clinic</option>{clinics?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        </FormField>
      </div>
    } />
  </>;
}
export function NotificationTemplatesPage({ identity }: { identity: api.Identity }) {
  if (!["superAdmin", "clinicAdmin"].includes(identity.user?.role ?? "")) return <p role="alert">You are not authorized to manage notifications.</p>;
  return identity.user?.role === "superAdmin" ? <NotificationScope key={identity.user.id} identity={identity} initial={new URLSearchParams(window.location.search).get("clinicId") ?? ""} /> : <ClinicAdminTemplates key={identity.user?.id} identity={identity} />;
}
export default NotificationTemplatesPage;
