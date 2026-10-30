import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests",testMatch:"profile-completion.spec.ts",workers:1,retries:0,timeout:60000,
  outputDir:"../../../generated-artifacts/profile-completion/results",reporter:[["list"]],
  use:{baseURL:"http://127.0.0.1:43720",launchOptions:{executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]},trace:"retain-on-failure"},
  webServer:{command:"pnpm --dir .. exec vite --config workspace-regression/vite.config.ts",url:"http://127.0.0.1:43720",reuseExistingServer:false,timeout:120000},
});
