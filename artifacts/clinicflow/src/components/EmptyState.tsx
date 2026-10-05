import { titleCase } from "@/lib/title-case";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCw, SearchX } from "lucide-react";
import { friendlyError, type ErrorContext } from "@/lib/friendly-error";
import "./shared-feedback.css";

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "empty" | "no-results";
}

/** Composed empty / no-results state with an optional next action (spec §7.10). */
export function EmptyState({ title, description, icon, action, variant = "empty" }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon" aria-hidden="true">{icon ?? (variant === "no-results" ? <SearchX className="h-5 w-5" /> : <Inbox className="h-5 w-5" />)}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-state-actions">{action}</div>}
    </div>
  );
}

/** "No matching {items}" with Clear search (spec §6B). */
export function NoResults({ items, onClear }: { items: string; onClear?: () => void }) {
  return <EmptyState variant="no-results" title={titleCase(`No matching ${items}`)}
    action={onClear && <button type="button" className="button secondary small" onClick={onClear}>Clear Search</button>} />;
}

/** Friendly error with Retry; never shows raw HTTP text. */
export function ErrorState({ error, context = "load", onRetry, title = "Something Went Wrong" }: { error: unknown; context?: ErrorContext; onRetry?: () => void; title?: string }) {
  return (
    <div className="empty-state error-state" role="alert">
      <span className="empty-state-icon" aria-hidden="true"><AlertTriangle className="h-5 w-5" /></span>
      <h3>{title}</h3>
      <p>{friendlyError(error, context)}</p>
      {onRetry && <div className="empty-state-actions"><button type="button" className="button secondary small" onClick={onRetry}><RotateCw className="h-4 w-4" aria-hidden="true" />Retry</button></div>}
    </div>
  );
}

/** Skeleton rows for first load of tables/lists. */
export function SkeletonRows({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-rows" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" aria-hidden="true">
          <span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
