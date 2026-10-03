import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const { build } = createRequire(resolve(root, "artifacts/api-server/package.json"))("esbuild");
const bundle = resolve(root, `artifacts/api-server/.check-integrations-${process.pid}.mjs`);
try {
  await build({
    entryPoints: [resolve(root, "artifacts/api-server/src/check-integrations.ts")],
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "workspace-database", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve(root, "lib/db/src/index.ts") }));
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve(root, "lib/db/package.json")).resolve("pg"), external: true }));
    } }],
  });
  await import(pathToFileURL(bundle).href);
} catch (error) {
  const category = /^[A-Z_]+$/.test(error?.code || "") ? error.code : error?.name === "ReferenceError" ? "REFERENCE_ERROR" : error?.message?.startsWith("Dynamic require of") ? "DYNAMIC_REQUIRE_UNSUPPORTED" : "STARTUP_FAILED";
  console.error(`Read-only integration verification could not start (${category}). No provider credentials were printed.`);
  process.exitCode = 1;
} finally {
  await rm(bundle, { force: true });
}