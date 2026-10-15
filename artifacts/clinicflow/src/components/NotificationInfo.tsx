import { useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

/** Hover/focus help also stays open on tap until tapped again or dismissed. */
export function NotificationInfo({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const dismiss = () => { pinned.current = false; setOpen(false); };
  return <TooltipProvider delayDuration={150}><Tooltip open={open} onOpenChange={value => { if (!pinned.current) setOpen(value); }}>
    <TooltipTrigger asChild>
      <button type="button" className="cm-info" aria-label={label}
        onClick={event => { event.preventDefault(); pinned.current = !pinned.current; setOpen(pinned.current); }}
        onKeyDown={event => { if (event.key === "Escape") dismiss(); }}
        onBlur={dismiss}>
        <Info size={20} aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="cm-info-content" collisionPadding={12} onEscapeKeyDown={dismiss} onPointerDownOutside={event => {
      if (!(event.target instanceof Element && event.target.closest(".cm-info"))) dismiss();
    }}>{children}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
