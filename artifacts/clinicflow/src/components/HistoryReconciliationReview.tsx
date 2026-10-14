import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  getStaffHistoryReview, scanStaffHistoryReview, previewStaffHistoryEvidence,
  restoreStaffHistoryEvidence, markStaffHistoryUnresolved,
} from "@workspace/api-client-react";
import type { HistoryReviewPage, HistoryReviewRecord, HistoryEvidenceReview } from "@workspace/api-client-react";

const MAX = 100000;
const REASONS: { value: "original_missing" | "incomplete_evidence" | "conflicting_sources" | "unreadable_archive"; text: string }[] = [
  { value: "original_missing", text: "Original archive is missing" },
  { value: "incomplete_evidence", text: "Evidence is incomplete" },
  { value: "conflicting_sources", text: "Sources conflict" },
  { value: "unreadable_archive", text: "Archive is unreadable" },
];
const statusOf = (e: unknown) => (e as { status?: number } | null)?.status;
const ambiguous = (e: unknown) => { const s = statusOf(e); return s === undefined || s === 408 || s >= 500; };
const msgOf = (e: unknown) => { const m = (e as { message?: string } | null)?.message; return m && m.length < 240 ? m : "The server could not complete this request."; };
const OWN: Record<string, string> = {
  includes_target: "The original capture includes this staff account as a recipient, clinician or recorded actor.",
  excludes_target: "The original capture does not include this staff account among its captured subjects.",
  unknown: "Ownership is unknown. Unknown ownership blocks removal; it is not proof that this account owns the record.",
};

export interface HistoryReconciliationReviewProps {
  userId: string;
  actorId?: string;
  /** Parent busy / handoff guard: blocks conflicting changes. */
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
  /** Called after a decision so the live deletion impact is refreshed. */
  onDecision?: () => void;
}

