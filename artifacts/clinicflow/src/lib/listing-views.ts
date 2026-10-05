import { usePreference } from "./workspace-preferences";

/** Keys that may never be stored in a saved view (patient-identifying search terms, paging). */
export const UNSAFE_VIEW_KEYS = ["search", "q", "page"] as const;

/** IDs, enum statuses, ISO dates, sort keys and numbers only. No spaces, so names/phones/notes cannot be stored. */
export const SAFE_VALUE = /^[A-Za-z0-9_\-:.,]+$/;

export type ViewColumns = { order: string[]; hidden: string[]; pinned: string | null };
/** `columns` is optional so views saved before column snapshots existed still load. */
export type SavedView = { id: string; name: string; filters: Record<string, string>; columns?: ViewColumns };
export type ListingLayout = { order: string[]; hidden: string[]; pinned: string | null; views: SavedView[] };

const EMPTY: ListingLayout = { order: [], hidden: [], pinned: null, views: [] };
const str = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 40) : [];

export function sanitizeViewFilters(filters: Record<string, unknown>, allowed: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of allowed) {
    if ((UNSAFE_VIEW_KEYS as readonly string[]).includes(key)) continue;
    const value = filters[key];
    // Allowlisted keys only, and only identifier/status/date-shaped values: free text (possible PHI) is rejected.
    if (typeof value === "string" && value && value.length <= 80 && SAFE_VALUE.test(value)) out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = String(value);
  }
  return out;
}

const sanitize = (allowed: readonly string[]) => (value: unknown): ListingLayout => {
  const v = (value || {}) as Record<string, unknown>;
  const views = Array.isArray(v.views) ? v.views.flatMap((item: any) => item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim()
    ? [{ id: item.id.slice(0, 40), name: item.name.slice(0, 60), filters: sanitizeViewFilters(item.filters || {}, allowed), ...(item.columns && typeof item.columns === "object" ? { columns: { order: str(item.columns.order), hidden: str(item.columns.hidden), pinned: typeof item.columns.pinned === "string" ? item.columns.pinned : null } } : {}) }] : []).slice(0, 12) : [];
  return { order: str(v.order), hidden: str(v.hidden), pinned: typeof v.pinned === "string" ? v.pinned : null, views };
};

/** Apply the stored order/visibility to the currently permitted columns. The first column is always visible. */
export function arrangeColumns(columns: string[], layout: ListingLayout) {
  const known = layout.order.filter(c => columns.includes(c));
  const ordered = [...known, ...columns.filter(c => !known.includes(c))];
  const required = columns[0];
  const visible = ordered.filter(c => c === required || !layout.hidden.includes(c));
  const pinned = layout.pinned && visible.includes(layout.pinned) ? layout.pinned : null;
  return { ordered, visible: pinned ? [pinned, ...visible.filter(c => c !== pinned)] : visible, hidden: ordered.filter(c => !visible.includes(c)), pinned, required };
}

export function useListingLayout(resource: string, userId: string | undefined, role: string | undefined, allowedFilterKeys: readonly string[]) {
  const key = `digiq-listing:${userId || "anon"}:${role || "none"}:${resource}`;
  const [layout, set] = usePreference(key, EMPTY, sanitize(allowedFilterKeys));
  return {
    layout,
    setLayout: (next: Partial<ListingLayout>) => set({ ...layout, ...next }),
    saveView: (name: string, filters: Record<string, unknown>, columns?: ViewColumns) => {
      const view: SavedView = { id: `v${Date.now().toString(36)}`, name: name.trim().slice(0, 60), filters: sanitizeViewFilters(filters, allowedFilterKeys), columns: columns ?? { order: layout.order, hidden: layout.hidden, pinned: layout.pinned } };
      return set({ ...layout, views: [...layout.views.filter(v => v.name !== view.name), view].slice(-12) });
    },
    /** Restore a view's column snapshot, limited to columns currently permitted. Old views without a snapshot keep the current layout. */
    applyViewColumns: (view: SavedView, permitted: string[]) => {
      if (!view.columns) return;
      const keep = (list: string[]) => list.filter(c => permitted.includes(c));
      set({ ...layout, order: keep(view.columns.order), hidden: keep(view.columns.hidden).filter(c => c !== permitted[0]), pinned: view.columns.pinned && permitted.includes(view.columns.pinned) ? view.columns.pinned : null });
    },
    deleteView: (id: string) => set({ ...layout, views: layout.views.filter(v => v.id !== id) }),
    resetColumns: () => set({ ...layout, order: [], hidden: [], pinned: null }),
  };
}
