import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { exceptionImpact } from "./exception-impact";

/** Section F: read-only preview of existing bookings a date exception would affect. Never mutates. */
export function ExceptionImpactPreview({ doctorId, branchId, date, isClosed, isExtra, startTime, endTime, sessionId }: { doctorId?: string; branchId?: string; date?: string; isClosed?: boolean; isExtra?: boolean; startTime?: string; endTime?: string; sessionId?: string }) {
  const enabled = !!doctorId && !!branchId && /^\d{4}-\d{2}-\d{2}$/.test(date || "") && (!isExtra || !!isClosed);
  const q = useQuery({ queryKey: ["exception-impact", doctorId, branchId, date], enabled, queryFn: () => api.listAppointments({ doctorId, branchId, date, pageSize: 100 } as api.ListAppointmentsParams) });
  // Day off wins over Extra interval: never let the extra-session note hide the closure booking warning.
  const conflict = isExtra && isClosed ? <p role="alert" className="error-box wide" data-testid="text-exception-conflict">Day off and Extra interval conflict: a closed day adds no session. Clear one so this date is unambiguous.</p> : null;
  if (isExtra && !isClosed) return <p className="notice wide" data-testid="text-exception-impact">Extra interval: adds a bookable session on this date. Existing bookings are not changed.</p>;
  if (!enabled) return <>{conflict}<p className="muted wide" data-testid="text-exception-impact">Choose doctor, location and date to preview booking impact.</p></>;
  if (q.isLoading) return <>{conflict}<p className="muted wide" role="status" data-testid="text-exception-impact">Checking existing bookings…</p></>;
  if (q.error) return <>{conflict}<p role="alert" className="wide" data-testid="text-exception-impact">Booking impact could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></p></>;
  const impact = exceptionImpact((q.data as { items?: unknown[] } | undefined)?.items || [], { isClosed, startTime, endTime, sessionId });
  return <>{conflict}<p className={impact.affected ? "notice wide" : "muted wide"} role="status" data-testid="text-exception-impact">{impact.message}</p></>;
}
