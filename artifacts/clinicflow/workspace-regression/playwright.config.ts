import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Independent of ticket-regression: Playwright clears outputDir at the start of a run.
  outputDir: "./test-results",
  timeout: 40000,
  expect: { timeout: 8500 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:43720",
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --dir .. exec vite --config workspace-regression/vite.config.ts",
    url: "http://127.0.0.1:43720/?mode=resource&resource=clinics",
    reuseExistingServer: false,
    timeout: 60000,
  },
});