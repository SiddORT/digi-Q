import * as api from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthEnd, monthGrid, monthStart, shiftMonth } from "../../lib/visit-range";
import { formatDate } from "../../lib/date-time";
import { title } from "../../resources";

type CalendarParams = Omit<api.GetAppointmentCalendarParams, "from" | "to">;
const STATUS_ORDER = ["booked", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"];

/** Server-scoped month view. Totals come only from GET /appointments/calendar, never from a paginated list. */
export function AppointmentCalendar({ month, today, selected, params, onMonthChange, onDrill }: { month: string; today: string; selected?: string; params: CalendarParams; onMonthChange: (month: string) => void; onDrill: (date: string) => void }) {
  const scoped = { ...params, from: monthStart(month), to: monthEnd(month) };
  const q = api.useGetAppointmentCalendar(scoped, { query: { queryKey: api.getGetAppointmentCalendarQueryKey(scoped), refetchInterval: 30000, placeholderData: p => p } });
  const byDate = new Map((q.data?.days ?? []).map(d => [d.date, d]));
  const totals = (q.data?.days ?? []).reduce<Record<string, number>>((acc, d) => { for (const [k, v] of Object.entries(d.byStatus)) acc[k] = (acc[k] ?? 0) + v; return acc; }, {});
  const [y, m] = month.split("-").map(Number);
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  return <section className="panel appt-cal" aria-label="Appointment calendar" aria-busy={q.isFetching}>
    <div className="appt-cal-head">
      <div className="appt-cal-nav">
        <button type="button" className="vrp-icon" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))} data-testid="button-calendar-prev"><ChevronLeft size={15} aria-hidden /></button>
        <h2 data-testid="text-calendar-month">{monthName}</h2>
        <button type="button" className="vrp-icon" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))} data-testid="button-calendar-next"><ChevronRight size={15} aria-hidden /></button>
        <button type="button" className="button secondary small" onClick={() => onMonthChange(monthStart(today))} data-testid="button-calendar-today">This month</button>
      </div>
      {q.data && <div className="appt-cal-totals" data-testid="calendar-status-totals"><strong>{q.data.total} visits</strong>{STATUS_ORDER.filter(s => totals[s]).map(s => <span key={s} className="appt-cal-total"><i className={`appt-status-dot ${s}`} aria-hidden />{title(s === "called" ? "calledNext" : s)} {totals[s]}</span>)}</div>}
    </div>
    {q.error ? <p role="alert">Unable to load calendar counts. <button type="button" onClick={() => void q.refetch()}>Retry Calendar</button></p>
      : <div className="appt-cal-grid" role="grid" aria-label={`${monthName} daily visit counts`}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <span key={d} className="appt-cal-dow" aria-hidden>{d}</span>)}
        {monthGrid(month).map((d, i) => {
          if (!d) return <span key={`p${i}`} className="appt-cal-pad" />;
          const day = byDate.get(d); const total = day?.total ?? 0;
          return <button type="button" key={d} aria-pressed={selected === d} className={`appt-cal-day${d === today ? " is-today" : ""}${selected === d ? " is-selected" : ""}${total ? "" : " is-empty"}`} disabled={q.isLoading}
            aria-label={`${formatDate(d)}: ${q.isLoading ? "loading" : `${total} visits`}. Show visits for this day.`} onClick={() => onDrill(d)} data-testid={`button-calendar-day-${d}`}>
            <span className="appt-cal-num">{Number(d.slice(8))}</span>
            {q.isLoading ? <span className="appt-cal-skel" /> : total > 0 && <><strong className="appt-cal-count">{total}</strong>
              <span className="appt-cal-dots" aria-hidden>{STATUS_ORDER.filter(s => day!.byStatus[s]).slice(0, 4).map(s => <span key={s}><i className={`appt-status-dot ${s}`} />{day!.byStatus[s]}</span>)}</span></>}
          </button>;
        })}
      </div>}
  </section>;
}
