import { useQuery } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { exceptionImpact } from "./exception-impact";

/** Section F: read-only preview of existing bookings a date exception would affect. Never mutates. */
export function ExceptionImpactPreview({ doctorId, branchId, date, isClosed, isExtra, startTime, endTime, sessionId }: { doctorId?: string; branchId?: string; date?: string; isClosed?: boolean; isExtra?: boolean; startTime?: string; endTime?: string; sessionId?: string }) {
  const enabled = !!doctorId && !!branchId && /^\d{4}-\d{2}-\d{2}$/.test(date || "") && !isExtra;
  const q = useQuery({ queryKey: ["exception-impact", doctorId, branchId, date], enabled, queryFn: () => api.listAppointments({ doctorId, branchId, date, pageSize: 100 } as api.ListAppointmentsParams) });
  if (isExtra) return <p className="notice wide" data-testid="text-exception-impact">Extra interval: adds a bookable session on this date. Existing bookings are not changed.</p>;
  if (!enabled) return <p className="muted wide" data-testid="text-exception-impact">Choose doctor, location and date to preview booking impact.</p>;
  if (q.isLoading) return <p className="muted wide" role="status" data-testid="text-exception-impact">Checking existing bookings…</p>;
  if (q.error) return <p role="alert" className="wide" data-testid="text-exception-impact">Booking impact could not be loaded. <button type="button" onClick={() => void q.refetch()}>Retry</button></p>;
  const impact = exceptionImpact((q.data as { items?: unknown[] } | undefined)?.items || [], { isClosed, startTime, endTime, sessionId });
  return <p className={impact.affected ? "notice wide" : "muted wide"} role="status" data-testid="text-exception-impact">{impact.message}</p>;
}
