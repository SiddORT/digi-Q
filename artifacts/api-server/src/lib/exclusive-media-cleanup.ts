import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { mediaConfig, readLocalLogo, removeLocalLogo } from "./local-media";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

/** Only generated staff-logo objects, never clinical documents or arbitrary URLs. */
export type ExclusiveLogoJob = {
  provider: "local" | "object";
  key: string;
  configuration: string;
  /** Signed PUTs can recreate an object until this reviewed expiry has passed. */
  notBefore: number;
};
export type ExclusiveLogoCleanup =
  | { state: "complete" }
  | { state: "pending"; reason: "INVALID_JOB" | "UPLOAD_NOT_EXPIRED" | "REFERENCE_PRESENT" |
      "STORAGE_CONFIGURATION_CHANGED" | "STORAGE_UNAVAILABLE" | "OBJECT_STILL_PRESENT" };

const localKey = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.png$/;
const objectKey = /^\/objects\/uploads\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:-validated\.png)?$/;
const missing = (error: any) => error instanceof ObjectNotFoundError || error?.code === "ENOENT" || error?.code === 404 || error?.status === 404;
export function logoStorageConfiguration(provider: ExclusiveLogoJob["provider"]): string {
  const location = provider === "local" ? mediaConfig().root : new ObjectStorageService().getPrivateObjectDir();
  return createHash("sha256").update(`${provider}\0${location}`).digest("hex");
}
export function isExclusiveLogoJob(job: ExclusiveLogoJob): boolean {
  return Boolean(job && ["local", "object"].includes(job.provider) &&
    (job.provider === "local" ? localKey : objectKey).test(job.key) &&
    /^[a-f0-9]{64}$/.test(job.configuration) && Number.isFinite(job.notBefore) && job.notBefore >= 0);
}

/**
 * Call only AFTER account removal commits and from a durable receipt worker.
 * The caller must serialize reference writers and recheck the whole reviewed
 * graph, including soft-deleted documents and public-logo aliases. An uploader
 * ID alone is not proof of exclusivity. Default behavior is fail-closed.
 *
 * No provider error is interpreted as a successful removal. A post-delete
 * absence check, not a swallowed delete error, supplies the completion receipt.
 */
export async function removeExclusiveLogo(
  job: ExclusiveLogoJob,
  isReferenced: (job: ExclusiveLogoJob) => Promise<boolean> = async () => true,
  now = Date.now(),
): Promise<ExclusiveLogoCleanup> {
  if (!isExclusiveLogoJob(job)) {
    return { state: "pending", reason: "INVALID_JOB" };
  }
  if (job.notBefore > now) return { state: "pending", reason: "UPLOAD_NOT_EXPIRED" };
  try {
    if (job.configuration !== logoStorageConfiguration(job.provider)) {
      return { state: "pending", reason: "STORAGE_CONFIGURATION_CHANGED" };
    }
    if (await isReferenced(job)) return { state: "pending", reason: "REFERENCE_PRESENT" };
    if (job.provider === "local") {
      const root = await lstat(mediaConfig().root);
      if (!root.isDirectory() || root.isSymbolicLink()) return { state: "pending", reason: "STORAGE_UNAVAILABLE" };
      try { await removeLocalLogo(job.key); } catch (error) { if (!missing(error)) throw error; }
      try {
        await readLocalLogo(job.key);
        return { state: "pending", reason: "OBJECT_STILL_PRESENT" };
      } catch (error) {
        if (!missing(error)) throw error;
      }
    } else {
      let file;
      try {
        file = await new ObjectStorageService().getObjectEntityFile(job.key);
      } catch (error) {
        // This lookup explicitly checks object existence. Canonical paths and
        // the configuration fingerprint above prevent a wrong-root "success".
        if (missing(error)) return { state: "complete" };
        throw error;
      }
      await file.delete({ ignoreNotFound: true });
      const [exists] = await file.exists();
      if (exists) return { state: "pending", reason: "OBJECT_STILL_PRESENT" };
    }
    return { state: "complete" };
  } catch {
    // Never expose bucket paths, local paths, signed URLs or provider responses.
    return { state: "pending", reason: "STORAGE_UNAVAILABLE" };
  }
}
