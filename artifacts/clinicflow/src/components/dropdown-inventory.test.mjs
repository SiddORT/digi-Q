import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const inventory = readFileSync(new URL("../../dropdown-readiness-coverage.md", import.meta.url), "utf8");
function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "ui") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith(".tsx") ? [path] : [];
  });
}
test("all app selector consumers are accounted for in the screen/role readiness inventory", () => {
  const consumers = sources(root).filter(path =>
    /<(?:select|[A-Za-z]*Select|[A-Za-z]*Lookup|SuggestionInput)\b/.test(readFileSync(path, "utf8")));
  assert.ok(consumers.length > 40, "do not accidentally reduce inventory to the original six modules");
  for (const path of consumers) assert.ok(inventory.includes(`\`${relative(root, path)}\``),
    `Account for ${relative(root, path)} and its roles, scope and mount boundary`);
});
