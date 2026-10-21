import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "*.spec.ts", workers: 1, timeout: 120_000,
  outputDir: "../../../generated-artifacts/catalog-benchmark",
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:43722", navigationTimeout: 90_000,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] } },
  webServer: { command: "pnpm --dir .. exec vite --config catalog-benchmark/vite.config.ts",
    url: "http://127.0.0.1:43722", reuseExistingServer: false, timeout: 120_000 },
});
