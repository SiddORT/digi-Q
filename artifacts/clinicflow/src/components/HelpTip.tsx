import {
  cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import "./help-tip.css";
import { DISMISS_TOOLTIPS, dismissTooltips } from "./tooltip-dismiss";
export { DISMISS_TOOLTIPS, dismissTooltips } from "./tooltip-dismiss";

export interface HelpTipProps { text: string; children?: ReactNode; icon?: ReactNode; label?: string }

type ChildProps = {
  disabled?: boolean;
  "aria-disabled"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  onPointerEnter?: (e: ReactPointerEvent) => void;
  onPointerLeave?: (e: ReactPointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
};

/** Tooltip rendered in a body portal, positioned against the anchor with flip + viewport clamp. */
function Bubble({ anchor, text, id, onEnter, onLeave, onUnavailable }: { anchor: RefObject<HTMLSpanElement | null>; text: string; id?: string; onEnter: () => void; onLeave: () => void; onUnavailable: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current, b = ref.current;
      if (!a || !b) return;
      const r = a.getBoundingClientRect(), m = 8, gap = 6;
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      // Opt-in only: booking help must stay below its tabs and inside the visible
      // listing viewport, not above sticky headings or over a neighbouring row.
      const boundary = a.closest("[data-tooltip-boundary]");
      if (boundary) {
        const region = boundary.getBoundingClientRect();
        let left = Math.max(m, region.left), right = Math.min(vw - m, region.right);
        let top = Math.max(m, region.top), bottom = Math.min(vh - m, region.bottom);
        for (let parent = a.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
          if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
            left = Math.max(left, rect.left + parent.clientLeft);
            right = Math.min(right, rect.left + parent.clientLeft + parent.clientWidth);
          }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            top = Math.max(top, rect.top + parent.clientTop);
            bottom = Math.min(bottom, rect.top + parent.clientTop + parent.clientHeight);
          }
        }
        const table = a.closest(".appt-table");
        for (const head of table?.querySelectorAll(":scope >table>thead>tr>th") || []) {
          const rect = head.getBoundingClientRect();
          if (getComputedStyle(head).position === "sticky" && rect.bottom > top && rect.top < bottom) top = rect.bottom;
        }
        if (right - left < 40 || r.left < left - 1 || r.right > right + 1 || r.top < top || r.bottom > bottom) {
          onUnavailable(); return;
        }
        b.style.maxWidth = `${Math.min(280, right - left)}px`;
        const w = b.offsetWidth, h = b.offsetHeight;
        const y = r.top - h - gap >= top ? r.top - h - gap : r.bottom + gap;
        if (y + h > bottom) { onUnavailable(); return; }
        setPos({ top: y, left: Math.max(left, Math.min(right - w, r.left + r.width / 2 - w / 2)) });
        return;
      }
      const w = b.offsetWidth, h = b.offsetHeight;
      let top = r.top - h - gap;
      if (top < m) top = r.bottom + gap <= vh - h - m ? r.bottom + gap : Math.max(m, Math.min(vh - h - m, r.bottom + gap));
      const left = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, text]);
  return createPortal(
    <span ref={ref} role="tooltip" id={id} aria-hidden="true" className="helptip-bubble" data-measuring={pos ? undefined : ""}
      onPointerEnter={onEnter} onPointerLeave={onLeave}
      style={pos ? { transform: `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)` } : undefined}>{text}</span>,
    document.body,
  );
}

/**
 * Accessible help tooltip.
 * - No children: renders an information icon button (tap toggles/pins).
 * - One element child (button/link): child is used AS the trigger (no nesting). Hover/focus
 *   shows help; touch press shows it briefly; the child's own click/navigation is untouched.
 * - Disabled child: wrapped in a focusable span so help remains reachable.
 * Escape and outside tap dismiss.
 */
