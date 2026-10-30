import { Fragment, useEffect, useRef, useState } from "react";
import { usePreferredPageSize } from "../../lib/page-size-preference";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Eye, ExternalLink, Building2 } from "lucide-react";
import { today, ErrorNotice } from "../../resources";
import { parseReportParams } from "../../lib/search-links";
import { formatDate, resolveDateTimePreferences, type DateTimePreferences } from "../../lib/date-time";
import { friendlyError } from "../../lib/friendly-error";
import { rangeError } from "../../lib/date-picker-logic";
import type { useListingLayout } from "../../lib/listing-views";
import { AppDialog } from "../AppDialog";
import { FilterBar, Pagination, SearchInput, ListingRegion, listingSuggestions, useDebouncedValue } from "../ListingControls";
import { SavedViews } from "../ListingViewControls";
import { useTableColumns, readTableColumns, writeTableColumns } from "../TableColumns";
import { DateRangeInput } from "../DateRangeInput";
import { CareLookup, useSelectedCare } from "../CareLookup";
import { SearchableSelect } from "../SearchableSelect";
import { useFilterNames } from "../FilterNames";
import { OverflowText } from "../OverflowText";
import { HelpTip } from "../HelpTip";
import { formatSessionHours, useDailySession } from "../queue/SessionSelector";
import { usePinnedCare, useWorkspaceBranch } from "../WorkspaceBranch";
import { ReportKpis } from "./ReportKpis";
import { ReportTrendPanel } from "./ReportTrendPanel";
import { GROUP_OPTIONS, METRIC_LABELS, buildReportExport, metricText, resolveFilters, rowDetailCsv, rowVisitsLink, PRESETS, REPORT_TABLE_RESOURCE, REPORT_TYPES, SORTABLE, STATUS_OPTIONS, defaultFilters, detectPreset, presetRange, reportTypeLabel, type ReportFilters, type ReportGroup, type ReportSort, type ReportStatus, type ReportType } from "./report-model";
import "./reports.css";

const TYPE_IDS = ["all", ...REPORT_TYPES.map(t => t.id)];

