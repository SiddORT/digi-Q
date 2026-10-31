import { CheckCircle2 } from "lucide-react";
import "./ticket-email-dialog.css";

/** Shared compact completion feedback; success means confirmed submission, not delivery. */
export function TicketSendSuccess({ children, testId }: { children: React.ReactNode; testId: string }) {
  return <div className="ticket-email-success" role="status" data-testid={testId}>
    <CheckCircle2 size={28} aria-hidden="true"/><p>{children}</p>
  </div>;
}
