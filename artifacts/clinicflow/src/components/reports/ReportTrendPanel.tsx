import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type * as api from "@workspace/api-client-react";
import { formatDate } from "../../lib/date-time";
import { SearchableSelect } from "../SearchableSelect";
import "./reports.css";

const METRICS = [{ id: "appointments", label: "Appointments" }, { id: "completed", label: "Completed" }, { id: "cancelled", label: "Cancelled" }, { id: "noShow", label: "No-shows" }, { id: "waiting", label: "Waiting" }] as const;
type Metric = typeof METRICS[number]["id"];

/** Trend with metric selector. Single-day ranges still render a chart (bars). Previous period overlays by day offset. */
export function ReportTrendPanel({ points, previousPoints, compare, loading, error, onRetry, preferences }: { points?: api.ReportTrendPoint[]; previousPoints?: api.ReportTrendPoint[]; compare: boolean; loading: boolean; error: boolean; onRetry: () => void; preferences?: Parameters<typeof formatDate>[1] }) {
  const [metric, setMetric] = useState<Metric>("appointments");
  const label = METRICS.find(m => m.id === metric)!.label;
  const data = (points || []).map((p, i) => ({ name: formatDate(p.date, preferences), current: p[metric], previous: compare ? previousPoints?.[i]?.[metric] : undefined }));
  const empty = !!points && !points.some(p => p[metric]);
  return <section className="panel rp-trend" aria-label="Appointments trend" data-testid="report-trend">
    <div className="rp-trend-head"><h2>Appointments Trend</h2>
      <div data-testid="select-trend-metric"><SearchableSelect label="Trend Metric" value={metric} onChange={v => { if (v) setMetric(v as Metric); }} options={METRICS.map(m => ({ value: m.id, label: m.label }))} /></div></div>
    {error ? <div role="alert" className="empty"><p>The trend could not be loaded.</p><button onClick={onRetry}>Retry</button></div>
      : loading || !points ? <div className="rp-skel" style={{ height: 250, marginTop: 8 }} />
      : <>{empty && <p className="muted" role="status" data-testid="text-trend-empty">No {label.toLowerCase()} were recorded in this range. Values are shown as zero.</p>}
        <div className="rp-trend-canvas"><ResponsiveContainer width="100%" height="100%">
          {data.length < 2 ? <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="current" name={label} fill="#2f6fd6" radius={[4, 4, 0, 0]} />{compare && <Bar dataKey="previous" name="Previous period" fill="#8fa6c4" radius={[4, 4, 0, 0]} />}</BarChart>
          : <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} minTickGap={24} /><YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Area type="linear" dataKey="current" name={label} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} dot={data.length <= 10} />{compare && <Area type="linear" dataKey="previous" name="Previous period" stroke="var(--soft)" fill="none" strokeDasharray="5 4" strokeWidth={2} dot={false} />}</AreaChart>}
        </ResponsiveContainer></div></>}
  </section>;
}
