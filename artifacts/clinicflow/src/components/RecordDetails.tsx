import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppDialog } from "./AppDialog";

export type RecordFact = [label: string, value: ReactNode];

/** Shared, grouped read-only facts for any record (listing expansion and exact-record drawer). */
export function RecordFacts({ facts, testId }: { facts: RecordFact[]; testId?: string }) {
  if (!facts.length) return <p className="muted">No further details recorded.</p>;
  return <dl className="record-facts" data-testid={testId}>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}</dl>;
}

/** Fetch one record by id through its permission-checked endpoint. Errors (403/404/network) are shown, never masked. */
export function useExactRecord<T>(key: unknown[], id: string, load: ((signal: AbortSignal) => Promise<T>) | null) {
  return useQuery<T>({ queryKey: ["exact-record", ...key, id], queryFn: ({ signal }) => load!(signal), enabled: !!id && !!load, retry: false, staleTime: 15000 });
}

/** Drawer for an exact record opened by link (e.g. from workspace search), whether or not it is on the current page. */
export function ExactRecordDrawer<T>({ title, query, onClose, children, actions }: {
  title: string;
  query: { data?: T; error: unknown; isLoading: boolean; refetch: () => unknown };
  onClose: () => void;
  children: (record: T) => ReactNode;
  actions?: (record: T) => ReactNode;
}) {
  const message = query.error instanceof Error ? query.error.message : query.error ? "This record could not be loaded." : "";
  return <AppDialog open variant="drawer" onClose={onClose} title={title}>
    <div className="exact-record" data-testid="drawer-exact-record">
      {query.isLoading ? <div className="appt-detail-skeleton" role="status" aria-label="Loading record"><span/><span/><span/></div>
        : message ? <div role="alert" className="error-box" data-testid="exact-record-error"><p>{message}</p><p className="muted">You may not have access to this record, or it no longer exists.</p><button type="button" className="button secondary" onClick={() => void query.refetch()}>Retry</button></div>
        : query.data ? <>{children(query.data)}{actions && <div className="exact-record-actions">{actions(query.data)}</div>}</> : null}
    </div>
  </AppDialog>;
}

/** Scoped, paginated scan for records that have no single-record endpoint. Walks the permitted, already-scoped list
 *  page by page until the id is found or the list ends; abortable; never silently stops at an arbitrary cap. */
export async function scanScopedPages<T extends { id: string }>(id: string, fetchPage: (page: number, signal: AbortSignal) => Promise<{ items: T[]; total: number }>, signal: AbortSignal, notFound: string, pageSize = 100): Promise<T> {
  for (let page = 1; ; page++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const result = await fetchPage(page, signal);
    const hit = result.items.find(item => item.id === id);
    if (hit) return hit;
    if (!result.items.length || page * pageSize >= result.total) throw new Error(notFound);
  }
}
