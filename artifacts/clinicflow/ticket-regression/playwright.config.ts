import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Cold Vite compilation and PDF work share resources with the PostgreSQL
  // contention check during completion validation. Keep assertions unchanged
  // while allowing those concurrent setup/render costs to finish.
  timeout: 90000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  // Rasterising PDFs at print resolution is memory-intensive.
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
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
    reuseExistingServer: false,
    timeout: 60000,
  },
});