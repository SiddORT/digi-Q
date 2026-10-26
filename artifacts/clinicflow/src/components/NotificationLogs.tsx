import { Fragment, useState } from "react";
import { getListNotificationLogsQueryKey, getGetNotificationLogQueryKey, useGetNotificationLog, useListNotificationLogs, type ListNotificationLogsParams, type NotificationLog } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { FilterBar } from "./ListingControls";
import { ResourceLookup } from "./ResourceLookup";
import { DateTimeFilterInput } from "./DateTimeFilterInput";
import { dateTimeRangeError } from "../lib/notification-log-format";
import { EVENT_OPTIONS, STATUS_OPTIONS, GROUP_OPTIONS, LOG_TIMEZONE, STATUS_COPY, LEGACY_NOTE, EMPTY_FILTERS, show, formatLogTime, buildLogParams, statusLabel, smsProviderErrorHelp, type LogFilters } from "../lib/notification-log-format";

const fields: [keyof LogFilters, string][] = [["channel", "Channel"], ["source", "Source"], ["event", "Event"], ["status", "Status"], ["recipientGroup", "Recipient group"], ["clinicId", "Clinic ID"], ["sender", "Sender"], ["recipient", "Recipient"], ["reference", "Reference"]];

function Drawer({ id, tz, onClose }: { id: string; tz: string; onClose: () => void }) {
  const q = useGetNotificationLog(id, { query: { queryKey: getGetNotificationLogQueryKey(id), gcTime: 0, staleTime: 0, retry: false } });
  const l = q.data as NotificationLog | undefined;
  const rows: [string, unknown][] = l ? [["Channel", l.channel], ["Event", l.event], ["Source", l.source], ["Recipient group", l.recipientGroup], ["Clinic", l.clinicId], ["Reference", l.reference], ["Occurrence", l.occurrence], ["Provider", l.provider], ["Sender", l.sender], ["Recipient", l.recipient], ["Subject", l.subject], ["Message", l.message], ["Template", l.templateId], ["Template revision", l.templateRevision], ["Template scope", l.templateScope], ["DLT template ID", l.dltTemplateId], ["HTTP status", l.httpStatus], ["Provider message ID", l.providerId], ["Reason", l.reason]] : [];
  const times: [string, number | null | undefined][] = l ? [["Created", l.createdAt], ["Queued", l.queuedAt], ["Due", l.dueAt], ["Dispatch", l.dispatchAt], ["Completed", l.completedAt]] : [];
  return <AppDialog open onClose={onClose} variant="drawer" title="Delivery details" description="Read-only delivery record.">
    <div data-testid="drawer-notification-log">
    {q.isLoading ? <p role="status">Loading details…</p> : q.isError || !l ? <div className="error-box" role="alert">Details could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></div> : <>
      <p><span className="et-chip">{statusLabel(l.status)}</span> {STATUS_COPY[l.status] ?? "Status is not recognized by this view."}</p>
      {smsProviderErrorHelp(l) && <p className="error-box" role="alert" data-testid="error-log-sms-auth">{smsProviderErrorHelp(l)}</p>}
      {l.legacy && <p className="notice" role="note" data-testid="note-log-legacy">{LEGACY_NOTE}</p>}
      {l.detailsUnavailable && <p className="notice" role="note">Sensitive details could not be retained securely for this attempt. Missing values are unavailable and are not reconstructed.</p>}
      <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{show(v)}</dd></Fragment>)}
        {times.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{formatLogTime(v, tz)}</dd></Fragment>)}</dl>
      <h4>Timeline</h4>
      {l.timeline.length ? <ol data-testid="list-log-timeline">{l.timeline.map((t, i) => <li key={i}><strong>{statusLabel(t.status)}</strong> {formatLogTime(t.at, tz)}{t.reason ? ` - ${t.reason}` : ""}</li>)}</ol> : <p>No transitions recorded{l.legacy ? " for this legacy record" : ""}.</p>}
    </>}
    </div></AppDialog>;
}

