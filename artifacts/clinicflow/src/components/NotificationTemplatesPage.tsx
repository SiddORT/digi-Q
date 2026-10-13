import { useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { useGetEventControls, getGetEventControlsQueryKey, useUpdateEventControl } from "@workspace/api-client-react";
import { useConfirm } from "./ConfirmDialog";
import { useWorkspaceLeaveGuard } from "../lib/use-workspace-leave-guard";
import { AppDialog } from "./AppDialog";
import { EmailTemplates, RECIPIENTS } from "./EmailTemplates";
import { FormActions } from "./FormActions";
import { FormField } from "./FormField";
import { ResourceLookup } from "./ResourceLookup";
import { StatusSwitch } from "./StatusSwitch";
import { AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { NotificationEventAccordion } from "./NotificationEventAccordion";
import { titleCase } from "../lib/title-case";
import { previewText } from "../lib/template-preview";
import { eventControlBody, eventControlError, eventSetupReasons, filterRows, type ListRow } from "../lib/communication-routes";
import "./email-templates.css";
import "./communication.css";

type Row = api.EventControlRow;
const label = (r: string) => RECIPIENTS.find(x => x.value === r)?.label ?? r;
const CHANNELS = ["email", "sms"] as const;

export function NotificationTemplatesPage({ identity }: { identity: api.Identity }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [clinicId, setClinicId] = useState("");
  const [f, setF] = useState({ q: "", channel: "", recipient: "", status: "" });
  const [editing, setEditing] = useState<{ channel: "email" | "sms"; event: string; recipient: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const askRef = useRef(confirm.ask); askRef.current = confirm.ask;
  const [pending, setPending] = useState<{ row: Row; next: boolean } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const enabled = superAdmin || !!clinicId;
  const params = clinicId ? { clinicId } : undefined;
  const qc = useQueryClient();
  const controls = useGetEventControls(params, { query: { enabled, queryKey: getGetEventControlsQueryKey(params), staleTime: 15000 } });
  const update = useUpdateEventControl();
  const sending = useRef(false);
  const combos = CHANNELS.flatMap(channel => RECIPIENTS.map(r => ({ channel, recipient: r.value })));
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
  const list: (ListRow & { row: Row })[] = items.map(r => ({ row: r, channel: r.channel, event: r.event, recipient: r.recipient, enabled: r.enabled, ready: r.ready, source: r.source,
    inherited: /default|inherit/i.test(r.source), preview: previews.get(`${r.channel}|${r.event}|${r.recipient}`) ?? "" }));
  const shown = filterRows(list, f) as typeof list;
  const groups = useMemo(() => { const m = new Map<string, typeof shown>(); for (const r of shown) m.set(r.event, [...(m.get(r.event) ?? []), r]); return [...m.entries()]; }, [shown]);
  const filtered = !!(f.q.trim() || f.channel || f.recipient || f.status);
  const expansionKey = JSON.stringify([identity.user?.id, superAdmin, clinicId, f.q.trim(), f.channel, f.recipient, f.status]);
  const closeEditor = () => { setEditing(null); setDirty(false); void qc.invalidateQueries({ queryKey: [api.getGetEventControlsQueryKey()[0]] }); };
  const [discard, setDiscard] = useState(false);
  useWorkspaceLeaveGuard("/admin/templates", dirty || busy, (o: any) => askRef.current(o), () => { setDirty(false); setBusy(false); setEditing(null); });
  const requestClose = () => busy ? undefined : dirty ? setDiscard(true) : closeEditor();
  const apply = () => {
    if (!pending || !confirmed || sending.current) return;
    sending.current = true; const { row, next } = pending;
    update.mutate({ data: eventControlBody(row, next, clinicId) as api.EventControlInput }, {
      onSuccess: () => { setPending(null); setConfirmed(false); setNotice(`${row.channel.toUpperCase()} ${next ? "enabled" : "disabled"} for ${titleCase(row.event)} to ${label(row.recipient)}. Only future events are affected.`); void qc.invalidateQueries({ queryKey: [api.getGetEventControlsQueryKey()[0]] }); void qc.invalidateQueries({ queryKey: [api.getGetNotificationTemplatesQueryKey()[0]] }); },
      onSettled: () => { sending.current = false; },
      onError: () => { setPending(null); setConfirmed(false); void controls.refetch(); },
    });
  };
  const sel = (k: keyof typeof f, v: string, opts: [string, string][], name: string) => <select aria-label={name} value={v} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} data-testid={`select-filter-${k}`}><option value="">{name}: all</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  return <section className="panel padded event-controls" data-testid="page-notification-templates">
    {confirm.dialog}
    <p className="muted" data-testid="text-gate-note">Each switch below is scoped to one event, channel and recipient. Turning email notifications off here never disables the SMTP connection used for sign-in codes, invitations and password recovery. Provider connections are in Communication Settings.</p>
    <div className="et-scope">
      <FormField label={superAdmin ? "Scope" : "Clinic Group"} optional={superAdmin} required={!superAdmin} helper={superAdmin ? "Empty edits platform defaults." : "Choose a clinic group you manage."}>
        {a => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => { setClinicId(v); setNotice(""); if (!update.isPending) update.reset(); }} placeholder={superAdmin ? "Platform defaults" : undefined} />}
      </FormField>
    </div>
    {enabled && controls.data && <p className="muted" data-testid="text-scope-gate"><span className={`et-chip ${clinicId ? "" : "live"}`} data-testid="chip-scope">{clinicId ? "Clinic" : "Platform"}</span> <strong>{controls.data.scopeName}</strong>{clinicId ? " inherits platform defaults where it has no override. " : " (clinics inherit these unless they override). "}{controls.data.notificationsEnabled === false ? "Clinic notifications are off, so nothing is delivered. " : ""}{controls.data.gateDescription}</p>}
    <button type="button" className="button secondary cm-filter-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(o => !o)} data-testid="button-toggle-filters">{filtersOpen ? "Hide filters" : "Search and filters"}</button>
    <div className={`cm-filters${filtersOpen ? " open" : ""}`} role="search">
      <input type="search" aria-label="Search events" placeholder="Search events or wording" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} data-testid="input-search-events" />
      {sel("channel", f.channel, [["email", "Email"], ["sms", "SMS"]], "Channel")}
      {sel("recipient", f.recipient, RECIPIENTS.map(r => [r.value, r.label]), "Recipient")}
      {sel("status", f.status, [["on", "On and ready"], ["blocked", "On, blocked"], ["off", "Off"]], "Status")}
    </div>
    {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
    {update.isError && <p role="alert" className="error-box" data-testid="status-update-error">{eventControlError(update.error)}</p>}
    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its notification templates.</div>
      : controls.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : controls.isError ? <div role="alert" className="error-box" data-testid="state-error">Events could not be loaded. <button type="button" onClick={() => controls.refetch()} data-testid="button-retry">Retry</button></div>
      : !groups.length ? <div className="et-empty" data-testid="state-empty">No events match these filters.</div>
       : <NotificationEventAccordion key={expansionKey} events={groups.map(([event]) => event)} filtered={filtered}>
         {groups.map(([event, rows]) => <AccordionItem key={event} value={event} className="cm-event" data-testid={`group-event-${event}`}>
         <AccordionTrigger className="cm-event-trigger" data-testid={`button-event-${event}`}>
           <span className="cm-event-head"><span className="cm-event-title">{titleCase(event)}</span>{rows[0].row.timing && <span className="muted cm-event-timing">{rows[0].row.timing}</span>}</span>
         </AccordionTrigger>
         <AccordionContent className="cm-event-content"><ul className="cm-rows">{rows.map(r => <li key={`${r.channel}|${r.recipient}`} className="cm-row" data-testid={`card-template-${r.channel}-${event}-${r.recipient}`}>
          <div className="cm-row-main">
            <div className="cm-row-meta"><span className="cm-channel">{r.channel === "sms" ? "SMS" : "Email"}</span><span>to {label(r.recipient)}</span>
              <span className={`et-chip ${r.enabled && r.ready ? "live" : ""}`}>{r.enabled ? (r.ready ? "On" : "On, blocked") : "Off"}</span>
              {!r.inherited && <span className="et-chip">Override</span>}</div>
            <p className="cm-preview" data-testid={`text-preview-${r.channel}-${event}-${r.recipient}`}>{r.preview ? previewText(r.preview, controls.data?.scopeName ?? "").slice(0, 160) : "Loading preview"}</p>
            {eventSetupReasons(r.row).length > 0 && <ul className="ec-blocked" data-testid={`setup-${r.channel}-${event}-${r.recipient}`}>{eventSetupReasons(r.row).map(b => <li key={b}>{b}</li>)}</ul>}
          </div>
          <div className="cm-row-actions">
            <StatusSwitch active={r.enabled} disabled={update.isPending} label={`${r.channel} ${titleCase(event)} ${label(r.recipient)}`} onChange={next => { update.reset(); setNotice(""); setConfirmed(false); setPending({ row: r.row, next }); }} testId={`switch-${r.channel}-${event}-${r.recipient}`}>{r.enabled ? "On" : "Off"}</StatusSwitch>
            <button type="button" className="button secondary small" disabled={update.isPending} onClick={() => { update.reset(); setEditing({ channel: r.channel, event, recipient: r.recipient }); }} data-testid={`button-edit-${r.channel}-${event}-${r.recipient}`}>Edit</button>
           </div></li>)}</ul></AccordionContent>
       </AccordionItem>)}</NotificationEventAccordion>}
    {editing && <AppDialog open variant="drawer" onClose={requestClose} dirty={false} title="Edit Template" description={`${titleCase(editing.event)} / ${editing.channel === "sms" ? "SMS" : "EMAIL"} (${label(editing.recipient)})`}>
      <EmailTemplates key={`${editing.channel}|${editing.event}|${editing.recipient}|${clinicId}`} identity={identity} channel={editing.channel} fixed={{ clinicId, event: editing.event, recipient: editing.recipient as any }} onDirtyChange={setDirty} onBusyChange={setBusy} />
    </AppDialog>}
    <AppDialog open={discard} onClose={() => setDiscard(false)} title="Discard unsaved changes?">
      <div className="et-dialog"><p>You have edits that are not saved. Closing discards them.</p>
        <FormActions wide={false} onCancel={() => setDiscard(false)} cancelLabel="Keep Editing" onSubmit={() => { setDiscard(false); closeEditor(); }} submitClassName="danger" submitLabel="Discard" submitTestId="button-discard-editor" /></div>
    </AppDialog>
    <AppDialog open={!!pending} onClose={() => !update.isPending && setPending(null)} title={pending ? `${pending.next ? "Enable" : "Disable"} ${pending.row.channel.toUpperCase()}?` : ""} busy={update.isPending}>
      {pending && <div className="et-dialog">
        <p>{pending.next ? "Eligible future events will send to " : "Future events will stop sending to "}{label(pending.row.recipient).toLowerCase()}s for {titleCase(pending.row.event)}. Past bookings are never replayed.</p>
        {pending.next && eventSetupReasons(pending.row).length > 0 && <div data-testid="control-setup-requirements"><p>Delivery requirements still to resolve:</p><ul className="ec-blocked">{eventSetupReasons(pending.row).map(reason => <li key={reason}>{reason}</li>)}</ul>
          {pending.row.channel === "sms" && <p>Use Edit to add this event's registered DLT Template ID and publish the template. Saving a draft does not update the active template.</p>}
        </div>}
        <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="checkbox-confirm-control" /> I confirm this change</label>
        <FormActions wide={false} onCancel={() => setPending(null)} cancelLabel="Go Back" busy={update.isPending} disabled={!confirmed} onSubmit={apply} submitLabel={pending.next ? "Enable" : "Disable"} submitTestId="button-control-confirm" /></div>}
    </AppDialog>
  </section>;
}
export default NotificationTemplatesPage;
