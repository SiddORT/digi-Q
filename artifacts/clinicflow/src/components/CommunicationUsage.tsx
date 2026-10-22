import { Fragment, useMemo, useState } from "react";
import { getGetCommunicationUsageQueryKey, getGetCommunicationUsageDetailQueryKey, useGetCommunicationUsage, useGetCommunicationUsageDetail, type CommunicationUsageCount, type CommunicationUsageRecord, type GetCommunicationUsageParams } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceLookup } from "./ResourceLookup";
import { csvCell } from "./admin-listing-data";
import "./communication-usage.css";

export const BUCKETS = ["accepted", "pending", "failed", "unknown", "skipped"] as const;
export const CHANNELS = ["sms", "email"] as const;
export const PRESETS = ["all", "today", "last7", "last30", "currentMonth", "custom"] as const;
export type Preset = typeof PRESETS[number];
const PRESET_LABEL: Record<Preset, string> = { all: "All time", today: "Today", last7: "Last 7 days", last30: "Last 30 days", currentMonth: "Current month", custom: "Custom" };
const BUCKET_COPY: Record<string, string> = { accepted: "Provider accepted", pending: "Pending / in progress", failed: "Failed", unknown: "Delivery unknown", skipped: "Skipped / not attempted" };
const IST = 330 * 60000;
export interface UsageFilters { preset: Preset; from: string; to: string; channel: string; event: string; status: string; clinicId: string; source: string; groupBy?: "clinic" | "user" | "location" | "event" | "recipientGroup"; attribution?: "recipient" | "actor"; userId?: string; branchId?: string }
export const EMPTY_USAGE: UsageFilters = { preset: "all", from: "", to: "", channel: "", event: "", status: "", clinicId: "", source: "" };

