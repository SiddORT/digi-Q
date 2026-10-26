import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");

// Bundle application/workspace TypeScript (including extensionless imports),
// but keep one CommonJS React/Query runtime shared with render providers.
export const runtime = require;
export async function loadModule(url, options = {}) {
  const result = await build({
    entryPoints: [fileURLToPath(url)], bundle: true, platform: "node",
    format: "cjs", write: false, jsx: "automatic",
    loader: { ".css": "empty" },
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "@tanstack/react-query"],
    alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
    ...options,
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports;
}
