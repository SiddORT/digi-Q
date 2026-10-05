import { isAbsolute, join } from "node:path";
import { mkdir, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { assert } from "./http";
import { mediaConfig } from "./local-media";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { DOCUMENT_MAX_BYTES } from "./feature-policy";

/** Private document bytes, using the configured media driver. Keys are server-generated UUIDs only. */
const KEY = /^[a-f0-9-]{36}$/;
function localPath(key: string) {
  assert(KEY.test(key), 400, "Invalid document key");
  const { root } = mediaConfig();
  assert(isAbsolute(root), 503, "MEDIA_ROOT is required for local documents");
  return join(root, "private-documents", key);
}
function objectLocation(key: string) {
  assert(KEY.test(key), 400, "Invalid document key");
  const dir = new ObjectStorageService().getPrivateObjectDir().replace(/^\/+/, "");
  const [bucket, ...rest] = `${dir}/patient-documents/${key}`.split("/");
  return objectStorageClient.bucket(bucket).file(rest.join("/"));
}
export async function saveDocument(bytes: Buffer, contentType: string) {
  const provider = mediaConfig().driver, key = randomUUID();
  if (provider === "local") {
    const path = localPath(key);
    await mkdir(join(mediaConfig().root, "private-documents"), { recursive: true, mode: 0o700 });
    const handle = await open(path, "wx", 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  } else {
    await objectLocation(key).save(bytes, { resumable: false, contentType, metadata: { cacheControl: "private, no-store" } });
  }
  return { provider, key };
}
export async function readDocument(provider: string, key: string): Promise<Buffer> {
  if (provider === "local") {
    const handle = await open(localPath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      assert(stat.isFile() && stat.size <= DOCUMENT_MAX_BYTES, 500, "Stored document is invalid");
      return await handle.readFile();
    } finally { await handle.close(); }
  }
  const [bytes] = await objectLocation(key).download();
  return bytes;
}
export async function removeDocument(provider: string, key: string) {
  if (provider === "local") await unlink(localPath(key)).catch(() => undefined);
  else await objectLocation(key).delete({ ignoreNotFound: true }).catch(() => undefined);
}
