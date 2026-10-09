import { bookingSessionIssue } from "../guest-booking-date.ts";

type Session = Parameters<typeof bookingSessionIssue>[0] & { sessionId?: string | null };
export function bookingReviewKey(context: string[], session?: { sessionId?: string | null; startTime?: string | null; endTime?: string | null; timezone?: string | null }) {
  return JSON.stringify([context, session?.sessionId, session?.startTime, session?.endTime, session?.timezone]);
}
/** An explicit invalid choice is rejected, never silently replaced with another session. */
export function resolveBookingSession<T extends Session>(sessions: T[], explicit: string, mode?: "advance" | "walkIn", date = "", today = "", time = "") {
  const issue = (session: T) => mode ? bookingSessionIssue(session, mode === "walkIn", date, today, time) : null;
  const eligible = sessions.filter(session => !issue(session));
  const selected = explicit ? sessions.find(session => session.sessionId === explicit) : eligible.length === 1 ? eligible[0] : undefined;
  const selectionIssue = explicit && !selected ? "Your selected session is no longer listed. Choose a current session."
    : selected ? issue(selected) : null;
  return { session: selectionIssue ? undefined : selected, sessionId: explicit || selected?.sessionId || "", selectionIssue, issue };
}
