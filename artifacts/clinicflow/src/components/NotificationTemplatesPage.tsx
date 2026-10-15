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
import { Bell, CalendarClock, CheckCircle2, FileText, KeyRound, Lock, Mail, MessageSquare, Search, ShieldCheck, UserPlus, XCircle, Building2, Smartphone, type LucideIcon } from "lucide-react";
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
type EventMeta = api.NotificationEventSection;
const EVENT_ICONS: Record<string, LucideIcon> = { booking: Mail, rescheduled: CalendarClock, cancelled: XCircle, completed: CheckCircle2, reminder: Bell, patient_login_otp: KeyRound, patient_email_otp: Mail, registration_mobile_otp: Smartphone, clinic_registration_otp: FileText, onboarding: Building2, doctor_setup: UserPlus, staff_setup: UserPlus, password_setup_complete: ShieldCheck };
const label = (r: string) => RECIPIENTS.find(x => x.value === r)?.label ?? r;
const CHANNELS = ["email", "sms"] as const;

function EventTemplates({ identity, clinicId, onDirty, onPending, scopeControl, interactionLock, scopeChanging, changeScope }: { changeScope: (next: string) => Promise<void>; identity: api.Identity; clinicId: string; onDirty: (v: boolean) => void; onPending: (v: boolean) => void; scopeControl: ReactNode; interactionLock: MutableRefObject<boolean>; scopeChanging: boolean }) {
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
  const items: Row[] = controls.data?.items ?? [];
  const list: (ListRow & { row: Row })[] = items.map(r => ({ row: r, channel: r.channel, event: r.event, recipient: r.recipient, enabled: r.enabled, ready: r.ready && (r.required || controls.data?.notificationsEnabled === true), source: r.source,
    inherited: clinicId ? r.source !== "clinic" : r.source === "default", preview: previews.get(`${r.channel}|${r.event}|${r.recipient}`) ?? "" }));
  const shown = filterRows(list, f) as typeof list;
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
  const meta: EventMeta[] = controls.data?.events ?? [];
  const sections = [...meta].sort((a, b) => a.order - b.order);
  const q = f.q.trim().toLowerCase();
  const rowFilter = !!(f.channel || f.recipient || f.status);
  const visible = sections.map(m => {
    const all = items.filter(r => r.event === m.id);
    const labelMatch = !!q && `${m.id.replaceAll("_", " ")} ${m.label}`.toLowerCase().includes(q);
    const rows = (labelMatch ? filterRows(list, { ...f, q: "" }) as typeof list : shown).filter(r => r.event === m.id);
    if (clinicId && !m.clinicApplicable) {
      const hit = !rowFilter && (!q || `${m.label} ${m.explanation} managed at system default`.toLowerCase().includes(q));
      return hit ? { m, rows: [], total: 0 } : null;
    }
    if (filtered && !rows.length) return null;
    return { m, rows, total: all.length };
  }).filter(Boolean) as { m: EventMeta; rows: typeof shown; total: number }[];
  const sel = (k: keyof typeof f, v: string, opts: [string, string][], name: string) => <select aria-label={name} value={v} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} data-testid={`select-filter-${k}`}><option value="">{name}: All</option>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>;
  const gateCan = !!controls.data?.canActivate;
  return <section className="panel padded event-controls" data-testid="page-notification-templates">
    {confirm.dialog}
    {management.dialog}
    <header className="cm-notification-toolbar">
      <div className="ns-heading"><h1>Notifications</h1><p>Configure delivery and wording for appointment, security and onboarding messages.</p></div>
      <div className="ns-controls">
        {scopeControl}
        <div className="ns-gate"><Switch className="cm-switch" id="notification-delivery-gate" checked={controls.data?.notificationsEnabled ?? false} disabled={!enabled || !gateCan || unavailable || !!editing} onCheckedChange={() => void management.change()} data-testid="checkbox-clinic-gate" /><label htmlFor="notification-delivery-gate">Optional Delivery</label>
        <NotificationInfo label="About Optional Delivery">
           {clinicId ? "Applies only to the selected clinic. Clinics inherit system values until explicitly changed." : "System Default is inherited by clinics without an explicit override; clinics with overrides may differ."} Required security messages ignore Optional Delivery and opt-outs. Enabling does not confirm delivery readiness: each event rechecks active recipients, assignments or ownership, opt-outs, valid contact and duplicate destinations. Provider setup is separate. Wording and drafts inherit independently; open Edit for details. Only future eligible events change; past events are never replayed.
          {controls.data && <> Current gate: {controls.data.notificationsEnabled ? "On" : "Off"}. {controls.data.inherited ? clinicId ? "Inherited system value." : "Default system value." : clinicId ? "Saved clinic value." : "Saved system value."}</>}
        </NotificationInfo>
        </div>
      </div>
    </header>
    {enabled && !controls.isError && controls.data && <>
      {!controls.data.notificationsEnabled && <p className="notice cm-gate-warning" data-testid="text-gate-off">{clinicId ? "Optional delivery is off for this clinic, including enabled options." : "Optional delivery is off for System Default. Clinics with explicit overrides may differ."} Required security messages are not blocked by this gate.</p>}
      {!gateCan && <p id="notification-activation-permission" className="muted">Activation is read-only for your account. You can still manage the wording you are allowed to edit.</p>}
    </>}
    {management.pending && <p role="status">Waiting for confirmation or saving. Scope and other delivery actions are locked.</p>}
    {management.error && <p className="error-box" role="alert" data-testid="status-management-error">{management.error}</p>}
    {management.notice && <p className="et-notice" role="status" data-testid="status-management-save">{management.notice}</p>}
    <div className="cm-filters cm-inline-filters" role="search" aria-label="Filter Notification Events">
      <div className="ns-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search Events" placeholder="Search events or wording" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} data-testid="input-search-events" /></div>
      {sel("channel", f.channel, [["email", "Email"], ["sms", "SMS"]], "Channel")}
      {sel("recipient", f.recipient, RECIPIENTS.filter(r => superAdmin || r.value !== "superAdmin").map(r => [r.value, r.label]), "Recipient")}
      {sel("status", f.status, [["on", "On and Ready"], ["blocked", "On, Blocked"], ["off", "Off"]], "Status")}
      {filtered && <button type="button" className="button secondary small" onClick={() => setF({ q: "", channel: "", recipient: "", status: "" })} data-testid="button-clear-filters">Clear Filters</button>}
    </div>
    <p className="muted cm-group-guidance" id="notification-group-guidance">Group switches change all optional options, including filtered-out rows. From Mixed, switch on to enable all; from All Enabled, switch off to disable all. Optional Delivery is unchanged; enabling does not confirm delivery readiness. Required messages are excluded. Future eligible events only; no replay.</p>
    {catalogs.some(c => c.isError) && <p className="error-box" role="alert">Some message previews could not be loaded. Activation settings are separate. <button type="button" onClick={() => catalogs.forEach(c => { if (c.isError) void c.refetch(); })}>Retry Previews</button></p>}
    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its notification templates.</div>
      : controls.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : controls.isError ? <div role="alert" className="error-box" data-testid="state-error">Events could not be loaded. <button type="button" onClick={() => controls.refetch()} data-testid="button-retry">Retry</button></div>
      : !sections.length ? <div className="et-empty" data-testid="state-empty-catalog">No notification events are available for this selection.</div>
      : !visible.length ? <div className="et-empty" data-testid="state-empty">{catalogs.some(c => c.isFetching) ? "Loading message previews…" : "No events match these filters."}</div>
      : <NotificationEventAccordion key={expansionKey} events={visible.map(v => v.m.id)} filtered={filtered}>
        {visible.map(({ m, rows, total }) => {
          const event = m.id;
          const title = m.label;
          const Icon = EVENT_ICONS[event] ?? Bell;
           if (clinicId && !m.clinicApplicable) return <AccordionItem key={event} value={event} className="cm-event cm-event-managed" data-testid={`group-event-${event}`}>
            <div className="cm-event-toolbar">
              <AccordionTrigger className="cm-event-trigger" data-testid={`button-event-${event}`}><span className="cm-event-icon"><Icon size={18} aria-hidden="true" /></span><span className="cm-event-title">{title}</span></AccordionTrigger>
              <span className="et-chip cm-group-status" data-testid={`status-event-${event}`}>Managed at System Default</span>
            </div>
            <AccordionContent className="cm-event-content"><div className="cm-managed-note" data-testid={`note-managed-${event}`}>
              <Lock size={16} aria-hidden="true" /><p>{m.explanation || "These platform security messages are managed at System Default and are not configured per clinic."}</p>
              {superAdmin && clinicId && <button type="button" className="button secondary small" disabled={pending || !!editing} onClick={() => void changeScope("")} data-testid={`button-system-default-${event}`}>Switch to System Default</button>}
            </div></AccordionContent>
          </AccordionItem>;
          const group = notificationGroup(items, event);
          const count = filtered && rows.length !== total ? `${rows.length} of ${total} options` : `${total} ${total === 1 ? "option" : "options"}`;
          return <AccordionItem key={event} value={event} className="cm-event" data-testid={`group-event-${event}`}>
          <div className="cm-event-toolbar">
          <AccordionTrigger className="cm-event-trigger" data-testid={`button-event-${event}`}>
            <span className="cm-event-icon"><Icon size={18} aria-hidden="true" /></span><span className="cm-event-title">{title}</span><span className="cm-count">{count}</span>
          </AccordionTrigger>
           {items.find(row => row.event === event && row.timing)?.timing ? <NotificationInfo label={`About ${title}`}>{items.find(row => row.event === event && row.timing)?.timing}</NotificationInfo> : <span className="cm-info-spacer" aria-hidden="true" />}
           <span className={`et-chip cm-group-status ${group.checked ? "live" : ""}`} data-testid={`status-event-${event}`}>{!total ? "No options" : group.status === "Enabled" ? "All Enabled" : group.status === "Disabled" ? "All Disabled" : group.status === "Custom" ? "Mixed" : "Required"}</span>
           {group.optional.length > 0 ? <Switch className="cm-switch" aria-label={`${title}: all ${group.optional.length} optional options`} aria-describedby={`notification-group-guidance${!gateCan ? " notification-activation-permission" : ""}`} checked={group.checked} disabled={!gateCan || pending || !!editing || controls.isFetching} onCheckedChange={() => void management.changeGroup(event)} data-testid={`switch-group-${event}`} /> : <span className="cm-switch-spacer" aria-hidden="true" />}
          </div>
          <AccordionContent className="cm-event-content">{!group.optional.length && rows.length > 0 && <p className="cm-required-note">These security messages cannot be disabled and ignore Optional Delivery. Wording remains editable.</p>}
          {!rows.length ? <p className="cm-required-note" data-testid={`empty-event-${event}`}>No channel or recipient options are available for this event in this scope.</p> : <>
          <div className="cm-cols" aria-hidden="true"><span>Channel &amp; Recipient</span><span>Status</span><span>Template Preview</span><span>Enabled</span><span>Action</span></div>
          <ul className="cm-rows">{rows.map(r => {
            const reasons = rowDeliveryReasons(r.row, controls.data?.notificationsEnabled === false);
            const rowCan = r.row.canActivate ?? gateCan;
            const canEdit = r.row.canEdit !== false && (superAdmin || r.channel === "email" && !r.row.required && r.recipient !== "superAdmin");
            const ch = r.channel === "sms" ? "SMS" : "Email";
            const ChIcon = r.channel === "sms" ? MessageSquare : Mail;
            const status = r.row.required ? "Required" : !r.enabled ? "Off" : reasons.length ? "On, Blocked" : "On";
            const full = r.preview ? previewText(r.preview, controls.data?.scopeName ?? "") : "";
            return <li key={`${r.channel}|${r.recipient}`} className="cm-row" data-testid={`card-template-${r.channel}-${event}-${r.recipient}`}>
          <div className="cm-cell cm-who"><ChIcon size={18} aria-hidden="true" /><strong>{ch} to {label(r.recipient)}</strong></div>
          <div className="cm-cell cm-status" data-label="Status">
            <span className={`et-chip cm-state ${status === "On" ? "live" : status === "On, Blocked" ? "cm-blocked" : ""}`}>{status}</span>
            <NotificationInfo label={`Activation Details: ${r.channel} to ${label(r.recipient)}`}>
                {activationSource(r.row.source, clinicId)}. {r.row.required ? "Always on; ignores Optional Delivery and opt-outs." : `Saved activation: ${r.enabled ? "on" : "off"}.`}
                {reasons.length ? ` Blocked: ${reasons.join(" · ")}` : !r.row.required && controls.data?.notificationsEnabled === false ? " Optional Delivery is off for this scope." : " Delivery still depends on eligibility at the event."}
            </NotificationInfo>
          </div>
          <div className="cm-cell cm-preview-cell" data-label="Template Preview">
            {r.channel === "sms" && !canEdit && !superAdmin ? <span className="cm-managed-sms" data-testid={`text-preview-${r.channel}-${event}-${r.recipient}`}>SMS wording managed by System Admin</span> : <>
            <OverflowText className="cm-preview" testId={`text-preview-${r.channel}-${event}-${r.recipient}`} value={full || (catalogs.some(c => c.isError) ? "Preview unavailable. Open Edit or retry previews." : "Loading Preview…")} />
             </>}
            {reasons.length > 0 && <ul className="ec-blocked" data-testid={`setup-${r.channel}-${event}-${r.recipient}`}>{reasons.map(b => <li key={b}>{b}</li>)}</ul>}
          </div>
          <div className="cm-cell cm-enabled" data-label="Enabled">
            {!r.row.required ? <Switch className="cm-switch" aria-label={`${title} ${ch} to ${label(r.recipient)}`} aria-describedby={!rowCan ? "notification-activation-permission" : undefined} checked={r.enabled} disabled={!rowCan || unavailable || !!editing} onCheckedChange={() => void management.change(r.row)} data-testid={`switch-${r.channel}-${event}-${r.recipient}`} /> : <span className="cm-dash" aria-label="Always on">Always on</span>}
          </div>
          <div className="cm-cell cm-action">
            {canEdit && <button type="button" className="button secondary small cm-edit" aria-label={`Edit ${title} ${ch} to ${label(r.recipient)}`} disabled={unavailable || !!editing} onClick={() => { if (!management.locked()) setEditing({ channel: r.channel, event, recipient: r.recipient }); }} data-testid={`button-edit-${r.channel}-${event}-${r.recipient}`}>Edit</button>}
          </div></li>; })}</ul></>}</AccordionContent>
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
    <EventTemplates key={`${identity.user?.id}|${identity.user?.role}|${clinicId}`} identity={identity} clinicId={clinicId} onDirty={setDirty} onPending={setPending} interactionLock={interactionLock} scopeChanging={scopeChanging} changeScope={changeScope} scopeControl={
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
