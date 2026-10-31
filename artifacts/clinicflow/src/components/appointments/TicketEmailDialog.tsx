import { FormActions } from "../FormActions";
import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { AppDialog, AppDialogActions } from "../AppDialog";
import { CheckCircle2, Check } from "lucide-react";
import { friendlyError, isFriendlyText, errorStatus } from "../../lib/friendly-error";
import { RecoveryActions } from "../RecoveryActions";
import "./ticket-email-dialog.css";

type Row = { id: string; label: string; preview?: api.TicketEmailPreview; error?: string; cause?:unknown; checking?:boolean; state?: "sending" | api.TicketEmailResultState | "failed"; failure?: string };

/** Ticket email with a mandatory recipient preview. The server rechecks recipient, scope and environment
 *  and attaches its own PDF. Each appointment keeps one requestId for this dialog session, so a manual
 *  resend after an unknown outcome is idempotent. Unknown outcomes are never retried automatically. */
export function TicketEmailDialog({ open, items, onClose }: { open: boolean; items: { id: string; label: string }[]; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const lock = useRef(false);
  const generation=useRef(0);
  const [notice,setNotice]=useState("");
  const key = items.map(i => i.id).join(",");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    generation.current++;setNotice("");
    requestIds.current = new Map();
    setRows(items.map(i => ({ ...i }))); setLoading(true);
    void Promise.all(items.map(async i => {
      try { return { ...i, preview: await api.getTicketEmailPreview(i.id) }; }
      catch (e) { return { ...i, error: friendlyError(e, "load","We couldn’t check this recipient."), cause:e }; }
    })).then(next => { if (!cancelled) { setRows(next); setLoading(false); } });
    return () => { cancelled = true;generation.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);
  const patch = (id: string, change: Partial<Row>) => setRows(list => list.map(r => r.id === id ? { ...r, ...change } : r));
  const previewLocks=useRef(new Set<string>());
  async function checkRecipient(r:Row){
    if(previewLocks.current.has(r.id)||lock.current)return;
    const epoch=generation.current;
    previewLocks.current.add(r.id);patch(r.id,{checking:true});
    try{const preview=await api.getTicketEmailPreview(r.id);if(epoch===generation.current)patch(r.id,{preview,error:undefined,cause:undefined,state:undefined,failure:undefined});}
    catch(e){if(epoch===generation.current)patch(r.id,{error:friendlyError(e,"load","We couldn’t check this recipient."),cause:e});}
    finally{previewLocks.current.delete(r.id);if(epoch===generation.current)patch(r.id,{checking:false});}
  }
  async function send(targets: Row[]) {
    if (lock.current) return;
    if (!navigator.onLine) {setNotice("You’re offline. Reconnect, then use the same action again. No new email was requested.");return;}
    setNotice("");
    lock.current = true; setBusy(true);
    for (const r of targets) {
      if (!r.preview?.eligible || r.state === "provider_accepted") continue;
      let requestId = requestIds.current.get(r.id);
      if (!requestId) { requestId = crypto.randomUUID(); requestIds.current.set(r.id, requestId); }
      patch(r.id, { state: "sending", failure: undefined });
      try { const res = await api.sendTicketEmail(r.id, { requestId, recipient: r.preview.recipient }); patch(r.id, { state: res?.state === "provider_accepted" ? "provider_accepted" : "unknown" }); }
      catch (e) { patch(r.id, { state: "failed", failure: friendlyError(e, "save","We couldn’t confirm the result. Check the same request before sending anything new."),cause:e }); }
    }
    lock.current = false; setBusy(false);
  }
  const eligible = rows.filter(r => r.preview?.eligible);
  const pendingFirst = eligible.filter(r => !r.state);
  const done = rows.some(r => r.state && r.state !== "sending");
  const complete = done && !busy && !pendingFirst.length;
  const success = complete && rows.length > 0 && rows.every(r => r.state === "provider_accepted");
  const affected = rows.filter(r => r.state !== "provider_accepted");
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && complete) actions.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open, complete]);
  return <AppDialog open={open} onClose={onClose} busy={busy} title={items.length === 1 ? "Email Ticket" : `Email ${items.length} Tickets`}>
    {!done && <p className="muted">Check each email address before sending. Each email includes the visit ticket PDF.</p>}
    {notice&&<p role="alert">{notice}</p>}
    {success ? <div className="ticket-email-success" role="status" data-testid="status-email-success">
      <CheckCircle2 size={28} aria-hidden="true" />
      <p>{items.length === 1 ? "Ticket email sent successfully." : "Ticket emails sent successfully."}</p>
    </div> : loading ? <div className="appt-detail-skeleton" role="status" aria-label="Loading recipients"><span /><span /></div> : <>
      {done && !busy && <p className="ticket-email-attention" role="status">{rows.some(r => r.state === "provider_accepted") ? "Some ticket emails need attention." : "Ticket email needs attention."}</p>}
      <ul className="ticket-email-list" data-testid="list-ticket-email">{(done ? affected : rows).map(r => <li key={r.id} data-testid={`row-ticket-email-${r.id}`}>
        {(!done || items.length > 1) && <strong>{r.label}</strong>}
        {r.error ? <div role="alert">{r.error}<RecoveryActions error={r.cause} onRetry={()=>checkRecipient(r)} busy={busy||r.checking} label="Check recipient again"/></div>
          : r.preview?.eligible ? !r.state && <span>To <code data-testid={`text-email-recipient-${r.id}`}>{r.preview.recipient}</code></span>
          : <span role="alert" data-testid={`text-email-disabled-${r.id}`}>{isFriendlyText(r.preview?.reason)?r.preview.reason:"This ticket can’t be emailed. Ask your clinic administrator for help."}</span>}
        {r.state === "sending" && <span role="status">Sending…</span>}
        {r.state === "unknown" && <span role="alert">We couldn’t confirm whether the email was sent. It may still arrive. <button type="button" disabled={busy} onClick={() => void send([r])} data-testid={`button-email-resend-${r.id}`}>Check same request</button></span>}
        {r.state === "failed" && <div role="alert">{r.failure}{errorStatus(r.cause)===409?<button type="button" disabled={busy||r.checking} onClick={()=>void checkRecipient(r)}>{r.checking?"Checking recipient…":"Review recipient"}</button>:<RecoveryActions error={r.cause} busy={busy} onRetry={()=>send([r])} label="Retry same request"/>}</div>}
      </li>)}</ul></>}
    <AppDialogActions><div ref={actions}>
      {done&&!pendingFirst.length?<FormActions wide={false} busy={busy} busyLabel="Sending…" onSubmit={onClose} submitTestId="button-email-ok" submitLabel={<><Check size={17} aria-hidden="true"/>OK</>}/>:<FormActions wide={false} onCancel={onClose} cancelLabel="Cancel" busy={busy} busyLabel="Sending…" disabled={loading || !pendingFirst.length || rows.some(r=>r.checking)} onSubmit={() => void send(pendingFirst)} submitTestId="button-email-confirm" submitLabel={pendingFirst.length ? `Send ${pendingFirst.length} ${pendingFirst.length === 1 ? "Email" : "Emails"}` : "Nothing to send"} />}
    </div></AppDialogActions>
  </AppDialog>;
}
