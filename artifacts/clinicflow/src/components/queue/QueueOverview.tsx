import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { ArrowLeft, History } from "lucide-react";
import { ResourceLookup } from "../ResourceLookup";
import { Pagination, SearchInput, ListingRegion, useDebouncedValue } from "../ListingControls";
import { ErrorNotice, title, today } from "../../resources";
import { DateFormatInput } from "../DateFormatInput";
import { formatDate, formatTime, formatTimeRange } from "../../lib/date-time";
import { doctorWorkspaceScope } from "./session-scope";
import "./queue-workspace.css";

const SIZES = [10, 20, 25, 50, 100];
const roleRoot = (role?: string) => role === "superAdmin" || role === "clinicAdmin" ? "admin" : role || "admin";

/** URL-backed overview state: every filter, page and reset is a history entry, never a hidden pin. */
function useUrlState() {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const set = (patch: Record<string, string | undefined>, resetPage = true, replace = false) => {
    const next = new URLSearchParams(search);
    // Optional care filters remain overview state, never operational selection.
    next.set("view", "sessions");
    for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
    if (resetPage && !("page" in patch)) next.delete("page");
    const query = next.toString();
    navigate(`${location}${query ? `?${query}` : ""}`, { replace });
  };
  return { params, set, navigate };
}

const RETURN_KEYS: Record<string, RegExp> = { view: /^sessions$/, date: /^\d{4}-\d{2}-\d{2}$/, clinic: /^[\w-]{1,100}$/, branch: /^[\w-]{1,100}$/, doctor: /^[\w-]{1,100}$/, search: /^.{1,200}$/, page: /^\d{1,6}$/, size: /^\d{1,3}$/ };
/** Only known overview keys with sane values survive the round trip; anything else is dropped. */
export function overviewReturnQuery(raw: string | null) {
  const source = new URLSearchParams(raw || ""), next = new URLSearchParams();
  for (const [key, pattern] of Object.entries(RETURN_KEYS)) { const value = source.get(key); if (value && pattern.test(value)) next.set(key, value); }
  return next.toString();
}

export function QueueBackLink({ date, patient = false }: { date: string; patient?: boolean }) {
  const [location] = useLocation();
  const params = new URLSearchParams(useSearch());
  const saved = params.has("return") ? overviewReturnQuery(params.get("return")) : (date && RETURN_KEYS.date.test(date) ? `date=${date}` : "");
  const restored = new URLSearchParams(saved);
  restored.set("view", "sessions");
  const href = `${location}?${restored}`;
  return <p className="sq-back"><Link className="text-link" href={href} data-testid="link-queue-overview"><ArrowLeft size={15} aria-hidden /> {patient ? "Back to your visits" : "Back to session overview"}</Link></p>;
}

type Retained = { staffId?: string; clinicId?: string; branchId?: string; doctorId?: string; date?: string; sessionId?: string; startTime?: string };
function readRetained(userId?: string): Retained | null {
  try { const value = JSON.parse(sessionStorage.getItem("clinicflow-staff-session") || "null"); return value && value.staffId === userId && value.branchId && value.doctorId ? value : null; } catch { return null; }
}
function sessionHref(base: string, row: { clinicId: string; branchId: string; doctorId: string; date: string; sessionId?: string | null; startTime?: string | null }, returnQuery = "") {
  const q = new URLSearchParams({ clinic: row.clinicId, branch: row.branchId, doctor: row.doctorId, date: row.date });
  if (returnQuery) q.set("return", returnQuery);
  if (row.sessionId) q.set("sessionId", row.sessionId);
  if (row.startTime) q.set("startTime", row.startTime);
  return `${base}?${q.toString()}`;
}

