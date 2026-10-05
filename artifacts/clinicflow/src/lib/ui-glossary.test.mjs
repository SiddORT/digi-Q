import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const glossary = [...readFileSync(new URL("./ui-glossary.ts", import.meta.url), "utf8").matchAll(/"([^"]+)"/g)].map(m => m[1]).filter(t => /^[A-Z]/.test(t));
const files = [];
(function walk(dir) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (n !== "ui") walk(p); } else if (p.endsWith(".tsx")) files.push(p); } })(root);

// Labels only: a JSX text node or a string literal that is exactly the phrase (plus an optional ellipsis).
test("static labels use the glossary casing for every known action phrase", () => {
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const term of glossary) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const m of src.matchAll(new RegExp(`(?:>\\s*|"|')(${esc})(?:…)?(?:\\s*<|"|')`, "gi"))) if (m[1] !== term) bad.push(`${f.replace(root, "")}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});
