import { useEffect, useState } from "react";
import * as api from "@workspace/api-client-react";
import { Link } from "wouter";
import { CalendarPlus, ChevronLeft, ChevronRight, List, X } from "lucide-react";
import { formatDate, formatTime } from "../../lib/date-time";
import { title } from "../../resources";
import { AppointmentDetails } from "./AppointmentDetails";
import { isPrivateAppointmentUnavailable } from "./presentation";

type DayFilters = { search?: string; status?: string; clinicId?: string; branchId?: string; doctorId?: string };

/** Group a day's visits by session identity (doctor id + location id + session id, falling back to start time), never by display names.
 *  Sessions are ordered chronologically by start time (untimed last), then doctor/location name, then id for stability; visits by token. */
export function groupBySession(items: api.Appointment[]) {
  type Group = { key: string; doctorId: string; branchId: string; sessionId?: string; doctorName: string; branchName: string; startTime?: string; endTime?: string; items: api.Appointment[] };
  const groups = new Map<string, Group>();
  for (const a of items) {
    const key = [a.doctorId, a.branchId, a.sessionId || `t:${a.startTime || ""}-${a.endTime || ""}`].join("|");
    if (!groups.has(key)) groups.set(key, { key, doctorId: a.doctorId, branchId: a.branchId, sessionId: a.sessionId, doctorName: a.doctorName, branchName: a.branchName, startTime: a.startTime, endTime: a.endTime, items: [] });
    groups.get(key)!.items.push(a);
  }
  const time = (t?: string) => t || "99:99";
  return [...groups.values()]
    .map(g => ({ ...g, items: [...g.items].sort((x, y) => (x.tokenNumber ?? Number.MAX_SAFE_INTEGER) - (y.tokenNumber ?? Number.MAX_SAFE_INTEGER) || x.createdAt.localeCompare(y.createdAt)) }))
    .sort((x, y) => time(x.startTime).localeCompare(time(y.startTime)) || x.doctorName.localeCompare(y.doctorName) || x.branchName.localeCompare(y.branchName) || x.key.localeCompare(y.key));
}

export const DAY_PAGE_SIZE = 100;
/** Visible-count label: always states what is shown out of the true total, so no visit is silently missing. */
export function dayRangeLabel(page: number, shown: number, total: number) {
  if (!total) return "0 visits";
  const start = (page - 1) * DAY_PAGE_SIZE + 1;
  return total <= DAY_PAGE_SIZE ? `${total} visit${total === 1 ? "" : "s"}` : `${start}–${start + shown - 1} of ${total} visits`;
}

/** Book link carries the date and current care scope only; availability is checked by the booking flow, never assumed here. */
export function dayBookingHref(root: string, date: string, f: DayFilters) {
  const q = new URLSearchParams({ date });
  if (f.clinicId) q.set("clinic", f.clinicId);
  if (f.branchId) q.set("branch", f.branchId);
  if (f.doctorId) q.set("doctor", f.doctorId);
  return `/${root}/book?${q}`;
}

function CalendarVisit({ appointment: a }: { appointment: api.Appointment }) {
  const [open, setOpen] = useState(false);
  // Observe the same exact-ID result as the detail surface so a denied record
  // cannot continue exposing patient identifiers in its cached list summary.
  const exact = api.useGetAppointment(a.id, { query: {
    queryKey: api.getGetAppointmentQueryKey(a.id), enabled: open, refetchInterval: 30000, retry: false,
  } });
  const denied = isPrivateAppointmentUnavailable(exact.error);
  const current = exact.data || a;
  return <details className="appt-day-visit" data-testid={`calendar-day-visit-${a.id}`} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{denied ? <span>Appointment unavailable</span> : <><strong className="appt-day-token">{current.token}</strong><span className="appt-day-name">{current.patientName}{current.patientCode && <small>{current.patientCode}</small>}</span><span className={`badge ${current.status}`}>{title(current.status === "called" ? "calledNext" : current.status)}</span></>}</summary>
    {open && <div className="appt-day-ticket"><AppointmentDetails appointment={a} /></div>}
  </details>;
}

