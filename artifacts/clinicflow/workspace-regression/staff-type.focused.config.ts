import { defineConfig, devices } from "@playwright/test";

// Focused UI-only run against the already-running, isolated Vite fixture.
export default defineConfig({
  testDir: "./tests",
  testMatch: "staff-type-toolbar.spec.ts",
  outputDir: "./test-results/staff-type-focused",
  timeout: 60000,
  expect: { timeout: 8500 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:43720",
    navigationTimeout: 15000,
    actionTimeout: 15000,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
});
