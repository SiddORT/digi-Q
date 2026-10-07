import { useId, type ReactNode } from "react";

/**
 * Shared titled form group (same visual rules as grouped Editor sections): card, compact heading,
 * optional one-line hint, inner field grid. Not numbered — numbering is reserved for the patient
 * editor that mirrors the approved reference.
 */
export function FormSection({ title, hint, children, className, grid = true, actions, testId }: { title: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; grid?: boolean; actions?: ReactNode; testId?: string }) {
  const id = useId();
  return <section className={["form-section", "wide", className].filter(Boolean).join(" ")} aria-labelledby={id} data-testid={testId}>
    <header className="form-section-head"><h3 id={id}>{title}</h3>{hint && <p className="form-section-hint">{hint}</p>}{actions && <div className="form-section-actions">{actions}</div>}</header>
    {grid ? <div className="form-section-grid">{children}</div> : children}
  </section>;
}

/** Collapsible variant: content stays mounted when closed so values are never lost. */
export function FormDisclosure({ title, summary, children, defaultOpen = false, testId }: { title: ReactNode; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  return <details className="form-section form-disclosure wide" open={defaultOpen} data-testid={testId}>
    <summary className="form-section-head"><h3>{title}</h3>{summary && <span className="form-section-hint">{summary}</span>}</summary>
    <div className="form-section-body">{children}</div>
  </details>;
}
