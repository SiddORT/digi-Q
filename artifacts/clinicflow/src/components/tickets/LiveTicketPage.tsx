import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as api from "@workspace/api-client-react";
import { useNativeAuth } from "../../auth/native-auth";
import { AuthShell } from "../../auth/AuthShell";
import { AppointmentTicket } from "../appointments/AppointmentTicket";
import { AppointmentRows } from "../appointments/AppointmentRows";
import { ArrivalGuidance, DirectionsAction } from "./ArrivalGuidance";
import "./live-ticket.css";
import { formatDate, formatTime } from "../../lib/date-time";

/** Per-tab storage key; the capability never leaves this tab's sessionStorage and request bodies. */
export const LIVE_TICKET_STORAGE_KEY = "clinicflow-live-ticket";
const CAPABILITY = /^[a-f0-9]{64}$/;
const POLL_MS = 30000;
const STALE_MS = 75000;

type Failure = "invalid" | "connection" | null;

/** Read the fragment once, scrub it from history immediately, and keep it only in this tab. */
function takeCapability(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const value = (new URLSearchParams(hash).get("c") ?? hash).trim().toLowerCase();
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (CAPABILITY.test(value)) { sessionStorage.setItem(LIVE_TICKET_STORAGE_KEY, value); return value; }
    sessionStorage.removeItem(LIVE_TICKET_STORAGE_KEY);
    return null;
  }
  const stored = sessionStorage.getItem(LIVE_TICKET_STORAGE_KEY);
  if (stored && CAPABILITY.test(stored)) return stored;
  if (stored) sessionStorage.removeItem(LIVE_TICKET_STORAGE_KEY);
  return null;
}

function useNoReferrer() {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const previous = existing?.content;
    const meta = existing ?? document.createElement("meta");
    meta.name = "referrer"; meta.content = "no-referrer";
    if (!existing) document.head.appendChild(meta);
    return () => { if (existing) existing.content = previous ?? ""; else meta.remove(); };
  }, []);
}

const statusText = (s: string) => ({ booked: "Booked", checkedIn: "Waiting", waiting: "Waiting", called: "Called next", inConsultation: "In consultation", completed: "Visit completed", noShow: "Marked absent", cancelled: "Cancelled" } as Record<string, string>)[s] ?? s;
const presenceText = (p: string) => p === "onBreak" ? "On break" : p === "away" ? "Away" : p === "available" ? "Available" : p;