export function ReportsDashboard({ role, initialReportType, initialViewId, layout }: { role: string; initialReportType?: string; initialViewId?: string; layout: ReturnType<typeof useListingLayout> }) {
  const settings = api.useGetSettings();
  const pin = useWorkspaceBranch();
  const selectedBranch = useSelectedCare("branches", pin?.branchId || "");
  const timezone = typeof selectedBranch.data?.timezone === "string" ? selectedBranch.data.timezone : settings.data?.timezone || "Asia/Kolkata";
  const todayIso = today(timezone);
  const [initial] = useState(() => parseReportParams(window.location.search, todayIso));
  const preferredPageSize = usePreferredPageSize(20, new URLSearchParams(window.location.search).get("pageSize"));
  const [applied, setApplied] = useState<ReportFilters>(() => ({ ...defaultFilters(todayIso), pageSize: preferredPageSize, from: initial.from, to: initial.to, preset: detectPreset(initial.from, initial.to, todayIso), groupBy: initial.groupBy as ReportGroup, reportType: (TYPE_IDS.includes(initialReportType || "") ? initialReportType : "all") as ReportType, clinicId: pin?.clinicId || "", branchId: pin?.branchId || "", sort: initialReportType === "clinicPerformance" ? "-uniquePatients" : initialReportType === "doctors" ? "-completed" : "" }));
  const [draft, setDraft] = useState(applied);
  const [search, setSearch] = useState(initial.search);
  const debounced = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [fromValid, setFromValid] = useState(true);
  const [toValid, setToValid] = useState(true);
  // Filter editors exist only in the drawer; sorting and page size remain table controls.
  const patch = (p: Partial<ReportFilters>) => { const next = "clinicId" in p || "branchId" in p || "doctorId" in p ? { ...p, sessionId: "" } : p; setApplied(a => ({ ...a, ...next })); setDraft(d => ({ ...d, ...next })); setPage(1); };
  const pinPatch = (p: Partial<ReportFilters>) => { setApplied(a => ({ ...a, ...p, sessionId: "" })); setDraft(d => ({ ...d, ...p, sessionId: "" })); };
  const [detail, setDetail] = useState<api.ReportAnalyticsRow | null>(null);
  const [drawerRequest, setDrawerRequest] = useState({ key: 0, target: "" });
  const requestedClinic = useRef("");
  const patchDraft = (p: Partial<ReportFilters>) => setDraft(d => ({ ...d, ...(["from", "to", "clinicId", "branchId", "doctorId"].some(k => k in p) ? { sessionId: "" } : {}), ...p }));

  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 60000 } });
  const uid = me.data?.user?.id, urole = me.data?.user?.role;
  const selectedClinic = useSelectedCare("clinics", applied.clinicId);
  const preferences = resolveDateTimePreferences(selectedClinic.data as Partial<DateTimePreferences> | undefined);
  usePinnedCare(applied.clinicId, applied.branchId, v => pinPatch({ clinicId: v }), v => pinPatch({ branchId: v }));
  const names = useFilterNames({ clinicId: applied.clinicId, branchId: applied.branchId, doctorId: applied.doctorId });

  const single = applied.from === applied.to;
  const session = useDailySession({ doctorId: applied.doctorId, branchId: applied.branchId, date: single ? applied.from : "" });
  const sessionId = single ? applied.sessionId || session.sessionId || undefined : undefined;
  const sessionStart = sessionId ? session.sessions.find(s => s.sessionId === sessionId)?.startTime || undefined : undefined;
  const draftSession = useDailySession({ doctorId: draft.doctorId, branchId: draft.branchId, date: draft.from === draft.to ? draft.from : "" });
  const defaults0 = useRef(defaultFilters(todayIso));
  const validRange = !!applied.from && !!applied.to && applied.from <= applied.to;
  const [initialViewLoaded, setInitialViewLoaded] = useState(!initialViewId);
  const waitingForView = !initialViewLoaded;
  const viewUnavailable = waitingForView && !layout.viewsLoading;

  const params: api.GetReportAnalyticsParams = { from: applied.from, to: applied.to, groupBy: applied.groupBy, reportType: applied.reportType, status: applied.status, compare: applied.compare, clinicId: applied.clinicId || undefined, branchId: applied.branchId || undefined, doctorId: applied.doctorId || undefined, sessionId: sessionStart ? undefined : sessionId, startTime: sessionStart, search: debounced || undefined, sort: applied.sort || undefined, page, pageSize: applied.pageSize };
  const q = api.useGetReportAnalytics(params, { query: { queryKey: api.getGetReportAnalyticsQueryKey(params), enabled: validRange && !waitingForView, refetchInterval: 30000, placeholderData: p => p } });
  const isReportLoading = validRange && (waitingForView && !viewUnavailable || q.isLoading || q.isPlaceholderData);
  const exportContext = useRef("");
  exportContext.current = JSON.stringify({ ...params, search, uid, urole });
  const stale = q.isPlaceholderData || q.isFetching;
  const data = q.error || q.isPlaceholderData || waitingForView ? undefined : q.data;
  const total = data?.total ?? 0;
  useEffect(() => { setExportDone(false); }, [applied, debounced]);
  useEffect(() => { setDetail(null); }, [applied, debounced, q.error, q.isPlaceholderData]);
  useEffect(() => {
    setApplied(p => p.preset === "custom" ? p : { ...p, ...presetRange(p.preset, todayIso) });
    setDraft(p => p.preset === "custom" ? p : { ...p, ...presetRange(p.preset, todayIso) });
  }, [todayIso]);
  const loadedView = useRef(false);
  const viewList = layout.layout.views;
  useEffect(() => { // one-time: open a saved configuration chosen in Report Templates; relative presets re-evaluate now
    if (!initialViewId || loadedView.current) return;
    const v = viewList.find(x => x.id === initialViewId); if (!v) return;
    loadedView.current = true; const next = resolveFilters(v.filters, todayIso, defaults0.current); next.clinicId = pin?.clinicId || next.clinicId; next.branchId = pin?.branchId || next.branchId;
    writeTableColumns(REPORT_TABLE_RESOURCE, uid, urole, v.columns); setApplied(next); setDraft(next); setPage(1); setInitialViewLoaded(true);
  }, [viewList, initialViewId, todayIso, pin, uid, urole]);
  useEffect(() => { if (data && !q.isPlaceholderData && !q.isFetching) setPage(c => Math.min(c, Math.max(1, Math.ceil(data.total / applied.pageSize)))); }, [data, q.isPlaceholderData, q.isFetching, applied.pageSize]);

  const extraMetrics = METRIC_LABELS.filter(m => !["appointments", "averageWaitMinutes", "averageConsultationMinutes"].includes(m.key));
  const templateMetrics: Record<string, string[]> = { doctors: ["uniquePatients", "completed", "consultationMinutes"], clinicPerformance: ["uniquePatients", "completed", "cancelled"], noShow: ["noShow"], cancellations: ["cancelled"], reschedules: ["reschedules", "rescheduledAppointments"], patients: ["registrations"], patientActivity: ["uniquePatients", "visits"], activity: ["activity"] };
  const visibleMetrics = templateMetrics[applied.reportType] || [];
  const cols = useTableColumns(REPORT_TABLE_RESOURCE, uid, urole, [{ key: "date", label: "Date" }, { key: "label", label: "Report / Event" }, { key: "clinic", label: "Clinic" }, { key: "type", label: "Type" }, { key: "status", label: "Status" }, { key: "visits", label: "Visits" }, { key: "outcomes", label: "Outcomes" }, { key: "wait", label: "Average Queue Wait" }, { key: "tat", label: "Average Consultation" }, ...extraMetrics.map(m => ({ key: m.key, label: m.label }))], { defaultHidden: ["visits", "outcomes", "wait", "tat", ...extraMetrics.map(m => m.key)].filter(k => !visibleMetrics.includes(k)) });
  const viewFilters: Record<string, string> = { from: applied.from, to: applied.to, preset: applied.preset, groupBy: applied.groupBy === "date" ? "" : applied.groupBy, reportType: applied.reportType === "all" ? "" : applied.reportType, status: applied.status === "all" ? "" : applied.status, compare: applied.compare ? "1" : "", clinicId: applied.clinicId, branchId: applied.branchId, doctorId: applied.doctorId, sort: applied.sort, pageSize: applied.pageSize === 20 ? "" : String(applied.pageSize) };
  const snap = () => readTableColumns(REPORT_TABLE_RESOURCE, uid, urole);

  const draftError = rangeError(draft.from, draft.to, true, !fromValid || !toValid);
  const root = ["superAdmin", "clinicAdmin"].includes(role) ? "admin" : role;
  const defaults = defaultFilters(todayIso);
  const dirty = applied.reportType !== "all" || applied.status !== "all" || applied.groupBy !== "date" || applied.compare || applied.preset !== "today" || (!pin && (applied.clinicId || applied.branchId)) || applied.doctorId || search;
  const resetDraft = () => { setDraft({ ...defaults, clinicId: pin?.clinicId || "", branchId: pin?.branchId || "" }); setFromValid(true); setToValid(true); };
  const clearAll = () => { setApplied({ ...defaults, clinicId: pin?.clinicId || "", branchId: pin?.branchId || "" }); resetDraft(); setSearch(""); setPage(1); };

  const [exporting, setExporting] = useState(false);
  const lock = useRef(false);
  const [exportError, setExportError] = useState<Error | null>(null);
  const [exportDone, setExportDone] = useState(false);
  const canExport = !exporting && !stale && !q.error && !!total && validRange && search === debounced;
  async function download() {
    if (lock.current || !canExport) return;
    lock.current = true; setExporting(true); setExportError(null); setExportDone(false);
    const context = exportContext.current;
    try {
      const out = await buildReportExport(api.getReportAnalytics, params, iso => formatDate(iso, preferences));
      if (context !== exportContext.current) throw new Error("Filters changed during export. Export again for the current selection.");
      const url = URL.createObjectURL(new Blob([out.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `DigiQ-report-${applied.reportType}-${applied.from}-${applied.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setExportDone(true);
    } catch (e) { setExportError(e instanceof Error ? e : new Error("Unable to export report.")); } finally { setExporting(false); lock.current = false; }
  }
  const exportTip = exporting ? "Export in progress." : stale ? "Waiting for the report to finish loading." : q.error ? "Retry the report first." : !total ? "No report rows to export." : !validRange ? "Select a valid date range first." : "Exports every result of the applied filters in one file.";

  const sortHeader = (key: string, label: string, cls?: string) => { const s = SORTABLE[key]; const cur = applied.sort; return <th key={key} className={cls} aria-sort={cur === s.asc ? "ascending" : cur === s.desc ? "descending" : "none"}><button type="button" className="table-sort" onClick={() => patch({ sort: (cur === s.asc ? s.desc : s.asc) as ReportSort })} aria-label={`Sort ${label} ${cur === s.asc ? "descending" : "ascending"}`}>{label} {cur === s.asc ? <ArrowUp size={15} aria-hidden /> : cur === s.desc ? <ArrowDown size={15} aria-hidden /> : <ArrowUpDown size={15} aria-hidden />}</button></th>; };
  const plain = (label: string, cls?: string) => <th key={label} className={cls}>{label}</th>;
  const header: Record<string, () => React.ReactNode> = { date: () => sortHeader("date", "Date", cols.cls("date")), label: () => sortHeader("label", "Report / Event", cols.cls("label")), clinic: () => sortHeader("clinic", "Clinic", cols.cls("clinic")), type: () => sortHeader("type", "Type", cols.cls("type")), status: () => plain("Status", cols.cls("status")), visits: () => sortHeader("visits", "Visits", cols.cls("visits")), outcomes: () => plain("Outcomes", cols.cls("outcomes")), wait: () => plain("Average Queue Wait", cols.cls("wait")), tat: () => plain("Average Consultation", cols.cls("tat")) };
  for (const m of extraMetrics) header[m.key] = () => SORTABLE[m.key] ? sortHeader(m.key, m.label, cols.cls(m.key)) : plain(m.label, cols.cls(m.key));
  const cell = (k: string, r: api.ReportAnalyticsRow) => k === "date" ? formatDate(r.date, preferences) : k === "label" ? <><OverflowText value={r.label} />{applied.groupBy !== "date" && <small><OverflowText value={r.group} /></small>}</> : k === "clinic" ? <OverflowText value={r.clinic || "—"} /> : k === "type" ? r.type : k === "status" ? <span className={`badge ${r.status === "available" ? "active" : "inactive"}`}>{r.status === "available" ? "Available" : "No Data"}</span> : k === "visits" ? <><strong>{r.metrics.appointments}</strong> <span className="muted">· {r.metrics.completed} completed</span></> : k === "outcomes" ? `${r.metrics.cancelled} cancelled · ${r.metrics.noShow} no-show` : k === "wait" ? (r.metrics.averageWaitMinutes == null ? "—" : `${r.metrics.averageWaitMinutes} min`) : k === "tat" ? (r.metrics.averageConsultationMinutes == null ? "—" : `${r.metrics.averageConsultationMinutes} min`) : metricText(r.metrics[k as keyof api.ReportAnalyticsMetrics], extraMetrics.find(m => m.key === k)?.unit);
  const rowActions = (r: api.ReportAnalyticsRow) => {
    const href = rowVisitsLink(r, applied, root, !!sessionId);
    return <div className="row-actions"><HelpTip text="View Report Details"><button type="button" className="button secondary small" aria-label={`View details: ${r.label}`} onClick={() => setDetail(r)} data-testid={`button-report-details-${r.id}`}><Eye size={15} aria-hidden /></button></HelpTip>{href && <HelpTip text="View Scoped Visits"><Link href={href} aria-label={`View visits: ${r.label}`} className="button secondary small" data-testid={`link-report-open-${r.id}`}><ExternalLink size={15} aria-hidden /></Link></HelpTip>}{r.clinicId && !pin && applied.clinicId !== r.clinicId && <HelpTip text="Focus This Clinic"><button type="button" className="button secondary small" aria-label={`Focus clinic: ${r.clinic}`} aria-haspopup="dialog" onClick={() => { requestedClinic.current = r.clinicId; setDrawerRequest(r => ({ key: r.key + 1, target: '[data-report-field="clinic"]' })); }} data-testid={`button-report-focus-${r.id}`}><Building2 size={15} aria-hidden /></button></HelpTip>}</div>;
  };
  function downloadRow(r: api.ReportAnalyticsRow) {
    const url = URL.createObjectURL(new Blob([rowDetailCsv(r, formatDate(r.date, preferences))], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `DigiQ-report-row-${r.id.replace(/[^A-Za-z0-9_-]/g, "-")}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chips = [
    { key: "range", drawerTarget: '[data-report-field="period"]', label: `${PRESETS.find(p => p.id === applied.preset)?.label}: ${single ? formatDate(applied.from, preferences) : `${formatDate(applied.from, preferences)} – ${formatDate(applied.to, preferences)}`}` },
    { key: "adv:type", drawerTarget: '[data-testid="select-report-drawer-type"]', label: `Report: ${reportTypeLabel(applied.reportType)}` },
    { key: "adv:status", drawerTarget: '[data-testid="select-report-drawer-status"]', label: `Status: ${STATUS_OPTIONS.find(s => s.id === applied.status)?.label}` },
    { key: "adv:group", drawerTarget: '[data-testid="select-report-drawer-group"]', label: `Group: ${GROUP_OPTIONS.find(g => g.id === applied.groupBy)?.label}` },
    { key: "compare", drawerTarget: '[data-report-field="compare"]', label: applied.compare ? "Compare: Previous period" : "Compare: Off" },
    ...(search ? [{ key: "search", label: search, onRemove: () => setSearch("") }] : []),
    { key: "adv:clinic", drawerTarget: pin ? undefined : '[data-report-field="clinic"]', label: `Clinic: ${pin?.clinicName || (applied.clinicId ? names.name("clinicId") : "All permitted")}` },
    { key: "adv:branch", drawerTarget: pin ? undefined : '[data-report-field="branch"]', label: `Location: ${pin?.name || (applied.branchId ? names.name("branchId") : "All permitted")}${pin ? " (workspace)" : ""}` },
    { key: "adv:doctor", drawerTarget: '[data-report-field="doctor"]', label: `Doctor: ${applied.doctorId ? names.name("doctorId") : "All permitted"}` },
    ...(single && applied.branchId && applied.doctorId ? [{ key: "session", drawerTarget: '[data-report-field="session"]', label: `Session: ${sessionId && sessionStart ? formatSessionHours({ ...session.sessions.find(s => s.sessionId === sessionId), ...preferences }) : "Not selected"}` }] : []),
  ];

  const openDrawer = () => { setDraft({ ...applied, sessionId: sessionId || "", ...(requestedClinic.current && !pin ? { clinicId: requestedClinic.current, branchId: "", doctorId: "", sessionId: "" } : {}) }); requestedClinic.current = ""; setFromValid(true); setToValid(true); };
  const applyDrawer = () => { if (draftError || (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 > 366 || (draft.sessionId && (draftSession.availability.isFetching || draftSession.availability.error || !draftSession.sessions.some(s => s.sessionId === draft.sessionId)))) return false; const next = { ...draft, preset: detectPreset(draft.from, draft.to, todayIso), clinicId: pin ? applied.clinicId : draft.clinicId, branchId: pin ? applied.branchId : draft.branchId, sort: applied.sort, pageSize: applied.pageSize }; setApplied(next); setDraft(next); setPage(1); return true; };
  const select = <T extends string>(label: string, value: T, options: readonly { id: string; label: string }[], onChange: (v: T) => void, id: string) => <div data-testid={`select-report-${id}`}><SearchableSelect label={label} value={value} onChange={v => { if (v) onChange(v as T); }} options={options.map(o => ({ value: o.id, label: o.label }))} /></div>;
  const typeOptions = [{ id: "all", label: "All Reports" }, ...REPORT_TYPES];

  const drawer = <div className="form-grid" data-testid="report-filter-drawer">
    <div data-report-field="period"><DateRangeInput required from={draft.from} to={draft.to} preferences={preferences} onChange={r => patchDraft({ ...r, preset: detectPreset(r.from, r.to, todayIso) })} onFromValidityChange={setFromValid} onToValidityChange={setToValid} /></div>
    {(Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 > 366 && <p role="alert" className="field-error">Choose a report range of up to 367 days.</p>}
    {draftError && <p role="alert" className="field-error" data-testid="text-report-range-error">{draftError}</p>}
    <div className="rp-presets" role="group" aria-label="Draft period">{PRESETS.map(p => <button key={p.id} type="button" aria-pressed={draft.preset === p.id} onClick={() => patchDraft(p.id === "custom" ? { preset: "custom" } : { ...presetRange(p.id, todayIso), preset: p.id })} data-testid={`button-draft-preset-${p.id}`}>{p.label}</button>)}</div>
    {select("Group By", draft.groupBy, GROUP_OPTIONS, v => patchDraft({ groupBy: v as ReportGroup }), "drawer-group")}
    {select("Report Type", draft.reportType, typeOptions, v => patchDraft({ reportType: v as ReportType }), "drawer-type")}
    {select("Status", draft.status, STATUS_OPTIONS, v => patchDraft({ status: v as ReportStatus }), "drawer-status")}
    {pin ? <p className="loc-fixed-note">Location: {pin.name} · change it from the top bar</p> : <>
      <div data-report-field="clinic"><CareLookup kind="clinics" label="Clinic" value={draft.clinicId} onChange={v => patchDraft({ clinicId: v, branchId: "", doctorId: "" })} /></div>
      <div data-report-field="branch"><CareLookup kind="branches" label="Location" value={draft.branchId} onChange={v => patchDraft({ branchId: v, doctorId: "" })} disabled={!draft.clinicId} params={{ clinicId: draft.clinicId }} /></div></>}
    <div data-report-field="doctor"><CareLookup kind="doctors" label="Doctor" value={draft.doctorId} onChange={v => patchDraft({ doctorId: v })} disabled={!(pin?.clinicId || draft.clinicId)} params={{ clinicId: pin?.clinicId || draft.clinicId, branchId: pin?.branchId || draft.branchId || undefined }} /></div>
    {draft.from === draft.to && draft.branchId && draft.doctorId && <div data-report-field="session"><SearchableSelect label="Session" value={draft.sessionId || draftSession.sessionId} onChange={v => patchDraft({ sessionId: v })} options={draftSession.sessions.map(s => ({ value: s.sessionId || "", label: formatSessionHours({ ...s, ...preferences }) }))} loading={draftSession.availability.isFetching} error={draftSession.availability.error ? "Sessions could not be loaded." : undefined} onRetry={() => void draftSession.availability.refetch()} /></div>}
    <label className="rp-toggle" data-report-field="compare"><input type="checkbox" checked={draft.compare} onChange={e => patchDraft({ compare: e.target.checked })} /> Compare with previous period</label>
  </div>;

  const headActions = <div className="rp-head-actions">
    <HelpTip text={exportTip}><button type="button" className="button small" onClick={() => void download()} disabled={!canExport} data-testid="button-report-header-export"><Download size={15} aria-hidden /> {exporting ? "Exporting…" : "Export"}</button></HelpTip>
  </div>;

  return <div className="reports-live" data-testid="reports-live">
    <FilterBar compactChips drawerRequest={drawerRequest} actions={headActions} advanced={drawer} onOpen={openDrawer} onApply={applyDrawer} onReset={clearAll} onResetDraft={resetDraft} onCancel={() => setDraft(applied)} active={!!dirty} chips={chips} activeCount={[applied.reportType !== "all", applied.status !== "all", applied.groupBy !== "date", applied.compare, applied.preset !== "today", applied.doctorId, !pin && applied.clinicId, !pin && applied.branchId].filter(Boolean).length}
      meta={<span className="rp-period" data-testid="text-report-period">{single ? formatDate(applied.from, preferences) : `${formatDate(applied.from, preferences)} – ${formatDate(applied.to, preferences)}`}{data ? ` · ${data.timezone}` : ""}{applied.compare && data ? ` · vs ${formatDate(data.previousFrom, preferences)} – ${formatDate(data.previousTo, preferences)}` : ""}</span>}
      secondary={<><HelpTip text={exportTip}><button type="button" className="button secondary small report-export" onClick={() => void download()} disabled={!canExport} data-testid="button-report-export"><Download size={15} aria-hidden /> Export CSV</button></HelpTip>{cols.settings}<SavedViews canShare={layout.canShare} legacyViews={layout.legacyViews} onImport={layout.importLegacyView} views={layout.layout.views} canSave={Object.values(viewFilters).some(Boolean)} onSave={v => layout.saveView(v, viewFilters, snap())} onDelete={layout.deleteView}
        onApply={v => { writeTableColumns(REPORT_TABLE_RESOURCE, uid, urole, v.columns); const next = resolveFilters(v.filters, todayIso, defaults); next.clinicId = pin?.clinicId || next.clinicId; next.branchId = pin?.branchId || next.branchId; setApplied(next); setDraft(next); setPage(1); }} /></>}>
      <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search reports…" label="Search Reports" suggestions={q.error ? [] : listingSuggestions(data?.rows, r => r.label ? { id: r.id, label: r.label, value: r.label } : null)} loading={q.isFetching} error={q.error ? friendlyError(q.error, "load") : null} onRetry={() => void q.refetch()} total={total} settledQuery={debounced} scopeKey={JSON.stringify({ ...params, search: undefined, page: undefined })} />
    </FilterBar>
    {!validRange && <p role="alert" className="error-box">Select a valid date range.</p>}
    <ErrorNotice error={exportError} />
    <ErrorNotice error={q.error} onRetry={()=>q.refetch()} busy={q.isFetching}/>
    {viewUnavailable && <div role="alert"><p>{layout.viewsError ? "Saved report templates could not be loaded." : "This saved report template is unavailable. No substitute report has been opened."}</p><button type="button" className="secondary small" onClick={() => layout.refreshViews()}>Retry Saved Templates</button></div>}
    {q.error && data && <p className="notice" role="alert">Showing the last available report. Refresh before exporting.</p>}
    {exportDone && <p role="status" className="notice">All matching report results exported.</p>}
    <ReportKpis summary={data?.summary} previous={data?.previous} compare={applied.compare} loading={isReportLoading} stale={stale} />
    <ReportTrendPanel points={data?.points} previousPoints={data?.previousPoints} compare={applied.compare} loading={isReportLoading} error={!!q.error || viewUnavailable} onRetry={() => void q.refetch()} preferences={preferences} />
    {data?.notes?.length ? <details className="muted" data-testid="report-notes"><summary>Report Definitions &amp; Data Coverage</summary><ul>{data.notes.map(n => <li key={n}>{n}</li>)}</ul></details> : null}
    <section aria-busy={stale} data-testid="report-results"><ListingRegion className="panel table-panel">
      <div className="rp-results-head"><h2>Report Results</h2><span className="rp-count" data-testid="text-report-count">{q.isLoading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "result" : "results"}`}</span></div>
      {isReportLoading ? <div className="skeleton">Loading report…</div> : data?.rows.length ? <div className="table-scroll"><table><thead><tr><th>#</th>{cols.visible.map(k => header[k]?.())}{cols.hidden.length > 0 && <th className="col-actions sticky"><span className="sr-only">Hidden columns</span></th>}<th>Actions</th></tr></thead>
        <tbody>{data.rows.map((r, i) => <Fragment key={r.id}><tr><td data-label="#">{(page - 1) * applied.pageSize + i + 1}</td>{cols.visible.map(k => <td key={k} data-label={cols.label(k)} className={cols.cls(k)}>{cell(k, r)}</td>)}{cols.hidden.length > 0 && <td className="col-actions sticky">{cols.toggle(r.id, r.label)}</td>}<td data-label="Actions">{rowActions(r)}</td></tr>{cols.expansion(r.id, cols.visible.length + 3, k => cell(k, r))}</Fragment>)}</tbody></table></div>
        : q.error ? null : <div className="empty" data-testid="report-empty"><p>No {applied.reportType === "all" ? "report results" : reportTypeLabel(applied.reportType).toLowerCase()} for this period and scope.</p><div className="rp-actions">{search && <button onClick={() => setSearch("")}>Clear Search</button>}{dirty && <button onClick={clearAll}>Clear All</button>}</div></div>}
      <Pagination state={isReportLoading?"loading":q.error||viewUnavailable?"error":"ready"} page={page} pageSize={applied.pageSize} total={total} onPageChange={setPage} onPageSizeChange={n => patch({ pageSize: n })} />
    </ListingRegion></section>
    <AppDialog open={!!detail} onClose={() => setDetail(null)} title={detail?.label || "Report details"} description={detail ? `${reportTypeLabel(detail.family)} · ${detail.clinic || "All clinics"} · ${formatDate(detail.date, preferences)}` : undefined}>
      {detail && <div data-testid="report-row-details"><dl className="rp-detail">{METRIC_LABELS.map(m => <Fragment key={m.key}><dt>{m.label}</dt><dd data-testid={`detail-${m.key}`}>{metricText(detail.metrics[m.key], m.unit)}</dd></Fragment>)}</dl>
        <div className="rp-actions"><button type="button" className="button small" disabled={!canExport} onClick={() => { if (canExport) downloadRow(detail); }} data-testid="button-report-row-csv"><Download size={15} aria-hidden /> Download Row CSV</button></div></div>}
    </AppDialog>
  </div>;
}
