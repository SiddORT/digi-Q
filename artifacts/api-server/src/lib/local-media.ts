import { isAbsolute, join } from "node:path";
import { mkdir, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { assert } from "./http";

export function mediaConfig(env = process.env) {
  const driver = env.MEDIA_STORAGE || "object";
  assert(["local", "object"].includes(driver), 500, "MEDIA_STORAGE must be local or object");
  const root = env.MEDIA_ROOT || "";
  const url = (env.MEDIA_URL || "/media").replace(/\/$/, "");
  assert(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(url) && !/^\/(api|admin|assets)(\/|$)/.test(url), 500, "MEDIA_URL must be a dedicated URL path, such as /media");
  if (driver === "local") {
    assert(isAbsolute(root) && root !== "/", 500, "Local media requires an absolute MEDIA_ROOT folder");
  }
  return { driver, root, url };
}
export async function initializeMedia() {
  const config = mediaConfig();
  if (config.driver !== "local") return;
  await mkdir(config.root, { recursive: true, mode: 0o700 });
  const probe = join(config.root, `.write-test-${randomUUID()}`);
  const handle = await open(probe, "wx", 0o600);
  await handle.close();
  await unlink(probe);
}
function filePath(key: string) {
  assert(/^[a-f0-9-]{36}\.png$/.test(key), 400, "Invalid media key");
  const { root } = mediaConfig();
  assert(isAbsolute(root), 503, "MEDIA_ROOT is required to read local logos");
  return join(root, key);
}
export async function saveLocalLogo(bytes: Buffer) {
  const key = `${randomUUID()}.png`;
  const handle = await open(filePath(key), "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  return key;
}
export async function readLocalLogo(key: string) {
  const handle = await open(filePath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size <= 20 * 1024 * 1024, 400, "Invalid stored logo");
    return await handle.readFile();
  } finally { await handle.close(); }
}
export async function removeLocalLogo(key: string) { await unlink(filePath(key)); }