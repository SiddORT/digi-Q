import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${command} terminated by ${result.signal}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Generated contracts are intentionally ignored by Git. Always generate before
// discovering tests; a fresh checkout must exercise the same contract as the app.
run("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);
const base = "artifacts/clinicflow/src";
const files = readdirSync(resolve(root, base), { recursive: true })
  .filter(file => file.endsWith(".test.mjs"))
  .map(file => `${base}/${file}`).sort();
if (!files.length) throw new Error("No frontend source tests discovered");
console.log(`Running all ${files.length} frontend source test files`);
run(process.execPath, ["--test", "--test-reporter=tap", "--test-concurrency=1", ...files]);
