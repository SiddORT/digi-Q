import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import * as api from "@/lib/api";
import { formatDate } from "@/lib/date-time";
import { CapabilityView, fromQuery } from "./CapabilityState";

/** Daily trend from the scoped /reports/trends aggregate. Every day in range is plotted, including zero days. */
export function ReportTrends({ from, to, clinicId, branchId, doctorId, preferences }: { from: string; to: string; clinicId?: string; branchId?: string; doctorId?: string; preferences?: Parameters<typeof formatDate>[1] }) {
  const params = { from, to, clinicId: clinicId || undefined, branchId: branchId || undefined, doctorId: doctorId || undefined };
  const valid = !!from && !!to && from <= to;
  const q = api.useGetReportTrends(params, { query: { queryKey: api.getGetReportTrendsQueryKey(params), enabled: valid, staleTime: 30000, placeholderData: p => p } });
  if (!valid || from === to) return null;
  const value = fromQuery(q, { isEmpty: d => !d.points.some(p => p.appointments), emptyMessage: "No visits were recorded in this date range.", errorMessage: "Trend data could not be loaded. The range may exceed one year." });
  return <section className="card report-trends" aria-label="Daily visit trend" data-testid="report-trends" style={{ padding: "12px 14px", margin: "10px 0" }}>
    <h2 className="section-subhead">Daily Trend</h2>
    <CapabilityView value={value} title="Trend" testId="report-trends">{d => <>
      <div style={{ width: "100%", height: 200 }}><ResponsiveContainer>
        <LineChart data={d.points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickFormatter={v => formatDate(v, preferences)} fontSize={11} minTickGap={24} />
          <YAxis allowDecimals={false} fontSize={11} />
          <Tooltip labelFormatter={v => formatDate(String(v), preferences)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="appointments" name="Visits" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="completed" name="Completed" stroke="#1f8a5b" dot={false} />
          <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#b4543a" dot={false} />
          <Line type="monotone" dataKey="noShow" name="Absent" stroke="#8a6d1f" dot={false} />
        </LineChart>
      </ResponsiveContainer></div>
      <table className="sr-only"><caption>Daily visits</caption><thead><tr><th>Date</th><th>Visits</th><th>Completed</th><th>Cancelled</th><th>Absent</th></tr></thead>
        <tbody>{d.points.map(p => <tr key={p.date}><td>{formatDate(p.date, preferences)}</td><td>{p.appointments}</td><td>{p.completed}</td><td>{p.cancelled}</td><td>{p.noShow}</td></tr>)}</tbody></table>
    </>}</CapabilityView>
  </section>;
}
