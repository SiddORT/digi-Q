import type * as api from "@workspace/api-client-react";
import { csvCell } from "../admin-listing-data.ts";

export type ReportType = NonNullable<api.GetReportAnalyticsParams["reportType"]>;
export type ReportStatus = NonNullable<api.GetReportAnalyticsParams["status"]>;
export type ReportGroup = NonNullable<api.GetReportAnalyticsParams["groupBy"]>;
export type ReportSort = NonNullable<api.GetReportAnalyticsParams["sort"]>;
export type Preset = "today" | "7d" | "30d" | "month" | "custom";

export interface ReportFilters {
  from: string; to: string; preset: Preset; groupBy: ReportGroup; reportType: ReportType; status: ReportStatus;
  compare: boolean; clinicId: string; branchId: string; doctorId: string; sessionId?: string; sort: ReportSort | ""; pageSize: number;
}

/** Saved-view contract. tableKey is "report-analytics"; filter keys are exactly these. */
export const REPORT_TABLE_RESOURCE = "report-analytics";
export const REPORT_VIEW_FILTER_KEYS = ["from", "to", "preset", "groupBy", "reportType", "status", "compare", "clinicId", "branchId", "doctorId", "sort", "pageSize"] as const;

export const REPORT_TYPES: { id: ReportType; label: string; description: string }[] = [
  { id: "appointments", label: "Daily Appointment Summary", description: "Visits and outcomes for every day, clinic or doctor in range." },
  { id: "doctors", label: "Doctor Utilization", description: "Visits, unique patients and consultation time per doctor." },
  { id: "noShow", label: "No-show Analysis", description: "Where absent visits concentrate, against total visits." },
  { id: "patients", label: "Patient Registration", description: "New patient registrations and the patients seen." },
  { id: "cancellations", label: "Cancellation", description: "Cancelled visits against the visits booked." },
  { id: "activity", label: "Clinic Activity", description: "Recorded workspace activity for the selected scope." },
  { id: "reschedules", label: "Reschedules", description: "Visits moved to another date or session." },
  { id: "clinicPerformance", label: "Clinic Performance", description: "Waiting, consultation and completion figures per clinic." },
  { id: "patientActivity", label: "Patient Activity", description: "Unique patients and their visit activity." },
];
export const reportTypeLabel = (id: string) => id === "all" ? "All Reports" : REPORT_TYPES.find(t => t.id === id)?.label || id;
export const STATUS_OPTIONS: { id: ReportStatus; label: string }[] = [{ id: "all", label: "All Statuses" }, { id: "available", label: "Available" }, { id: "noData", label: "No Data" }];
export const GROUP_OPTIONS: { id: ReportGroup; label: string }[] = [{ id: "date", label: "Date" }, { id: "clinic", label: "Clinic" }, { id: "doctor", label: "Doctor" }];
export const PRESETS: { id: Preset; label: string }[] = [{ id: "today", label: "Today" }, { id: "7d", label: "7 Days" }, { id: "30d", label: "30 Days" }, { id: "month", label: "This Month" }, { id: "custom", label: "Custom Range" }];

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function presetRange(preset: Exclude<Preset, "custom">, today: string) {
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") return { from: addDays(today, -6), to: today };
  if (preset === "30d") return { from: addDays(today, -29), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}
export function detectPreset(from: string, to: string, today: string): Preset {
  for (const p of ["today", "7d", "30d", "month"] as const) { const r = presetRange(p, today); if (r.from === from && r.to === to) return p; }
  return "custom";
}
export const defaultFilters = (today: string): ReportFilters => ({ ...presetRange("today", today), preset: "today", groupBy: "date", reportType: "all", status: "all", compare: false, clinicId: "", branchId: "", doctorId: "", sort: "", pageSize: 20 });

export interface Comparison { text: string; direction: "up" | "down" | "flat" | "none" }
/** Percentage change against the previous period. Zero baselines and missing data are stated, never invented. */
export function compareValue(current: number, previous: number | null | undefined): Comparison {
  if (previous == null) return { text: "No comparison", direction: "none" };
  if (previous === 0) return current === 0 ? { text: "No change from 0", direction: "flat" } : { text: "New; previous period had 0", direction: "up" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.05) return { text: "0.0% vs previous", direction: "flat" };
  return { text: `${Math.abs(pct).toFixed(1)}% vs previous`, direction: pct > 0 ? "up" : "down" };
}

export const SORTABLE: Record<string, { asc: ReportSort; desc: ReportSort }> = {
  date: { asc: "date", desc: "-date" }, label: { asc: "label", desc: "-label" }, clinic: { asc: "clinic", desc: "-clinic" },
  type: { asc: "type", desc: "-type" }, visits: { asc: "appointments", desc: "-appointments" },
  uniquePatients: { asc: "uniquePatients", desc: "-uniquePatients" },
  completed: { asc: "completed", desc: "-completed" },
  cancelled: { asc: "cancelled", desc: "-cancelled" },
  noShow: { asc: "noShow", desc: "-noShow" },
  consultationMinutes: { asc: "consultationMinutes", desc: "-consultationMinutes" },
  reschedules: { asc: "reschedules", desc: "-reschedules" },
};

export const CSV_HEADERS = ["Date", "Report / Event", "Group", "Clinic", "Type", "Status", "Visits", "Completed", "Cancelled", "No-show", "Unique Patients", "Registrations", "Reschedules", "Average Queue Wait (min)", "Average Consultation (min)", "Waiting", "In Consultation", "Total Consultation (min)", "Timed Consultations", "Rescheduled Appointments", "Recorded Activity"];
export function csvRow(r: api.ReportAnalyticsRow, date: string) {
  const m = r.metrics;
  return [date, r.label, r.group, r.clinic, r.type, r.status === "available" ? "Available" : "No Data", m.appointments, m.completed, m.cancelled, m.noShow, m.uniquePatients, m.registrations, m.reschedules, m.averageWaitMinutes ?? "", m.averageConsultationMinutes ?? "", m.waiting, m.checkedIn, m.consultationMinutes ?? "", m.timedConsultations, m.rescheduledAppointments, m.activity].map(csvCell).join(",");
}

export const METRIC_LABELS: { key: keyof api.ReportAnalyticsMetrics; label: string; unit?: string }[] = [
  { key: "appointments", label: "Visits" }, { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" }, { key: "noShow", label: "No-show" },
  { key: "uniquePatients", label: "Unique patients" }, { key: "registrations", label: "Registrations" }, { key: "waiting", label: "Waiting" }, { key: "checkedIn", label: "Checked in" },
  { key: "averageWaitMinutes", label: "Average queue wait", unit: "min" }, { key: "averageConsultationMinutes", label: "Average consultation", unit: "min" },
  { key: "consultationMinutes", label: "Total consultation time", unit: "min" }, { key: "timedConsultations", label: "Timed consultations" },
  { key: "reschedules", label: "Reschedule events" }, { key: "rescheduledAppointments", label: "Rescheduled visits" }, { key: "activity", label: "Recorded activity" },
];
export const metricText = (v: number | null | undefined, unit?: string) => v == null ? "Not available" : unit ? `${v} ${unit}` : String(v);

/** Header row plus one row: the CSV for a single result. */
export const rowDetailCsv = (r: api.ReportAnalyticsRow, date: string) => `\uFEFF${CSV_HEADERS.join(",")}\r\n${csvRow(r, date)}`;

type ExportLoader = (params: api.GetReportAnalyticsParams) => Promise<api.ReportAnalytics>;
/** One exportAll snapshot. Anything short of the full reported total is an error, never a partial file. */
export async function buildReportExport(load: ExportLoader, params: api.GetReportAnalyticsParams, fmtDate: (iso: string) => string) {
  const { page: _p, pageSize: _s, ...rest } = params; void _p; void _s;
  const res = await load({ ...rest, compare: false, exportAll: true });
  if (!Number.isFinite(res.total) || res.rows.length !== res.total) throw new Error("The export did not include every result. Please retry.");
  if (new Set(res.rows.map(r => r.id)).size !== res.rows.length) throw new Error("Report rows changed while exporting. Please retry.");
  return { rows: res.rows.length, csv: `\uFEFF${[CSV_HEADERS.join(","), ...res.rows.map(r => csvRow(r, fmtDate(r.date)))].join("\r\n")}` };
}

const REL = ["today", "7d", "30d", "month"];
/** Saved values to filters. Relative presets are re-evaluated against today; only custom keeps stored dates. */
export function resolveFilters(raw: Record<string, string>, today: string, base: ReportFilters): ReportFilters {
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const preset = REL.includes(raw.preset) ? raw.preset as Exclude<Preset, "custom"> : null;
  const range = preset ? presetRange(preset, today) : isDate(raw.from) && isDate(raw.to) && raw.from <= raw.to ? { from: raw.from, to: raw.to } : { from: base.from, to: base.to };
  const sortKey = (raw.sort || "").replace(/^-/, "");
  return { ...base, ...range, preset: preset || detectPreset(range.from, range.to, today), groupBy: (["clinic", "doctor"].includes(raw.groupBy) ? raw.groupBy : "date") as ReportGroup,
    reportType: (REPORT_TYPES.some(t => t.id === raw.reportType) ? raw.reportType : "all") as ReportType, status: (["available", "noData"].includes(raw.status) ? raw.status : "all") as ReportStatus,
    compare: raw.compare === "1", clinicId: raw.clinicId || "", branchId: raw.branchId || "", doctorId: raw.doctorId || "",
    sort: (["date", "label", "clinic", "type", "appointments", "uniquePatients", "completed", "cancelled", "noShow", "consultationMinutes", "reschedules"].includes(sortKey) ? raw.sort : "") as ReportSort | "", pageSize: [10, 20, 25, 50, 100].includes(Number(raw.pageSize)) ? Number(raw.pageSize) : 20 };
}
export function describeFilters(raw: Record<string, string>) {
  const period = raw.preset && raw.preset !== "custom" ? PRESETS.find(p => p.id === raw.preset)?.label : raw.from && raw.to ? `${raw.from} to ${raw.to}` : "Today";
  return [reportTypeLabel(raw.reportType || "all"), period, GROUP_OPTIONS.find(g => g.id === raw.groupBy)?.label ? `By ${GROUP_OPTIONS.find(g => g.id === raw.groupBy)!.label}` : "", raw.compare === "1" ? "Compared" : ""].filter(Boolean).join(" · ");
}

const LINK_FAMILIES = ["appointments", "clinicPerformance"];
/** Visits link only when the row's scope maps exactly onto appointment filters; otherwise null (no misleading link). */
export function rowVisitsLink(r: api.ReportAnalyticsRow, a: Pick<ReportFilters, "from" | "to" | "groupBy" | "clinicId" | "branchId" | "doctorId">, root: string, hasSession: boolean) {
  if (!LINK_FAMILIES.includes(r.family) || hasSession || a.groupBy === "doctor") return null;
  const day = a.groupBy === "date";
  const q = new URLSearchParams({ from: day ? r.date : a.from, to: day ? r.date : a.to });
  const clinic = r.clinicId || a.clinicId; if (clinic) q.set("clinic", clinic);
  if (a.branchId) q.set("branch", a.branchId); if (a.doctorId) q.set("doctor", a.doctorId);
  return `/${root}/appointments?${q}`;
}
