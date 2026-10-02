import { getGetPublicDisplayQueryKey, useGetPublicDisplay } from "@workspace/api-client-react";
import { formatTime, formatConfiguredTimestamp } from "../lib/date-time";

export function PublicClinicLive({ reference }: { reference: string }) {
  const query = useGetPublicDisplay(reference, { query: { queryKey: getGetPublicDisplayQueryKey(reference), refetchInterval: 15000, staleTime: 0 } });
  return <section className="public-clinic-card"><span className="eyebrow">TODAY AT THIS LOCATION</span><h2>Live sessions</h2>
    {query.isLoading && <p role="status">Loading today's sessions…</p>}
    {query.error && <div className="error-box" role="alert">Live sessions are temporarily unavailable. <button data-testid="public-sessions-retry" onClick={() => query.refetch()}>Try again</button></div>}
    {!query.error && query.data && <><p className="registration-note">Token-only queue information · Updated {formatConfiguredTimestamp(query.data.updatedAt,query.data.branch.timezone,{},query.data)}</p>{query.data.sessions.length ? query.data.sessions.map((session, i) => <article className="public-clinic-session" key={`${session.doctorId}-${session.startTime}-${i}`} data-testid={`public-session-${i}`}><strong>{session.doctorName}</strong><p>{session.startTime && session.endTime ? `${formatTime(session.startTime,query.data)}–${formatTime(session.endTime,query.data)}` : "Session time not available"} · <span data-testid={`public-session-presence-${i}`}>{session.presence === "available" ? "Available" : session.presence === "onBreak" ? "On break" : session.presence === "away" ? "Away" : "Presence not available"}</span></p><dl><div><dt>Now serving</dt><dd>{session.currentToken ?? "Not calling"}</dd></div><div><dt>Waiting</dt><dd>{session.waitingCount}</dd></div><div><dt>Next token</dt><dd>{session.nextToken ?? "None"}</dd></div></dl></article>) : <p>No live sessions at this location today. Check booking for available dates.</p>}</>}
  </section>;
}