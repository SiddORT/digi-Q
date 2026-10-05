import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type * as api from "@/lib/api";
import "./workspace-surfaces.css";

type Row = Pick<api.ReportRow, "key" | "label" | "completed" | "cancelled" | "noShow" | "appointments">;

/** Visit outcomes per group, drawn only from the report rows already loaded for the table. Never synthesises data. */
export function ReportChart({ rows, page, totalPages }: { rows?: Row[]; page?: number; totalPages?: number }) {
  if (!rows) return null;
  if (!rows.length) return <section className="panel report-chart cap-state cap-empty" role="status" data-testid="report-chart-empty"><div><strong>No Chart Data</strong><p>There are no report rows for this range, so there is nothing to chart.</p></div></section>;
  const valid = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
  const usable = rows.every(r => [r.appointments, r.completed, r.cancelled, r.noShow].every(valid) && r.appointments - r.completed - r.cancelled - r.noShow >= 0);
  if (!usable) return <section className="panel report-chart cap-state cap-unavailable" role="status" data-testid="report-chart-unavailable"><div><strong>Chart Unavailable</strong><p>Some report counts are missing or inconsistent, so no chart is drawn. The table below shows the counts as reported.</p></div></section>;
  const data = rows.slice(0, 20).map(r => ({ name: r.label || r.key, Completed: r.completed, Cancelled: r.cancelled, Absent: r.noShow, Other: r.appointments - r.completed - r.cancelled - r.noShow }));
  return <section className="panel report-chart" aria-label="Visit Outcomes by Group" data-testid="report-chart">
    <div className="report-chart-head section-head"><h2>Visit Outcomes by Group</h2>
      <small className="muted">{rows.length > 20 ? "First 20 rows of this page" : "Rows on this page"}{totalPages && totalPages > 1 ? ` · Page ${page ?? 1} of ${totalPages}` : ""}</small></div>
    <div className="report-chart-canvas"><ResponsiveContainer width="100%" height={240}>
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={18} tickFormatter={(v: string) => v.length > 14 ? `${v.slice(0, 13)}…` : v} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Completed" stackId="o" fill="#2f6fd6" />
        <Bar dataKey="Absent" stackId="o" fill="#d08a2c" />
        <Bar dataKey="Cancelled" stackId="o" fill="#b6475a" />
        <Bar dataKey="Other" stackId="o" fill="#8fa6c4" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer></div>
  </section>;
}
