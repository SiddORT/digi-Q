import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { useGetEventControls, getGetEventControlsQueryKey, useUpdateEventControl } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AppDialog } from "./AppDialog";
import { FormActions } from "./FormActions";
import { FormField } from "./FormField";
import { StatusSwitch } from "./StatusSwitch";
import { HelpTip } from "./HelpTip";
import { ResourceLookup } from "./ResourceLookup";
import { titleCase } from "../lib/title-case";

type Row = api.EventControlRow;
const status = (e: any) => e?.status ?? e?.response?.status;
const RECIPIENT_LABEL: Record<string, string> = { patient: "Patient", clinicAdmin: "Clinic Admin", doctor: "Doctor", receptionist: "Receptionist" };
export const rowKey = (r: Pick<Row, "channel" | "event" | "recipient">) => `${r.channel}|${r.event}|${r.recipient}`;
/** Groups catalog rows by event, preserving server order. */
export function groupByEvent(items: Row[]) {
  const map = new Map<string, Row[]>();
  for (const r of items) map.set(r.event, [...(map.get(r.event) ?? []), r]);
  return [...map.entries()];
}

export function EventControls({ identity }: { identity: api.Identity }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [clinicId, setClinicId] = useState("");
  const enabled = superAdmin || !!clinicId;
  const params = clinicId ? { clinicId } : undefined;
  const queryKey = getGetEventControlsQueryKey(params);
  const q = useGetEventControls(params, { query: { enabled, queryKey, staleTime: 15000 } });
  const qc = useQueryClient();
  const update = useUpdateEventControl();
  const [pending, setPending] = useState<{ row: Row; next: boolean } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const area = (c: string) => superAdmin ? `/admin/communication?tab=${c}` : "/admin/templates";
  const sending = useRef(false);
  const apply = () => {
    if (!pending || !confirmed || sending.current) return;
    sending.current = true;
    const { row, next } = pending;
    update.mutate({ data: { channel: row.channel, event: row.event as api.EventControlInputEvent, recipient: row.recipient, clinicId: clinicId || undefined, revision: row.revision, enabled: next, confirmed: true } }, {
      onSuccess: () => { setPending(null); setConfirmed(false); setConflict(false); setNotice(`${row.channel.toUpperCase()} ${next ? "enabled" : "disabled"} for ${titleCase(row.event)} to ${RECIPIENT_LABEL[row.recipient]}.`); void qc.invalidateQueries({ queryKey: [api.getGetEventControlsQueryKey()[0]] }); void qc.invalidateQueries({ queryKey: [api.getGetNotificationTemplatesQueryKey()[0]] }); },
      onSettled: () => { sending.current = false; },
      onError: e => { setPending(null); setConfirmed(false); if (status(e) === 409) { setConflict(true); void qc.invalidateQueries({ queryKey }); } },
    });
  };
  const data = q.data;
  return <section className="panel padded event-controls" aria-labelledby="event-controls-title" data-testid="event-controls">
    <div className="section-head"><h2 id="event-controls-title">Event Controls <HelpTip text="These switches change the same published activation policy as the switch on each template. They affect only future events and never resend past bookings." /></h2></div>
    <div className="et-scope">
      <FormField label={superAdmin ? "Scope" : "Clinic Group"} optional={superAdmin} required={!superAdmin} helper={superAdmin ? "Leave empty to edit platform defaults." : "Choose a clinic group you manage."}>
        {(a) => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => { setClinicId(v); setNotice(""); setConflict(false); }} placeholder={superAdmin ? "Platform defaults" : undefined} />}
      </FormField>
    </div>
    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its event controls.</div>
      : q.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : q.isError ? <div role="alert" className="error-box" data-testid="state-error">Event controls could not be loaded. <button type="button" onClick={() => q.refetch()} data-testid="button-retry">Retry</button></div>
      : !data || !data.items.length ? <div className="et-empty" data-testid="state-empty">No events are available for this scope.</div>
      : <>
        <p className="muted" data-testid="text-scope-gate"><strong>{data.scopeName}</strong>{clinicId ? " inherits platform defaults where it has no override. " : " (platform defaults; clinics inherit these unless they override). "}
          {data.notificationsEnabled === false ? "Clinic notifications are off, so nothing is delivered. " : ""}{data.gateDescription}</p>
        {conflict && <p role="alert" className="error-box" data-testid="state-conflict">Another administrator changed these controls. The latest values are shown; try again.</p>}
        {update.isError && !conflict && <p role="alert" className="error-box" data-testid="status-update-error">The control was not changed. Try again.</p>}
        {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
        {groupByEvent(data.items).map(([event, rows]) => <div key={event} className="ec-event" data-testid={`group-event-${event}`}>
          <h3>{titleCase(event)}</h3>
          <table className="ec-table"><thead><tr><th>Recipient</th><th>Channel</th><th>Timing</th><th>Status</th><th>Switch</th></tr></thead><tbody>
            {rows.map(r => <tr key={rowKey(r)} data-testid={`row-control-${r.channel}-${event}-${r.recipient}`}>
              <td>{RECIPIENT_LABEL[r.recipient]}</td><td>{r.channel === "sms" ? "SMS" : "Email"}</td><td>{r.timing}</td>
              <td><span className={`et-chip ${r.enabled && r.ready ? "live" : ""}`}>{r.enabled ? (r.ready ? "On and ready" : "On, blocked") : "Off"}</span> <span className="muted">{titleCase(r.source.replace(/[_-]/g, " "))}</span>
                {r.enabled && !r.ready && r.blockedReasons.length > 0 && <ul className="ec-blocked" data-testid={`list-blocked-${r.channel}-${event}-${r.recipient}`}>{r.blockedReasons.map(b => <li key={b}>{b}</li>)}
                  <li><Link href={area(r.channel)} className="text-link" data-testid={`link-fix-${r.channel}-${event}-${r.recipient}`}>Open {r.channel === "sms" ? "SMS" : "Email"} settings</Link></li></ul>}
                {!r.enabled && r.blockedReasons.length > 0 && <small className="muted"> Needs: {r.blockedReasons.join("; ")} <Link href={area(r.channel)} className="text-link">Open {r.channel === "sms" ? "SMS" : "Email"} settings</Link></small>}</td>
              <td><StatusSwitch active={r.enabled} disabled={update.isPending} label={`${r.channel} ${titleCase(event)} ${RECIPIENT_LABEL[r.recipient]}`} onChange={next => { setNotice(""); setConfirmed(false); setPending({ row: r, next }); }} testId={`switch-${r.channel}-${event}-${r.recipient}`}>{r.enabled ? "On" : "Off"}</StatusSwitch></td>
            </tr>)}
          </tbody></table>
        </div>)}
      </>}
    <AppDialog open={!!pending} onClose={() => !update.isPending && setPending(null)} title={pending ? `${pending.next ? "Enable" : "Disable"} ${pending.row.channel.toUpperCase()}?` : ""} busy={update.isPending}>
      {pending && <div className="et-dialog">
        <p>{pending.next ? "Eligible future events will send to " : "Future events will stop sending to "}{RECIPIENT_LABEL[pending.row.recipient].toLowerCase()}s for {titleCase(pending.row.event)}. Past bookings are never replayed. This is the same published setting shown on the template.</p>
        <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} data-testid="checkbox-confirm-control" /> I confirm this change</label>
        <FormActions wide={false} onCancel={() => setPending(null)} cancelLabel="Go Back" cancelTestId="button-control-cancel" busy={update.isPending} disabled={!confirmed} onSubmit={apply} submitLabel={pending.next ? "Enable" : "Disable"} submitTestId="button-control-confirm" /></div>}
    </AppDialog>
  </section>;
}
export default EventControls;
