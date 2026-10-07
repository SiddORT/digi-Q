import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, FileText, Printer } from "lucide-react";
import { IconAction } from "../IconAction";
import { BRAND_LOGO_URL, BRAND_NAME } from "../../branding";
import "./visit-ticket.css";
import { downloadTicketPdf } from "./ticket-pdf";
import { ticketCssVarString, ticketCssVars, ticketModel } from "./ticket-model";
import type { CSSProperties } from "react";
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

/** Model input for both renderers (screen card and export/print HTML). */
const modelFor = (t: TicketData) => ticketModel({ patientName: t.patientName, clinicName: t.clinicName, branchName: t.branchName, address: t.address, doctorName: t.doctorName, waitingNumber: t.waitingNumber, reference: t.reference, statusLabel: t.statusLabel, dateText: formatDate(t.date, t), sessionText: sessionRange(t) });

/** Self-contained HTML (inline styles + QR data URI) usable for both download and print.
 *  Same content model and the same --vt-* tokens as the on-screen card, so the two cannot drift. */
export function ticketHtml(t: TicketData, qr: string | null, logo = BRAND_LOGO_URL) {
  const m = modelFor(t);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND_NAME} ticket ${esc(t.reference || "")}</title>
 <style>body{font-family:system-ui,sans-serif;background:var(--vt-soft);color:var(--vt-ink);margin:0;padding:16px;${ticketCssVarString()}}