export function HelpTip({ text, children, icon, label }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const leaveTimer = useRef<number | undefined>(undefined);

  const cancelLeave = () => window.clearTimeout(leaveTimer.current);
  const close = () => { cancelLeave(); window.clearTimeout(timer.current); setOpen(false); setPinned(false); };
  const show = () => { cancelLeave(); dismissTooltips(); setOpen(true); };
  const leave = () => { cancelLeave(); if (!pinned) leaveTimer.current = window.setTimeout(() => setOpen(false), 180); };
  // Menus and popovers broadcast this so a trigger's tooltip never overlaps the opened menu.
  useEffect(() => { const dismiss = () => { window.clearTimeout(leaveTimer.current); window.clearTimeout(timer.current); setOpen(false); setPinned(false); }; window.addEventListener(DISMISS_TOOLTIPS, dismiss); return () => window.removeEventListener(DISMISS_TOOLTIPS, dismiss); }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const down = (e: PointerEvent) => { if (e.target instanceof Element && e.target.closest(".helptip-bubble")) return; if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    window.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down);
    // Bounded help is dismissed by any scrolling (including horizontal listing
    // scrolling). Its always-present accessible description remains available.
    const bounded = !!ref.current?.closest("[data-tooltip-boundary]");
    if (bounded) window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", down);
      if (bounded) window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(leaveTimer.current); }, []);

  const bubble = open ? <Bubble anchor={ref} text={text} onEnter={cancelLeave} onLeave={leave} onUnavailable={close} /> : null;
  // Touch browsers may emit compatibility mouseenter after an outside tap. Only
  // real hover pointers may reopen help; keyboard focus and tap toggling stay separate.
  const hoverProps = {
    onPointerEnter: (e: ReactPointerEvent) => { if (e.pointerType !== "touch") show(); },
    onPointerLeave: (e: ReactPointerEvent) => { if (e.pointerType !== "touch") leave(); },
  };

  if (isValidElement(children)) {
    const child = children as ReactElement<ChildProps>;
    const p = child.props;
    const disabled = !!p.disabled || p["aria-disabled"] === true || p["aria-disabled"] === "true";
    const describedBy = [p["aria-describedby"], id].filter(Boolean).join(" ");

    if (disabled) {
      // Disabled controls can't receive focus/hover; a focusable wrapper carries the help.
      return <span className="helptip helptip-disabled" ref={ref} {...hoverProps}>
        <span tabIndex={0} className="helptip-focus" aria-describedby={id} aria-label={text}
          onFocus={show} onBlur={close}
          onClick={() => { const n = !pinned; dismissTooltips(); setPinned(n); setOpen(n); }} data-testid="helptip-disabled-wrapper">
          {child}
        </span>
        <span id={id} className="sr-only-helptip">{text}</span>
        {bubble}
      </span>;
    }

    const trigger = cloneElement(child, {
      "aria-describedby": describedBy,
      onPointerEnter: (e: ReactPointerEvent) => { p.onPointerEnter?.(e); if (e.pointerType !== "touch") show(); },
      onPointerLeave: (e: ReactPointerEvent) => { p.onPointerLeave?.(e); if (e.pointerType !== "touch") leave(); },
      onFocus: (e: FocusEvent) => { p.onFocus?.(e); show(); },
      onBlur: (e: FocusEvent) => { p.onBlur?.(e); if (!pinned) setOpen(false); },
      onPointerDown: (e: ReactPointerEvent) => {
        p.onPointerDown?.(e);
        if (e.pointerType === "touch") { show(); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 2500); }
      },
    });
    // Description is always in the DOM so aria-describedby resolves even when bubble is hidden.
    return <span className="helptip" ref={ref}>
      {trigger}
      <span id={id} className="sr-only-helptip">{text}</span>
      {bubble}
    </span>;
  }

  return <span className="helptip" ref={ref} {...hoverProps}>
    <button type="button" className="helptip-trigger" aria-label={label ?? "Help"} aria-describedby={id} aria-expanded={open}
      onFocus={show} onBlur={close}
      onClick={() => { const n = !pinned; dismissTooltips(); setPinned(n); setOpen(n); }} data-testid="button-help-tip">
      {children ?? icon ?? <Info size={15} aria-hidden="true" />}
    </button>
    <span id={id} className="sr-only-helptip">{text}</span>
    {bubble}
  </span>;
}

export default HelpTip;
