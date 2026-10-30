import { useEffect, useRef, useState, type ReactNode } from "react";
import * as api from "@workspace/api-client-react";
import { Download, Mail, MessageSquare, Printer } from "lucide-react";
import { AppDialog } from "../AppDialog";
import { FormActions } from "../FormActions";
import { IconAction } from "../IconAction";
import { errorStatus, friendlyError, isFriendlyText } from "../../lib/friendly-error";
import { RecoveryActions } from "../RecoveryActions";
import { useServerWait } from "../../lib/use-server-wait";
import { downloadPdf, freshTicketHtml } from "./ticket-export";
import { canShowAppointmentTicket } from "./presentation";
import { TicketEmailDialog } from "./TicketEmailDialog";
import { useQueryClient } from "@tanstack/react-query";
import { clearBookingDraft } from "./booking-drafts";
import { refreshAppointmentObservers } from "./refresh";

export type TicketActionKey = "download" | "print" | "email" | "sms";
/** One ordered action model shared by the row menu and the Ticket & QR header. */
export const TICKET_ACTION_ORDER: TicketActionKey[] = ["download", "print", "email", "sms"];
const LABELS: Record<TicketActionKey, string> = { download: "Download Ticket", print: "Print Ticket", email: "Email Ticket", sms: "SMS Booking Status Link" };

