import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { IconAction } from "../IconAction";
import { BRAND_LOGO_URL, BRAND_NAME } from "../../branding";
import "./visit-ticket.css";
import { downloadTicketPdf } from "./ticket-pdf";
import { formatDate, formatTime, type DateTimePreferences } from "../../lib/date-time";

export type TicketData = Partial<DateTimePreferences> & {
  patientName: string;
  clinicName: string;
  branchName: string;
  address?: string | null;
  doctorName: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  timezone?: string | null;
  waitingNumber?: string | null;
  reference?: string | null;
  statusLabel?: string;
  qrUrl?: string | null;
};

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const sessionRange = (t: TicketData) => t.startTime || t.endTime ? `${t.startTime ? formatTime(t.startTime,t) : "—"} – ${t.endTime ? formatTime(t.endTime,t) : "—"}${t.timezone ? ` (${t.timezone})` : ""}` : "Session time set by clinic";
export const absoluteUrl = (u: string) => u.startsWith("/") ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${u}` : u;

let logoPromise: Promise<string> | undefined;
/** Embed the actual supplied logo so saved and printed tickets work without network access. */
export function embeddedTicketLogo(): Promise<string> {
  if (!logoPromise) logoPromise = fetch(BRAND_LOGO_URL)
    .then(async response => {
      if (!response.ok) throw new Error(`Logo request failed (${response.status}).`);
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("image/png")) throw new Error("Logo response is not a PNG image.");
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Logo could not be read."));
        reader.readAsDataURL(blob);
      });
    })
    .catch(() => {
      logoPromise = undefined;
      throw new Error("DigiQ Doctors logo could not be loaded. Try exporting again.");
    });
  return logoPromise;
}

/** Self-contained HTML (inline styles + QR data URI) usable for both download and print. */
export function ticketHtml(t: TicketData, qr: string | null, logo = BRAND_LOGO_URL) {
  const rows: [string, string][] = [["Clinic", t.clinicName], ...(t.address ? [["Address", t.address] as [string, string]] : []), ["Doctor", t.doctorName]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND_NAME} ticket ${esc(t.reference || "")}</title>
 <style>body{font-family:system-ui,sans-serif;background:#f0f9fd;color:#10274e;margin:0;padding:16px}.t{max-width:560px;margin:auto;background:#fff;border:1px solid #c9e3ed;border-radius:16px;overflow:hidden}.h{background:#edfaff;color:#10274e;padding:4px 18px;border-bottom:1px solid #c9e3ed;display:flex;align-items:center;gap:8px;font-weight:700}.h img{display:block;width:108px;height:54px;object-fit:contain;flex:none}.b{padding:16px 18px}.n{font:700 56px/1 ui-monospace,monospace;color:#087cb7;margin:4px 0 8px}.l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}.visit{border:1px solid #c9e3ed;background:#edfaff;padding:10px 12px;border-radius:9px;margin:8px 0 12px;overflow-wrap:anywhere}.visit strong{display:block;font-size:16px}.visit small{display:block;margin-top:4px}td{padding:2px 12px 2px 0;vertical-align:top}td:first-child{opacity:.65}.f{border-top:2px dashed #c9e3ed;padding:10px 18px;font-size:13px;background:#e9f8fc}.qr{display:block;margin:12px auto 0;width:180px}@media(max-width:420px){.h{flex-wrap:wrap;gap:0 8px}}@media print{body{background:none;padding:0}}</style></head><body><div class="t"><div class="h"><img src="${esc(logo)}" alt="DigiQ Doctors logo"><span>Visit ticket</span></div><div class="b">
<p>Status: <strong>${esc(t.statusLabel || "Booked")}</strong></p><div class="l">Waiting number</div><div class="n">${esc(t.waitingNumber || "—")}</div>${t.reference ? `<div>Reference <strong>${esc(t.reference)}</strong></div>` : ""}
 <h2 style="margin:10px 0 8px;overflow-wrap:anywhere">${esc(t.patientName)}</h2><div class="visit"><span class="l">Date · Location</span><strong>${esc(formatDate(t.date,t))} · ${esc(t.branchName)}</strong><small>Session ${esc(sessionRange(t))}</small></div><table style="width:100%;table-layout:fixed;overflow-wrap:anywhere">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
${qr ? `<img class="qr" src="${qr}" alt="Personal visit QR">` : ""}</div><div class="f">Show this ticket at reception. The session time is a range, not an exact consultation time. Keep the QR private.</div></div></body></html>`;
}

/** Patient-facing label for the real appointment status. */
export function bookingStatusLabel(status?:string|null){
  switch(status){case "booked":case "waiting":return "Booked";case "checkedIn":return "Checked in";case "called":return "Called";case "inConsultation":return "In consultation";case "completed":return "Completed";case "cancelled":return "Cancelled";case "noShow":return "Missed";case "skipped":return "Skipped";default:return status?status.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()):"Booked";}
}

async function qrImage(url?:string|null){
  if(!url)throw new Error("Your personal QR is not available yet. Refresh and try again.");
  try{return await QRCode.toDataURL(absoluteUrl(url),{width:320,margin:1});}catch{throw new Error("Your personal QR could not be generated. Try again.");}
}

