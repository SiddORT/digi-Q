import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { DISMISS_TOOLTIPS, dismissTooltips } from '../tooltip-dismiss';

const TooltipProvider = TooltipPrimitive.Provider;

function Tooltip({ open: controlled, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [local, setLocal] = React.useState(defaultOpen);
  const change = React.useCallback((next: boolean) => {
    setLocal(next);
    onOpenChange?.(next);
  }, [onOpenChange]);
  React.useEffect(() => {
    const close = () => change(false);
    window.addEventListener(DISMISS_TOOLTIPS, close);
    return () => window.removeEventListener(DISMISS_TOOLTIPS, close);
  }, [change]);
  return <TooltipPrimitive.Root {...props} open={controlled ?? local} onOpenChange={next => {
    if (next) dismissTooltips();
    change(next);
  }}/>;
}

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={8}
      className={cn(
        'dq-tooltip z-50 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
