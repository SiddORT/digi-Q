import { constants } from "node:fs";
import { lstat, mkdir, open, link, unlink } from "node:fs/promises";
import { isAbsolute, join, parse, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { assert } from "../../lib/http";
import { mediaConfig, privateStorageConfig } from "../../lib/storage-config";
import { objectStorageClient } from "../../lib/objectStorage";
import { readDocument } from "../../lib/document-storage";
import { DOCUMENT_MAX_BYTES } from "../../lib/feature-policy";

const ID = /^(?!con$|prn$|aux$|nul$|com[0-9]$|lpt[0-9]$)[a-zA-Z0-9_-]{1,128}$/i;
const KEY = /^private\/clinics\/[A-Za-z0-9_-]+\/(?:doctors|patients)\/[A-Za-z0-9_-]+\/(?:profile|credentials|documents|medical)\/[a-f0-9-]{36}\.(?:pdf|png|jpg|webp|txt)$/;
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "text/plain": "txt" };

export function fileKey(clinicId: string, kind: "patients" | "doctors", entityId: string, purpose: string, id: string, mime: string) {
  assert(ID.test(clinicId) && ID.test(entityId) && /^[a-f0-9-]{36}$/.test(id), 400, "Invalid file identity");
  const key = `private/clinics/${clinicId}/${kind}/${entityId}/${purpose}/${id}.${extensions[mime]}`;
  assert(KEY.test(key), 400, "Invalid file purpose or type");
  return key;
}

/** No symlink component, including ancestors of MEDIA_ROOT. Private directories
 * must be owned by this service and not group/world writable. The OS account and
 * its parent directories must not be writable by untrusted local processes. */
export async function privateDirectory(root: string, suffix: string[], create = false) {
  assert(isAbsolute(root) && root !== parse(root).root, 503, "Private storage root is invalid");
  const absolute = resolve(root);
  let current = parse(absolute).root;
  const parts = absolute.slice(current.length).split(/[\\/]/).filter(Boolean);
  for (const [i, part] of [...parts, ...suffix].entries()) {
    assert(part !== "." && part !== ".." && !part.includes("\0"), 400, "Invalid storage path");
    current = join(current, part);
    if (create) await mkdir(current, { mode: 0o700 }).catch((e: any) => { if (e.code !== "EEXIST") throw e; });
    const stat = await lstat(current);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 409, "Private storage cannot use symlinks");
    if (i >= parts.length - 1 && process.platform !== "win32") {
      assert((stat.mode & 0o022) === 0 && (!process.getuid || stat.uid === process.getuid()), 503, "Private storage permissions are unsafe");
    }
  }
  return current;
}

async function localTarget(key: string, create = false) {
  assert(KEY.test(key) && key.split("/").every(p => ID.test(p.split(".")[0])), 400, "Invalid private locator");
  const pieces = key.split("/"), name = pieces.pop()!;
  const dir = await privateDirectory(mediaConfig().root, pieces, create);
  return join(dir, name);
}
function objectFile(locator: string) {
  assert(/^\/[^/]+\/.+/.test(locator) && !locator.includes("..") && !locator.includes("\\") && !/[\u0000-\u001f]/.test(locator), 409, "Invalid object locator");
  const [bucket, ...parts] = locator.slice(1).split("/");
  const match = parts.join("/").match(/(?:^|\/)uploads\/(private\/clinics\/.+)$/);
  assert(match && KEY.test(match[1]), 409, "Invalid object locator");
  return objectStorageClient.bucket(bucket).file(parts.join("/"));
}
export function planFileStorage(key: string) {
  assert(KEY.test(key), 400, "Invalid private locator");
  const config = privateStorageConfig();
  return { provider: config.driver, key: config.driver === "local" ? key :
    `/${process.env.PRIVATE_OBJECT_DIR!.replace(/^\/+|\/+$/g, "")}/uploads/${key}` };
}
export async function writeFileBytes(key: string, bytes: Buffer, contentType: string) {
  const config = privateStorageConfig();
  assert(bytes.length > 0 && bytes.length <= DOCUMENT_MAX_BYTES, 400, "Invalid file size");
  if (config.driver === "object") {
    const locator = planFileStorage(key).key;
    await objectFile(locator).save(bytes, { resumable: false, contentType, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: "private, no-store" } });
    return { provider: "object", key: locator };
  }
  const target = await localTarget(key, true);
  const stageDir = await privateDirectory(config.root, ["private", "staging"], true);
  const stage = join(stageDir, randomUUID());
  try {
    const handle = await open(stage, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    // Hard-link completion is atomic and, unlike rename, never replaces an
    // existing destination on POSIX or Windows. Both paths share a volume.
    await link(stage, target);
  } finally { await unlink(stage).catch((e: any) => { if (e.code !== "ENOENT") throw e; }); }
  return { provider: "local", key };
}

export async function readFileBytes(file: { provider: string; storageKey: string; registryVersion: number }): Promise<Buffer> {
  if (!file.registryVersion) return readDocument(file.provider, file.storageKey);
  assert(["local", "object"].includes(file.provider), 409, "Unknown file provider");
  if (file.provider === "object") {
    const object = objectFile(file.storageKey);
    const [metadata] = await object.getMetadata();
    assert(Number(metadata.size) > 0 && Number(metadata.size) <= DOCUMENT_MAX_BYTES, 409, "Stored file size is invalid");
    const [bytes] = await object.download({ validation: "crc32c" });
    assert(bytes.length <= DOCUMENT_MAX_BYTES, 409, "Stored file size is invalid");
    return bytes;
  }
  const target = await localTarget(file.storageKey), before = await lstat(target);
  assert(before.isFile() && !before.isSymbolicLink(), 409, "Stored file is not a regular file");
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.dev === before.dev && stat.ino === before.ino && stat.size > 0 && stat.size <= DOCUMENT_MAX_BYTES, 409, "Stored file size is invalid");
    const bytes = Buffer.alloc(stat.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    assert(total === stat.size, 409, "Stored file changed while reading");
    return bytes.subarray(0, total);
  } finally { await handle.close(); }
}
