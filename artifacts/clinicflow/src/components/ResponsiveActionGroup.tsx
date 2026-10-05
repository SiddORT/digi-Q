import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import "./responsive-action-group.css";

/**
 * Toolbar actions that never wrap to a second row.
 * - `children` (primary, e.g. Add / Book) stay visible at every width.
 * - `secondary` (Export, Columns, Saved Views, Recovery…) shows inline on wide desktops (1280px+).
 *   Below 1280px it collapses behind a "More" disclosure panel, including on phones.
 * The secondary nodes are mounted exactly once and never moved or portalled, so their state
 * (exports in progress, open dialogs, form values) survives width changes and closing the panel.
 * The panel is a plain disclosure group, not role="menu", so it can hold real buttons, links and
 * controls that open their own AppDialog.
 */
export function ResponsiveActionGroup({ children, secondary, label = "More Actions", className }: { children?: ReactNode; secondary?: ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Ignore clicks inside the group and inside dialogs or popovers opened from it.
      if (!target || root.current?.contains(target) || target.closest("[role=dialog],[role=alertdialog],[data-radix-popper-content-wrapper]")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog],[role=alertdialog]")) return;
      setOpen(false); toggle.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const hasSecondary = secondary != null && secondary !== false;
  return <div ref={root} className={`rag${className ? ` ${className}` : ""}`} data-open={open ? "true" : "false"} data-testid="responsive-action-group">
    {hasSecondary && <>
      <button ref={toggle} type="button" className="button secondary rag-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)} data-testid="button-more-actions">
        More <ChevronDown size={15} aria-hidden />
      </button>
      <div id={panelId} className="rag-secondary" role="group" aria-label={label} data-testid="more-actions-panel">{secondary}</div>
    </>}
    {children}
  </div>;
}