.t{max-width:var(--vt-card-width);margin:auto;background:var(--vt-paper);border:1px solid var(--vt-line);border-radius:var(--vt-radius);overflow:hidden}
.h{background:var(--vt-head);padding:4px 16px;border-bottom:1px solid var(--vt-line);display:flex;align-items:center;gap:8px;font-weight:700}
.h img{display:block;width:var(--vt-logo-width);height:var(--vt-logo-height);object-fit:contain;flex:none}
.h .s{margin-left:auto;background:var(--vt-badge);color:var(--vt-ink);border-radius:99px;padding:4px 10px;font-size:var(--vt-small-size);letter-spacing:.12em;font-weight:500}
.b{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;padding:16px;font-size:var(--vt-body-size)}
.l{font-size:var(--vt-small-size);letter-spacing:var(--vt-label-tracking);opacity:.7;margin:0}
.n{font:700 var(--vt-number-size)/1 ui-monospace,monospace;color:var(--vt-accent);margin:4px 0 8px}
.r{font-family:ui-monospace,monospace;margin:0 0 8px}.p{font-size:var(--vt-name-size);font-weight:700;margin:0 0 8px;overflow-wrap:anywhere}
.visit{border:1px solid var(--vt-line);background:var(--vt-head);padding:8px 12px;border-radius:var(--vt-radius-inner);margin:0 0 8px;overflow-wrap:anywhere}
.visit strong{display:block;font-size:var(--vt-visit-size)}.visit small{display:block;margin-top:4px}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}dt{opacity:.65}dd{margin:0;font-weight:500;overflow-wrap:anywhere}
.q{display:flex;flex-direction:column;align-items:center;gap:8px}.q img{width:var(--vt-qr-size);height:var(--vt-qr-size);border:1px solid var(--vt-line);border-radius:var(--vt-radius-inner)}
.q small{font-size:var(--vt-small-size);opacity:.7;max-width:var(--vt-qr-size);text-align:center}
.f{border-top:2px dashed var(--vt-line);padding:12px 16px;font-size:var(--vt-body-size);background:var(--vt-soft)}
@media(max-width:420px){.b{grid-template-columns:1fr}}
@page{size:A4;margin:16mm}@media print{body{background:#fff;padding:0}.t{max-width:120mm;margin:0 auto;break-inside:avoid}}</style></head><body>
<div class="t"><div class="h"><img src="${esc(logo)}" alt="DigiQ Doctors logo"><span>${m.title}</span><span class="s">${esc(m.status)}</span></div>
<div class="b"><div><p class="l">${m.numberLabel}</p><p class="n">${esc(m.number)}</p>${t.reference ? `<p class="r">${esc(m.reference)}</p>` : ""}<p class="p">${esc(m.patient)}</p>
<div class="visit"><span class="l">${m.visitLabel}</span><strong>${esc(m.visitPrimary)}</strong><small>${esc(m.visitSecondary)}</small></div>
<dl>${m.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></div>
${qr ? `<div class="q"><img src="${qr}" alt="${m.qrAlt}"><small>${m.qrCaption}</small></div>` : ""}</div>
<div class="f">${m.footer}</div></div></body></html>`;
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
  const [busy, setBusy] = useState<""|"print"|"download"|"a4">("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true; setQr(null); setQrError("");
    qrImage(ticket.qrUrl).then(v => { if (live) setQr(v); }).catch(e => { if (live) setQrError(e.message); });
    return () => { live = false; };
  }, [ticket.qrUrl, qrTry]);
  const file = `clinicflow-ticket-${(ticket.reference || ticket.waitingNumber || "visit").replace(/[^a-z0-9-]/gi, "")}.pdf`;
  async function run(kind:"print"|"download"|"a4") {
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
        await downloadTicketPdf(html, file, kind === "a4" ? "a4" : "ticket");
      }
    } catch (e) { w?.close(); setErr(e instanceof Error ? e.message : "Ticket could not be prepared. Try again."); }
    finally { lock.current = false; setBusy(""); }
  }
  const disabled = !!busy || exportDisabled || !qr;
  const m = modelFor(ticket);
  const why = busy ? "Checking the latest ticket first." : !qr ? "Personal QR is still loading." : "Reconnect and refresh the ticket first.";
  return <article className="vt" data-testid={testId} aria-label="Visit ticket" style={ticketCssVars() as CSSProperties}>
    <header className="vt-head"><div className="vt-head-brand"><img src={BRAND_LOGO_URL} alt="DigiQ Doctors logo"/><h2>{m.title}</h2></div>
      <div className="vt-head-tools">
        <span className="vt-badge" data-testid="ticket-status" aria-label={`Booking Status: ${m.status}`}>{m.status}</span>
        <div className="vt-actions" role="group" aria-label="Ticket Actions">
          <IconAction className="vt-icon-action" testId="button-download-ticket" label={busy==="download"?"Preparing PDF…":"Download Ticket PDF"} hint="Download Ticket PDF — ticket-sized, for phones and sharing" icon={<Download size={16} aria-hidden/>} onClick={() => void run("download")} disabled={disabled} disabledReason={why}/>
          <IconAction className="vt-icon-action" testId="button-download-ticket-a4" label={busy==="a4"?"Preparing A4 PDF…":"Download A4 PDF"} hint="Download A4 PDF — ticket centred on an A4 page for office printing" icon={<FileText size={16} aria-hidden/>} onClick={() => void run("a4")} disabled={disabled} disabledReason={why}/>
          <IconAction className="vt-icon-action" testId="button-print-ticket" label={busy==="print"?"Checking Ticket…":"Print Ticket"} hint="Print Ticket — prints on A4 with the ticket centred" icon={<Printer size={16} aria-hidden/>} onClick={() => void run("print")} disabled={disabled} disabledReason={why}/>
        </div>
      </div>
    </header>
    <div className="vt-body">
      <div className="vt-info">
        <div className="vt-main">
          <p className="vt-number-label">{m.numberLabel}</p>
          <p className="vt-number" data-testid="ticket-waiting-number">{m.number}</p>
          {ticket.reference && <p className="vt-ref" data-testid="ticket-reference">{m.reference}</p>}
          <p className="vt-name" data-testid="ticket-patient-name">{m.patient}</p>
        </div>
        <div className="vt-facts">
          <div className="vt-visit"><small>{m.visitLabel}</small><strong>{m.visitPrimary}</strong><span>{m.visitSecondary}</span></div>
          <dl className="vt-dl">{m.facts.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
      </div>
      <div className="vt-qr">{qr ? <img src={qr} alt={m.qrAlt}/> : qrError ? <div role="alert" className="vt-qr-slot"><p style={{margin:"0 0 8px"}}>{qrError}</p><button type="button" className="button secondary" data-testid="button-retry-ticket-qr" onClick={() => setQrTry(n => n + 1)}>Retry QR</button></div> : <div className="vt-qr-slot vt-qr-loading" role="status" aria-label="Loading QR"/>}<small>{m.qrCaption}</small></div>
    </div>
    <footer className="vt-foot">
      <p>{note || m.footer}</p>
      {err && <p role="alert" data-testid="ticket-export-error">{err}</p>}
    </footer>
  </article>;
}
