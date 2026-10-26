import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Uses the managed Preview. Every API request in these tests is intercepted.
export default defineConfig({
  testDir: ".",
  testMatch: "otp-delivery.spec.ts",
  outputDir: resolve("generated-artifacts/otp-delivery"),
  reporter: [["list"]],
  timeout: 90000,
  workers: 1,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:80",
    navigationTimeout: 60000,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
});
