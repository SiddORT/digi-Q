import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { customFetch, getGetStaffDeletionImpactQueryKey, useGetStaffDeletionImpact } from "@workspace/api-client-react";
import type { StaffDeletionImpact } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { saveRemoval } from "../lib/staff-removal-receipts";
import { HistoryReconciliationReview } from "./HistoryReconciliationReview";
import { SessionSelector, useDailySession } from "./queue/SessionSelector";
import { DateFormatInput } from "./DateFormatInput";
import { SearchableSelect } from "./SearchableSelect";

export interface StaffDeletionTargetRef { /** Sign-in user id (never the doctor profile id). */ userId: string; name: string }
export interface StaffDeletionReviewProps {
  target: StaffDeletionTargetRef | null;
  actorId?: string;
  onClose: () => void;
  /** Called once the account removal is committed (complete or cleanup_pending). */
  onRemoved?: (receipt: Receipt) => void;
}
export interface Receipt { operationId: string; accountRemoved: boolean; state: "complete" | "cleanup_pending"; files: number; verifiedFiles: number; pendingReasons: string[] }
type ImpactX = StaffDeletionImpact & { operationId?: string | null };
type HDoctor = { id: string; userId: string; fullName: string; branches: { id: string; clinicId: string; name: string }[] };
type HAdmin = { id: string; fullName: string; email: string };
type HVisit = { id: string; patientId: string; patientName: string; clinicId: string; branchId: string; date: string; startTime: string | null; timezone: string; revision: number; status: string; checkedInAt: string | null };
type Options = { doctors: HDoctor[]; admins: HAdmin[]; visits: HVisit[] };
type Move = { appointmentId: string; doctorId: string; branchId: string; date: string; expectedRevision: number; sessionId?: string; startTime?: string; reason?: string };
type Proposal = { kind: "clinic-responsibilities" | "visits"; operationId: string; version: string; proposal: unknown; reviewToken: string; visits?: unknown[] };

