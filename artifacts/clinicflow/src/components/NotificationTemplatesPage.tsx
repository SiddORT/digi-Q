import { useEffect, useMemo, useRef, useState, type ReactNode, type MutableRefObject } from "react";
import { useQueries } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { useConfirm } from "./ConfirmDialog";
import { useWorkspaceLeaveGuard } from "../lib/use-workspace-leave-guard";
import { AppDialog } from "./AppDialog";
import { EmailTemplates, RECIPIENTS } from "./EmailTemplates";
import { FormActions } from "./FormActions";
import { ResourceLookup } from "./ResourceLookup";
import { SearchableSelect } from "./SearchableSelect";
import { OverflowText } from "./OverflowText";
import { Pencil } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { NotificationEventAccordion } from "./NotificationEventAccordion";
import { titleCase } from "../lib/title-case";
import { previewText } from "../lib/template-preview";
import { filterRows, type ListRow } from "../lib/communication-routes";
import { activationSource, rowDeliveryReasons } from "../lib/notification-presentation";
import { useNotificationManagement } from "./useNotificationManagement";
import { notificationGroup } from "../lib/notification-groups";
import { Switch } from "./ui/switch";
import { NotificationInfo } from "./NotificationInfo";
import "./email-templates.css";
import "./communication.css";
import "./notification-settings.css";
import "./notification-page.css";

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
  const enabled = superAdmin || !!clinicId;
  const management = useNotificationManagement(clinicId, enabled, superAdmin, interactionLock, () => busy || !!editing || scopeChanging);
  const controls = management.query;
  const pending = management.pending || busy || scopeChanging;
  const unavailable = pending || controls.isFetching || controls.isError || !controls.data;
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
  const sel = (k: keyof typeof f, v: string, opts: [string, string][], name: string) => <select aria-label={name} value={v} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} data-testid={`select-filter-${k}`}><option value="">{name}: All</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  return <section className="panel padded event-controls" data-testid="page-notification-templates">
    {confirm.dialog}
    {management.dialog}
    <header className="cm-notification-toolbar">
      {scopeControl}
      <div className="ns-gate"><Switch className="cm-switch" id="notification-delivery-gate" checked={controls.data?.notificationsEnabled ?? false} disabled={!enabled || unavailable || !!editing} onCheckedChange={() => void management.change()} data-testid="checkbox-clinic-gate" /><label htmlFor="notification-delivery-gate">Optional Delivery</label>
        <NotificationInfo label="About Optional Delivery">
          {clinicId ? "Applies only to the selected clinic. Clinics inherit system values until explicitly changed." : "System Default is inherited by clinics without an explicit override; clinics with overrides may differ."} Required security messages ignore Optional Delivery and opt-outs. Activation and wording are separate. Enabling does not confirm delivery readiness. Only future eligible events change; past events are never replayed.
          {controls.data && <> Current gate: {controls.data.notificationsEnabled ? "On" : "Off"}. {controls.data.inherited ? clinicId ? "Inherited system value." : "Default system value." : clinicId ? "Saved clinic value." : "Saved system value."}</>}
        </NotificationInfo>
      </div>
    </header>
    {enabled && !controls.isError && controls.data && <>
      {!controls.data.notificationsEnabled && <p className="notice cm-gate-warning" data-testid="text-gate-off">{clinicId ? "Optional delivery is off for this clinic, including enabled options." : "Optional delivery is off for System Default. Clinics with explicit overrides may differ."} Required security messages are not blocked by this gate.</p>}
      {!controls.data.canActivate && <p id="notification-activation-permission" className="muted">Activation is read-only. Only the System Admin can change it. You can manage Optional Delivery and email wording.</p>}
    </>}
    {management.pending && <p role="status">Waiting for confirmation or saving. Scope and other delivery actions are locked.</p>}
    {management.error && <p className="error-box" role="alert" data-testid="status-management-error">{management.error}</p>}
    {management.notice && <p className="et-notice" role="status" data-testid="status-management-save">{management.notice}</p>}
    <div className="cm-filters cm-inline-filters" role="search" aria-label="Filter Notification Events">
      <input type="search" aria-label="Search Events" placeholder="Search Events or Wording" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} data-testid="input-search-events" />
      {sel("channel", f.channel, [["email", "Email"], ["sms", "SMS"]], "Channel")}
      {sel("recipient", f.recipient, RECIPIENTS.filter(r => superAdmin || r.value !== "superAdmin").map(r => [r.value, r.label]), "Recipient")}
      {sel("status", f.status, [["on", "On and Ready"], ["blocked", "On, Blocked"], ["off", "Off"]], "Status")}
      {filtered && <button type="button" className="button secondary small" onClick={() => setF({ q: "", channel: "", recipient: "", status: "" })} data-testid="button-clear-filters">Clear Filters</button>}
    </div>
    {catalogs.some(c => c.isError) && <p className="error-box" role="alert">Some message previews could not be loaded. Activation settings are separate. <button type="button" onClick={() => catalogs.forEach(c => { if (c.isError) void c.refetch(); })}>Retry Previews</button></p>}
    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its notification templates.</div>
      : controls.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : controls.isError ? <div role="alert" className="error-box" data-testid="state-error">Events could not be loaded. <button type="button" onClick={() => controls.refetch()} data-testid="button-retry">Retry</button></div>
      : !items.length ? <div className="et-empty" data-testid="state-empty-catalog">No notification events are available for this selection.</div>
      : !groups.length ? <div className="et-empty" data-testid="state-empty">{catalogs.some(c => c.isFetching) ? "Loading message previews…" : "No events match these filters."}</div>
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
            {group.optional.length ? `Saved activation across all ${group.optional.length} optional channel/recipient options, including those hidden by filters. Mixed means some are enabled: switch on to enable all; from All Enabled, switch off to disable all. This does not change Optional Delivery or confirm delivery readiness. Required recipients are excluded.` : "Required security messages cannot be disabled and ignore Optional Delivery. Wording can still be edited."}
         </NotificationInfo>
          <span className={`et-chip cm-group-status ${group.checked ? "live" : ""}`} data-testid={`status-event-${event}`}>{group.status === "Enabled" ? "All Enabled" : group.status === "Disabled" ? "All Disabled" : group.status === "Custom" ? "Mixed" : "Required"}</span>
         {group.optional.length > 0 && <Switch className="cm-switch" aria-label={`${title}: all ${group.optional.length} optional options`} aria-describedby={!controls.data?.canActivate ? "notification-activation-permission" : undefined} checked={group.checked} disabled={!superAdmin || !controls.data?.canActivate || pending || !!editing || controls.isFetching} onCheckedChange={() => void management.changeGroup(event)} data-testid={`switch-group-${event}`} />}
         </div>
          <AccordionContent className="cm-event-content">{!group.optional.length && <p className="cm-required-note">These security messages cannot be disabled and ignore Optional Delivery. Wording remains editable.</p>}<ul className="cm-rows">{rows.map(r => <li key={`${r.channel}|${r.recipient}`} className="cm-row" data-testid={`card-template-${r.channel}-${event}-${r.recipient}`}>
          <div className="cm-row-main">
            <div className="cm-row-meta"><span className="cm-channel">{r.channel === "sms" ? "SMS" : "Email"}</span><span className="cm-recipient">{label(r.recipient)}</span>
              {r.row.required && group.optional.length > 0 && <span className="et-chip">Required</span>}
              {r.enabled && rowDeliveryReasons(r.row, controls.data?.notificationsEnabled === false).length > 0 && <span className="et-chip cm-blocked">Delivery Blocked</span>}
              <NotificationInfo label={`Activation Details: ${r.channel} to ${label(r.recipient)}`}>
                {activationSource(r.row.source, clinicId)}. {r.row.required ? "Read-only security activation." : `Saved activation is ${r.enabled ? "on" : "off"}; it does not guarantee delivery. Provider readiness is separate from recipient eligibility: active status, patient opt-outs, clinic ownership or doctor assignment, valid contact and duplicate destinations are checked for each event.`} Wording has its own inheritance and unpublished drafts; open Edit for wording details. SMS uses the provider configuration on Communication Settings and each template's own DLT Template ID.
              </NotificationInfo>
              </div>
            <OverflowText className="cm-preview" testId={`text-preview-${r.channel}-${event}-${r.recipient}`} value={r.preview ? previewText(r.preview, controls.data?.scopeName ?? "") : catalogs.some(c => c.isError) ? "Preview unavailable. Open Edit or retry previews." : "Loading Preview…"} />
            {rowDeliveryReasons(r.row, controls.data?.notificationsEnabled === false).length > 0 && <ul className="ec-blocked" data-testid={`setup-${r.channel}-${event}-${r.recipient}`}>{rowDeliveryReasons(r.row, controls.data?.notificationsEnabled === false).map(b => <li key={b}>{b}</li>)}</ul>}
          </div>
          <div className="cm-row-actions">
            {!r.row.required && <Switch className="cm-switch" aria-label={`${titleCase(event.replaceAll("_", " "))} ${r.channel === "sms" ? "SMS" : "Email"} to ${label(r.recipient)}`} aria-describedby={!controls.data?.canActivate ? "notification-activation-permission" : undefined} checked={r.enabled} disabled={!superAdmin || !controls.data?.canActivate || unavailable || !!editing} onCheckedChange={() => void management.change(r.row)} data-testid={`switch-${r.channel}-${event}-${r.recipient}`} />}
            <button type="button" className="button secondary small cm-edit" aria-label={`Edit ${title} ${r.channel === "sms" ? "SMS" : "Email"} to ${label(r.recipient)}`} title="Edit Template" disabled={unavailable || !!editing} onClick={() => { if (!management.locked()) setEditing({ channel: r.channel, event, recipient: r.recipient }); }} data-testid={`button-edit-${r.channel}-${event}-${r.recipient}`}><Pencil size={18} aria-hidden="true" /></button>
           </div></li>)}</ul></AccordionContent>
       </AccordionItem>; })}</NotificationEventAccordion>}
    {editing && <AppDialog open variant="drawer" onClose={requestClose} dirty={false} title="Edit Template" description={`${titleCase(editing.event.replaceAll("_", " "))} · ${editing.channel === "sms" ? "SMS" : "Email"} · ${label(editing.recipient)}`}>
      <EmailTemplates key={`${editing.channel}|${editing.event}|${editing.recipient}|${clinicId}`} notificationPage identity={identity} channel={editing.channel} fixed={{ clinicId, event: editing.event, recipient: editing.recipient as any }} onDirtyChange={setDirty} onBusyChange={setBusy} />
    </AppDialog>}
    <AppDialog open={discard} onClose={() => setDiscard(false)} title="Discard Unsaved Changes?">
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
  const initial = owned.some(c => c.id === linked) ? linked! : owned.some(c => c.id === q.data.activeClinicId) ? q.data.activeClinicId! : owned.length === 1 ? owned[0].id : "";
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
  useEffect(() => {
    // This route owns selection locally. Never leave a misleading old deep-link.
    const url = new URL(window.location.href);
    if (url.searchParams.has("clinicId")) {
      url.searchParams.delete("clinicId");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);
  const changeScope = async (next: string) => {
    if (next === clinicId || pending || switching.current || interactionLock.current || (!superAdmin && !clinics?.some(c => c.id === next))) return;
    switching.current = true; interactionLock.current = true; setScopeChanging(true);
    try {
      if (dirty && !await confirm.ask({ title: "Discard Unsaved Changes?", description: "Switching scope discards unsaved wording. Saved unpublished drafts are kept.", confirmLabel: "Discard and Switch", tone: "danger" })) return;
      setDirty(false); setClinicId(next);
    } finally { switching.current = false; interactionLock.current = false; setScopeChanging(false); }
  };
  return <>
    {confirm.dialog}
    <EventTemplates key={`${identity.user?.id}|${identity.user?.role}|${clinicId}`} identity={identity} clinicId={clinicId} onDirty={setDirty} onPending={setPending} interactionLock={interactionLock} scopeChanging={scopeChanging} scopeControl={
      <div className="cm-notification-scope" data-testid="notification-scope">
        <span className="sr-only" id="notification-scope-label">Notification Clinic</span>
        {superAdmin ? <ResourceLookup resource="clinics" aria-labelledby="notification-scope-label" compactLabel clearable={false} emptyOption={{ value: "__system_default__", label: "System Default" }} value={clinicId} disabled={pending || scopeChanging} onChange={v => void changeScope(v)} placeholder="System Default" />
          : clinics?.length === 1 ? <OverflowText value={clinics[0].name} />
          : <SearchableSelect aria-labelledby="notification-scope-label" compactLabel clearable={false} value={clinicId} disabled={pending || scopeChanging} onChange={v => { if(v) void changeScope(v); }} placeholder="Choose a Clinic" options={clinics?.map(c => ({ value: c.id, label: c.name })) ?? []} />}
      </div>
    } />
  </>;
}
export function NotificationTemplatesPage({ identity }: { identity: api.Identity }) {
  if (!["superAdmin", "clinicAdmin"].includes(identity.user?.role ?? "")) return <p role="alert">You are not authorized to manage notifications.</p>;
  return identity.user?.role === "superAdmin" ? <NotificationScope key={identity.user.id} identity={identity} /> : <ClinicAdminTemplates key={identity.user?.id} identity={identity} />;
}
export default NotificationTemplatesPage;
