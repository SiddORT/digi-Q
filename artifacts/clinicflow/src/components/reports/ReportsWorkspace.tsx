import { useLocation, useSearch } from "wouter";
import type { ReactNode } from "react";
import { CommunicationUsage } from "../CommunicationUsage";
import { WorkspaceBranchScopeGate } from "./scope";
import { ReportsDashboard } from "./ReportsDashboard";
import { ReportTemplates } from "./ReportTemplates";
import { useListingLayout } from "../../lib/listing-views";
import { REPORT_TABLE_RESOURCE, REPORT_VIEW_FILTER_KEYS } from "./report-model";
import { WorkspaceTabs } from "../WorkspaceTabs";

type Tab = "live" | "templates" | "operational" | "usage";
export function ReportsWorkspace({ userId, role, clinicIds, legacy }: { userId: string; role: string; clinicIds?: string[]; legacy: ReactNode }) {
  const canUsage = role === "superAdmin" || role === "clinicAdmin";
  const search = useSearch(); const [location, navigate] = useLocation();
  const qs = new URLSearchParams(search); const area = qs.get("area");
  const tab: Tab = area === "templates" ? "templates" : area === "operational" ? "operational" : area === "communication-usage" && canUsage ? "usage" : "live";
  const go = (next: Tab, extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (next === "templates") p.set("area", "templates"); else if (next === "operational") p.set("area", "operational"); else if (next === "usage") p.set("area", "communication-usage");
    Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
    navigate(`${location}${p.size ? `?${p}` : ""}`);
  };
  const tabs: import("../WorkspaceTabs").WorkspaceTab[] = [{ id: "live", label: "Live Reports", icon: "live" }, { id: "templates", label: "Report Templates", icon: "templates" }, { id: "operational", label: "Operational Detail", icon: "operational" }, ...(canUsage ? [{ id: "usage", label: "Communication Usage", icon: "usage" as const }] : [])];
  const reportType = qs.get("reportType") || "";
  const viewId = qs.get("view") || "";
  const layout = useListingLayout(REPORT_TABLE_RESOURCE, userId, role, REPORT_VIEW_FILTER_KEYS);
  return <><div className="report-tabs"><WorkspaceTabs tabs={tabs} area={tab} onSelect={next=>go(next as Tab)} label="Report sections" testIdPrefix="tab-report-"/></div>
    {tab === "live" ? <WorkspaceBranchScopeGate page="reports"><ReportsDashboard key={`${reportType}:${viewId}`} role={role} initialReportType={reportType} initialViewId={viewId} layout={layout} /></WorkspaceBranchScopeGate>
      : tab === "templates" ? <ReportTemplates canUsage={canUsage} onOpen={id => go("live", { reportType: id, group: id === "doctors" ? "doctor" : id === "clinicPerformance" ? "clinic" : "date" })} onOpenUsage={() => go("usage")} saved={layout.layout.views} onOpenSaved={id => go("live", { view: id })} onDeleteSaved={layout.deleteView} savedLoading={layout.viewsLoading} savedError={layout.viewsError} onRetry={() => { void layout.refreshViews(); }} />
      : tab === "operational" ? <WorkspaceBranchScopeGate page="reports">{legacy}</WorkspaceBranchScopeGate>
      : <CommunicationUsage key={`${userId}:${role}:${clinicIds?.join(",")}`} userId={userId} role={role} clinicScope={clinicIds?.join(",") || "unassigned"} />}</>;
}
