import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import { assert } from "./http";

/** Environment is read after the existing bootstrap/vault loading; never log it. */
export function mediaConfig(env = process.env) {
  const driver = env.MEDIA_STORAGE || "object";
  assert(["local", "object"].includes(driver), 500, "MEDIA_STORAGE must be local or object");
  const root = env.MEDIA_ROOT || "";
  const url = (env.MEDIA_URL || "/media").replace(/\/$/, "");
  assert(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(url) && !/^\/(api|admin|assets)(\/|$)/.test(url), 500, "MEDIA_URL must be a dedicated URL path, such as /media");
  if (driver === "local") assert(isAbsolute(root) && root !== "/", 500, "Local media requires an absolute MEDIA_ROOT folder");
  return { driver: driver as "local" | "object", root, url };
}

export function privateStorageConfig(env = process.env) {
  const config = mediaConfig(env);
  if (config.driver === "local") {
    assert(basename(config.root) === "uploads", 503, "Private files require MEDIA_ROOT ending in uploads");
    assert(!config.root.split(/[\\/]/).some(p => ["public", "static"].includes(p.toLowerCase())), 503, "Private uploads cannot be in a public folder");
    if (env.NODE_ENV === "production") {
      let checkout = resolve(process.cwd());
      while (!existsSync(join(checkout, "pnpm-workspace.yaml")) && dirname(checkout) !== checkout) checkout = dirname(checkout);
      if (dirname(checkout) === checkout) checkout = resolve(process.cwd());
      const rel = relative(checkout, resolve(config.root));
      assert(rel.startsWith("..") || isAbsolute(rel), 503, "Production uploads must be outside the application checkout");
    }
  } else {
    const location = (env.PRIVATE_OBJECT_DIR || "").replace(/^\/|\/$/g, "");
    const parts = location.split("/");
    assert(parts.length >= 2 && /^[a-z0-9][a-z0-9._-]{1,221}[a-z0-9]$/.test(parts[0]) &&
      parts.every(p => /^[a-zA-Z0-9._-]+$/.test(p) && !p.includes("..") && p !== "."), 503, "Private object storage is not configured");
  }
  return config;
}
