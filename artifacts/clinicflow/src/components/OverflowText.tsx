import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DISMISS_TOOLTIPS, dismissTooltips } from "./tooltip-dismiss";
import "./overflow-text.css";

/**
 * Single-line ellipsis with the complete value on hover, keyboard focus and tap.
 * Display only: the underlying value is never altered or recased.
 */
export function OverflowText({ value, children, as = "span", className, lines = 1, testId }: { value: string | number | null | undefined; children?: ReactNode; as?: "span" | "strong"; className?: string; lines?: 1 | 2; testId?: string }) {
  const text = value == null || value === "" ? "" : String(value);
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const id = useId();
  const touchFocus = useRef(false);
  useEffect(() => {
    const dismiss = () => { window.clearTimeout(closeTimer.current); setOpen(false); };
    window.addEventListener(DISMISS_TOOLTIPS, dismiss);
    return () => window.removeEventListener(DISMISS_TOOLTIPS, dismiss);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    const measure = () => {
      const clipped = !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      setTruncated(clipped);
      if (!clipped) setOpen(false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el) observer.observe(el);
    document.fonts.ready.then(() => { if (el?.isConnected) measure(); });
    return () => { observer.disconnect(); window.clearTimeout(closeTimer.current); };
  }, [text, children, lines]);
  if (!text) return <>{children ?? "—"}</>;
  const measure = () => { const el = ref.current; const t = !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1); setTruncated(t); return t; };
  const show = () => { window.clearTimeout(closeTimer.current); if (measure()) { dismissTooltips(); setOpen(true); } };
  const toggle = () => { const next = !open; dismissTooltips(); if (measure()) setOpen(next); };
  const hide = () => { closeTimer.current = window.setTimeout(() => setOpen(false), 120); };
  const Tag = as;
  return <Popover.Root open={open && truncated} onOpenChange={setOpen}>
    <Popover.Anchor asChild>
      <Tag ref={ref as any} className={`ov-text${lines === 2 ? " ov-2" : ""}${className ? ` ${className}` : ""}`} data-testid={testId}
        tabIndex={truncated ? 0 : -1} aria-label={truncated ? text : undefined}
        aria-describedby={open && truncated ? id : undefined}
        onPointerEnter={e => { if (e.pointerType !== "touch") show(); }} onPointerLeave={e => { if (e.pointerType !== "touch") hide(); }} onFocus={() => { if (!touchFocus.current) show(); }} onBlur={hide}
        onPointerDown={e => { if (e.pointerType !== "mouse" && measure()) { e.preventDefault(); touchFocus.current = true; ref.current?.focus(); touchFocus.current = false; toggle(); } }}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); if ((e.key === "Enter" || e.key === " ") && truncated) { e.preventDefault(); toggle(); } }}>
        {children ?? text}
      </Tag>
    </Popover.Anchor>
    <Popover.Portal>
      <Popover.Content id={id} className="ov-pop" side="top" align="start" sideOffset={6} collisionPadding={8} role="tooltip"
        onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()}
        onInteractOutside={e => { if (ref.current?.contains(e.target as Node)) e.preventDefault(); }}
        onMouseEnter={() => window.clearTimeout(closeTimer.current)} onMouseLeave={hide}>
        {text}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
export const FullValueText = OverflowText;