export function LiveTicketPage() {
  useNoReferrer();
  const [capability, setCapability] = useState<string | null>(() => takeCapability());
  const [ticket, setTicket] = useState<api.LiveTicket | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [loading, setLoading] = useState(!!capability);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(navigator.onLine);
  const auth = useNativeAuth();
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), enabled: auth.isLoaded && auth.isSignedIn, retry: false } });
  const identity = auth.isSignedIn ? me.data?.user?.id ?? "pending" : "anonymous";
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!capability) return;
    const run = ++seq.current;
    setLoading(true);
    try {
      const result = await api.readLiveTicket({ capability });
      if (run !== seq.current) return;
      setTicket(result); setFailure(null); setFetchedAt(Date.now());
    } catch (caught) {
      if (run !== seq.current) return;
      const status = (caught as { status?: number })?.status;
      if (status === 404 || status === 410) {
        sessionStorage.removeItem(LIVE_TICKET_STORAGE_KEY);
        setCapability(null); setTicket(null); setFailure("invalid");
      } else setFailure("connection");
    } finally { if (run === seq.current) setLoading(false); }
  }, [capability]);

  // Auth boundary: drop any personal owner details immediately, then re-read under the new identity.
  const lastIdentity = useRef(identity);
  useEffect(() => {
    if (lastIdentity.current === identity) return;
    lastIdentity.current = identity;
    seq.current++;
    setTicket(t => t ? { ...t, appointment: undefined } : t);
    if (identity !== "pending") void load();
  }, [identity, load]);

  useEffect(() => {
    if (!capability) return;
    void load();
    const timer = window.setInterval(() => { if (navigator.onLine) void load(); }, POLL_MS);
    return () => { window.clearInterval(timer); seq.current++; };
  }, [capability, load]);

  useEffect(() => {
    const update = () => { setOnline(navigator.onLine); if (navigator.onLine) void load(); };
    const tick = window.setInterval(() => setNow(Date.now()), 10000);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.clearInterval(tick); window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, [load]);

  const stale = !online || failure === "connection" || (fetchedAt > 0 && now - fetchedAt > STALE_MS);
  const appointment = auth.isLoaded && auth.isSignedIn && lastIdentity.current === identity && me.data?.user?.role === "patient" ? ticket?.appointment : undefined;
  const timeFormat = ticket?.timeFormat;

  return <AuthShell eyebrow="Live Ticket">
    <section className="live-ticket" aria-labelledby="live-ticket-title" data-testid="live-ticket">
      <header className="live-ticket-head">
        <h1 id="live-ticket-title">Visit Status</h1>
        <p className="muted">Queue position and arrival guidance are estimates, not a promised consultation time.</p>
      </header>

      {failure === "invalid" || (!capability && !ticket) ? <div className="live-ticket-state" role="alert" data-testid="live-ticket-invalid">
        <strong>This ticket link is invalid or has expired.</strong>
        <p>Ask the clinic for a new live ticket link, or sign in to view bookings on your account.</p>
        <div className="et-actions"><Link className="button" href="/patient-login">Patient Login</Link><Link className="button secondary" href="/">Home</Link></div>
      </div> : !ticket ? (failure === "connection" ? <div className="live-ticket-state" role="alert" data-testid="live-ticket-connection">
        <strong>Unable to reach the clinic service.</strong>
        <p>Your ticket link is still kept in this tab. Check your connection and retry.</p>
        <button className="button" type="button" disabled={loading} onClick={() => void load()}>{loading ? "Retrying…" : "Retry"}</button>
      </div> : <div className="live-ticket-skeleton" role="status" aria-label="Loading ticket"><span/><span/><span/></div>) : <>
        {stale && <div className="live-ticket-stale" role="alert" data-testid="live-ticket-stale">
          <span>{!online ? "You are offline." : "Status could not be refreshed."} Estimates are hidden until the ticket updates.</span>
          <button className="button secondary" type="button" disabled={!online || loading} onClick={() => void load()}>Retry</button>
        </div>}
        <dl className="live-ticket-grid">
          <div className="live-ticket-token"><dt>Token</dt><dd data-testid="live-ticket-token">{ticket.token}</dd></div>
          <div><dt>Status</dt><dd data-testid="live-ticket-status">{statusText(ticket.status)}</dd></div>
          <div><dt>Doctor</dt><dd>{ticket.doctorName}</dd></div>
          <div><dt>Doctor status</dt><dd>{presenceText(ticket.presence)}{ticket.presence !== "available" && " · calling paused, booking kept"}</dd></div>
          <div><dt>Clinic</dt><dd>{ticket.clinicName} · {ticket.branchName}</dd></div>
          <div><dt>Visit date & session</dt><dd>{formatDate(ticket.date,ticket)}{ticket.startTime ? ` · ${formatTime(ticket.startTime,ticket)}${ticket.endTime ? `–${formatTime(ticket.endTime,ticket)}` : ""}` : ""}{ticket.timezone ? ` (${ticket.timezone})` : ""}</dd></div>
        </dl>
        {!appointment && <ArrivalGuidance estimate={stale ? undefined : ticket.estimate} stale={stale} timezone={ticket.timezone} timeFormat={timeFormat} />}
        <div className="live-ticket-address"><span>{ticket.branchAddress || "The booked location has no saved address. Contact the clinic."}</span><DirectionsAction address={ticket.branchAddress} /></div>
        <p className="muted live-ticket-meta" data-testid="live-ticket-updated">Updated {new Date(ticket.updatedAt).toLocaleTimeString()} · refreshes every 30 seconds while connected.</p>

        {appointment ? <section className="live-ticket-owner" aria-label="Your booking" data-testid="live-ticket-owner">
          <h2>Your Booking</h2>
          <AppointmentTicket key={appointment.id} id={appointment.id} showHistory={false} />
          <AppointmentRows appointments={[appointment]} compactColumns sessionScoped disabled={stale} />
        </section> : !auth.isSignedIn && auth.isLoaded && <div className="live-ticket-signin">
          <span>Booked this visit with a patient account? Sign in to print, download, cancel or reschedule.</span>
          <Link className="button secondary" href="/patient-login?returnTo=live-ticket" data-testid="link-live-ticket-login">Patient Login</Link>
        </div>}
      </>}
    </section>
  </AuthShell>;
}
