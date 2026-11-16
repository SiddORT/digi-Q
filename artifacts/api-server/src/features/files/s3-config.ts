import { createHash } from "node:crypto";
import { assert } from "../../lib/http";

const segment = /^[A-Za-z0-9_-]+$/;
export const s3BucketValid = (value: string) =>
  /^(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value) &&
  value.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));

/** Called only for S3 operations; unused configuration cannot activate a client.
 * Do not log/serialize this return value: it can contain secret-store credentials. */
export function s3FileConfig(env = process.env) {
  const invalid = "Private S3 storage is not configured correctly";
  const bucket = env.FILES_S3_BUCKET || "", region = env.FILES_S3_REGION || "";
  assert(s3BucketValid(bucket) && /^[a-z0-9][a-z0-9-]{0,62}$/.test(region), 503, invalid);
  let endpoint: string | undefined;
  if (env.FILES_S3_ENDPOINT) {
    let url: URL;
    try { url = new URL(env.FILES_S3_ENDPOINT); } catch { assert(false, 503, invalid); }
    assert(url!.protocol === "https:" && !url!.username && !url!.password && !url!.search && !url!.hash &&
      url!.pathname === "/", 503, invalid);
    endpoint = url!.origin;
  }
  const prefix = env.FILES_S3_UPLOADS_PREFIX || "";
  assert(prefix.length > 0 && prefix.length <= 256 && prefix.split("/").every(p => segment.test(p)), 503, invalid);
  assert(["true", "false"].includes(env.FILES_S3_FORCE_PATH_STYLE || ""), 503, invalid);
  assert(["role", "static"].includes(env.FILES_S3_CREDENTIALS || ""), 503, invalid);
  const accessKeyId = env.FILES_S3_ACCESS_KEY_ID, secretAccessKey = env.FILES_S3_SECRET_ACCESS_KEY;
  const sessionToken = env.FILES_S3_SESSION_TOKEN;
  if (env.FILES_S3_CREDENTIALS === "static") {
    const validSecret = (value: string | undefined) => !!value && value.length <= 4096 && !/[\s\u0000-\u001f\u007f]/.test(value);
    assert(validSecret(accessKeyId) && validSecret(secretAccessKey) && (!sessionToken || validSecret(sessionToken)), 503, invalid);
  } else assert(!accessKeyId && !secretAccessKey && !sessionToken, 503, invalid);
  return {
    bucket, region, endpoint, prefix, forcePathStyle: env.FILES_S3_FORCE_PATH_STYLE === "true",
    credentials: env.FILES_S3_CREDENTIALS === "static" ? { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, ...(sessionToken ? { sessionToken } : {}) } : undefined,
    // Locators never contain endpoint URLs or credentials. A changed authority
    // must fail closed instead of silently resolving the same key elsewhere.
    authority: createHash("sha256").update(JSON.stringify([endpoint || "aws", region])).digest("hex"),
  };
}
