import { useState } from "react";
import * as api from "@workspace/api-client-react";
import { MapPin, ExternalLink } from "lucide-react";
import { IconAction } from "../IconAction";
import { formatTime } from "../../lib/date-time";
import { branchDirectionsUrl as directionsUrl } from "@workspace/api-zod/ticket-directions";
export { branchDirectionsUrl as directionsUrl } from "@workspace/api-zod/ticket-directions";

export function estimateFacts(e?: api.ArrivalEstimate, preferences: { timeFormat?: api.ClinicTimeFormat } = {}): [string, string][] {
  if (!e) return [["Estimate", "Unavailable. Refresh or contact the clinic."]];
  return [
    ...(e.patientsAhead == null ? [] : [["Patients ahead", String(e.patientsAhead)] as [string, string]]),
    [e.basis === "sessionStart" ? "Wait from session start" : "Remaining queue wait", e.waitMinutes == null ? "Unavailable" : `Approx. ${e.waitMinutes} minutes`],
    ["Suggested arrival", e.suggestedArrival ? formatTime(e.suggestedArrival, preferences) : "Not available"],
    ["Estimate as of", new Date(e.asOf).toISOString().replace("T", " ").replace(".000Z", " UTC")],
    ["Guidance", e.guidance],
  ];
}
export function ArrivalGuidance({ estimate, stale, timezone, timeFormat }: { estimate?: api.ArrivalEstimate; stale?: boolean; timezone?: string | null; timeFormat?: api.ClinicTimeFormat }) {
  if (stale) return <p role="status" data-testid="text-ticket-estimate">Waiting estimates unavailable while offline or stale. Reconnect and refresh.</p>;
  return <dl className="appt-detail-grid" data-testid="text-ticket-estimate">{estimateFacts(estimate, {timeFormat}).map(([key, value]) => <div className="span-2" key={key}><dt>{key}</dt><dd>{value}{key === "Suggested arrival" && estimate?.suggestedArrival && timezone ? ` (${timezone})` : ""}</dd></div>)}</dl>;
}
export function DirectionsAction({ address }: { address?: string | null }) {
  const url = directionsUrl(address);
  return <IconAction label="Get Directions" icon={<MapPin size={16} aria-hidden/>} testId="button-get-directions" disabled={!url}
    disabledReason="The booked location has no saved address. Contact the clinic for directions."
    onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}/>;
}
/** Direct calls only: a share secret must never enter a mutation/query cache. */
export function LiveTicketAction({ appointmentId, receiptSecret }: { appointmentId?: string; receiptSecret?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function open() {
    if (busy) return;
    setBusy(true); setError("");
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      if (!tab) throw new Error("Allow pop-ups to open the live ticket.");
      const link = await api.issueLiveTicketLink(receiptSecret ? { receiptSecret } : { appointmentId });
      tab.location.replace(link.url);
    } catch { tab?.close(); setError("Live link unavailable. Reconnect or contact the clinic."); }
    finally { setBusy(false); }
  }
  return <><IconAction label="Open Live Ticket" testId="button-open-live-ticket" icon={<ExternalLink size={16} aria-hidden/>} disabled={busy || !navigator.onLine} disabledReason="Reconnect before opening the latest ticket." onClick={() => void open()}/>{error && <small role="alert">{error}</small>}</>;
}
