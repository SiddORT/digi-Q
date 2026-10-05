import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Lock, PlugZap, RotateCw } from "lucide-react";
import { SkeletonRows } from "./EmptyState";
import "./workspace-surfaces.css";

/**
 * Capability states for UI surfaces whose data may or may not exist in this app.
 * "unavailable" means the backend has no API for it: the UI must say so instead of
 * pretending the list is empty. No mock data is ever produced from this type.
 */
export type Capability<T> =
  | { state: "loading" }
  | { state: "loaded"; data: T }
  | { state: "empty"; message?: string }
  | { state: "error"; message: string; onRetry?: () => void }
  | { state: "forbidden"; reason: string }
  | { state: "unavailable"; reason: string };

export const unavailable = (reason: string): Capability<never> => ({ state: "unavailable", reason });

/** Maps a React Query style result to a Capability without inventing data. */
export function fromQuery<T>(q: { isLoading: boolean; error: unknown; data: T | undefined; refetch?: () => unknown }, opts: { isEmpty: (d: T) => boolean; emptyMessage?: string; errorMessage: string; forbiddenReason?: string }): Capability<T> {
  if (q.isLoading) return { state: "loading" };
  if (q.error) {
    const status = (q.error as { status?: number })?.status;
    if ((status === 401 || status === 403) && opts.forbiddenReason) return { state: "forbidden", reason: opts.forbiddenReason };
    return { state: "error", message: opts.errorMessage, onRetry: q.refetch ? () => void q.refetch!() : undefined };
  }
  if (q.data === undefined || opts.isEmpty(q.data)) return { state: "empty", message: opts.emptyMessage };
  return { state: "loaded", data: q.data };
}

export function CapabilityView<T>({ value, title, children, testId, loadingLabel = "Loading" }: { value: Capability<T>; title: string; children: (data: T) => ReactNode; testId?: string; loadingLabel?: string }) {
  const box = (kind: string, icon: ReactNode, heading: string, body: ReactNode, action?: ReactNode) =>
    <div className={`cap-state cap-${kind}`} role={kind === "error" ? "alert" : "status"} data-testid={testId ? `${testId}-${kind}` : undefined} data-capability={kind}>
      <span className="cap-icon" aria-hidden>{icon}</span>
      <div><strong>{heading}</strong><p>{body}</p>{action}</div>
    </div>;
  switch (value.state) {
    case "loading": return <SkeletonRows rows={3} label={loadingLabel} />;
    case "loaded": return <>{children(value.data)}</>;
    case "empty": return box("empty", <Inbox size={18} />, `No ${title} Yet`, value.message || "Nothing has been recorded here yet.");
    case "error": return box("error", <AlertTriangle size={18} />, `${title} Could Not Load`, value.message,
      value.onRetry && <button type="button" className="button secondary small" onClick={value.onRetry}><RotateCw size={15} aria-hidden />Retry</button>);
    case "forbidden": return box("forbidden", <Lock size={18} />, "Not Available for Your Role", value.reason);
    case "unavailable": return box("unavailable", <PlugZap size={18} />, `${title} Not Connected`, value.reason);
  }
}

/** A disabled action that always shows why it is disabled (visible text, not only a tooltip). */
export function UnavailableAction({ icon, label, reason, testId }: { icon?: ReactNode; label: string; reason: string; testId?: string }) {
  return <button type="button" className="button secondary small cap-disabled-action" disabled aria-disabled="true" title={reason} aria-description={reason} data-testid={testId}>{icon}<span className="ov-text">{label}</span></button>;
}
