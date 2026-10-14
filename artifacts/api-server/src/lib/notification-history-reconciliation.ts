import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db, settings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { assert } from "./http";
import { assertLiveRemovalActor } from "./staff-removal-auth";
import { accountSubjectFingerprint, classifyHistoryForRemoval, verifyHistorySubjects } from "./notification-history-provenance";
import { historyAssetSnapshots } from "./notification-history";
import { requiredEvent, templateEvents, validTemplateTarget } from "./notification-templates";
import { audit } from "./store";

const historyKey = z.string().regex(/^notification-history:[a-f0-9]{64}$/);
const version = z.string().regex(/^[a-f0-9]{64}$/);
export const historyEvidenceInput = z.object({
  historyId: historyKey, version, evidence: z.string().min(1).max(100_000),
}).strict();
export const historyRestoreInput = historyEvidenceInput.extend({
  reviewToken: z.string().min(1).max(2500), confirmation: z.literal("restore"),
}).strict();
export const historyUnresolvedInput = z.object({
  historyId: historyKey, version,
  reason: z.enum(["original_missing", "incomplete_evidence", "conflicting_sources", "unreadable_archive"]),
}).strict();
const archive = z.object({ id: historyKey, data: z.record(z.string(), z.unknown()) }).strict();
const archives = z.union([archive, z.array(archive).min(1).max(10)]);
const canonical = (value: any): string => {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).filter(k => value[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
};
const digest = (value: any) => createHash("sha256").update(canonical(value)).digest("hex");
const reviewId = (id: string) => "notification-history-reconciliation:" + digest(id);
const envelopeCount = (data: any) => (typeof data?.encrypted === "string" ? 1 : 0) +
  (Array.isArray(data?.snapshots) ? data.snapshots.filter((s: any) => typeof s?.encrypted === "string").length : 0);
const proofless = (data: any) => {
  const { provenance: _proof, ...rest } = data;
  return rest;
};
type ActorInput = { actorId: string; sessionHash: string; targetId: string };
type Evidence = { historyId: string; version: string; evidence: string };

async function authorize(tx: any, input: ActorInput) {
  const actor = await assertLiveRemovalActor(tx, input.actorId, input.sessionHash);
  const result = await tx.execute(sql`select id,role from users where id=${input.targetId} for share`);
  assert(result.rows[0], 404, "Staff account not found");
  assert(["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(result.rows[0].role), 400, "Staff accounts only");
  return actor;
}
async function load(tx: any, input: Evidence | { historyId: string; version: string }, lock = false) {
  if (lock) {
    const result = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${input.historyId})) as locked`);
    assert(result.rows[0]?.locked, 409, "History is busy. Refresh and review again");
  }
  // NOWAIT avoids waiting with actor locks held against legacy writers' lock orders.
  const result = await tx.execute(lock
    ? sql`select data from settings where id=${input.historyId} for update nowait`
    : sql`select data from settings where id=${input.historyId}`);
  assert(result.rows[0], 404, "History record no longer exists");
  const data = result.rows[0].data;
  assert(digest(data) === input.version, 409, "History changed. Refresh and review again");
  assert(classifyHistoryForRemoval(input.historyId, data, "") === "blocked", 409, "This history no longer requires reconciliation");
  return data;
}

/** No signing/backfill function is used here. Only an ORIGINAL valid MAC can be restored.
 * Exact full-record matching covers metadata, contact hashes and every older envelope.
 * A boolean failure marker is the sole harmless difference permitted. */
async function checkEvidence(tx: any, input: Evidence, current: any, targetId: string) {
  const base = { status: "unresolved" as "eligible" | "unresolved", historyId: input.historyId,
    version: input.version, reason: "", ownership: "unknown" as "unknown" | "includes_target" | "excludes_target",
    envelopeCount: envelopeCount(current), sourceCount: 0, subjectCount: 0 };
  const reject = (reason: string) => ({ public: { ...base, reason }, restored: null as any, evidenceDigest: "" });
  let parsed;
  try { parsed = archives.safeParse(JSON.parse(input.evidence)); }
  catch { return reject("The archive is not valid original-record JSON."); }
  if (!parsed.success) return reject("Provide an original {id,data} signed record, or an array of those records.");
  const sources = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  let restored: any, captured: string[] | undefined;
  for (const source of sources) {
    if (source.id !== input.historyId) return reject("A source belongs to a different history record. Hash or contact similarities are not ownership evidence.");
    const subjects = verifyHistorySubjects(source.id, source.data);
    if (!subjects) return reject("An original capture proof is missing or invalid. Unsigned backups and current outbox metadata cannot establish ownership.");
    const candidate = { ...current, provenance: source.data.provenance };
    if (candidate.provenanceUnavailable === true && source.data.provenanceUnavailable === undefined) delete candidate.provenanceUnavailable;
    if (canonical(proofless(candidate)) !== canonical(proofless(source.data)) ||
      !verifyHistorySubjects(input.historyId, candidate))
      return reject("The source does not cover the complete current record and all historical envelopes. It remains unresolved.");
    if (captured && canonical(captured) !== canonical(subjects))
      return reject("Original sources disagree about captured subjects. Conflicting evidence remains unresolved.");
    if (candidate.erased || !["email", "sms"].includes(candidate.channel) ||
      !(templateEvents as readonly string[]).includes(candidate.event) || requiredEvent(candidate.event) ||
      !["automatic", "test"].includes(candidate.source) ||
      !(candidate.source === "test" && candidate.recipientGroup === "explicit") &&
        !validTemplateTarget(candidate.event, candidate.recipientGroup, candidate.channel))
      return reject("The original capture is not a recognized operational notification.");
    try { historyAssetSnapshots(input.historyId, candidate); }
    catch { return reject("A current or historical envelope cannot be authenticated and read. Ownership remains unresolved."); }
    captured = subjects; restored = candidate;
  }
  // Same native identity boundary as a new capture: hold every proven subject
  // through restoration so old archives cannot revive an already removed identity.
  const native = await tx.execute(sql`select id from users
    where encode(sha256(convert_to(id,'UTF8')),'hex') in
      (select jsonb_array_elements_text(${JSON.stringify(captured)}::jsonb))
    order by id for share nowait`);
  if (native.rows.length !== captured!.length)
    return reject("An originally captured staff account no longer exists. Keep this record unresolved; do not restore removed identity history.");
  return { public: { ...base, status: "eligible" as const,
    reason: "Original capture proof verified against the entire saved record. No history or account will be deleted.",
    ownership: captured!.includes(accountSubjectFingerprint(targetId)) ? "includes_target" as const : "excludes_target" as const,
    sourceCount: sources.length, subjectCount: captured!.length },
    restored, evidenceDigest: digest(sources) };
}
function mac(value: string) {
  const key = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  assert(key && /^[a-f0-9]{64}$/i.test(key), 503, "History verification is not configured");
  return createHmac("sha256", Buffer.from(key, "hex")).update("history-reconciliation:" + value).digest("hex");
}
function stamp(input: ActorInput & Evidence, evidenceDigest: string, expiresAt: number) {
  return { actor: accountSubjectFingerprint(input.actorId), session: digest(input.sessionHash),
    target: accountSubjectFingerprint(input.targetId), historyId: input.historyId, version: input.version, evidenceDigest, expiresAt };
}
function token(input: ActorInput & Evidence, evidenceDigest: string) {
  const payload = Buffer.from(canonical(stamp(input, evidenceDigest, Date.now() + 300_000))).toString("base64url");
  return payload + "." + mac(payload);
}
function assertToken(input: ActorInput & Evidence & { reviewToken: string }, evidenceDigest: string) {
  try {
    const [payload, signature, extra] = input.reviewToken.split(".");
    assert(!extra && /^[a-f0-9]{64}$/.test(signature || ""), 409, "Review again before restoring proof");
    assert(timingSafeEqual(Buffer.from(mac(payload), "hex"), Buffer.from(signature, "hex")), 409, "Review again before restoring proof");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    assert(Number.isSafeInteger(decoded.expiresAt) && decoded.expiresAt > Date.now() &&
      decoded.expiresAt <= Date.now() + 300_000 &&
      canonical(decoded) === canonical(stamp(input, evidenceDigest, decoded.expiresAt)),
    409, "The evidence review expired or changed. Review again");
  } catch { assert(false, 409, "The evidence review expired or changed. Review again"); }
}
async function guarded<T>(conn: any, fn: (tx: any) => Promise<T>): Promise<T> {
  try { return await conn.transaction(fn); }
  catch (error: any) {
    if (error?.code === "55P03" || error?.cause?.code === "55P03")
      assert(false, 409, "History is busy. Refresh and review again");
    throw error;
  }
}

export async function listHistoryReconciliation(input: ActorInput & { cursor?: string }, conn: any = db) {
  if (input.cursor) historyKey.parse(input.cursor);
  return guarded(conn, async tx => {
    await authorize(tx, input);
    const rows = (await tx.execute(sql`select id,data from settings
      where id like 'notification-history:%' and id > ${input.cursor || ""} order by id limit 26`)).rows;
    const items = [];
    for (const row of rows.slice(0, 25)) {
      if (classifyHistoryForRemoval(row.id, row.data, "") !== "blocked") continue;
      const recordVersion = digest(row.data);
      const [review] = await tx.select().from(settings).where(eq(settings.id, reviewId(row.id)));
      const decision = review?.data?.recordVersion === recordVersion && review?.data?.status === "unresolved" ? review.data : null;
      items.push({ id: row.id, version: recordVersion,
        channel: ["email", "sms"].includes(row.data?.channel) ? row.data.channel : "unknown",
        event: (templateEvents as readonly string[]).includes(row.data?.event) ? row.data.event : "unknown",
        envelopeCount: envelopeCount(row.data), status: decision ? "unresolved" : "blocked",
        unresolvedReason: decision?.reason ?? null, reviewedAt: decision?.reviewedAt ?? null });
    }
    return { items, nextCursor: rows.length > 25 ? rows[24].id : null, scannedCount: Math.min(rows.length, 25) };
  });
}
export async function previewHistoryReconciliation(input: ActorInput & Evidence, conn: any = db) {
  return guarded(conn, async tx => {
    await authorize(tx, input);
    const current = await load(tx, input);
    const checked = await checkEvidence(tx, input, current, input.targetId);
    return { ...checked.public, reviewToken: checked.restored ? token(input, checked.evidenceDigest) : null };
  });
}
async function decision(tx: any, actor: any, input: ActorInput & { historyId: string }, data: any) {
  const safe = { ...data, reviewedAt: Date.now(), reviewerFingerprint: accountSubjectFingerprint(input.actorId) };
  await tx.insert(settings).values({ id: reviewId(input.historyId), data: safe })
    .onConflictDoUpdate({ target: settings.id, set: { data: safe } });
  await audit(actor, "reconcileNotificationHistory", "settings", { id: input.historyId, ...safe }, tx);
}
export async function restoreHistoryReconciliation(input: ActorInput & z.infer<typeof historyRestoreInput>, conn: any = db) {
  return guarded(conn, async tx => {
    const actor = await authorize(tx, input);
    const current = await load(tx, input, true);
    const checked = await checkEvidence(tx, input, current, input.targetId);
    assert(checked.restored, 409, checked.public.reason);
    assertToken(input, checked.evidenceDigest);
    await tx.update(settings).set({ data: checked.restored }).where(eq(settings.id, input.historyId));
    await decision(tx, actor, input, { status: "verified", recordVersion: digest(checked.restored),
      sourceCount: checked.public.sourceCount, envelopeCount: checked.public.envelopeCount });
    return { status: "verified" as const, historyId: input.historyId,
      message: "Original proof restored. No account or history deleted. Refresh the permanent-removal review." };
  });
}
export async function markHistoryUnresolved(input: ActorInput & z.infer<typeof historyUnresolvedInput>, conn: any = db) {
  return guarded(conn, async tx => {
    const actor = await authorize(tx, input);
    await load(tx, input, true);
    await decision(tx, actor, input, { status: "unresolved", recordVersion: input.version, reason: input.reason });
    return { status: "unresolved" as const, historyId: input.historyId,
      message: "Unresolved reason recorded. Original history is unchanged and permanent removal remains blocked." };
  });
}
