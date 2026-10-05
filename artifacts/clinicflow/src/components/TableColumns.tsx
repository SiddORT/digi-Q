import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { usePreference, readPreference, writePreference } from "@/lib/workspace-preferences";
import { arrangeColumns, type ListingLayout, type ViewColumns } from "@/lib/listing-views";
import { ColumnSettings } from "./ListingViewControls";

export type ColumnDef = { key: string; label: string };
type Stored = ListingLayout & { touched: boolean };
const EMPTY: Stored = { order: [], hidden: [], pinned: null, views: [], touched: false };
const strs = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : [];
const sanitize = (value: unknown): Stored => {
  if (!value || typeof value !== "object") return EMPTY;
  const v = value as Record<string, unknown>;
  return { order: strs(v.order), hidden: strs(v.hidden), pinned: typeof v.pinned === "string" ? v.pinned : null, views: [], touched: true };
};

/** Shared column preferences for bespoke tables (column layout only; never row data or order of records).
 *  `reorderable:false` keeps the operational column order fixed (e.g. live queue) while allowing visibility.
 *  A single pinned column is supported deliberately: it is always rendered first with left:0, so sticky
 *  offsets can never overlap. Actions are never part of the configurable set and stay sticky on the right. */
export function useTableColumns(tableId: string, userId: string | undefined, role: string | undefined, columns: ColumnDef[], options: { reorderable?: boolean; pinnable?: boolean; defaultHidden?: string[] } = {}) {
  const { reorderable = true, pinnable = true, defaultHidden = [] } = options;
  const [layout, set] = usePreference(columnsKey(tableId, userId, role), EMPTY, sanitize);
  const effective: ListingLayout = { ...layout, hidden: layout.touched ? layout.hidden : defaultHidden, order: reorderable ? layout.order : [], pinned: pinnable ? layout.pinned : null };
  const keys = columns.map(c => c.key);
  const arranged = arrangeColumns(keys, effective);
  const label = (k: string) => columns.find(c => c.key === k)?.label || k;
  const [expanded, setExpanded] = useState<string | null>(null);
  const settings = <ColumnSettings columns={keys} layout={effective} label={label} reorderable={reorderable} pinnable={pinnable}
    onChange={next => set({ ...effective, ...next, touched: true })} onReset={() => set(EMPTY)} />;
  const cls = (key: string, base?: string) => [`col-${key}`, base, key === arranged.pinned ? "col-pinned" : ""].filter(Boolean).join(" ") || undefined;
  const toggle = (rowId: string, name: string) => arranged.hidden.length ? <button type="button" className="row-expand-toggle" aria-expanded={expanded === rowId} aria-controls={`expand-${tableId}-${rowId}`}
    aria-label={`${expanded === rowId ? "Hide" : "Show"} hidden columns for ${name}`} onClick={() => setExpanded(expanded === rowId ? null : rowId)} data-testid={`button-expand-${tableId}-${rowId}`}><ChevronRight size={14} aria-hidden /></button> : null;
  /** Expansion row lists hidden data columns only; row actions are never duplicated here. */
  const expansion = (rowId: string, colSpan: number, render: (key: string) => ReactNode) => expanded === rowId && arranged.hidden.length
    ? <tr className="row-expansion" id={`expand-${tableId}-${rowId}`}><td colSpan={colSpan}><dl>{arranged.hidden.map(k => <div key={k}><dt>{label(k)}</dt><dd>{render(k)}</dd></div>)}</dl></td></tr> : null;
  return { visible: arranged.visible, hidden: arranged.hidden, pinned: arranged.pinned, settings, cls, toggle, expansion, label };
}

const columnsKey = (tableId: string, userId?: string, role?: string) => `digiq-columns:${userId || "anon"}:${role || "none"}:${tableId}`;
/** Snapshot/restore used by saved views on bespoke tables. Restored keys are re-checked against permitted columns at render. */
export function readTableColumns(tableId: string, userId?: string, role?: string): ViewColumns | undefined {
  const v = readPreference(columnsKey(tableId, userId, role), EMPTY, sanitize);
  return v.touched ? { order: v.order, hidden: v.hidden, pinned: v.pinned } : undefined;
}
export function writeTableColumns(tableId: string, userId: string | undefined, role: string | undefined, columns: ViewColumns | undefined) {
  if (!columns) return;
  writePreference(columnsKey(tableId, userId, role), { ...columns, touched: true });
}
