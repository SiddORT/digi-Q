import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests",
  // The root validation command runs alongside other checks. Never let a
  // different suite's cleanup delete in-flight PDF traces or attachments.
  outputDir: resolve("generated-artifacts/ticket-regression/results"),
  // Cold Vite compilation and PDF work share resources with the PostgreSQL
  // contention check during completion validation. Keep assertions unchanged
  // while allowing those concurrent setup/render costs to finish.
  timeout: 90000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  // Rasterising PDFs at print resolution is memory-intensive.
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: resolve("generated-artifacts/ticket-regression/report") }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:43719",
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --dir .. exec vite --config ticket-regression/vite.config.ts",
    url: "http://127.0.0.1:43719/?mode=appointment",
    reuseExistingServer: process.env.REUSE_TICKET_SERVER === "1",
    timeout: 60000,
  },
});