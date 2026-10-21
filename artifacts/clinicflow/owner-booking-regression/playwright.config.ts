import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.OWNER_BOOKING_BASE_URL || "http://127.0.0.1";

export default defineConfig({
  testDir: ".",
  testMatch: "owner-booking.spec.ts",
  outputDir: "../../../generated-artifacts/owner-booking-regression",
  timeout: 180_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      executablePath: "/repl/tools/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
