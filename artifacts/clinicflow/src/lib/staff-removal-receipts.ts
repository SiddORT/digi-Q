/** Safe, per-actor removal receipts: operation id and counts only. No names, contacts or target ids. */
export interface StoredRemoval { operationId: string; state: "complete" | "cleanup_pending"; files: number; verifiedFiles: number; savedAt: number }
const PREFIX = "clinicflow:staff-removals:";
const MAX = 20;
const key = (actorId: string) => `${PREFIX}${actorId}`;
const valid = (v: unknown): v is StoredRemoval => { const r = v as StoredRemoval | null; return !!r && typeof r.operationId === "string" && r.operationId.length > 0 && r.operationId.length < 200 && (r.state === "complete" || r.state === "cleanup_pending") && Number.isFinite(r.files) && Number.isFinite(r.verifiedFiles); };
export function readRemovals(actorId?: string): StoredRemoval[] {
  if (!actorId) return [];
  try { const v = JSON.parse(localStorage.getItem(key(actorId)) || "[]"); return Array.isArray(v) ? v.filter(valid) : []; } catch { return []; }
}
export function saveRemoval(actorId: string | undefined, r: { operationId: string; state: "complete" | "cleanup_pending"; files: number; verifiedFiles: number }) {
  if (!actorId) return;
  try {
    const rest = readRemovals(actorId).filter(x => x.operationId !== r.operationId);
    const next = [{ operationId: r.operationId, state: r.state, files: r.files, verifiedFiles: r.verifiedFiles, savedAt: Date.now() }, ...rest];
    // Keep every pending item; trim only old completed ones.
    const kept = [...next.filter(x => x.state === "cleanup_pending"), ...next.filter(x => x.state === "complete").slice(0, MAX)];
    localStorage.setItem(key(actorId), JSON.stringify(kept));
    window.dispatchEvent(new CustomEvent("staff-removals-changed"));
  } catch { /* storage unavailable: the in-memory receipt still shows */ }
}
/** Remove receipts of every actor except the signed-in one (call on auth changes). */
export function purgeOtherActors(actorId?: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && k !== (actorId ? key(actorId) : "")) localStorage.removeItem(k); }
  } catch { /* ignore */ }
}