/**
 * prepareExport must revalidate with the server and resolve fresh ticket data (or throw).
 * Exports never proceed without a QR.
 */
export function VisitTicket({ ticket, testId = "visit-ticket", note, prepareExport, exportDisabled }: { ticket: TicketData; testId?: string; note?: string; prepareExport?: () => Promise<TicketData>; exportDisabled?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");
  const [qrTry, setQrTry] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<""|"print"|"download">("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true; setQr(null); setQrError("");
    qrImage(ticket.qrUrl).then(v => { if (live) setQr(v); }).catch(e => { if (live) setQrError(e.message); });
    return () => { live = false; };
  }, [ticket.qrUrl, qrTry]);
  const file = `clinicflow-ticket-${(ticket.reference || ticket.waitingNumber || "visit").replace(/[^a-z0-9-]/gi, "")}.pdf`;
  async function run(kind:"print"|"download") {
    if (lock.current) return; lock.current = true; setErr(""); setBusy(kind);
    const w = kind === "print" ? window.open("", "_blank", "width=680,height=820") : null;
    try {
      if (kind === "print" && !w) throw new Error("Allow pop-ups to print this ticket, or use Download.");
      if (w) { w.opener = null; w.document.body.textContent = "Checking your ticket…"; }
      const fresh = prepareExport ? await prepareExport() : ticket;
      const image = await qrImage(fresh.qrUrl);
      const html = ticketHtml(fresh, image, await embeddedTicketLogo());
      if (w) {
        if (w.closed) throw new Error("Print window closed. Try again.");
        w.document.open(); w.document.write(html); w.document.close();
        await Promise.all(Array.from(w.document.images).map(img => img.decode()));
        if (w.closed) throw new Error("Print window closed. Try again.");
        w.focus(); w.print();
      } else {
        await downloadTicketPdf(html, file);
      }
    } catch (e) { w?.close(); setErr(e instanceof Error ? e.message : "Ticket could not be prepared. Try again."); }
    finally { lock.current = false; setBusy(""); }
  }
  const disabled = !!busy || exportDisabled || !qr;
  return <article className="vt" data-testid={testId} aria-label="Visit ticket">
    <header className="vt-head"><div className="vt-head-brand"><img src={BRAND_LOGO_URL} alt="DigiQ Doctors logo"/><h2>Visit Ticket</h2></div>
      <div className="vt-head-tools">
        <span className="vt-badge" data-testid="ticket-status" aria-label={`Booking Status: ${ticket.statusLabel || "Booked"}`}>{ticket.statusLabel || "Booked"}</span>
        <div className="vt-actions" role="group" aria-label="Ticket Actions">
          <IconAction className="vt-icon-action" testId="button-download-ticket" label={busy==="download"?"Preparing PDF…":"Download Ticket PDF"} icon={<Download size={16} aria-hidden/>} onClick={() => void run("download")} disabled={disabled} disabledReason={busy?"Checking the latest ticket first.":!qr?"Personal QR is still loading.":"Reconnect and refresh the ticket first."}/>
          <IconAction className="vt-icon-action" testId="button-print-ticket" label={busy==="print"?"Checking Ticket…":"Print Ticket"} icon={<Printer size={16} aria-hidden/>} onClick={() => void run("print")} disabled={disabled} disabledReason={busy?"Checking the latest ticket first.":!qr?"Personal QR is still loading.":"Reconnect and refresh the ticket first."}/>
        </div>
      </div>
    </header>
    <div className="vt-body">
      <div className="vt-info">
        <div className="vt-main">
          <p className="vt-number-label">Waiting Number</p>
          <p className="vt-number" data-testid="ticket-waiting-number">{ticket.waitingNumber || "—"}</p>
          {ticket.reference && <p className="vt-ref" data-testid="ticket-reference">Ref {ticket.reference}</p>}
          <p className="vt-name" data-testid="ticket-patient-name">{ticket.patientName}</p>
        </div>
        <div className="vt-facts">
          <div className="vt-visit"><small>Date · Location</small><strong>{formatDate(ticket.date,ticket)} · {ticket.branchName}</strong><span>Session {sessionRange(ticket)}</span></div>
          <dl className="vt-dl">
            <dt>Clinic</dt><dd>{ticket.clinicName}</dd>
            {ticket.address && <><dt>Address</dt><dd>{ticket.address}</dd></>}
            <dt>Doctor</dt><dd>{ticket.doctorName}</dd>
          </dl>
        </div>
      </div>
      <div className="vt-qr">{qr ? <img src={qr} alt="Personal visit QR"/> : qrError ? <div role="alert" style={{ width: 160 }}><p style={{margin:"0 0 8px"}}>{qrError}</p><button type="button" className="button secondary" data-testid="button-retry-ticket-qr" onClick={() => setQrTry(n => n + 1)}>Retry QR</button></div> : <div style={{ width: 160, height: 160 }} role="status" aria-label="Loading QR"/>}<small>Personal QR for reception. Keep it private.</small></div>
    </div>
    <footer className="vt-foot">
      <p>{note || "Show this ticket at reception. The session is a time range, not an exact consultation time."}</p>
      {err && <p role="alert" data-testid="ticket-export-error">{err}</p>}
    </footer>
  </article>;
}
