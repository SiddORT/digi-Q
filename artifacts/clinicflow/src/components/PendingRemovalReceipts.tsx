import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { purgeOtherActors, readRemovals, saveRemoval, type StoredRemoval } from "../lib/staff-removal-receipts";

type Receipt = { operationId: string; state: "complete" | "cleanup_pending"; files: number; verifiedFiles: number; pendingReasons: string[] };
const base = "/api/management/staff-removals";

/** Keeps removals whose personal-file cleanup is still pending visible across dialog close and reload. */
export function PendingRemovalReceipts({ actorId }: { actorId?: string }) {
  const client = useQueryClient();
  const [items, setItems] = useState<StoredRemoval[]>([]);
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const lock = useRef(false);
  const refresh = useCallback(() => setItems(readRemovals(actorId).filter(r => r.state === "cleanup_pending")), [actorId]);
  useEffect(() => { purgeOtherActors(actorId); refresh(); }, [actorId, refresh]);
  useEffect(() => {
    window.addEventListener("staff-removals-changed", refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("staff-removals-changed", refresh); window.removeEventListener("storage", refresh); };
  }, [refresh]);
  if (!actorId || !items.length) return null;
  const act = async (op: string, kind: "status" | "retry") => {
    if (lock.current) return; lock.current = true; setBusy(`${kind}:${op}`);
    try {
      const r = await customFetch<Receipt>(kind === "status" ? `${base}/${op}` : `${base}/${op}/retry-cleanup`, { method: kind === "status" ? "GET" : "POST" });
      saveRemoval(actorId, r);
      setNotes(n => ({ ...n, [op]: r.state === "complete" ? "Cleanup finished." : (r.pendingReasons[0] || "Cleanup is still pending.") }));
      void client.invalidateQueries();
    } catch (e) {
      const s = (e as { status?: number } | null)?.status;
      setNotes(n => ({ ...n, [op]: s === 404 ? "No committed receipt was found for this operation." : "Status could not be confirmed. Try again." }));
    } finally { lock.current = false; setBusy(""); refresh(); }
  };
  return <section className="notice" aria-labelledby="pending-removals-h" data-testid="pending-removals">
    <h3 id="pending-removals-h">Staff removals with cleanup pending</h3>
    <p>These accounts are already removed. Only personal file cleanup remains, and it can be retried safely.</p>
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
      {items.map(r => <li key={r.operationId} data-testid={`pending-removal-${r.operationId}`} style={{ overflowWrap: "anywhere" }}>
        Operation <code>{r.operationId}</code> · files verified {r.verifiedFiles} of {r.files}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <button type="button" disabled={!!busy} onClick={() => void act(r.operationId, "status")}>{busy === `status:${r.operationId}` ? "Checking…" : "Check status"}</button>
          <button type="button" disabled={!!busy} onClick={() => void act(r.operationId, "retry")}>{busy === `retry:${r.operationId}` ? "Retrying…" : "Retry cleanup"}</button>
        </div>
        {notes[r.operationId] && <p role="status">{notes[r.operationId]}</p>}
      </li>)}
    </ul>
  </section>;
}
