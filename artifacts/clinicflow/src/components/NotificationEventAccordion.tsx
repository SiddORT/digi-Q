import { useState, type ReactNode } from "react";
import { Accordion } from "./ui/accordion";

/**
 * The parent keys this view by actor, scope and filters. Only expansion lives
 * here; editors and pending activation confirmations stay outside this view.
 */
export function NotificationEventAccordion({ events, filtered, children }: {
  events: string[];
  filtered: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  // Newly arriving wording matches also open after preview queries finish.
  const value = filtered ? events.filter(event => !closed.includes(event)) : open;
  return <Accordion type="multiple" value={value} onValueChange={next => {
    if (filtered) setClosed(events.filter(event => !next.includes(event)));
    else setOpen(next);
  }}>{children}</Accordion>;
}
