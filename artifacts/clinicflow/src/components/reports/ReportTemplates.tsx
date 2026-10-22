import { FileText, MessageSquare, Trash2 } from "lucide-react";
import type { SavedView } from "../../lib/listing-views";
import { REPORT_TYPES, describeFilters } from "./report-model";
import "./reports.css";

/** Entry points to each report family, saved custom configurations (the same Views saved in Live Reports) and Communication Usage. */
export function ReportTemplates({ onOpen, onOpenUsage, canUsage, saved, onOpenSaved, onDeleteSaved, savedLoading, savedError, onRetry }: { onOpen: (id: string) => void; onOpenUsage: () => void; canUsage: boolean; saved: SavedView[]; onOpenSaved: (id: string) => void; onDeleteSaved: (id: string) => void; savedLoading?: boolean; savedError?: boolean; onRetry?: () => void }) {
  return <section aria-label="Report templates" data-testid="report-templates">
    <div className="page-heading"><div><h1>Report Templates</h1><p>Open a live report or reuse a saved configuration.</p></div></div>
    <p className="muted">Each template opens Live Reports with that report family applied. Results always reflect your current access.</p>
    <h2 style={{ fontSize: 16, margin: "12px 0 0" }}>Saved Custom Configurations</h2>
    {savedLoading ? <p role="status" className="skeleton">Loading saved configurations…</p> : savedError ? <div role="alert"><p>Saved configurations could not be loaded.</p><button type="button" className="button secondary small" onClick={onRetry}>Retry Saved Templates</button></div> : saved.length ? <div className="panel" data-testid="saved-configurations">{saved.map(v => <div key={v.id} className="rp-saved" data-testid={`saved-config-${v.id}`}><div><strong>{v.name}</strong><div className="muted">{describeFilters(v.filters)}{v.shared ? " · Shared" : ""}</div></div>
      <div className="rp-actions"><button type="button" className="button secondary small" onClick={() => onOpenSaved(v.id)} data-testid={`button-open-config-${v.id}`}>Open</button>{v.ownedByMe !== false && <button type="button" className="button secondary small" onClick={() => onDeleteSaved(v.id)} aria-label={`Delete ${v.name}`} data-testid={`button-delete-config-${v.id}`}><Trash2 size={14} aria-hidden /></button>}</div></div>)}</div>
      : <p className="muted" data-testid="text-no-saved-configurations">No saved configurations yet. Set filters in Live Reports and save them from Views. Relative periods such as 7 Days are re-evaluated each time you open them.</p>}
    <h2 style={{ fontSize: 16, margin: "16px 0 0" }}>Report Families</h2>
    <div className="rp-templates">
      {REPORT_TYPES.map(t => <article key={t.id} className="panel rp-template" data-testid={`template-${t.id}`}><FileText size={18} aria-hidden /><h3>{t.label}</h3><p>{t.description}</p><button type="button" className="button secondary small" onClick={() => onOpen(t.id)} data-testid={`button-template-${t.id}`}>Open Report</button></article>)}
      <article className="panel rp-template" data-testid="template-communication"><MessageSquare size={18} aria-hidden /><h3>Communication Usage</h3><p>Observed email and SMS activity; acceptance does not prove delivery or billing. Separate from clinical reports.</p>{canUsage ? <button type="button" className="button secondary small" onClick={onOpenUsage} data-testid="button-template-communication">Open Report</button> : <p>Available to Super Admins and Clinic Admins.</p>}</article>
    </div>
  </section>;
}
