// Exercise the real config in a disposable copy: never rewrite checked-in clients
// merely to test a generator update. No database or provider connection is used.
import { cp, mkdir, mkdtemp, readdir, readFile, symlink } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "..");
await mkdir(join(root, "generated-artifacts"), { recursive: true });
const temp = await mkdtemp(join(root, "generated-artifacts/security-codegen-"));
for (const file of ["lib", "tsconfig.json", "tsconfig.base.json", "package.json", "pnpm-workspace.yaml"]) {
  await cp(join(root, file), join(temp, file), {
    recursive: true,
    filter: path => !path.split("/").some(p => ["node_modules", "dist", ".local"].includes(p)) && !path.endsWith(".tsbuildinfo"),
  });
}
await symlink(join(root, "node_modules"), join(temp, "node_modules"));
for (const entry of await readdir(join(root, "lib"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    await symlink(join(root, "lib", entry.name, "node_modules"), join(temp, "lib", entry.name, "node_modules"));
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
const result = spawnSync("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"], {
  cwd: temp, encoding: "utf8", timeout: 180000,
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
async function hashes(dir) {
  const files = {};
  for (const item of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!item.isFile()) continue;
    const path = join(item.parentPath, item.name);
    files[relative(dir, path)] = createHash("sha256").update(await readFile(path)).digest("hex");
  }
  return files;
}
let changes = 0;
for (const pkg of ["api-client-react", "api-zod"]) {
  const path = `lib/${pkg}/src/generated`;
  const before = await hashes(join(root, path));
  const after = await hashes(join(temp, path));
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => before[k] !== after[k]);
  changes += changed.length;
  console.log(`${pkg}: ${changed.length} generated files differ from checked-in output`);
  console.log(changed.slice(0, 20).join("\n"));
}
console.log(`Codegen and generated-library typecheck passed; ${changes} changed files retained only in ${relative(root, temp)}`);
