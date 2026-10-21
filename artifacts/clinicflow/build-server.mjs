import { build } from "esbuild";
import path from "node:path";

await build({
  entryPoints: [path.join(import.meta.dirname, "server.ts")],
  outfile: path.join(import.meta.dirname, "dist/server.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  external: ["pg-native"],
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
