import { useEffect, useState } from "react";
import { useGetPublicDisplay, getGetPublicDisplayQueryKey, type PublicDisplay } from "@workspace/api-client-react";
import QRCode from "qrcode";
import { Activity, Clock3, MapPin, QrCode, RefreshCw, WifiOff, Users, Maximize2 } from "lucide-react";
import "./clinic-display.css";
import { BRAND_NAME } from "../branding";
import { formatConfiguredTimestamp, formatDate, formatTime, type DateTimePreferences } from "../lib/date-time";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
type DisplaySession = PublicDisplay["sessions"][number];
const errStatus = (e: unknown) => (e && typeof e === "object" && "status" in e ? Number((e as { status: unknown }).status) : 0);
const isRevoked = (e: unknown) => [400, 403, 404, 410].includes(errStatus(e));

function fmtTime(t: string | null,preferences?:Partial<DateTimePreferences>) {
  if (!t) return null;
  return formatTime(t,preferences);
}

function useClock(tz?: string | null,preferences?:Partial<DateTimePreferences>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000 * 15); return () => clearInterval(i); }, []);
  try { return tz ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, hour12:preferences?.timeFormat!=="24h" }) : "Clock unavailable"; }
  catch { return "Clock unavailable"; }
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

export function ClinicDisplay({ reference, bookingHref }: { reference: string; bookingHref?: string }) {
  const online = useOnline();
  const q = useGetPublicDisplay(reference, { query: {
    queryKey: getGetPublicDisplayQueryKey(reference),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: (count, err) => !isRevoked(err) && count < 2,
  } });
  const bookingUrl = bookingHref || `${window.location.origin}${basePath}/book/${encodeURIComponent(reference)}`;
  const [qrResult, setQrResult] = useState({url:"", image:"", failed:false});
  const [qrAttempt, setQrAttempt] = useState(0);
  const qr = qrResult.url === bookingUrl ? qrResult.image : "";
  const qrFailed = qrResult.url === bookingUrl && qrResult.failed;
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(bookingUrl, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#123a37", light: "#fbfdfb" } })
      .then(image => { if (!cancelled) setQrResult({url:bookingUrl,image,failed:false}); })
      .catch(() => { if (!cancelled) setQrResult({url:bookingUrl,image:"",failed:true}); });
    return () => { cancelled = true; };
  }, [bookingUrl, qrAttempt]);

  const data = q.isError || !online ? undefined : q.data;
  const clock = useClock(data?.branch.timezone,data);
  const revoked = q.isError && isRevoked(q.error);

  useEffect(() => { document.title = data ? `${data.clinic.name} · Queue display` : `${BRAND_NAME} · Queue display`; }, [data]);

  const fullscreen = () => { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {}); };

  if (revoked) {
    return <div className="cd-root cd-center" data-testid="display-revoked">
      <div className="cd-notice"><QrCode size={44} strokeWidth={1.4} /><h1>This display link is no longer active</h1>
        <p>The booking QR for this branch was revoked or doesn't exist. Ask reception to open the display from a current branch QR.</p>
        <button className="cd-btn" onClick={() => q.refetch()} data-testid="button-retry-display"><RefreshCw size={18} /> Check Again</button></div>
    </div>;
  }

  const location = data ? [data.branch.name, data.branch.address, data.branch.city].filter(Boolean).join(" · ") : "";
  const updated = q.dataUpdatedAt ? formatConfiguredTimestamp(new Date(q.dataUpdatedAt), data?.branch.timezone || undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }, data) : null;

  return <div className="cd-root">
    <header className="cd-header">
      <div className="cd-brand"><span className="cd-mark"><Activity size={26} /></span>
        <div>{data ? <h1 data-testid="text-clinic-name">{data.clinic.name}</h1> : <span className="cd-sk cd-sk-title" />}
          {data ? <p data-testid="text-branch-location"><MapPin size={16} /> {location}</p> : <span className="cd-sk cd-sk-line" />}</div></div>
      <div className="cd-header-right">
        <div className="cd-clock" data-testid="text-clock">{clock}</div>
        <div className="cd-live">{!online || q.isError ? <><WifiOff size={15} /> Updates unavailable</> : !data ? "Connecting…" : <><span className="cd-pulse" /> Live{updated && <> · updated {updated}</>}</>}</div>
        <button className="cd-icon-btn" onClick={fullscreen} aria-label="Toggle full screen" data-testid="button-fullscreen"><Maximize2 size={18} /></button>
      </div>
    </header>

    {(!online || (q.isError && !revoked)) && <div className="cd-banner" role="alert" data-testid="status-display-error">
      <WifiOff size={18} /><span>{!online ? "This screen is offline." : "Queue information couldn't be refreshed."} Queue details are hidden until the connection returns.</span>
      <button className="cd-btn small" onClick={() => q.refetch()} disabled={q.isFetching} data-testid="button-retry-display">
        <RefreshCw size={16} className={q.isFetching ? "cd-spin" : ""} /> {q.isFetching ? "Retrying" : "Retry"}</button>
    </div>}

    <main className="cd-main">
      <section className="cd-book" aria-label="Book a queue place">
        <span className="cd-eyebrow">Scan to Book</span>
        <h2>Reserve Your Place<br /><em>from your phone.</em></h2>
        <div className="cd-qr" data-testid="img-booking-qr">
          {qr ? <img src={qr} alt="QR code linking to this branch's booking page" /> : qrFailed ? <div role="alert"><p>QR image could not be generated. You can use the booking link below.</p><button onClick={()=>setQrAttempt(n=>n+1)}>Retry QR Image</button></div> : <span className="cd-sk cd-sk-qr" />}
        </div>
        <ol className="cd-steps">
          <li><span>1</span>Open your phone camera and point it at the code.</li>
          <li><span>2</span>Choose your doctor and confirm your visit.</li>
          <li><span>3</span>Your token appears here when it's your turn.</li>
        </ol>
        <p className="cd-url" data-testid="text-booking-url">{bookingUrl.replace(/^https?:\/\//, "")}</p>
      </section>

      <section className="cd-queues" aria-label="Live doctor queues" aria-live="polite">
        <div className="cd-queues-head"><span className="cd-eyebrow">Now Serving</span>{data && <span className="cd-date">{formatDate(data.date,data)}</span>}</div>
        {q.isLoading && online ? <div className="cd-grid">{[0, 1].map(i => <div key={i} className="cd-card"><span className="cd-sk cd-sk-line" /><span className="cd-sk cd-sk-token" /><span className="cd-sk cd-sk-line" /></div>)}</div>
          : !data ? <div className="cd-empty"><WifiOff size={34} strokeWidth={1.4} /><p>Live queue hidden while offline.</p></div>
          : data.sessions.length === 0 ? <div className="cd-empty" data-testid="status-no-sessions"><Clock3 size={34} strokeWidth={1.4} /><h3>No Consultations Scheduled Today</h3><p>You can still book an upcoming visit using the QR code.</p></div>
          : <div className={`cd-grid ${data.sessions.length === 1 ? "one" : ""}`}>
            {data.sessions.map((s: DisplaySession) => {
              const hours = [fmtTime(s.startTime,data), fmtTime(s.endTime,data)].filter(Boolean).join(" – ");
              const upcoming = s.waitingTokens.filter(t => t !== s.nextToken);
              return <article key={`${s.doctorId}-${s.startTime}`} className="cd-card" data-testid={`card-doctor-queue-${s.doctorId}`}>
                <div className="cd-card-top"><h3>{s.doctorName}</h3>{hours && <span className="cd-hours"><Clock3 size={14} /> {hours}</span>}</div>
                <div className={`cd-now ${s.currentStatus === "called" ? "called" : ""}`}>
                  <div><label data-testid={`text-current-status-${s.doctorId}`}>{s.currentToken ? (s.currentStatus === "inConsultation" ? "In Consultation" : s.currentStatus === "called" ? "Called Next — Please Proceed" : "Now Serving") : "No One Called Yet"}</label><strong className="cd-token-big" data-testid={`text-current-token-${s.doctorId}`}>{s.currentToken ?? "—"}</strong></div>
                  <div className="cd-next"><label>Up Next</label><strong data-testid={`text-next-token-${s.doctorId}`}>{s.nextToken ?? "—"}</strong></div>
                </div>
                <div className="cd-waiting">
                  <label><Users size={14} /> Waiting · <b data-testid={`text-waiting-count-${s.doctorId}`}>{s.waitingCount}</b></label>
                  <div className="cd-chips">{upcoming.length ? <>{upcoming.slice(0, 10).map(t => <span key={t}>{t}</span>)}{upcoming.length > 10 && <span className="more">+{upcoming.length - 10}</span>}</> : <em>No One Else Waiting</em>}</div>
                </div>
                <div className="cd-foot">{s.completedCount} seen today</div>
              </article>;
            })}
          </div>}
      </section>
    </main>
  </div>;
}

export default ClinicDisplay;
