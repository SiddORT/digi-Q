import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { BRAND_LOGO_URL, BRAND_NAME } from "../../branding";
import "./visit-ticket.css";

export type TicketData = {
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
export const sessionRange = (t: TicketData) => t.startTime || t.endTime ? `${t.startTime || "—"} – ${t.endTime || "—"}${t.timezone ? ` (${t.timezone})` : ""}` : "Session time set by clinic";
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
  const rows: [string, string][] = [["Clinic", t.clinicName], ["Location", t.branchName], ...(t.address ? [["Address", t.address] as [string, string]] : []), ["Doctor", t.doctorName], ["Date", t.date], ["Session", sessionRange(t)]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND_NAME} ticket ${esc(t.reference || "")}</title>
<style>body{font-family:system-ui,sans-serif;background:#f0f9fd;color:#10274e;margin:0;padding:24px}.t{max-width:560px;margin:auto;background:#fff;border:1px solid #c9e3ed;border-radius:16px;overflow:hidden}.h{background:#edfaff;color:#10274e;padding:4px 20px;border-bottom:1px solid #c9e3ed;display:flex;align-items:center;gap:8px;font-weight:700}.h img{display:block;width:108px;height:54px;object-fit:contain;flex:none}.b{padding:20px}.n{font:700 56px/1 ui-monospace,monospace;color:#087cb7;margin:4px 0 8px}.l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}td{padding:3px 12px 3px 0;vertical-align:top}td:first-child{opacity:.65}.f{border-top:2px dashed #c9e3ed;padding:12px 20px;font-size:13px;background:#e9f8fc}.qr{display:block;margin:14px auto 0;width:180px}@media(max-width:420px){.h{flex-wrap:wrap;gap:0 8px}}@media print{body{background:none;padding:0}}</style></head><body><div class="t"><div class="h"><img src="${esc(logo)}" alt="DigiQ Doctors logo"><span>Visit ticket</span></div><div class="b">
<p>Status: <strong>${esc(t.statusLabel || "Booked")}</strong></p><div class="l">Waiting number</div><div class="n">${esc(t.waitingNumber || "—")}</div>${t.reference ? `<div>Reference <strong>${esc(t.reference)}</strong></div>` : ""}
<h2 style="margin:14px 0 8px;overflow-wrap:anywhere">${esc(t.patientName)}</h2><table style="width:100%;table-layout:fixed;overflow-wrap:anywhere">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
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
  const file = `clinicflow-ticket-${(ticket.reference || ticket.waitingNumber || "visit").replace(/[^a-z0-9-]/gi, "")}.html`;
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
        const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const a = document.createElement("a"); a.href = url; a.download = file; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) { w?.close(); setErr(e instanceof Error ? e.message : "Ticket could not be prepared. Try again."); }
    finally { lock.current = false; setBusy(""); }
  }
  const disabled = !!busy || exportDisabled || !qr;
  return <article className="vt" data-testid={testId} aria-label="Visit ticket">
    <header className="vt-head"><div className="vt-head-brand"><img src={BRAND_LOGO_URL} alt="DigiQ Doctors logo"/><h2>Visit ticket</h2></div><span className="vt-badge" data-testid="ticket-status">{ticket.statusLabel || "Booked"}</span></header>
    <div className="vt-body">
      <div>
        <p className="vt-number-label">Waiting number</p>
        <p className="vt-number" data-testid="ticket-waiting-number">{ticket.waitingNumber || "—"}</p>
        {ticket.reference && <p className="vt-ref" data-testid="ticket-reference">Ref {ticket.reference}</p>}
        <p className="vt-name">{ticket.patientName}</p>
        <dl className="vt-dl">
          <dt>Clinic</dt><dd>{ticket.clinicName}</dd>
          <dt>Location</dt><dd>{ticket.branchName}</dd>
          {ticket.address && <><dt>Address</dt><dd>{ticket.address}</dd></>}
          <dt>Doctor</dt><dd>{ticket.doctorName}</dd>
          <dt>Date</dt><dd>{ticket.date}</dd>
          <dt>Session</dt><dd>{sessionRange(ticket)}</dd>
        </dl>
      </div>
      <div className="vt-qr">{qr ? <img src={qr} alt="Personal visit QR"/> : qrError ? <div role="alert" style={{ width: 160 }}><p style={{margin:"0 0 8px"}}>{qrError}</p><button type="button" className="button secondary" data-testid="button-retry-ticket-qr" onClick={() => setQrTry(n => n + 1)}>Retry QR</button></div> : <div style={{ width: 160, height: 160 }} role="status" aria-label="Loading QR"/>}<small>Personal QR for reception. Keep it private.</small></div>
    </div>
    <footer className="vt-foot">
      <p>{note || "Show this ticket at reception. The session is a time range, not an exact consultation time."}</p>
      <div className="vt-actions">
        <button type="button" className="button" data-testid="button-download-ticket" onClick={() => void run("download")} disabled={disabled}>{busy==="download"?"Checking ticket…":"Download ticket"}</button>
        <button type="button" className="button secondary" data-testid="button-print-ticket" onClick={() => void run("print")} disabled={disabled}>{busy==="print"?"Checking ticket…":"Print ticket"}</button>
      </div>
      {err && <p role="alert" data-testid="ticket-export-error">{err}</p>}
    </footer>
  </article>;
}