export function HistoryReconciliationReview({ userId, actorId, disabled, onBusy, onDecision }: HistoryReconciliationReviewProps) {
  const uid = useId();
  const [page, setPage] = useState<HistoryReviewPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<HistoryReviewRecord | null>(null);
  const [evidence, setEvidence] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [preview, setPreview] = useState<HistoryEvidenceReview | null>(null);
  const [previewEvidence, setPreviewEvidence] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"" | "scan" | "preview" | "restore" | "unresolved">("");
  const lock = useRef(false);
  const epoch = useRef(0);
  const selection = useRef("");
  selection.current = `${selected?.id ?? ""}:${selected?.version ?? ""}`;
  const cbBusy = useRef(onBusy); cbBusy.current = onBusy;
  const cbDone = useRef(onDecision); cbDone.current = onDecision;
  useEffect(() => { cbBusy.current?.(!!busy || loading); return () => cbBusy.current?.(false); }, [busy, loading]);

  const clearEvidence = () => { setPreview(null); setPreviewEvidence(""); setConfirm(false); };
  const resetRecord = () => { setSelected(null); setEvidence(""); setFileNote(""); clearEvidence(); setReason(""); };

  // Scope change (actor/target): drop everything and invalidate in-flight work.
  useEffect(() => {
    epoch.current++; lock.current = false;
    setPage(null); setError(""); setNote(""); resetRecord(); setBusy(""); setLoading(false);
    if (!actorId || !userId) return;
    const my = epoch.current; setLoading(true);
    getStaffHistoryReview(userId).then(r => { if (my === epoch.current) setPage(r); })
      .catch(e => { if (my === epoch.current) setError(msgOf(e)); })
      .finally(() => { if (my === epoch.current) setLoading(false); });
  }, [userId, actorId]);

  const reload = useCallback(async (my: number) => {
    try { const r = await getStaffHistoryReview(userId); if (my === epoch.current) setPage(r); }
    catch (e) { if (my === epoch.current) setError(msgOf(e)); }
  }, [userId]);

  const blocked = !!busy || loading || !!disabled;
  const run = async (mode: "scan" | "preview" | "restore" | "unresolved", fn: (my: number) => Promise<void>) => {
    if (lock.current || blocked) return;
    lock.current = true; setBusy(mode); setError(""); setNote("");
    const my = epoch.current;
    try { await fn(my); }
    finally { if (my === epoch.current) { lock.current = false; setBusy(""); } }
  };
  const afterStale = async (my: number, e: unknown) => {
    if (statusOf(e) === 409) { clearEvidence(); setSelected(null); setNote("The history changed. The preview was cleared and the list refreshed. Check the evidence again."); await reload(my); }
    else if (ambiguous(e)) { clearEvidence(); setError("The response was not confirmed. Nothing was assumed; the list was re-read."); await reload(my); }
    else { setError(msgOf(e)); if (statusOf(e) === 400) clearEvidence(); }
  };

  const scan = (cursor: string | null) => run("scan", async my => {
    try {
      const r = cursor ? await scanStaffHistoryReview(userId, { cursor }) : await getStaffHistoryReview(userId);
      if (my !== epoch.current) return;
      setPage(r); resetRecord();
    } catch (e) { if (my === epoch.current) setError(msgOf(e)); }
  });

  const choose = (r: HistoryReviewRecord) => { if (blocked) return; setSelected(r); setEvidence(""); setFileNote(""); clearEvidence(); setReason(""); };
  const edit = (v: string) => { setEvidence(v.slice(0, MAX + 1)); clearEvidence(); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const my = epoch.current, selectedKey = selection.current;
    clearEvidence();
    if (f.size > 120_000) { setFileNote("This file exceeds the safe request size. Use a smaller original single-record export, or mark the record unresolved. Nothing was loaded."); return; }
    try {
      const t = await f.text();
      if (my !== epoch.current || selectedKey !== selection.current) return;
      if (t.length > MAX) { setEvidence(t.slice(0, MAX + 1)); setFileNote(`File has ${t.length} characters; the limit is ${MAX}.`); return; }
      setEvidence(t); setFileNote(`Loaded ${f.name} locally (${t.length} characters). It is not stored.`);
    } catch { if (my === epoch.current && selectedKey === selection.current) setFileNote("This local file could not be read. Nothing was loaded."); }
  };

  const tooLong = evidence.length > MAX ||
    new TextEncoder().encode(JSON.stringify({ historyId: selected?.id, version: selected?.version, evidence })).length > 120_000;
  const canPreview = !!selected && !!evidence.trim() && !tooLong && !blocked;
  const doPreview = () => selected && run("preview", async my => {
    clearEvidence();
    const sent = evidence;
    try {
      const r = await previewStaffHistoryEvidence(userId, { historyId: selected.id, version: selected.version, evidence: sent });
      if (my !== epoch.current) return;
      setPreview(r); setPreviewEvidence(sent);
    } catch (e) { if (my === epoch.current) await afterStale(my, e); }
  });
  const canRestore = !!selected && !!preview && preview.status === "eligible" && !!preview.reviewToken && preview.historyId === selected.id && preview.version === selected.version && previewEvidence === evidence && confirm && !blocked;
  const doRestore = () => selected && preview?.reviewToken && run("restore", async my => {
    try {
      const r = await restoreStaffHistoryEvidence(userId, { historyId: selected.id, version: selected.version, evidence: previewEvidence, reviewToken: preview.reviewToken!, confirmation: "restore" });
      if (my !== epoch.current) return;
      setNote(r.message || "Original proof restored. No history or account was deleted."); resetRecord(); await reload(my); cbDone.current?.();
    } catch (e) { if (my === epoch.current) { await afterStale(my, e); cbDone.current?.(); } }
  });
  const doUnresolved = () => selected && reason && run("unresolved", async my => {
    try {
      const r = await markStaffHistoryUnresolved(userId, { historyId: selected.id, version: selected.version, reason: reason as typeof REASONS[number]["value"] });
      if (my !== epoch.current) return;
      setNote((r.message || "Unresolved decision saved.") + " The record stays blocked; this is not permission to remove."); resetRecord(); await reload(my); cbDone.current?.();
    } catch (e) { if (my === epoch.current) { await afterStale(my, e); cbDone.current?.(); } }
  });

  const items = page?.items ?? [];
  return <section aria-labelledby={`${uid}-h`} data-testid="history-reconciliation" style={{ display: "grid", gap: 10 }} aria-busy={blocked || undefined}>
    <h3 id={`${uid}-h`}>Notification history evidence</h3>
    <p className="muted">Some older notification history has no proven original owner. Unknown ownership blocks removal of any staff account; it is not proof that {" "}this account owns the record. Nothing here deletes history or the account.</p>
    {loading && <div className="skeleton" role="status">Loading history review…</div>}
    {error && <p className="error-box" role="alert" data-testid="history-error">{error} <button type="button" disabled={blocked} onClick={() => void scan(null)}>Retry</button></p>}
    {note && <p className="notice" role="status" data-testid="history-note">{note}</p>}
    {page && <>
      <p className="muted" data-testid="history-scan-meta">Scanned {page.scannedCount} {page.scannedCount === 1 ? "record" : "records"} in this page; {items.length} still need review.{page.nextCursor ? " More records remain." : " No further pages."}</p>
      {items.length === 0 && <p className="muted">{page.nextCursor ? "No blocked records in this page. Continue to the next page." : "No blocked records were returned."}</p>}
      {items.length > 0 && <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {items.map(r => <li key={r.id} style={{ border: "1px solid hsl(var(--border))", borderRadius: 8, padding: 8 }} data-testid={`history-record-${r.id}`}>
          <strong>{r.channel} · {r.event}</strong> · <span className="badge">{r.status === "unresolved" ? "Unresolved" : "Blocked"}</span><br />
          <span className="muted">{r.envelopeCount} {r.envelopeCount === 1 ? "envelope" : "envelopes"} · <code>{r.id}</code></span>
          {r.status === "unresolved" && <div className="muted">Recorded reason: {r.unresolvedReason ? r.unresolvedReason.replace(/_/g, " ") : "none"}{r.reviewedAt ? ` · ${new Date(r.reviewedAt < 1e12 ? r.reviewedAt * 1000 : r.reviewedAt).toLocaleString()}` : ""}. Still blocks removal.</div>}
          <div><button type="button" aria-pressed={selected?.id === r.id} disabled={blocked} data-testid={`button-history-select-${r.id}`} onClick={() => choose(r)}>{selected?.id === r.id ? "Selected" : "Review evidence"}</button></div>
        </li>)}
      </ul>}
      <div><button type="button" disabled={blocked} data-testid="button-history-next" onClick={() => void scan(page.nextCursor)} hidden={!page.nextCursor}>Scan next page</button>{" "}
        <button type="button" disabled={blocked} data-testid="button-history-restart" onClick={() => void scan(null)}>{busy === "scan" ? "Scanning…" : "Start over"}</button></div>
    </>}
    {selected && <div style={{ display: "grid", gap: 8, padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }} data-testid="history-evidence-form">
      <h4>Evidence for <code>{selected.id}</code></h4>
      <p className="muted">Paste the original signed archive JSON ({"{id,data}"} or an array of those), or choose a local JSON file. Unsigned old backups, current names, contacts or outbox metadata cannot prove historical ownership. Evidence is sent only for checking and never saved in this browser. Limit {MAX} characters; very large files may exceed browser or request limits.</p>
      <label htmlFor={`${uid}-e`}>Original signed archive JSON</label>
      <textarea id={`${uid}-e`} rows={6} value={evidence} spellCheck={false} autoComplete="off" disabled={blocked} data-testid="input-history-evidence" aria-invalid={tooLong} onChange={e => edit(e.target.value)} />
      <p className={tooLong ? "error-box" : "muted"} role={tooLong ? "alert" : undefined}>{evidence.length} / {MAX} characters{tooLong ? ". Too long to send." : ""}</p>
      <label htmlFor={`${uid}-f`}>Or choose a JSON file</label>
      <input id={`${uid}-f`} type="file" accept="application/json,.json" disabled={blocked} data-testid="input-history-file" onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      {fileNote && <p className="muted" role="status">{fileNote}</p>}
      <div><button type="button" disabled={!canPreview} data-testid="button-history-preview" onClick={() => void doPreview()}>{busy === "preview" ? "Checking…" : "Check evidence (no changes)"}</button></div>
      {preview && previewEvidence === evidence && <div className="notice" role="status" data-testid="history-preview">
        <strong>{preview.status === "eligible" ? "Eligible for restore" : "Unresolved: proof not accepted"}</strong>
        <p>{preview.reason}</p><p>{OWN[preview.ownership]}</p>
        <p className="muted">{preview.ownership === "includes_target" ? "Includes" : preview.ownership === "excludes_target" ? "Excludes" : "Unknown for"} this account · {preview.sourceCount} sources · {preview.subjectCount} subjects · {preview.envelopeCount} envelopes</p>
        {preview.status === "eligible" && preview.reviewToken && <>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" checked={confirm} disabled={blocked} data-testid="checkbox-history-confirm" onChange={e => setConfirm(e.target.checked)} /><span>I confirm this is the original signed proof, and I understand restoring it deletes no history and no account.</span></label>
          <button type="button" disabled={!canRestore} data-testid="button-history-restore" onClick={() => void doRestore()}>{busy === "restore" ? "Restoring…" : "Restore verified original proof"}</button></>}
      </div>}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={blocked}>
        <legend>If proof cannot be found</legend>
        <label htmlFor={`${uid}-r`}>Unresolved reason</label>
        <select id={`${uid}-r`} value={reason} data-testid="select-history-reason" onChange={e => setReason(e.target.value)}><option value="">Select a reason…</option>{REASONS.map(r => <option key={r.value} value={r.value}>{r.text}</option>)}</select>
        <p className="muted">Saving this keeps the record blocked. It is never permission to remove the account.</p>
        <button type="button" disabled={!reason || blocked} data-testid="button-history-unresolved" onClick={() => void doUnresolved()}>{busy === "unresolved" ? "Saving…" : "Save unresolved decision"}</button>
      </fieldset>
    </div>}
  </section>;
}

export default HistoryReconciliationReview;