/** Read-only, server-filtered delivery log. Nothing is persisted in the browser. */
export function NotificationLogs() {
  const [draft, setDraft] = useState<LogFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<LogFilters>(EMPTY_FILTERS);
  const [cursors, setCursors] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const cursor = cursors[cursors.length - 1];
  const params = buildLogParams(applied, cursor);
  const q = useListNotificationLogs(params, { query: { queryKey: getListNotificationLogsQueryKey(params), gcTime: 0, staleTime: 0, refetchOnMount: "always", retry: false } });
  const tz = q.data?.timezone || LOG_TIMEZONE;
  const set = (k: keyof LogFilters) => (v: string) => setDraft(d => ({ ...d, [k]: v }));
  const apply = () => { if (dateTimeRangeError(draft.from, draft.to)) return false; setCursors([]); setApplied(draft); return true; };
  const reset = () => { setDraft(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); setCursors([]); };
  const filterCount = Object.values(applied).filter(Boolean).length;
  return <section aria-labelledby="nl-heading" data-testid="notification-logs">
    <div className="nl-toolbar">
      <h2 id="nl-heading" className="sms-ref-title">Notification Logs</h2>
      <button type="button" className="button secondary" disabled={q.isFetching} onClick={() => void q.refetch()} data-testid="button-refresh-logs">Refresh</button>
    </div>
    <p className="muted">Read-only. Times are shown in {tz}. "Provider accepted" means the provider took the request, not that the recipient received it. Legacy records are incomplete and unknown values show as unavailable. A message stuck in sending is reported as delivery unknown by the server.</p>
    <p className="muted" data-testid="note-log-exact">All retained history, with optional open-ended dates. Previously deleted or never captured records cannot be recovered. Clinic ID, sender and recipient filters are exact matches, not partial searches.</p>
    <FilterBar active={filterCount > 0} activeCount={filterCount} onOpen={() => setDraft(applied)} onCancel={() => setDraft(applied)} onApply={apply} onReset={reset} onResetDraft={() => setDraft(EMPTY_FILTERS)} advanced={<div className="nl-filters">
      <DateTimeFilterInput label="From (IST)" value={draft.from} onChange={set("from")} testId="input-log-from" />
      <DateTimeFilterInput label="To (IST)" value={draft.to} onChange={set("to")} testId="input-log-to" />
      <ResourceLookup resource="clinics" label="Clinic Name" value={draft.clinicId} onChange={set("clinicId")} clearable />
      {fields.map(([k, label]) => <div className="form-field" key={k}><label htmlFor={`nl-${k}`}>{label}</label>
        {k === "channel" ? <select id="nl-channel" value={draft.channel} onChange={e => set("channel")(e.target.value)} data-testid="select-log-channel"><option value="">All</option><option value="sms">SMS</option><option value="email">Email</option></select>
          : k === "source" ? <select id="nl-source" value={draft.source} onChange={e => set("source")(e.target.value)} data-testid="select-log-source"><option value="">All</option><option value="automatic">Automatic</option><option value="test">Test</option></select>
          : k === "event" || k === "status" || k === "recipientGroup" ? <select id={`nl-${k}`} value={draft[k]} onChange={e => set(k)(e.target.value)} data-testid={`select-log-${k}`}><option value="">All</option>{(k === "event" ? EVENT_OPTIONS : k === "status" ? STATUS_OPTIONS : GROUP_OPTIONS).map(o => <option key={o} value={o}>{statusLabel(o)}</option>)}</select>
          : <input id={`nl-${k}`} maxLength={k === "reference" ? 100 : 254} value={draft[k]} onChange={e => set(k)(e.target.value)} data-testid={`input-log-${k}`} />}</div>)}
      {dateTimeRangeError(draft.from, draft.to) && <p role="alert" className="field-error">{dateTimeRangeError(draft.from, draft.to)}</p>}
      <p className="muted">Clinic Name searches authorized clinics. Use Clinic ID for an exact historical or deleted clinic; an unavailable name does not clear the ID.</p>
    </div>} />
    {q.isLoading ? <div role="status" data-testid="loading-logs">Loading delivery logs…</div>
      : q.isError || !q.data ? <div className="error-box" role="alert" data-testid="error-logs">Delivery logs could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></div>
      : !q.data.items.length ? <p data-testid="empty-logs">No log entries match these filters{cursors.length ? " on this page" : ""}. An empty list is not proof that nothing was sent.</p>
      : <div className="nl-wrap"><table className="nl-table"><thead><tr><th>Time</th><th>Channel</th><th>Event</th><th>Status</th><th>Recipient</th><th>Reference</th><th /></tr></thead>
        <tbody>{q.data.items.map(l => <tr key={l.id} data-testid={`row-log-${l.id}`}>
          <td>{formatLogTime(l.createdAt, tz)}</td><td>{l.channel}</td><td>{l.event}{l.source === "test" ? " (test)" : ""}</td>
          <td><span className="et-chip">{statusLabel(l.status)}</span>{l.legacy ? " legacy" : ""}</td><td>{show(l.recipient)}</td><td>{show(l.reference)}</td>
          <td><button type="button" onClick={() => setOpen(l.id)} data-testid={`button-open-log-${l.id}`}>Details</button></td></tr>)}</tbody></table></div>}
    <div className="et-actions" aria-label="Log pages">
      <button type="button" disabled={!cursors.length || q.isFetching} onClick={() => setCursors(c => c.slice(0, -1))} data-testid="button-logs-prev">Previous</button>
      <span>Page {cursors.length + 1}</span>
      <button type="button" disabled={!q.data?.nextCursor || q.isFetching} onClick={() => { const n = q.data?.nextCursor; if (n) setCursors(c => [...c, n]); }} data-testid="button-logs-next">Next</button>
    </div>
    {open && <Drawer id={open} tz={tz} onClose={() => setOpen(null)} />}
  </section>;
}
export default NotificationLogs;
