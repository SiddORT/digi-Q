import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests", testMatch: "owner-mobile-onboarding.spec.ts",
  outputDir: resolve("generated-artifacts/owner-mobile/browser"), reporter: [["list"]],
  workers: 1, retries: 0, timeout: 60000, expect: {timeout:10000},
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:80",
    launchOptions: {executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]},
    trace:"retain-on-failure",
  },
});
