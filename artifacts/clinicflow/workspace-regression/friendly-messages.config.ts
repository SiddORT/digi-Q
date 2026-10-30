import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir:"./tests",testMatch:"friendly-messages.spec.ts",workers:1,retries:0,
  timeout:60000,expect:{timeout:10000},
  outputDir:resolve("generated-artifacts/friendly-messages/results"),
  reporter:[["list"]],
  use:{baseURL:"http://127.0.0.1:43720",launchOptions:{executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]},trace:"retain-on-failure"},
  projects:[{name:"desktop",use:{viewport:{width:1366,height:900}}},{name:"mobile",use:{viewport:{width:390,height:844}}}],
  webServer:{command:"pnpm --dir .. exec vite --config workspace-regression/vite.config.ts",url:"http://127.0.0.1:43720/friendly-messages.html",reuseExistingServer:false,timeout:120000},
});
