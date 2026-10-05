import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Link } from "wouter";

export type RowMenuItem = { key: string; label: string; onSelect?: () => void; href?: string; hint?: string; disabled?: boolean; danger?: boolean; testId?: string };

/** Secondary row actions rendered in a body portal so table scroll containers and sticky cells never clip the list. */
export function RowMenu({ label, items, testId }: { label: string; items: RowMenuItem[]; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const place = () => {
    const r = trigger.current?.getBoundingClientRect(); if (!r) return;
    const width = list.current?.offsetWidth || 190, height = list.current?.offsetHeight || 0;
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    const below = r.bottom + 4;
    const top = height && below + height > window.innerHeight - 8 ? Math.max(8, r.top - height - 4) : below;
    setPos({ top, left });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { const t = e.target as Node; if (!list.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const reflow = () => place();
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
    window.addEventListener("resize", reflow); window.addEventListener("scroll", reflow, true);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus());
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); window.removeEventListener("resize", reflow); window.removeEventListener("scroll", reflow, true); };
  }, [open]);
  const safe = items.filter(i => !i.danger), danger = items.filter(i => i.danger);
  const render = (i: RowMenuItem) => i.href && !i.disabled
    ? <Link key={i.key} role="menuitem" href={i.href} title={i.hint} data-testid={i.testId} onClick={() => setOpen(false)}>{i.label}</Link>
    : <button key={i.key} type="button" role="menuitem" title={i.hint} className={i.danger ? "danger" : undefined} disabled={i.disabled} data-testid={i.testId} onClick={() => { setOpen(false); i.onSelect?.(); }}>{i.label}</button>;
  const arrows = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return; e.preventDefault();
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    const idx = all.indexOf(document.activeElement as HTMLElement);
    all[e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (idx + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
  };
  return <>
    <button ref={trigger} type="button" className="row-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} data-testid={testId} onClick={() => setOpen(v => !v)}><MoreHorizontal aria-hidden size={16} /><span>More</span></button>
    {open && createPortal(<div ref={list} className="row-menu-list row-menu-portal" role="menu" aria-label={label} onKeyDown={arrows} style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
      {safe.map(render)}{safe.length > 0 && danger.length > 0 && <hr className="row-menu-sep" />}{danger.map(render)}
    </div>, document.body)}
  </>;
}
