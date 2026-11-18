import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "..");
const require = createRequire(resolve(root, "artifacts/api-server/package.json"));
const bundle = resolve(root, `artifacts/api-server/.registration-sms-config-${process.pid}.mjs`);
try {
  await require("esbuild").build({
    entryPoints: [resolve(root, "artifacts/api-server/src/registration-sms-config.ts")],
    outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "database", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve(root, "lib/db/src/index.ts") }));
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve(root, "lib/db/package.json")).resolve("pg"), external: true }));
    } }],
  });
  await import(pathToFileURL(bundle).href);
} catch {
  process.stderr.write("Configuration command could not start. No credentials were printed.\n");
  process.exitCode = 1;
} finally { await rm(bundle, { force: true }); }
