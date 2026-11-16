import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

// Preview-only UI regression for clinic-owner registration email recovery.
// Every /api/** request is intercepted in the spec; no UAT, secrets or real delivery.
const previewHost = process.env.REPLIT_DEV_DOMAIN;

export default defineConfig({
  testDir: "./tests",
  testMatch: "register-clinic-email-recovery.spec.ts",
  outputDir: resolve("generated-artifacts/register-email-recovery"),
  reporter: [["list"]],
  timeout: 240000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: previewHost ? `https://${previewHost}` : "http://localhost:80",
    navigationTimeout: 60000,
    actionTimeout: 15000,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
    trace: "retain-on-failure",
  },
});