const pad = (n: number) => String(n).padStart(2, "0");
const istParts = (ms: number) => { const d = new Date(ms + IST); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; };
const istIso = (y: number, m: number, d: number, end: boolean) => `${y}-${pad(m)}-${pad(d)}T${end ? "23:59:59.999" : "00:00:00.000"}+05:30`;
/** Inclusive IST bounds; open-ended when absent. */
export function usageRange(f: UsageFilters, now = Date.now()): { from?: string; to?: string } {
  const t = istParts(now);
  if (f.preset === "today") return { from: istIso(t.y, t.m, t.d, false), to: istIso(t.y, t.m, t.d, true) };
  if (f.preset === "last7" || f.preset === "last30") { const s = istParts(now - (f.preset === "last7" ? 6 : 29) * 86400000); return { from: istIso(s.y, s.m, s.d, false), to: istIso(t.y, t.m, t.d, true) }; }
  if (f.preset === "currentMonth") return { from: istIso(t.y, t.m, 1, false), to: istIso(t.y, t.m, t.d, true) };
  if (f.preset === "custom") { const c = (v: string) => (v ? `${v.length === 16 ? `${v}:00` : v}+05:30` : undefined); return { from: c(f.from), to: c(f.to) }; }
  return {};
}
export function buildUsageParams(f: UsageFilters, role: string, cursor?: string, now?: number): GetCommunicationUsageParams {
  const sa = role === "superAdmin"; const r = usageRange(f, now);
  const p: GetCommunicationUsageParams = { pageSize: 25 };
  if (r.from) p.from = r.from; if (r.to) p.to = r.to;
  if (f.channel) p.channel = f.channel as any; if (f.event) p.event = f.event; if (f.status) p.status = f.status as any;
  if (sa && f.clinicId) p.clinicId = f.clinicId;
  if (sa && f.source) p.source = f.source as any;
  if (f.groupBy) p.groupBy = f.groupBy;
  if (f.attribution) p.attribution = f.attribution;
  if (f.userId) p.userId = f.userId;
  if (f.branchId) p.branchId = f.branchId;
  if (cursor) p.cursor = cursor;
  return p;
}
export function sumCounts(counts: CommunicationUsageCount[], channel?: string, bucket?: string) {
  return counts.filter(c => (!channel || c.channel === channel) && (!bucket || c.bucket === bucket)).reduce((n, c) => n + c.count, 0);
}
export function groupByClinic(counts: CommunicationUsageCount[]) {
  const m = new Map<string, { id: string | null; name: string; total: number; byBucket: Record<string, number> }>();
  for (const c of counts) { const k = c.clinicId ?? "unattributed"; const g = m.get(k) ?? { id: c.clinicId, name: c.clinicName || (c.clinicId ? `Clinic ${c.clinicId} (name unavailable)` : "Unattributed / platform"), total: 0, byBucket: {} }; g.total += c.count; g.byBucket[c.bucket] = (g.byBucket[c.bucket] || 0) + c.count; m.set(k, g); }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
const fmt = (ms: number | null | undefined, tz: string) => ms == null ? "Unavailable" : new Intl.DateTimeFormat("en-IN", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
const label = (v: string) => v.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

function Detail({ id, tz, scope, onClose }: { id: string; tz: string; scope: readonly unknown[]; onClose: () => void }) {
  const q = useGetCommunicationUsageDetail(id, { query: { queryKey: [...getGetCommunicationUsageDetailQueryKey(id), ...scope] as any, gcTime: 0, staleTime: 0, refetchInterval: 30000, retry: false } });
  const l = q.data as CommunicationUsageRecord | undefined;
  const rows: [string, string][] = l ? [["Channel", l.channel], ["Event", label(l.event)], ["Outcome", BUCKET_COPY[l.bucket] ?? l.bucket], ["Recorded status", label(l.status)], ["Recipient group", l.recipientGroup], ["Clinic", l.clinicId ?? "Unattributed / platform"], ["Recipient (masked)", l.recipient ?? "Unavailable"], ["Reason", l.reason ?? "None recorded"], ["HTTP status", l.httpStatus == null ? "Unavailable" : String(l.httpStatus)], ["First recorded", fmt(l.createdAt, tz)], ["Queued", fmt(l.queuedAt, tz)], ["Due", fmt(l.dueAt, tz)], ["Dispatch", fmt(l.dispatchAt, tz)], ["Completed", fmt(l.completedAt, tz)]] : [];
  return <AppDialog open onClose={onClose} variant="drawer" title="Communication record" description="Read-only metadata. Message content is never shown here.">
    <div data-testid="drawer-usage-detail">
      {q.isLoading ? <div className="cu-skel" role="status">Loading record…</div> : q.isError || !l ? <div className="error-box" role="alert">This record could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></div> : <>
        {l.legacy && <p className="notice" role="note">Legacy record: captured before full tracking, so some values may be missing.</p>}
        <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl></>}
    </div></AppDialog>;
}

export function CommunicationUsage({ userId, role, clinicScope = "own" }: { userId: string; role: string; clinicScope?: string }) {
  const sa = role === "superAdmin";
  const [draft, setDraft] = useState<UsageFilters>(EMPTY_USAGE);
  const [f, setF] = useState<UsageFilters>(EMPTY_USAGE);
  const [cursors, setCursors] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const cursor = cursors[cursors.length - 1];
  const params = useMemo(() => buildUsageParams(f, role, cursor), [f, role, cursor]);
  const scope = [userId, role, sa ? f.clinicId || "all" : clinicScope] as const;
  const q = useGetCommunicationUsage(params, { query: { queryKey: [...getGetCommunicationUsageQueryKey(params), ...scope] as any, gcTime: 0, staleTime: 0, refetchInterval: 30000, refetchOnMount: "always", retry: false } });
  const d = q.data;
  const tz = d?.timezone || "Asia/Kolkata";
  const apply = (next: UsageFilters) => { setCursors([]); setF(next); setDraft(next); };
  const toggle = (k: "channel" | "status", v: string) => apply({ ...f, [k]: f[k] === v ? "" : v });
  const counts = d?.counts ?? [];
  const clinics = useMemo(() => groupByClinic(counts), [counts]);
  const breakdowns = useMemo(() => {
    const groups = new Map<string, { key: string | null; label: string; sms: number; email: number; buckets: Record<string, number> }>();
    for (const r of d?.breakdowns || []) {
      const key = r.key ?? "unattributed";
      const g = groups.get(key) || { key: r.key, label: r.label, sms: 0, email: 0, buckets: {} };
      if (r.channel === "sms" || r.channel === "email") g[r.channel] += r.count;
      g.buckets[r.bucket] = (g.buckets[r.bucket] || 0) + r.count;
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => b.sms + b.email - a.sms - a.email);
  }, [d?.breakdowns]);
  const exportBreakdown = () => {
    setExportError("");
    try {
      if (!d || q.isFetching || q.isError) throw new Error("Refresh usage before exporting.");
      const csv = [["Group", "SMS Records", "Email Records", ...BUCKETS.map(b => BUCKET_COPY[b])].map(csvCell).join(","),
        ...breakdowns.map(r => [r.label, r.sms, r.email, ...BUCKETS.map(b => r.buckets[b] || 0)].map(csvCell).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `DigiQ-communication-${f.groupBy || "clinic"}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setExportError(e instanceof Error ? e.message : "Unable to export usage."); }
  };
  const customBad = draft.preset === "custom" && draft.from && draft.to && draft.from > draft.to;
  const showCounts = !!d && !q.isError;
  const num = (n: number) => showCounts ? n.toLocaleString("en-IN") : "—";
  const filterCount = [f.preset !== "all", f.channel, f.event, f.status, f.clinicId, f.source].filter(Boolean).length;
  return <section className="cu" aria-labelledby="cu-h" data-testid="communication-usage">
    <div className="nl-toolbar"><h2 id="cu-h" className="sms-ref-title">Communication Usage{d?.scopeClinicName ? ` · ${d.scopeClinicName}` : ""}</h2>
      <button type="button" className="button secondary" disabled={q.isFetching} onClick={() => void q.refetch()} data-testid="button-refresh-usage">{q.isFetching && !q.isLoading ? "Refreshing…" : "Refresh"}</button></div>
    <div className="cu-coverage notice" role="note" data-testid="note-usage-coverage">
      <p><strong>What these counts are.</strong> Each count is one observed notification per channel and recipient occurrence, dated when first recorded (not its latest status transition). Provider accepted means the provider took the request, not confirmed delivery. This is not billing, SMS segments or a provider balance.</p>
      <p>History is best effort. Purged or never-captured records cannot be recovered, security messages may be incomplete, and legacy records are partial. Times are in {tz}.</p>
      {showCounts && <p data-testid="text-usage-earliest">{d.earliestAvailableAt == null ? "No recorded occurrence timestamp is available in this scope; missing timestamps do not prove there are no records." : `Earliest available record in this scope: ${fmt(d.earliestAvailableAt, tz)}.`} {d.legacyCount > 0 && `${d.legacyCount.toLocaleString("en-IN")} legacy record(s) have partial details. `}{d.unattributedCount > 0 && `${d.unattributedCount.toLocaleString("en-IN")} record(s) are unattributed / platform activity and are not assigned to clinics by guessing.`}</p>}
    </div>
    <div className="cu-presets" role="group" aria-label="Date range">{PRESETS.map(p => <button key={p} type="button" aria-pressed={f.preset === p} className={f.preset === p ? "cu-pill on" : "cu-pill"} data-testid={`button-usage-preset-${p}`} onClick={() => p === "custom" ? (setDraft({ ...draft, preset: "custom" }), setF({ ...f, preset: "custom" }), setCursors([])) : apply({ ...f, preset: p, from: "", to: "" })}>{PRESET_LABEL[p]}</button>)}</div>
    <details className="nl-filter-panel" open={f.preset === "custom" || undefined}><summary>Filters{filterCount ? ` (${filterCount} applied)` : ""}</summary>
      <form className="nl-filters" onSubmit={e => { e.preventDefault(); if (!customBad) apply({ ...draft, preset: draft.from || draft.to ? "custom" : draft.preset }); }}>
        <div className="form-field"><label htmlFor="cu-from">From (IST, optional)</label><input id="cu-from" type="datetime-local" value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value, preset: "custom" })} data-testid="input-usage-from" /></div>
        <div className="form-field"><label htmlFor="cu-to">To (IST, optional)</label><input id="cu-to" type="datetime-local" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value, preset: "custom" })} data-testid="input-usage-to" /></div>
        <div className="form-field"><label htmlFor="cu-channel">Channel</label><select id="cu-channel" value={draft.channel} onChange={e=>setDraft({...draft,channel:e.target.value})}><option value="">All channels</option>{CHANNELS.map(c=><option key={c} value={c}>{c==="sms"?"SMS":"Email"}</option>)}</select></div>
        <div className="form-field"><label htmlFor="cu-status">Outcome</label><select id="cu-status" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}><option value="">All outcomes</option>{BUCKETS.map(b=><option key={b} value={b}>{BUCKET_COPY[b]}</option>)}</select></div>
        <div className="form-field"><label htmlFor="cu-event">Event</label><select id="cu-event" value={draft.event} onChange={e => setDraft({ ...draft, event: e.target.value })} data-testid="input-usage-event"><option value="">All events</option>{["booking","onboarding","rescheduled","cancelled","completed","reminder",...(sa?["provider_test"]:[])].map(event=><option key={event} value={event}>{label(event)}</option>)}</select></div>
        {sa && <div className="form-field"><label htmlFor="cu-source">Source</label><select id="cu-source" value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} data-testid="select-usage-source"><option value="">Automatic only (default)</option><option value="automatic">Automatic</option><option value="test">Test sends</option></select></div>}
        {sa && <div className="form-field cu-clinic"><ResourceLookup resource="clinics" label="Clinic" clearable value={draft.clinicId === "unattributed" ? "" : draft.clinicId} onChange={v => setDraft({ ...draft, clinicId: v })} />
          <label className="check-label"><input type="checkbox" checked={draft.clinicId === "unattributed"} onChange={e => setDraft({ ...draft, clinicId: e.target.checked ? "unattributed" : "" })} data-testid="check-usage-unattributed" /> Unattributed / platform only</label></div>}
        <label>Group By<select value={draft.groupBy || "clinic"} onChange={e => setDraft({ ...draft, groupBy: e.target.value as UsageFilters["groupBy"] })} data-testid="select-usage-group"><option value="clinic">Clinic</option><option value="user">Staff User</option><option value="location">Location</option><option value="event">Message Purpose</option><option value="recipientGroup">Recipient Role</option></select></label>
        <label>User Attribution<select value={draft.attribution || "recipient"} onChange={e => setDraft({ ...draft, attribution: e.target.value as UsageFilters["attribution"] })}><option value="recipient">Staff Recipient</option><option value="actor">Staff Actor Who Triggered the Event</option></select></label>
        <SearchableSelect label="Staff User" clearable labelScope={`communication-report-users:${userId}:${role}:${clinicScope}`} value={draft.userId || ""} onChange={v => setDraft({ ...draft, userId: v })} options={(q.data?.userOptions || []).map(u => ({ value: u.id, label: u.name }))} loading={q.isFetching} error={q.error ? "Staff reporting identities could not be loaded." : undefined} onRetry={() => void q.refetch()} />
        {customBad && <p className="error-box" role="alert">From must not be after To.</p>}
        <div className="et-actions"><button type="submit" className="button" disabled={!!customBad} data-testid="button-apply-usage">Apply filters</button>
          <button type="button" className="button secondary" onClick={() => apply(EMPTY_USAGE)} data-testid="button-reset-usage">Reset</button></div>
      </form></details>
    {q.isLoading ? <div className="cu-skel" role="status" data-testid="loading-usage">Loading communication usage…</div>
      : q.isError || !d ? <div className="error-box" role="alert" data-testid="error-usage">Usage could not be loaded, so no totals are shown. This is not a count of zero. <button type="button" onClick={() => void q.refetch()} data-testid="button-retry-usage">Retry</button></div>
      : <>
        <div className="cu-total" data-testid="text-usage-total" aria-busy={q.isFetching}><span>{num(d.total)}</span> observed notifications match these filters{f.source === "test" && " (test sends)"}</div>
        <div className="cu-cards" data-testid="cards-usage-channels">{CHANNELS.map(c => <article key={c} className="cu-channel-card"><button type="button" aria-pressed={f.channel === c && f.status === "accepted"} className={f.channel === c ? "cu-card on" : "cu-card"} onClick={() => apply({...f,channel:c,status:"accepted"})} data-testid={`card-usage-channel-${c}`}><small>{c === "sms" ? "SMS" : "Email"} · Provider accepted</small><strong>{num(sumCounts(counts, c, "accepted"))}</strong></button><div className="cu-channel-breakdown">{BUCKETS.filter(b=>b!=="accepted").map(b=><button type="button" key={b} onClick={()=>apply({...f,channel:c,status:b})}>{BUCKET_COPY[b]}: {num(sumCounts(counts,c,b))}</button>)}</div></article>)}</div>
        <div className="cu-cards five" data-testid="cards-usage-status">{BUCKETS.map(b => <button key={b} type="button" aria-pressed={f.status === b} className={`cu-card b-${b}${f.status === b ? " on" : ""}`} onClick={() => toggle("status", b)} data-testid={`card-usage-status-${b}`}><small>{BUCKET_COPY[b]}</small><strong>{num(sumCounts(counts, undefined, b))}</strong></button>)}</div>
        {sa && clinics.length > 0 && <div className="nl-wrap"><table className="nl-table cu-clinics" data-testid="table-usage-clinics"><caption>Clinic breakdown (clinics with matching records)</caption><thead><tr><th>Clinic</th><th>Total</th>{BUCKETS.map(b => <th key={b}>{BUCKET_COPY[b]}</th>)}</tr></thead>
          <tbody>{clinics.map(g => { const key = g.id ?? "unattributed"; return <tr key={key} className={f.clinicId === key ? "sel" : ""}><td><button type="button" className="table-sort" aria-pressed={f.clinicId === key} onClick={() => apply({ ...f, clinicId: f.clinicId === key ? "" : key })} data-testid={`row-usage-clinic-${key}`}>{g.name}</button></td><td>{g.total.toLocaleString("en-IN")}</td>{BUCKETS.map(b => <td key={b}>{(g.byBucket[b] || 0).toLocaleString("en-IN")}</td>)}</tr>; })}</tbody></table></div>}
        <section aria-label="Communication Breakdown">
          <div className="section-head"><h3>Usage by {f.groupBy === "user" ? `Staff ${f.attribution === "actor" ? "Actor" : "Recipient"}` : f.groupBy === "location" ? "Location" : f.groupBy === "event" ? "Message Purpose" : f.groupBy === "recipientGroup" ? "Recipient Role" : "Clinic"}</h3>
            <button type="button" className="button secondary small" onClick={exportBreakdown} disabled={q.isFetching || q.isError || !breakdowns.length}>Export Breakdown CSV</button></div>
          <p className="muted">All matching recorded messages, not just this page. User and location attribution is captured for new messages only; older or unrecorded identities remain Unattributed / Unavailable. Automatic messages may have no staff actor. These are observed message records, not billed SMS segments or confirmed delivery.</p>
          {exportError && <p role="alert" className="error-box">{exportError}</p>}
          <div className="table-scroll"><table className="nl-table" data-testid="table-usage-breakdown"><thead><tr><th>Group</th><th>SMS</th><th>Email</th>{BUCKETS.map(b => <th key={b}>{BUCKET_COPY[b]}</th>)}</tr></thead><tbody>{breakdowns.map(r => <tr key={r.key || "unattributed"}><td>{r.label}</td><td>{r.sms}</td><td>{r.email}</td>{BUCKETS.map(b => <td key={b}>{r.buckets[b] || 0}</td>)}</tr>)}</tbody></table></div>
        </section>
        {!d.items.length ? <p className="notice" data-testid="empty-usage">No records match these filters{cursors.length ? " on this page" : ""}. This is not proof that nothing was sent; history is best effort and may have been purged.</p>
          : <div className="nl-wrap"><table className="nl-table" data-testid="table-usage"><thead><tr><th>Time</th><th>Channel</th><th>Event</th><th>Outcome</th><th>Recipient</th><th /></tr></thead>
            <tbody>{d.items.map(r => <tr key={r.id} data-testid={`row-usage-${r.id}`}><td>{fmt(r.createdAt, tz)}</td><td>{r.channel}</td><td>{label(r.event)}</td><td><span className="et-chip">{BUCKET_COPY[r.bucket] ?? r.bucket}</span>{r.legacy ? " legacy" : ""}</td><td>{r.recipient ?? "Unavailable"}</td><td><button type="button" onClick={() => setOpen(r.id)} data-testid={`button-open-usage-${r.id}`}>Details</button></td></tr>)}</tbody></table></div>}
      </>}
    <div className="et-actions" aria-label="Usage pages">
      <button type="button" disabled={!cursors.length || q.isFetching} onClick={() => setCursors(c => c.slice(0, -1))} data-testid="button-usage-prev">Previous</button>
      <span>Page {cursors.length + 1}{q.isFetching && !q.isLoading ? " · updating…" : ""}</span>
      <button type="button" disabled={!d?.nextCursor || q.isFetching || q.isError} onClick={() => { const n = d?.nextCursor; if (n) setCursors(c => [...c, n]); }} data-testid="button-usage-next">Next</button>
    </div>
    {open && <Detail id={open} tz={tz} scope={scope} onClose={() => setOpen(null)} />}
  </section>;
}
export default CommunicationUsage;