const ROLE_COPY: Record<string, string> = {
  doctor: "Doctor: open care (waiting, scheduled or in-progress visits) must be moved to another doctor or resolved before removal. Completed visits are historical and stay on the patient record with the doctor's name as it was.",
  clinicAdmin: "Clinic Admin: clinics, staff and settings owned by this administrator must be handed to another administrator first. Anything without a confirmed owner remains a blocker.",
  receptionist: "Receptionist: clinic and location assignments end with the account. Check the assignments listed below; historical actions they recorded are preserved.",
  superAdmin: "Super Admin: platform administrators are protected. The server decides whether this account may ever be removed, and the last Super Admin can never be removed.",
};
const label = (s: string) => s.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
const statusOf = (e: unknown) => (e as { status?: number } | null)?.status;
const ambiguous = (e: unknown) => { const s = statusOf(e); return s === undefined || s === 408 || s >= 500; };
const msgOf = (e: unknown) => { const m = (e as { message?: string } | null)?.message; return m && m.length < 240 ? m : "The server could not complete this request."; };
const BASE = "/api/management";
const post = <T,>(path: string, body?: unknown) => customFetch<T>(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = <T,>(path: string) => customFetch<T>(`${BASE}${path}`, { method: "GET" });

function Ids({ ids }: { ids?: string[] }) {
  if (!ids?.length) return null;
  return <ul className="muted" style={{ margin: "4px 0 0", paddingLeft: 18, overflowWrap: "anywhere" }}>{ids.map(id => <li key={id}><code>{id}</code></li>)}</ul>;
}

function VisitMove({ visit, doctors, onMove }: { visit: HVisit; doctors: HDoctor[]; onMove: (id: string, m: Move | null) => void }) {
  const [doctorId, setDoctorId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const doctor = doctors.find(d => d.id === doctorId);
  const selection = useDailySession({ doctorId, branchId, date, bookingMode: "advance" });
  const a = selection.availability.data;
  const ready = !!doctor && doctor.branches.some(b => b.id === branchId) && /^\d{4}-\d{2}-\d{2}$/.test(date) && !!selection.sessionId && !!a && a.available && !selection.availability.isFetching && !selection.selectionIssue;
  const cb = useRef(onMove); cb.current = onMove;
  const key = ready ? JSON.stringify([doctorId, branchId, date, selection.sessionId, a?.startTime, reason]) : "";
  useEffect(() => {
    cb.current(visit.id, ready && a ? { appointmentId: visit.id, doctorId, branchId, date, expectedRevision: visit.revision, sessionId: selection.sessionId, startTime: a.startTime ?? undefined, reason: reason.trim() || undefined } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, visit.id]);
  useEffect(() => () => cb.current(visit.id, null), [visit.id]);
  const idp = `mv-${visit.id}`;
  return <div style={{ display: "grid", gap: 8, padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }} data-testid={`handoff-visit-${visit.id}`}>
    <div><label htmlFor={`${idp}-d`}>New doctor</label>
      <SearchableSelect id={`${idp}-d`} value={doctorId} onChange={v => { setDoctorId(v); setBranchId(""); }} options={doctors.map(d => ({ value: d.id, label: d.fullName }))} /></div>
    {doctor && <div><label htmlFor={`${idp}-b`}>Location</label>
      <SearchableSelect id={`${idp}-b`} value={branchId} onChange={setBranchId} options={doctor.branches.map(b => ({ value: b.id, label: b.name }))} /></div>}
    <div><label htmlFor={`${idp}-t`}>Date</label><DateFormatInput id={`${idp}-t`} value={date} onChange={setDate} /></div>
    {doctorId && branchId && date && <SessionSelector selection={selection} />}
    <div><label htmlFor={`${idp}-r`}>Reason (optional)</label><input id={`${idp}-r`} maxLength={200} value={reason} onChange={e => setReason(e.target.value)} /></div>
    <p className="muted" role="status">{ready ? "Session chosen. This visit is included in the review." : "Choose a doctor, location, date and an available session to include this visit."}</p>
  </div>;
}

function Handoff({ userId, kind, version, onCommitted, onClose, disabled, onBusy }: { userId: string; kind: "visits" | "clinic-responsibilities"; version: string; onCommitted: (r: unknown) => void; onClose: () => void; disabled: boolean; onBusy: (kind: string, busy: boolean) => void }) {
  const opts = useQuery<Options>({ queryKey: ["staff-removal-handoff-options", userId, version], queryFn: () => get<Options>(`/system-users/${userId}/handoff-options`), gcTime: 0, staleTime: 0, retry: false, refetchInterval: 30000 });
  const [replacement, setReplacement] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [moves, setMoves] = useState<Record<string, Move | null>>({});
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<"" | "review" | "commit">("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const busyRef = useRef(onBusy); busyRef.current = onBusy;
  useEffect(() => { busyRef.current(kind, !!busy); return () => busyRef.current(kind, false); }, [busy, kind]);
  const setMove = (id: string, m: Move | null) => setMoves(p => (p[id] === m ? p : { ...p, [id]: m }));
  const selected = Object.keys(picked).filter(k => picked[k]);
  const chosen = selected.map(id => moves[id]).filter((m): m is Move => !!m);
  const moveKey = JSON.stringify(chosen);
  useEffect(() => { setProposal(null); }, [replacement, moveKey, version]);
  const visits = (opts.data?.visits ?? []).filter(v => v.id);
  const run = async (mode: "review" | "commit") => {
    if (lock.current) return; lock.current = true; setBusy(mode); setError("");
    try {
      if (mode === "review") {
        const body = kind === "visits" ? { kind, moves: chosen } : { kind, replacementId: replacement };
        const r = await post<Proposal>(`/system-users/${userId}/handoff-impact`, body);
        setProposal(r); requestAnimationFrame(() => heading.current?.focus());
      } else if (proposal) {
        const r = await post<unknown>(`/system-users/${userId}/handoff`, { kind: proposal.kind, proposal: proposal.proposal, reviewToken: proposal.reviewToken });
        setProposal(null); setPicked({}); setMoves({}); setReplacement(""); onCommitted(r); void opts.refetch();
      }
    } catch (e) { setError(msgOf(e)); if (mode === "commit") setProposal(null); }
    finally { lock.current = false; setBusy(""); }
  };
  const canReview = !disabled && !busy && !opts.isError && (kind === "visits" ? chosen.length > 0 && chosen.length === selected.length : !!opts.data?.admins.some(a => a.id === replacement));
  return <section aria-labelledby={`handoff-h-${kind}`} data-testid={`staff-handoff-${kind}`}>
    <h3 id={`handoff-h-${kind}`}>{kind === "visits" ? "Move future visits" : "Hand over clinic responsibilities"}</h3>
    <p className="muted">{kind === "visits" ? "Select each future visit and choose its new doctor, location, date and session yourself. Nothing moves automatically. Checked-in or in-progress work, overdue visits and pending guest requests must be resolved in the queue and requests screens." : "Choose an existing Clinic Admin to take over, or create one first through the normal staff form. Nothing is transferred automatically."}</p>
    <p><Link href={`/admin/users?tab=${kind === "visits" ? "doctors" : "admins"}`} onClick={onClose} data-testid={`link-create-replacement-${kind}`}>Open staff creation</Link> (opens the {kind === "visits" ? "Doctors" : "Clinic Admins"} list; choose Add Staff. This closes the review; reopen it afterwards).</p>
    {opts.isLoading && <div className="skeleton" role="status">Loading handoff options…</div>}
    {opts.error && <div className="error-box" role="alert">Handoff options could not be loaded. <button type="button" onClick={() => void opts.refetch()}>Retry</button></div>}
    {opts.data && kind === "clinic-responsibilities" && <div>
      <label htmlFor={`handoff-admin-${userId}`}>Replacement Clinic Admin</label>
      <SearchableSelect id={`handoff-admin-${userId}`} value={replacement} disabled={!!busy} onChange={setReplacement} options={opts.data.admins.map(a => ({ value: a.id, label: `${a.fullName} · ${a.email}` }))} />
      {!opts.data.admins.length && <p className="muted">No other Clinic Admin is listed. Create one first.</p>}
    </div>}
    {opts.data && kind === "visits" && (visits.length ? <div style={{ display: "grid", gap: 10 }}>
      {visits.map(v => <div key={v.id}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" checked={!!picked[v.id]} disabled={!!busy || v.status !== "booked" || !!v.checkedInAt} onChange={e => setPicked(p => ({ ...p, [v.id]: e.target.checked }))} />
          <span><strong>{v.patientName}</strong> · {v.date}{v.startTime ? ` ${v.startTime}` : ""} ({v.timezone}) · {label(v.status)}{v.status !== "booked" || v.checkedInAt ? " · resolve in the queue, not transferable here" : ""}<br /><code>{v.id}</code></span></label>
        {picked[v.id] && opts.data && <VisitMove visit={v} doctors={opts.data.doctors} onMove={setMove} />}
      </div>)}
    </div> : <p className="muted">No future visits are listed for this doctor.</p>)}
    {error && <p className="error-box" role="alert" data-testid={`handoff-error-${kind}`}>{error}</p>}
    {proposal && <div className="notice" role="status" data-testid={`handoff-proposal-${kind}`}><h4 ref={heading} tabIndex={-1}>Review before committing</h4>
      <p>The server prepared this handoff (operation <code>{proposal.operationId}</code>). It is not applied until you commit it. Committing refreshes the impact and you must retype <code>delete</code> afterwards.</p>
      {proposal.visits && <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(proposal.visits, null, 2)}</pre>}</div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      <button type="button" data-testid={`button-handoff-review-${kind}`} disabled={!canReview} onClick={() => void run("review")}>{busy === "review" ? "Reviewing…" : "Review handoff"}</button>
      <button type="button" data-testid={`button-handoff-commit-${kind}`} disabled={!proposal || !!busy || disabled} onClick={() => void run("commit")}>{busy === "commit" ? "Committing…" : "Commit reviewed handoff"}</button>
    </div>
  </section>;
}

export function StaffDeletionReview(props: StaffDeletionReviewProps) {
  if (!props.target) return null;
  return <ReviewBody key={`${props.actorId}:${props.target.userId}`} {...props} target={props.target} />;
}

function ReviewBody({ target, actorId, onClose, onRemoved }: StaffDeletionReviewProps & { target: StaffDeletionTargetRef }) {
  const id = target.userId;
  const client = useQueryClient();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [opId, setOpId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "remove" | "status" | "cleanup">("");
  const [problem, setProblem] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [handoffDone, setHandoffDone] = useState("");
  const [handoffBusy, setHandoffBusy] = useState<Record<string, boolean>>({});
  const anyHandoff = Object.values(handoffBusy).some(Boolean);
  const onHistoryBusy = useCallback((b: boolean) => setHandoffBusy(p => (!!p.history === b ? p : { ...p, history: b })), []);
  const onHandoffBusy = useCallback((k: string, b: boolean) => setHandoffBusy(p => (p[k] === b ? p : { ...p, [k]: b })), []);
  const lock = useRef(false);
  const fieldId = useId();
  const q = useGetStaffDeletionImpact(id, { query: {
    queryKey: [...getGetStaffDeletionImpactQueryKey(id), actorId ?? "unknown"],
    enabled: !!id && !!actorId && !receipt && !uncertain, staleTime: 0, gcTime: 0, retry: false,
    refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: busy || anyHandoff ? false : 30000,
  } });
  const settled = q.isSuccess && !q.isFetching && !receipt;
  const impact: ImpactX | null = settled && q.data && q.data.target.id === id ? q.data : null;
  useEffect(() => { setText(""); }, [id, impact?.version, q.dataUpdatedAt, q.isFetching]);
  const reviewedOp = useRef<string | null>(null);
  if (impact?.operationId) reviewedOp.current = impact.operationId;

  const reconcile = (done: Receipt) => {
    saveRemoval(actorId, done);
    setReceipt(done); setUncertain(false); setProblem(""); setText(""); setOpId(done.operationId);
    void client.cancelQueries();
    client.removeQueries({ predicate: qk => { const k = JSON.stringify(qk.queryKey); return k.includes(id) && !k.includes("staff-removals"); } });
    void client.invalidateQueries();
    onRemoved?.(done);
  };
  const guard = async (mode: "remove" | "status" | "cleanup", fn: () => Promise<void>) => {
    if (lock.current) return; lock.current = true; setBusy(mode); setProblem("");
    try { await fn(); } finally { lock.current = false; setBusy(""); }
  };
  const lookup = async (op: string): Promise<boolean> => {
    try { reconcile(await get<Receipt>(`/staff-removals/${op}`)); return true; }
    catch (e) {
      if (statusOf(e) === 404) setProblem("No committed removal receipt was found. The account may still exist. Check status again or refresh the review.");
      else setProblem("Removal status could not be confirmed. Check status again before doing anything else.");
      setUncertain(true); return false;
    }
  };
  const canRemove = !anyHandoff && !!impact && impact.ready === true && !!impact.reviewToken && !!impact.operationId && text === "delete" && !busy;
  const remove = () => guard("remove", async () => {
    if (!impact || !impact.reviewToken || !impact.ready || text !== "delete") return;
    const op = impact.operationId ?? reviewedOp.current; setOpId(op);
    try { reconcile(await post<Receipt>(`/system-users/${id}/permanent-removal`, { version: impact.version, reviewToken: impact.reviewToken, confirmation: "delete" })); }
    catch (e) {
      if (ambiguous(e) && op) { setProblem("The response was lost. Checking whether the removal was committed…"); await lookup(op); }
      else { setProblem(statusOf(e) === 409 ? "The review is out of date. Refresh impact and retype delete." : msgOf(e)); setText(""); void q.refetch(); }
    }
  });
  const checkStatus = () => guard("status", async () => { const op = opId ?? reviewedOp.current; if (op) await lookup(op); });
  const retryCleanup = () => guard("cleanup", async () => {
    const op = receipt?.operationId ?? opId; if (!op) return;
    try { reconcile(await post<Receipt>(`/staff-removals/${op}/retry-cleanup`)); }
    catch (e) { setProblem(ambiguous(e) ? "Cleanup status is unknown. Use Check status." : msgOf(e)); }
  });

  const err = q.error; const code = statusOf(err);
  const roleKey = impact?.target.role ?? "";
  const unknownBlock = impact && !impact.ready && impact.blockers.length === 0;
  const onHandoff = (r: unknown) => { const op = (r as { operationId?: string } | null)?.operationId; setHandoffDone(`Handoff committed${op ? ` (operation ${op})` : ""}. The impact was refreshed; review it again and retype delete.`); void q.refetch(); void client.invalidateQueries(); };
  const refreshAll = () => { setHandoffDone(""); void q.refetch(); };
  return <AppDialog open onClose={onClose} busy={!!busy || anyHandoff} title={`Review permanent removal · ${target.name}`}
    description="Nothing is deleted until you review the impact and type delete. Patient care records and documents are never deleted with a staff account.">
    <div data-testid="staff-deletion-review" style={{ display: "grid", gap: 14, overflowWrap: "anywhere" }}>
      {!receipt && !uncertain && (q.isLoading || (q.isFetching && !impact)) && <div className="skeleton" role="status">Loading live deletion impact…</div>}
      {!receipt && !uncertain && !q.isFetching && err ? <div className="error-box" role="alert" data-testid="staff-deletion-error">
        {code === 403 ? "Only a Super Admin can review permanent staff removal." : code === 404 ? "This staff account no longer exists. Refresh the list." : "The deletion impact could not be loaded. No removal is possible until it loads."}{" "}
        {code !== 403 && code !== 404 && <button type="button" onClick={() => void q.refetch()}>Retry</button>}
      </div> : null}
      {problem && <p className="error-box" role="alert" data-testid="staff-deletion-problem">{problem}</p>}
      {uncertain && !receipt && <section data-testid="staff-deletion-uncertain"><h3>Removal status uncertain</h3>
        <p>Do not assume the account survived or was removed. Check the reviewed operation again.</p>
        <button type="button" disabled={!!busy} onClick={() => void checkStatus()}>{busy === "status" ? "Checking…" : "Check status"}</button>
        <button type="button" disabled={!!busy} onClick={() => { setUncertain(false); setProblem(""); void q.refetch(); }}>Refresh review</button></section>}
      {receipt && <section data-testid="staff-deletion-receipt" role="status" aria-live="polite" tabIndex={-1} ref={el => el?.focus()}>
        <h3>{receipt.state === "complete" ? "Account removed" : "Account removed, file cleanup pending"}</h3>
        <p className="notice">The staff account was permanently removed. Patient records and documents were kept. Operation <code>{receipt.operationId}</code>; files verified {receipt.verifiedFiles} of {receipt.files}.</p>
        {receipt.state === "cleanup_pending" && <>
          <ul>{receipt.pendingReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <p>Cleanup is separate from account removal and can be retried safely.</p>
          <button type="button" data-testid="button-retry-cleanup" disabled={!!busy} onClick={() => void retryCleanup()}>{busy === "cleanup" ? "Retrying cleanup…" : "Retry cleanup"}</button>{" "}
          <button type="button" disabled={!!busy} onClick={() => void checkStatus()}>{busy === "status" ? "Checking…" : "Check status"}</button></>}
      </section>}
      {impact && <>
        <section aria-labelledby={`${fieldId}-t`}>
          <h3 id={`${fieldId}-t`}>Account</h3>
          <p><strong>{impact.target.fullName}</strong><br />{impact.target.email}<br /><span className="badge">{label(impact.target.role)}</span> <span className="badge muted">{label(impact.target.status)}</span></p>
          <p className="muted">{ROLE_COPY[roleKey] ?? "Unknown role: treat every dependency as a blocker until the server confirms otherwise."}</p>
        </section>
        <section aria-labelledby={`${fieldId}-p`}>
          <h3 id={`${fieldId}-p`}>What is preserved</h3>
          <p className="muted">Patient records, visit history, notes and uploaded documents stay in place. Removal affects the staff sign-in and its assignments only. This product does not keep a patient-to-doctor roster; open care is checked from live visits listed below.</p>
        </section>
        <section aria-labelledby={`${fieldId}-g`}>
          <h3 id={`${fieldId}-g`}>Records connected to this account</h3>
          {impact.groups.length ? <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {impact.groups.map((g, i) => <li key={`${g.source}:${g.action}:${i}`} data-testid={`deletion-group-${i}`}>
              <strong>{label(g.source)}</strong> · {label(g.action)} · {g.count} {g.count === 1 ? "record" : "records"}
              {g.ids.length < g.count && <span className="muted"> (showing {g.ids.length})</span>}
              <Ids ids={g.ids} />
            </li>)}
          </ul> : <p className="muted">The server reported no connected records.</p>}
        </section>
        <section aria-labelledby={`${fieldId}-b`}>
          <h3 id={`${fieldId}-b`}>Blockers</h3>
          {impact.blockers.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{impact.blockers.map((b, i) => <li key={`${b.code}:${i}`} data-testid={`deletion-blocker-${i}`}>
            <strong>{b.message}</strong>{b.source && <span className="muted"> · {label(b.source)}</span>}<Ids ids={b.ids} />
          </li>)}</ul> : <p className="muted">No blockers were listed.</p>}
          {unknownBlock && <p className="error-box" role="alert">The server has not confirmed this removal is safe. Unknown dependencies are treated as blockers.</p>}
        </section>
        {impact.warnings.length > 0 && <section aria-labelledby={`${fieldId}-w`}>
          <h3 id={`${fieldId}-w`}>Warnings</h3>
          <ul className="notice" style={{ margin: 0, paddingLeft: 24 }}>{impact.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </section>}
        {handoffDone && <p className="notice" role="status" data-testid="handoff-done">{handoffDone}</p>}
        {(roleKey === "doctor" || roleKey === "clinicAdmin") && <>
          {roleKey === "clinicAdmin" && <p className="muted">A Clinic Admin may also hold a consulting doctor profile. Future visits and clinic responsibilities are handed over separately, each reviewed and committed on its own.</p>}
          {((roleKey === "clinicAdmin" ? ["visits", "clinic-responsibilities"] : ["visits"]) as ("visits" | "clinic-responsibilities")[]).map(k =>
            <Handoff key={k} kind={k} userId={id} version={impact.version} disabled={!!busy || !!handoffBusy.history} onBusy={onHandoffBusy} onClose={onClose} onCommitted={onHandoff} />)}
        </>}
        <section>
          <h3>Removal</h3>
          {!impact.ready || !impact.reviewToken ? <p role="status" data-testid="staff-deletion-gated">Removal is blocked. The server has not marked this account ready and has issued no review token. Resolve every blocker above, then refresh.</p> : <div>
            <label htmlFor={fieldId}>Type <code>delete</code> in lowercase to confirm</label>
            <input id={fieldId} data-testid="input-staff-deletion-confirm" value={text} autoComplete="off" spellCheck={false} disabled={!!busy} onChange={e => setText(e.target.value)} />
          </div>}
        </section>
      </>}
      {q.isSuccess && !receipt && !uncertain && q.data?.target.id === id &&
        q.data.blockers.some(b => b.code === "ENCRYPTED_HISTORY_REVIEW") &&
        <HistoryReconciliationReview key={`${actorId}:${id}`} userId={id} actorId={actorId}
          disabled={q.isFetching || !!busy || anyHandoff} onBusy={onHistoryBusy}
          onDecision={() => { setHandoffDone(""); void q.refetch(); }} />}
      <div className="row-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
        {!receipt && !uncertain && <button type="button" data-testid="button-staff-deletion-refresh" disabled={q.isFetching || !!busy || anyHandoff} onClick={refreshAll}>{q.isFetching ? "Refreshing…" : "Refresh impact"}</button>}
        <button type="button" data-testid="button-staff-deletion-cancel" disabled={!!busy || anyHandoff} onClick={onClose}>{receipt ? "Close" : "Cancel"}</button>
        {!receipt && !uncertain && <button type="button" className="danger" data-testid="button-staff-deletion-confirm" disabled={!canRemove} aria-disabled={!canRemove} onClick={() => void remove()}>{busy === "remove" ? "Removing…" : "Permanently remove"}</button>}
      </div>
    </div>
  </AppDialog>;
}

export default StaffDeletionReview;
