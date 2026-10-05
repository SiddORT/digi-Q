import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { AppDialog } from "../AppDialog";
import { friendlyError } from "../../lib/friendly-error";

type Row = { id: string; label: string; preview?: api.TicketEmailPreview; error?: string; state?: "sending" | api.TicketEmailResultState | "failed"; failure?: string };

/** Ticket email with a mandatory recipient preview. The server rechecks recipient, scope and environment
 *  and attaches its own PDF. Each appointment keeps one requestId for this dialog session, so a manual
 *  resend after an unknown outcome is idempotent. Unknown outcomes are never retried automatically. */
export function TicketEmailDialog({ open, items, onClose }: { open: boolean; items: { id: string; label: string }[]; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestIds = useRef(new Map<string, string>());
  const lock = useRef(false);
  const key = items.map(i => i.id).join(",");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    requestIds.current = new Map();
    setRows(items.map(i => ({ ...i }))); setLoading(true);
    void Promise.all(items.map(async i => {
      try { return { ...i, preview: await api.getTicketEmailPreview(i.id) }; }
      catch (e) { return { ...i, error: friendlyError(e, "load") }; }
    })).then(next => { if (!cancelled) { setRows(next); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);
  const patch = (id: string, change: Partial<Row>) => setRows(list => list.map(r => r.id === id ? { ...r, ...change } : r));
  async function send(targets: Row[]) {
    if (lock.current || !navigator.onLine) return;
    lock.current = true; setBusy(true);
    for (const r of targets) {
      if (!r.preview?.eligible) continue;
      let requestId = requestIds.current.get(r.id);
      if (!requestId) { requestId = crypto.randomUUID(); requestIds.current.set(r.id, requestId); }
      patch(r.id, { state: "sending", failure: undefined });
      try { const res = await api.sendTicketEmail(r.id, { requestId, recipient: r.preview.recipient }); patch(r.id, { state: res.state }); }
      catch (e) { patch(r.id, { state: "failed", failure: friendlyError(e, "save") }); }
    }
    lock.current = false; setBusy(false);
  }
  const eligible = rows.filter(r => r.preview?.eligible);
  const pendingFirst = eligible.filter(r => !r.state);
  const accepted = rows.filter(r => r.state === "provider_accepted").length;
  const unknown = rows.filter(r => r.state === "unknown").length;
  const failed = rows.filter(r => r.state === "failed").length;
  const done = rows.some(r => r.state && r.state !== "sending");
  return <AppDialog open={open} onClose={onClose} busy={busy} title={items.length === 1 ? "Email Ticket" : `Email ${items.length} Tickets`}>
    <p className="muted">Confirm each recipient. The clinic server checks access again and attaches the ticket PDF. Ineligible tickets are not sent.</p>
    {loading ? <div className="appt-detail-skeleton" role="status" aria-label="Loading recipients"><span /><span /></div> :
      <ul className="ticket-email-list" data-testid="list-ticket-email">{rows.map(r => <li key={r.id} data-testid={`row-ticket-email-${r.id}`}>
        <strong>{r.label}</strong>
        {r.error ? <span role="alert">Recipient check failed: {r.error}</span>
          : r.preview?.eligible ? <span>To <code data-testid={`text-email-recipient-${r.id}`}>{r.preview.recipient}</code></span>
          : <span className="muted" data-testid={`text-email-disabled-${r.id}`}>Not sent: {r.preview?.reason || "Not eligible"}</span>}
        {r.state === "sending" && <span role="status">Sending…</span>}
        {r.state === "provider_accepted" && <span className="ok" role="status">Accepted by email provider</span>}
        {r.state === "unknown" && <span role="alert">Outcome unknown. It may still arrive. Check before resending; a resend reuses the same request and will not duplicate. <button type="button" disabled={busy} onClick={() => void send([r])} data-testid={`button-email-resend-${r.id}`}>Resend Same Request</button></span>}
        {r.state === "failed" && <span role="alert">Failed: {r.failure} <button type="button" disabled={busy} onClick={() => void send([r])} data-testid={`button-email-retry-${r.id}`}>Retry</button></span>}
      </li>)}</ul>}
    {done && <p role="status" data-testid="status-email-summary">{accepted} accepted, {unknown} unknown, {failed} failed, {rows.length - eligible.length} not eligible.</p>}
    <div className="form-footer">
      <button type="button" disabled={busy} onClick={onClose}>{done ? "Close" : "Cancel"}</button>
      <button type="button" className="button" disabled={loading || busy || !pendingFirst.length} onClick={() => void send(pendingFirst)} data-testid="button-email-confirm">{busy ? "Sending…" : pendingFirst.length ? `Send ${pendingFirst.length} ${pendingFirst.length === 1 ? "Email" : "Emails"}` : "Nothing to Send"}</button>
    </div>
  </AppDialog>;
}
