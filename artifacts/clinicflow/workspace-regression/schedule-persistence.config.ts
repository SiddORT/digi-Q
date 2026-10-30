import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests",testMatch:"schedule-persistence.spec.ts",workers:1,fullyParallel:false,retries:0,
  timeout:90000,expect:{timeout:12000},reporter:"list",
  outputDir:"../../../generated-artifacts/schedule-persistence/results",
  use:{baseURL:"http://127.0.0.1:43720",trace:"retain-on-failure",
    launchOptions:{executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]}},
  webServer:{command:"node scripts/schedule-persistence-server.mjs",cwd:new URL("../../..",import.meta.url).pathname,url:"http://127.0.0.1:43720",timeout:180000,reuseExistingServer:false},
});
