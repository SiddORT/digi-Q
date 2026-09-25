import {
  cloneElement, isValidElement, useEffect, useId, useRef, useState,
  type FocusEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode,
} from "react";
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

  const bubble = open ? <span role="tooltip" id={id} className="helptip-bubble">{text}</span> : null;
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
        {open && <span role="tooltip" className="helptip-bubble">{text}</span>}
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
      {open && <span role="tooltip" aria-hidden="true" className="helptip-bubble">{text}</span>}
    </span>;
  }

  return <span className="helptip" ref={ref} {...hoverProps}>
    <button type="button" className="helptip-trigger" aria-label="Help" aria-describedby={id} aria-expanded={open}
      onFocus={() => setOpen(true)} onBlur={() => { if (!pinned) setOpen(false); }}
      onClick={() => { const n = !pinned; setPinned(n); setOpen(n); }} data-testid="button-help-tip">
      {children ?? <HelpCircle size={15} aria-hidden="true" />}
    </button>
    <span id={id} className="sr-only-helptip">{text}</span>
    {bubble && <span role="tooltip" aria-hidden="true" className="helptip-bubble">{text}</span>}
  </span>;
}

export default HelpTip;