/** Staff landing for Queue: paginated authorized sessions for one date. Read-only; no queue actions. */
export function QueueOverview({ identity }: { identity: api.Identity }) {
  const { params, set } = useUrlState();
  const { isDoctor } = doctorWorkspaceScope(identity);
  const base = `/${roleRoot(identity.user?.role)}/queue`;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date")! : today();
  const clinicId = params.get("clinic") || "", branchId = params.get("branch") || "", doctorId = isDoctor ? "" : params.get("doctor") || "";
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const pageSize = SIZES.includes(Number(params.get("size"))) ? Number(params.get("size")) : 20;
  const [search, setSearch] = useState(params.get("search") || "");
  const debounced = useDebouncedValue(search);
  const appliedSearch = params.get("search") || "";
  // Only text the user typed is committed (replacing the entry, so typing adds no history). URL changes
  // from Back/reset re-seed the box and cancel any pending typed value, so Back never gets clobbered.
  const typed = useRef(false);
  const setRef = useRef(set); setRef.current = set;
  useEffect(() => { typed.current = false; setSearch(appliedSearch); }, [appliedSearch]);
  useEffect(() => { if (typed.current && debounced === search && debounced !== appliedSearch) { typed.current = false; setRef.current({ search: debounced || undefined }, true, true); } }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = { date, clinicId: clinicId || undefined, branchId: branchId || undefined, doctorId: doctorId || undefined, search: appliedSearch || undefined, page, pageSize };
  const sessions = api.useListQueueSessions(query, { query: { queryKey: api.getListQueueSessionsQueryKey(query), refetchInterval: 30000 } });
  const [retained] = useState(() => readRetained(identity.user?.id));
  const filtered = !!(clinicId || branchId || doctorId || appliedSearch || params.get("date"));
  const reset = () => { setSearch(""); set({ clinic: undefined, branch: undefined, doctor: undefined, search: undefined, date: undefined, page: undefined }); };
  const items = sessions.data?.items || [];
  return <div className="sq-overview" data-testid="queue-overview">
    <div className="page-heading compact-heading"><div><h1>Queue</h1><p>Sessions for the selected day. Open a session to manage its queue.</p></div>
      {retained && <Link className="button secondary small" href={sessionHref(base, { clinicId: retained.clinicId || "", branchId: retained.branchId!, doctorId: retained.doctorId!, date: retained.date || date, sessionId: retained.sessionId, startTime: retained.startTime })} data-testid="link-resume-session"><History size={15} aria-hidden /> Resume last session</Link>}
    </div>
    <section className="panel padded sq-overview-filters" aria-label="Session filters">
      <div className="form-grid">
        <label>Date<DateFormatInput required value={date} data-testid="input-overview-date" onChange={value => { if (value) set({ date: value === today() ? undefined : value }); }} /></label>
        <SearchInput value={search} onChange={v => { typed.current = true; setSearch(v); }} placeholder="Search clinic, location or doctor…" label="Search Sessions" />
        <ResourceLookup autoSole={false} resource="clinics" label="Clinic (optional)" value={clinicId} params={{ status: "active" }} onChange={(id: any) => set({ clinic: id || undefined, branch: undefined, doctor: undefined })} />
        <ResourceLookup autoSole={false} resource="branches" label="Location (optional)" value={branchId} params={{ status: "active", ...(clinicId ? { clinicId } : {}) }} onChange={(id: any) => set({ branch: id || undefined, doctor: undefined })} />
        {!isDoctor && <ResourceLookup autoSole={false} resource="doctors" label="Doctor (optional)" value={doctorId} params={{ status: "active", ...(clinicId ? { clinicId } : {}), ...(branchId ? { branchId } : {}) }} onChange={(id: any) => set({ doctor: id || undefined })} />}
      </div>
      {filtered && <button type="button" onClick={reset} data-testid="button-reset-queue-overview">Reset filters</button>}
    </section>
    <ErrorNotice error={sessions.error} />
    {sessions.error && <button type="button" onClick={() => void sessions.refetch()} data-testid="button-retry-queue-overview">Retry Sessions</button>}
    <ListingRegion className="panel table-panel">
      {sessions.isLoading ? <div className="skeleton" role="status">Loading sessions…</div> : !items.length ? <div className="empty" role="status" data-testid="text-queue-overview-empty"><h3>No sessions</h3><p>{filtered ? "No sessions match these filters." : `No sessions scheduled for ${formatDate(date)}.`}</p></div> :
        <div className="table-scroll"><table data-testid="table-queue-sessions"><thead><tr><th>Doctor</th><th>Clinic · Location</th><th>Session</th><th>Waiting</th><th>In Consultation</th><th>Completed</th><th>Cancelled</th><th>Total</th><th aria-label="Open" /></tr></thead><tbody>
          {items.map(row => { const key = `${row.doctorId}-${row.branchId}-${row.date}-${row.sessionId || "snapshot"}-${row.startTime || "day"}`; return <tr key={key} data-testid={`row-queue-session-${key}`}>
            <td><strong>{row.doctorName}</strong></td>
            <td>{row.clinicName}<small>{row.branchName}</small></td>
            <td>{row.startTime ? (row.endTime ? formatTimeRange(row.startTime, row.endTime, row) : formatTime(row.startTime, row)) : "Unscheduled"}<small>{formatDate(row.date, row)} · {row.timezone}</small><small className="muted">{row.snapshotOnly ? "Historical" : row.available ? "Scheduled" : "Closed"}</small></td>
            <td>{row.waiting}</td><td>{row.inConsultation}</td><td>{row.completed}</td><td>{row.cancelled}</td><td>{row.total}</td>
            <td><Link className="button secondary small" href={sessionHref(base, row, overviewReturnQuery(params.toString()))} data-testid={`link-open-session-${key}`}>Open</Link></td>
          </tr>; })}
        </tbody></table></div>}
      <Pagination state={sessions.error ? "error" : sessions.isLoading ? "loading" : "ready"} page={page} pageSize={pageSize} total={sessions.data?.total || 0} onPageChange={p => set({ page: p > 1 ? String(p) : undefined }, false)} onPageSizeChange={s => set({ size: s === 20 ? undefined : String(s) })} />
    </ListingRegion>
  </div>;
}

/** Patient My Queue landing: own visits for today; each opens its private queue view. */
export function PatientQueueList({ identity }: { identity: api.Identity }) {
  const { params, set } = useUrlState();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date")! : today();
  const page = Math.max(1, Math.floor(Number(params.get("page"))) || 1);
  const query = { date, page, pageSize: 10, ...(identity.patientId ? { patientId: identity.patientId } : {}) };
  const list = api.useListAppointments(query, { query: { queryKey: api.getListAppointmentsQueryKey(query), refetchInterval: 30000 } });
  const items = list.data?.items || [];
  return <div className="sq-overview" data-testid="patient-queue-list">
    <div className="page-heading compact-heading"><div><h1>My Queue</h1><p>Your visits for the selected day.</p></div><Link className="text-link" href="/patient/appointments" data-testid="link-all-appointments">All appointments</Link></div>
    <section className="panel padded" aria-label="Visit date"><label>Date<DateFormatInput required value={date} data-testid="input-my-queue-date" onChange={value => { if (value) set({ date: value === today() ? undefined : value }); }} /></label></section>
    <ErrorNotice error={list.error} />
    {list.error && <button type="button" onClick={() => void list.refetch()}>Retry</button>}
    {list.isLoading ? <div className="skeleton" role="status">Loading your visits…</div> : !items.length ? <div className="empty" role="status" data-testid="text-my-queue-empty"><h3>No visits on {formatDate(date)}</h3><p>Book a visit or check your other appointments.</p><Link className="button small" href="/patient/book">Book Now</Link></div> :
      <div className="sq-visit-cards">{items.map(a => <article key={a.id} className="panel padded sq-visit-card" data-testid={`card-my-visit-${a.id}`}>
        <span className={`badge ${a.status}`}>{title(a.status)}</span>
        <h3>Token {a.token}</h3>
        <p>{a.doctorName}<small>{a.clinicName} · {a.branchName}</small><small>{formatDate(a.date, a)}{a.startTime ? ` · ${a.endTime ? formatTimeRange(a.startTime, a.endTime, a) : formatTime(a.startTime, a)}` : ""}</small></p>
        <Link className="button secondary small" href={`/patient/queue?appointment=${encodeURIComponent(a.id)}&date=${encodeURIComponent(date)}&return=${encodeURIComponent(overviewReturnQuery(params.toString()))}`} data-testid={`link-open-my-queue-${a.id}`}>View queue</Link>
      </article>)}</div>}
    {(list.data?.total || 0) > 10 && <Pagination page={page} pageSize={10} total={list.data?.total || 0} onPageChange={p => set({ page: p > 1 ? String(p) : undefined }, false)} />}
  </div>;
}
