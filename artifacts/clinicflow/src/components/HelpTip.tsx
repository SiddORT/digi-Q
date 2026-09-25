import {
  cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import "./help-tip.css";

export interface HelpTipProps { text: string; children?: ReactNode }

type ChildProps = {
  disabled?: boolean;
  "aria-disabled"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onPointerDown?: (e: ReactPointerEvent) => void;
};

/** Tooltip rendered in a body portal, positioned against the anchor with flip + viewport clamp. */
function Bubble({ anchor, text, id }: { anchor: RefObject<HTMLSpanElement | null>; text: string; id?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current, b = ref.current;
      if (!a || !b) return;
      const r = a.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight, m = 8, gap = 6;
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
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
      style={pos ? { transform: `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)` } : undefined}>{text}</span>,
    document.body,
  );
}

/**
 * Accessible help tooltip.
 * - No children: renders a "?" icon button (tap toggles/pins).
 * - One element child (button/link): child is used AS the trigger (no nesting). Hover/focus
 *   shows help; touch press shows it briefly; the child's own click/navigation is untouched.
 * - Disabled child: wrapped in a focusable span so help remains reachable.
 * Escape and outside tap dismiss.
 */
export function HelpTip({ text, children }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const close = () => { setOpen(false); setPinned(false); };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const down = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down);
    return () => { document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", down); };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const bubble = open ? <Bubble anchor={ref} text={text} /> : null;
  const hoverProps = { onMouseEnter: () => setOpen(true), onMouseLeave: () => { if (!pinned) setOpen(false); } };

  if (isValidElement(children)) {
    const child = children as ReactElement<ChildProps>;
    const p = child.props;
    const disabled = !!p.disabled || p["aria-disabled"] === true || p["aria-disabled"] === "true";
    const describedBy = [p["aria-describedby"], id].filter(Boolean).join(" ");

    if (disabled) {
      // Disabled controls can't receive focus/hover; a focusable wrapper carries the help.
      return <span className="helptip helptip-disabled" ref={ref} {...hoverProps}>
        <span tabIndex={0} className="helptip-focus" aria-describedby={id} aria-label={text}
          onFocus={() => setOpen(true)} onBlur={() => { if (!pinned) setOpen(false); }}
          onClick={() => { const n = !pinned; setPinned(n); setOpen(n); }} data-testid="helptip-disabled-wrapper">
          {child}
        </span>
        <span id={id} className="sr-only-helptip">{text}</span>
        {bubble}
      </span>;
    }

    const trigger = cloneElement(child, {
      "aria-describedby": describedBy,
      onMouseEnter: (e: MouseEvent) => { p.onMouseEnter?.(e); setOpen(true); },
      onMouseLeave: (e: MouseEvent) => { p.onMouseLeave?.(e); if (!pinned) setOpen(false); },
      onFocus: (e: FocusEvent) => { p.onFocus?.(e); setOpen(true); },
      onBlur: (e: FocusEvent) => { p.onBlur?.(e); if (!pinned) setOpen(false); },
      onPointerDown: (e: ReactPointerEvent) => {
        p.onPointerDown?.(e);
        if (e.pointerType === "touch") { setOpen(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 2500); }
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
    <button type="button" className="helptip-trigger" aria-label="Help" aria-describedby={id} aria-expanded={open}
      onFocus={() => setOpen(true)} onBlur={() => { if (!pinned) setOpen(false); }}
      onClick={() => { const n = !pinned; setPinned(n); setOpen(n); }} data-testid="button-help-tip">
      {children ?? <HelpCircle size={15} aria-hidden="true" />}
    </button>
    <span id={id} className="sr-only-helptip">{text}</span>
    {bubble}
  </span>;
}

export default HelpTip;