export function CalendarDayPanel({ date, today, root, filters, canBook, onClose, onOpenList }: { date: string; today: string; root: string; filters: DayFilters; canBook: boolean; onClose: () => void; onOpenList: () => void }) {
  const [page, setPage] = useState(1);
  const scopeKey = JSON.stringify([date, filters.search, filters.status, filters.clinicId, filters.branchId, filters.doctorId]);
  useEffect(() => { setPage(1); }, [scopeKey]);
  const params: api.ListAppointmentsParams = { from: date, to: date, search: filters.search || undefined, clinicId: filters.clinicId || undefined, branchId: filters.branchId || undefined, doctorId: filters.doctorId || undefined, sort: "date", page, pageSize: DAY_PAGE_SIZE, ...(filters.status ? { status: filters.status as api.ListAppointmentsParams["status"] } : {}) };
  const q = api.useListAppointments(params, { query: { queryKey: api.getListAppointmentsQueryKey(params), refetchInterval: 30000, placeholderData: previous => previous } });
  const total = q.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / DAY_PAGE_SIZE));
  const groups = groupBySession(q.data?.items ?? []);
  const past = date < today;
  return <aside className="panel appt-day-panel" aria-labelledby="appt-day-title" data-testid="panel-calendar-day">
    <header className="appt-day-head">
      <div><span className="eyebrow">{date === today ? "Today" : past ? "Past day" : "Upcoming day"}</span><h2 id="appt-day-title" data-testid="text-calendar-day-title">{formatDate(date)}</h2>
        {q.data && <small className="muted" data-testid="text-calendar-day-count">{dayRangeLabel(page, q.data.items.length, total)} · {groups.length} session{groups.length === 1 ? "" : "s"}{pages > 1 ? " on this page" : ""}</small>}</div>
      <button type="button" className="vrp-icon" aria-label="Close day details" onClick={onClose} data-testid="button-calendar-day-close"><X size={16} aria-hidden /></button>
    </header>
    <div className="appt-day-actions">
      {canBook && !past && <Link href={dayBookingHref(root, date, filters)} className="button small" data-testid="link-calendar-day-book"><CalendarPlus size={14} aria-hidden /> Book for this day</Link>}
      <button type="button" className="button secondary small" onClick={onOpenList} data-testid="button-calendar-day-open-list"><List size={14} aria-hidden /> Open in list</button>
    </div>
    {canBook && !past && <p className="muted appt-day-note">Booking checks the doctor's live sessions and remaining capacity for this date.</p>}
    <div className="appt-day-body" aria-busy={q.isFetching}>
      {q.isLoading ? <div className="appt-day-skel" role="status" aria-label="Loading visits"><span /><span /><span /></div>
        : q.error ? <p role="alert" className="error-box">Unable to load this day. <button type="button" onClick={() => void q.refetch()}>Retry</button></p>
        : !groups.length ? <div className="empty appt-day-empty"><p>No visits on this day{Object.values(filters).some(Boolean) ? " for the current filters" : ""}.</p></div>
        : groups.map(g => <section key={g.key} className="appt-day-session" data-testid="calendar-day-session">
            <h3><span>{g.doctorName}</span><small>{g.startTime ? `${formatTime(g.startTime)}${g.endTime ? `–${formatTime(g.endTime)}` : ""}` : "Session"} · {g.branchName} · {g.items.length}</small></h3>
            <ul>{g.items.map(a => <li key={a.id}><CalendarVisit appointment={a} /></li>)}</ul>
          </section>)}
      {pages > 1 && <nav className="appt-day-pager" aria-label="Day visits pages">
        <button type="button" className="button secondary small" disabled={page <= 1 || q.isFetching} onClick={() => setPage(p => Math.max(1, p - 1))} data-testid="button-calendar-day-prev"><ChevronLeft size={14} aria-hidden /> Previous</button>
        <span role="status">Page {page} of {pages}</span>
        <button type="button" className="button secondary small" disabled={page >= pages || q.isFetching} onClick={() => setPage(p => Math.min(pages, p + 1))} data-testid="button-calendar-day-next">Next <ChevronRight size={14} aria-hidden /></button>
      </nav>}
    </div>
  </aside>;
}
