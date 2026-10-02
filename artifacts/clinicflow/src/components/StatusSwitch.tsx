import type { ReactNode } from "react";

/** Shared binary active/inactive status editor. Not for filters (use status tabs) or consent/selection (use checkboxes). */
export function StatusSwitch({ active, onChange, label, disabled, busy, title, testId, children }: {
  active: boolean; onChange: (active: boolean) => void; label: string; disabled?: boolean; busy?: boolean; title?: string; testId?: string; children?: ReactNode;
}) {
  return <label className="check-label status-switch staff-status-switch" title={title}>
    <input type="checkbox" role="switch" aria-label={label} aria-checked={active} checked={active} disabled={disabled || busy}
      data-testid={testId} onChange={event => onChange(event.target.checked)} />
    <span className="status-switch-track" aria-hidden="true" />
    {children ?? (busy ? "Saving…" : active ? "Active" : "Inactive")}
  </label>;
}
