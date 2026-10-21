import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
const root = path.dirname(new URL(import.meta.url).pathname);
export default defineConfig({
  root,
  plugins: [
    // Benchmark the previous unpaged behavior without editing application files.
    ...(process.env.CATALOG_BASELINE === "1" ? [{
      name: "catalog-baseline-only", enforce: "pre" as const,
      transform(source: string, id: string) {
        if (id.endsWith("/ClinicMetadataFields.tsx") || id.endsWith("/fixture.tsx"))
          return source.replaceAll("localPageSize={75}", "");
      },
    }] : []),
    react(), tailwindcss({ optimize: false }),
  ],
  resolve: { alias: { "@": path.resolve(root, "../src") }, dedupe: ["react", "react-dom"] },
  server: { host: "127.0.0.1", port: 43722, strictPort: true, fs: { allow: [path.resolve(root, "../../..")] } },
});
