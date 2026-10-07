import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Link } from "wouter";
import { HelpTip, dismissTooltips } from "./HelpTip";
import { computeMenuPosition, type MenuPosition } from "./row-menu-position";

export type RowMenuItem = { key: string; label: string; onSelect?: () => void; href?: string; hint?: string; disabled?: boolean; danger?: boolean; testId?: string };


/** Secondary row actions in a portal so table scroll containers and sticky cells never clip the list.
 *  - Portals into the enclosing dialog when the trigger lives inside one (keeps modal focus trap/pointer events working).
 *  - Flips above when there is no room below, clamps horizontally, scrolls internally when taller than the viewport.
 *  - Tracks scroll/resize of every ancestor; closes if the trigger scrolls out of view.
 *  - Escape closes and restores focus to the trigger; arrow/Home/End move between items; Tab closes.
 *  - Renders nothing when there are no items (no empty menus). */
export function RowMenu({ label, items, testId, trigger: triggerContent }: { label: string; items: RowMenuItem[]; testId?: string; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPosition | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const t = trigger.current, l = list.current; if (!t) return;
    const r = t.getBoundingClientRect();
    const h = host && host !== document.body ? { rect: host.getBoundingClientRect(), clientTop: host.clientTop, clientLeft: host.clientLeft, clientWidth: host.clientWidth, clientHeight: host.clientHeight, scrollTop: host.scrollTop, scrollLeft: host.scrollLeft } : null;
    const next = computeMenuPosition(r, { width: l?.offsetWidth || 200, height: l?.scrollHeight || 0 }, document.documentElement.clientWidth, window.innerHeight, h);
    if (!next) { setOpen(false); return; }
    setPos(next);
  }, [host]);

  const close = (focus: boolean) => { setOpen(false); setPos(null); if (focus) trigger.current?.focus(); };

  useLayoutEffect(() => { if (open) { place(); requestAnimationFrame(place); } }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { const t = e.target as Node; if (!list.current?.contains(t) && !trigger.current?.contains(t)) close(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); } };
    const reflow = () => place();
    document.addEventListener("pointerdown", outside, true); window.addEventListener("keydown", key, true);
    window.addEventListener("resize", reflow); window.addEventListener("scroll", reflow, true);
    const raf = requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(raf); document.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key, true); window.removeEventListener("resize", reflow); window.removeEventListener("scroll", reflow, true); };
  }, [open, place]);

  if (!items.length) return null;
  const safe = items.filter(i => !i.danger), danger = items.filter(i => i.danger);
  const render = (i: RowMenuItem) => i.href && !i.disabled
    ? <Link key={i.key} role="menuitem" href={i.href} title={i.hint} data-testid={i.testId} onClick={() => close(false)}>{i.label}</Link>
    : <button key={i.key} type="button" role="menuitem" title={i.hint} className={i.danger ? "danger" : undefined} disabled={i.disabled} data-testid={i.testId} onClick={() => { close(true); i.onSelect?.(); }}>{i.label}</button>;
  const keys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") { close(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return; e.preventDefault();
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    const idx = all.indexOf(document.activeElement as HTMLElement);
    all[e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (idx + (e.key === "ArrowDown" ? 1 : all.length - 1)) % all.length]?.focus();
  };
  const toggle = () => {
    if (open) { close(false); return; }
    setHost(trigger.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body);
    setOpen(true); dismissTooltips();
  };
  return <>
    {triggerContent ? <button ref={trigger} type="button" className="row-menu-trigger text-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} data-testid={testId} onClick={toggle}>{triggerContent}</button> : <HelpTip text="More Actions"><button ref={trigger} type="button" className="row-menu-trigger icon-action" aria-haspopup="menu" aria-expanded={open} aria-label={label} data-testid={testId} onClick={toggle}><MoreHorizontal aria-hidden size={16} /></button></HelpTip>}
    {open && host && createPortal(<div ref={list} className="row-menu-list row-menu-portal" role="menu" aria-label={label} data-placement={pos?.placement} onKeyDown={keys}
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxHeight, maxWidth: pos?.maxWidth, minWidth: pos ? Math.min(190, pos.maxWidth) : undefined, visibility: pos ? "visible" : "hidden" }}>
      {safe.map(render)}{safe.length > 0 && danger.length > 0 && <hr className="row-menu-sep" />}{danger.map(render)}
    </div>, host)}
  </>;
}
