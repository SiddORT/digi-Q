import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { DISMISS_TOOLTIPS, dismissTooltips } from "./tooltip-dismiss";

/** Hover/focus help also stays open on tap until tapped again or dismissed. */
export function NotificationInfo({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dismiss = () => { pinned.current = false; setOpen(false); };
  useEffect(() => {
    window.addEventListener(DISMISS_TOOLTIPS, dismiss);
    return () => window.removeEventListener(DISMISS_TOOLTIPS, dismiss);
  }, []);
  return <TooltipProvider delayDuration={150}><Tooltip open={open} onOpenChange={value => { if (!pinned.current) { if (value) dismissTooltips(); setOpen(value); } }}>
    <TooltipTrigger asChild>
      <button ref={trigger} type="button" className="cm-info" aria-label={label}
        onClick={event => { event.preventDefault(); const next = !pinned.current; dismissTooltips(); pinned.current = next; setOpen(next); }}
        onKeyDown={event => { if (event.key === "Escape") dismiss(); }}
        onBlur={dismiss}>
        <Info size={20} aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="cm-info-content" collisionPadding={12} onEscapeKeyDown={dismiss} onPointerDownOutside={event => {
      if (!trigger.current?.contains(event.target as Node)) dismiss();
    }}>{children}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
