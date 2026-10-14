import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { staffDeletionReceipts } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { isExclusiveLogoJob, removeExclusiveLogo, type ExclusiveLogoJob, type ExclusiveLogoCleanup } from "./exclusive-media-cleanup";

type Job = ExclusiveLogoJob & { state: "pending" | "complete"; reason?: string };
export type DeletionReceiptStatus = {
  operationId: string; accountRemoved: true; state: "complete" | "cleanup_pending";
  files: number; verifiedFiles: number; pendingReasons: string[];
};
const fingerprint = (id: string) => createHash("sha256").update(id).digest("hex");
function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  assert(raw && /^[a-f0-9]{64}$/i.test(raw), 503, "File-cleanup receipt encryption is unavailable");
  return Buffer.from(raw!, "hex");
}
function encrypt(id: string, jobs: Job[]): string {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from(`staff-deletion-receipt:${id}`));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(jobs)), cipher.final()]);
  return [nonce.toString("base64"), cipher.getAuthTag().toString("base64"), bytes.toString("base64")].join(".");
}
function decrypt(id: string, encrypted: string): Job[] {
  const [iv, tag, bytes, extra] = encrypted.split(".");
  assert(!extra && iv && tag && bytes, 503, "File-cleanup receipt is unavailable");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  cipher.setAAD(Buffer.from(`staff-deletion-receipt:${id}`)); cipher.setAuthTag(Buffer.from(tag, "base64"));
  const jobs = JSON.parse(Buffer.concat([cipher.update(Buffer.from(bytes, "base64")), cipher.final()]).toString("utf8"));
  assert(Array.isArray(jobs) && jobs.every(j => isExclusiveLogoJob(j) && ["complete", "pending"].includes(j.state)),
    503, "File-cleanup receipt is unavailable");
  return jobs;
}

/** Prepare encryption BEFORE deleting, then insert ONLY in the same account-removal transaction. */
export function prepareDeletionReceipt(accountId: string, reviewHash: string, files: ExclusiveLogoJob[], operationId: string = randomUUID()) {
  assert(accountId && /^[a-f0-9]{64}$/.test(reviewHash), 400, "Invalid deletion review");
  assert(files.every(isExclusiveLogoJob), 409, "Personal-file ownership cannot be verified");
  assert(new Set(files.map(f => `${f.provider}:${f.key}`)).size === files.length, 409, "Duplicate personal-file cleanup job");
  assert(/^[a-f0-9-]{36}$/i.test(operationId), 400, "Invalid removal operation");
  const id = operationId, jobs: Job[] = files.map(f => ({
    provider: f.provider, key: f.key, configuration: f.configuration, notBefore: f.notBefore, state: "pending",
  }));
  return {
    id, accountFingerprint: fingerprint(accountId), reviewHash,
    state: files.length ? "cleanup_pending" : "complete", fileCount: files.length, verifiedCount: 0,
    encryptedJobs: files.length ? encrypt(id, jobs) : null,
    completedAt: files.length ? null : new Date(),
  };
}

export async function commitDeletionReceipt(tx: any, prepared: ReturnType<typeof prepareDeletionReceipt>) {
  const result = await tx.execute(sql`select 1 from users where encode(sha256(convert_to(id,'UTF8')),'hex')=${prepared.accountFingerprint} limit 1`);
  assert(!result.rows.length, 409, "The staff account has not been removed");
  await tx.insert(staffDeletionReceipts).values(prepared);
  return prepared.id;
}
function status(row: any, jobs: Job[] = []): DeletionReceiptStatus {
  return { operationId: row.id, accountRemoved: true, state: row.state,
    files: row.fileCount, verifiedFiles: row.verifiedCount,
    pendingReasons: [...new Set(jobs.filter(j => j.state === "pending").map(j => j.reason || "NOT_VERIFIED"))] };
}
export async function getDeletionReceipt(conn: any, id: string): Promise<DeletionReceiptStatus> {
  const [row] = await conn.select().from(staffDeletionReceipts).where(eq(staffDeletionReceipts.id, id));
  assert(row, 404, "Removal receipt not found");
  if (row.state === "complete") return status(row);
  try { return status(row, decrypt(row.id, row.encryptedJobs!)); }
  catch { return { ...status(row), pendingReasons: ["RECEIPT_UNAVAILABLE"] }; }
}

/**
 * Separate POST-COMMIT operation. Never put physical removal inside the account
 * transaction. The caller must supply a fresh, serialized whole-graph reference
 * checker; default behavior preserves every file. No route enables this yet.
 */
export async function processDeletionReceipt(
  conn: any, id: string, isReferenced: (job: ExclusiveLogoJob) => Promise<boolean> = async () => true,
  remove: typeof removeExclusiveLogo = removeExclusiveLogo,
): Promise<DeletionReceiptStatus> {
  return conn.transaction(async (tx: any) => {
    const [row] = await tx.select().from(staffDeletionReceipts).where(eq(staffDeletionReceipts.id, id)).for("update");
    assert(row, 404, "Removal receipt not found");
    if (row.state === "complete") return status(row);
    let jobs: Job[];
    try { jobs = decrypt(row.id, row.encryptedJobs!); }
    catch { return { ...status(row), pendingReasons: ["RECEIPT_UNAVAILABLE"] }; }
    assert(jobs.length === row.fileCount && jobs.filter(j => j.state === "complete").length === row.verifiedCount,
      503, "File-cleanup receipt is inconsistent");
    let attempted = 0;
    for (const job of jobs) {
      if (job.state === "complete") continue;
      if (++attempted > 3) break; // Bound each retry; durable remainder stays pending.
      let result: ExclusiveLogoCleanup;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try { result = await Promise.race([remove(job, isReferenced), new Promise<ExclusiveLogoCleanup>(resolve => {
        timeout = setTimeout(() => resolve({ state: "pending", reason: "STORAGE_UNAVAILABLE" }), 5000);
        timeout.unref?.();
      })]); }
      catch { result = { state: "pending", reason: "STORAGE_UNAVAILABLE" }; }
      finally { if (timeout) clearTimeout(timeout); }
      job.state = result.state;
      if (result.state === "pending") job.reason = result.reason;
      else delete job.reason;
    }
    const verifiedCount = jobs.filter(j => j.state === "complete").length;
    const complete = verifiedCount === row.fileCount;
    const update = { verifiedCount, state: complete ? "complete" : "cleanup_pending",
      encryptedJobs: complete ? null : encrypt(id, jobs), completedAt: complete ? new Date() : null };
    await tx.update(staffDeletionReceipts).set(update).where(eq(staffDeletionReceipts.id, id));
    return status({ ...row, ...update }, jobs);
  });
}