export function useAppointmentTicketActions() {
  const client = useQueryClient();
  const [busy, setBusy] = useState<{ id: string; kind: "download" | "print" } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [emailFor, setEmailFor] = useState<api.Appointment | null>(null);
  const [smsFor, setSmsFor] = useState<api.Appointment | null>(null);
  const dialogId = smsFor?.id || emailFor?.id || "";
  const authority = api.useGetAppointment(dialogId, { query: {
    queryKey: api.getGetAppointmentQueryKey(dialogId), enabled: !!dialogId, retry: false, refetchInterval: 30000,
  } });
  const revoked = denied(authority.error);
  useEffect(() => { if (revoked) { setEmailFor(null); setSmsFor(null); } }, [revoked]);
  const lock = useRef(false);
  const closeAll = () => { setEmailFor(null); setSmsFor(null); };
  const failure = (a: api.Appointment, e: unknown) => {
    if (denied(e)) {
      clearBookingDraft(a.id); closeAll();
      void client.fetchQuery({ queryKey: api.getGetAppointmentQueryKey(a.id), queryFn: () => api.getAppointment(a.id), staleTime: 0, retry: false }).catch(() => {});
      void refreshAppointmentObservers(client);
      setError({ id: a.id, message: "Appointment unavailable. Private ticket details are hidden." });
    } else setError({ id: a.id, message: `${a.reference}: ${friendlyError(e,"load","Ticket could not be prepared. Try the ticket action again.")}` });
  };
  async function download(a: api.Appointment) {
    if (lock.current) return; lock.current = true; setError(null); setBusy({ id: a.id, kind: "download" });
    try { const { html, appointment } = await freshTicketHtml(a.id); await downloadPdf(html, `DigiQ-ticket-${appointment.reference}.pdf`, "ticket"); }
    catch (e) { failure(a, e); }
    finally { lock.current = false; setBusy(null); }
  }
  async function print(a: api.Appointment) {
    if (lock.current) return;
    // The popup must open synchronously inside the click; preparation is asynchronous afterwards.
    const w = window.open("", "_blank", "width=680,height=820");
    if (!w) { setError({ id: a.id, message: "Allow pop-ups to print this ticket, or use Download Ticket." }); return; }
    lock.current = true; setError(null); setBusy({ id: a.id, kind: "print" });
    w.opener = null; w.document.body.textContent = "Checking your ticket…";
    try {
      const { html } = await freshTicketHtml(a.id);
      if (w.closed) throw new Error("Print window closed. Try again.");
      w.document.open(); w.document.write(html); w.document.close();
      await Promise.all(Array.from(w.document.images).map(img => img.decode()));
      if (w.closed) throw new Error("Print window closed. Try again.");
      w.focus(); w.print();
    } catch (e) { w.close(); failure(a, e); }
    finally { lock.current = false; setBusy(null); }
  }
  const run = (key: TicketActionKey, a: api.Appointment) => key === "download" ? void download(a) : key === "print" ? void print(a) : key === "email" ? setEmailFor(a) : setSmsFor(a);
  /** Items for RowMenu, in the shared order. Completed visits have no ticket actions. */
  const menuItems = (a: api.Appointment, blocked: boolean) => !canShowAppointmentTicket(a) ? [] : TICKET_ACTION_ORDER.map(key => {
    const working = busy?.id === a.id && busy.kind === key;
    return { key: `ticket-${key}`, label: working ? (key === "print" ? "Checking Ticket…" : "Preparing PDF…") : LABELS[key] + (key === "email" ? "…" : ""), disabled: blocked || !!busy, testId: `action-ticket-${key}-${a.id}`, onSelect: () => run(key, a) };
  });
  const buttons = (a: api.Appointment, blocked: boolean, className = "vt-icon-action") => <div className="vt-actions" role="group" aria-label="Ticket Actions" data-testid="group-ticket-actions">
    {TICKET_ACTION_ORDER.map(key => {
      const icon = key === "download" ? <Download size={16} aria-hidden /> : key === "print" ? <Printer size={16} aria-hidden /> : key === "email" ? <Mail size={16} aria-hidden /> : <MessageSquare size={16} aria-hidden />;
      const working = busy?.id === a.id && busy.kind === key;
      return <IconAction key={key} className={className} testId={`button-ticket-${key}`} label={working ? (key === "print" ? "Checking Ticket…" : "Preparing PDF…") : LABELS[key]} hint={key === "print" ? "Print Ticket — prints on A4 with the ticket centred" : LABELS[key]} icon={icon} onClick={() => run(key, a)} disabled={blocked || !!busy} disabledReason={busy ? "Checking the latest ticket first." : "Reconnect and refresh the ticket first."} />;
    })}
  </div>;
  const errorFor = (id: string): ReactNode => error?.id === id ? <p role="alert" className="notice" data-testid="status-ticket-action-error">{error.message} <button type="button" onClick={() => setError(null)}>Dismiss</button></p> : null;
  const dialogs = revoked ? null : <>
    <TicketEmailDialog open={!!emailFor} items={emailFor ? [{ id: emailFor.id, label: `${emailFor.patientName} · ${emailFor.reference}` }] : []} onClose={() => setEmailFor(null)} />
    <SmsLinkDialog appointment={smsFor} onClose={() => setSmsFor(null)} />
  </>;
  return { closeAll, menuItems, buttons, errorFor, dialogs };
}

