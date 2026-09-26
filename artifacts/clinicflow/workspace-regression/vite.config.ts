import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
export default defineConfig({
  root,
  publicDir: path.resolve(root, "../public"),
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: { alias: { "@": path.resolve(root, "../src") }, dedupe: ["react", "react-dom"] },
  server: {
    host: "127.0.0.1", port: 43720, strictPort: true,
    fs: { allow: [path.resolve(root, "../../..")] },
  },
});