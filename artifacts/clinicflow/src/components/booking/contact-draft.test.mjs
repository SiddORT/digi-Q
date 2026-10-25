import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("./contact-draft.ts", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "cjs",
});
const mod = { exports: {} };
new Function("module", "exports", bundle.outputFiles[0].text)(mod, mod.exports);
const { resolveContactDraft } = mod.exports;
test("untouched contact accepts saved actor hydration and missing mobile stays blank", () => {
  assert.equal(resolveContactDraft(undefined, "").value, "");
  assert.equal(resolveContactDraft({ value: "", edited: false }, "+919876543210").value, "+919876543210");
});
test("replacement and explicit clearing survive patient selection, identity refresh and returning steps", () => {
  for (const value of ["+14155552671", ""]) {
    const draft = { value, edited: true };
    for (const saved of ["", "+919876543210", "+919876543211"]) {
      assert.equal(resolveContactDraft(draft, saved), draft);
    }
  }
});
