import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Independent runs must not delete each other's traces during Playwright startup.
  // The default still discovers every workspace spec; projects only isolate artifacts.
  projects: [
    { name: "workspace", testIgnore: ["doctor-context.spec.ts", "users-administration.spec.ts"], outputDir: "./test-results/workspace" },
    { name: "doctor-context", testMatch: "doctor-context.spec.ts", outputDir: "./test-results/doctor-context" },
    { name: "users-administration", testMatch: "users-administration.spec.ts", outputDir: "./test-results/users-administration" },
  ],
  timeout: 60000,
  expect: { timeout: 8500 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:43720",
    // Bound cold Vite compilation separately from assertion polling; no retries.
    navigationTimeout: 60000,
    actionTimeout: 15000,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --dir .. exec vite --config workspace-regression/vite.config.ts",
    url: "http://127.0.0.1:43720/?mode=resource&resource=clinics",
    reuseExistingServer: false,
    timeout: 120000,
  },
});