const denied = (e: unknown) => { const st = errorStatus(e); return st === 401 || st === 403 || st === 404; };
type SendState = "sending" | "failed" | "provider_accepted" | "provider_rejected" | "pre_dispatch_failed" | "delivery_unknown" | "blocked";
/** Recipient and approved message are shown before an explicit send. Uncertain outcomes are never retried automatically. */
export function SmsLinkDialog({ appointment, onClose }: { appointment: api.Appointment | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return <AppDialog open={!!appointment} busy={busy} onClose={onClose} title="SMS Booking Status Link">{appointment && <SmsLinkBody key={appointment.id} appointment={appointment} onClose={onClose} onBusy={setBusy} />}</AppDialog>;
}
function SmsLinkBody({ appointment, onClose, onBusy }: { appointment: api.Appointment; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const [preview, setPreview] = useState<api.BookingStatusSmsPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadCause,setLoadCause]=useState<unknown>();
  const limit=useServerWait();
  const [state, setState] = useState<SendState | "">("");
  const [reason, setReason] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const lock = useRef(false);
  const [privateDenied, setPrivateDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setPreview(null); setLoadError("");
    void api.getBookingStatusSmsPreview(appointment.id).then(value => { if (live) setPreview(value); }, e => {
      if (!live) return;
      setPrivateDenied(denied(e));
      setLoadCause(e);
      setLoadError(denied(e) ? "This appointment is unavailable. Private details are hidden." : friendlyError(e, "load"));
    });
    return () => { live = false; };
  }, [appointment.id, attempt]);
  async function send() {
    if (lock.current || limit.wait>0 || !preview?.eligible) return;
    if(!navigator.onLine){setReason("You’re offline. Reconnect before checking this request.");setState("failed");return;}
    lock.current = true; onBusy(true); setState("sending"); setReason("");
    try { const res = await api.sendBookingStatusSms(appointment.id, { requestId: requestId.current, previewToken: preview.previewToken }); setState(res.state); setReason(isFriendlyText(res.reason)?res.reason:""); }
    catch (e) { limit.record(e);if (denied(e)) { setPrivateDenied(true); setPreview(null);setLoadCause(e); setLoadError("This appointment is unavailable. Private details are hidden."); setState(""); } else { setState("failed"); setReason("We couldn’t confirm whether it was sent. Check for the SMS before checking the same request again."); } }
    finally { lock.current = false; onBusy(false); }
  }
  const sending = state === "sending";
  const final = state === "provider_accepted" || state === "provider_rejected" || state === "blocked";
  return <div data-testid="dialog-sms-link">
    {!privateDenied && <p className="muted">{appointment.patientName} · {appointment.reference}. Check the recipient below before sending. Sending is available only when this visit meets the clinic’s requirements.</p>}
    {!preview && !loadError ? <div className="appt-detail-skeleton" role="status" aria-label="Loading SMS preview"><span /><span /></div>
      : loadError ? <div role="alert">{loadError}<RecoveryActions error={loadCause} onRetry={()=>setAttempt(n=>n+1)} label="Check recipient again"/></div>
      : !preview!.eligible ? <p role="alert" className="notice" data-testid="text-sms-blocked">SMS not available: {isFriendlyText(preview!.reason)?preview!.reason:"This visit can’t receive an SMS. Ask your clinic administrator for help."}</p>
      : <div data-testid="preview-sms"><p>To <code data-testid="text-sms-recipient">{preview!.recipient}</code></p><blockquote className="sms-preview" data-testid="text-sms-message">{preview!.message}</blockquote></div>}
    {sending && <p role="status">Sending…</p>}
    {state === "provider_accepted" && <p role="status" className="ok" data-testid="status-sms-result">SMS submitted. It may take a few minutes to arrive; delivery to the phone isn’t confirmed.</p>}
    {state === "provider_rejected" && <p role="alert" data-testid="status-sms-result">The SMS could not be sent. Ask the system administrator to check the SMS settings.{reason && ` ${reason}`}</p>}
    {state === "blocked" && <p role="alert" data-testid="status-sms-result">Not sent: {reason || "Blocked by policy."}</p>}
    {state === "pre_dispatch_failed" && <p role="alert" data-testid="status-sms-result">The SMS was not sent.{reason && ` ${reason}`} Close and review the recipient and settings before another attempt.</p>}
    {state === "delivery_unknown" && <p role="alert" data-testid="status-sms-result">We couldn’t confirm whether the SMS was sent. It may still arrive. Check for it before checking the same request; this will not start a new send.</p>}
    {state === "failed" && <p role="alert" data-testid="status-sms-result">Failed: {reason}</p>}
    {state==="provider_accepted"?<button type="button" className="button" onClick={onClose}>Done</button>:<FormActions wide={false} onCancel={onClose} cancelLabel={final ? "Close" : "Cancel"} busy={sending} busyLabel="Sending…" disabled={!preview?.eligible || final||limit.wait>0} onSubmit={() => void send()} submitTestId="button-sms-confirm" submitLabel={limit.wait>0?`Try again in ${limit.wait}s`:state === "delivery_unknown" || state === "failed" || state === "pre_dispatch_failed" ? "Check same request" : "Send SMS"} />}
  </div>;
}
