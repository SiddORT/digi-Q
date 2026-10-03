import { useState } from "react";
import { AppDialog } from "./AppDialog";

type Names = string[] | string | null | undefined;
const list = (v: Names) => (Array.isArray(v) ? v : v ? String(v).split(",").map(s => s.trim()) : []).filter(Boolean);

/** Concise assignment count; the full names open in an accessible dialog (keyboard, tap and screen reader friendly). */
export function AssignmentSummary({ owner, groups, groupLabel = "Clinic Group", clinics, clinicLabel = "clinic", testId }: {
  owner: string; groups?: Names; groupLabel?: string; clinics?: Names; clinicLabel?: string; testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const g = list(groups), c = list(clinics);
  if (!g.length && !c.length) return <span className="muted">None</span>;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const single = g.length + c.length === 1 ? (g[0] || c[0]) : "";
  const text = single || [g.length ? plural(g.length, groupLabel) : "", c.length ? plural(c.length, clinicLabel) : ""].filter(Boolean).join(" · ");
  return <>
    <button type="button" className="assignment-summary" aria-haspopup="dialog" aria-label={`${text}. Show assignments for ${owner}`} onClick={() => setOpen(true)} data-testid={testId}>{text}</button>
    {open && <AppDialog open onClose={() => setOpen(false)} title={`Assignments · ${owner}`} variant="drawer">
      {g.length > 0 && <section className="assignment-list"><h3>{groupLabel}s</h3><ul>{g.map(n => <li key={n}>{n}</li>)}</ul></section>}
      {c.length > 0 && <section className="assignment-list"><h3>{clinicLabel[0].toUpperCase() + clinicLabel.slice(1)}s</h3><ul>{c.map(n => <li key={n}>{n}</li>)}</ul></section>}
    </AppDialog>}
  </>;
}
