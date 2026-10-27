import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  projects:[{name:"headers",testMatch:["header-pagination.spec.ts","header-consumers.spec.ts"],outputDir:"../../../generated-artifacts/headers/results"}],
  reporter:[["list"]],
});
