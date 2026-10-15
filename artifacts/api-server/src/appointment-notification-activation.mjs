// Explicit maintenance command, never imported by startup and never sends messages.
// Bundled locally so the same implementation is used by disposable-database tests.
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
const output = resolve(import.meta.dirname, `.appointment-activation-${process.pid}.mjs`);
await mkdir(resolve("generated-artifacts"), { recursive: true });
try {
  await build({
    stdin: { contents: `export * from "./lib/appointment-notification-activation"; export {pool} from "@workspace/db";`,
      resolveDir: import.meta.dirname, loader: "ts" },
    outfile: output, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "workspace-db", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: resolve(import.meta.dirname, "../../../lib/db/src/index.ts") }));
      b.onResolve({ filter: /^pg$/ }, () => ({ path: createRequire(resolve(import.meta.dirname, "../../../lib/db/package.json")).resolve("pg"), external: true }));
    } }],
  });
  const api = await import(output);
  try {
    if (process.env.NODE_ENV !== "development") throw new Error("This command is restricted to workspace development");
    const plan = await api.appointmentActivationInventory();
    if (process.argv.includes("--apply-workspace-development")) {
      const result = await api.applyAppointmentActivation(plan.revision);
      console.log(JSON.stringify({ environment: "workspace development database only", before: plan, result,
        after: await api.appointmentActivationInventory() }, null, 2));
    } else console.log(JSON.stringify({ environment: "workspace development database only", ...plan }, null, 2));
  } finally { await api.pool.end(); }
} finally { await rm(output, { force: true }); }
