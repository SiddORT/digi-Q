import { ArrowDownRight, ArrowUpRight, Minus, CalendarDays, CircleCheck, CircleX, Users } from "lucide-react";
import type * as api from "@workspace/api-client-react";
import { compareValue } from "./report-model";
import "./reports.css";

const CARDS = [
  { key: "appointments", label: "Total Appointments", bad: false, icon: CalendarDays },
  { key: "completed", label: "Completed", bad: false, icon: CircleCheck },
  { key: "cancelled", label: "Cancelled", bad: true, icon: CircleX },
  { key: "noShow", label: "No-shows", bad: true, icon: Users },
] as const;

/** Full-filter-set totals from the summary, with previous-period comparison only when the server returned one. */
export function ReportKpis({ summary, previous, compare, loading, stale }: { summary?: api.ReportAnalyticsMetrics; previous?: api.ReportAnalyticsMetrics | null; compare: boolean; loading: boolean; stale: boolean }) {
  return <section className="rp-kpis" aria-label="Report summary" aria-busy={loading || stale} data-testid="report-kpis">
    {CARDS.map(card => {
      if (loading) return <div key={card.key} className="rp-skel" data-testid={`kpi-${card.key}-loading`} />;
      if (!summary) return <div key={card.key} className="panel rp-kpi"><small>{card.label}</small><strong>—</strong><span className="muted">Unavailable</span></div>;
      const value = summary[card.key];
      const cmp = compare ? compareValue(value, previous ? previous[card.key] : null) : null;
      const tone = !cmp ? "none" : cmp.direction === "flat" || cmp.direction === "none" ? cmp.direction : (cmp.direction === "up") === card.bad ? "bad" : "good";
      return <div key={card.key} className="panel rp-kpi" data-testid={`kpi-${card.key}`}>
        <small><card.icon size={16} aria-hidden /> {card.label}</small><strong>{value.toLocaleString()}</strong>
        {cmp ? <span className={`rp-delta ${tone}`}>{cmp.direction === "up" ? <ArrowUpRight size={14} aria-hidden /> : cmp.direction === "down" ? <ArrowDownRight size={14} aria-hidden /> : <Minus size={14} aria-hidden />}{cmp.text}</span> : <span className="rp-delta none">Comparison off</span>}
      </div>;
    })}
  </section>;
}
