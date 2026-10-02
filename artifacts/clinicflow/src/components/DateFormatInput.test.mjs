import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const bundle = new URL(`../../.date-format-input-test-${process.pid}.mjs`, import.meta.url);
let controls;
before(async () => {
  await build({
    entryPoints: [fileURLToPath(new URL("./DateFormatInput.tsx", import.meta.url))],
    outfile: fileURLToPath(bundle), bundle: true, platform: "node", format: "esm",
    packages: "external", jsx: "automatic",
  });
  controls = await import(bundle.href);
});
after(async () => { await unlink(bundle).catch(() => {}); });

test("date and time inputs preserve external invalid state and error descriptions", () => {
  for (const [name, value] of [["DateFormatInput", "2026-09-30"], ["TimeFormatInput", "09:00"]]) {
    for (const invalid of [true, "true", "grammar"]) {
      const html = renderToStaticMarkup(createElement(controls[name], {
        value, onChange() {}, "aria-invalid": invalid, "aria-describedby": "external-error hint",
      }));
      assert.ok(html.includes(`aria-invalid="${invalid}"`));
      assert.ok(html.includes('aria-describedby="external-error hint"'));
    }
  }
});
test("internal parser errors override external false and append their linked description", () => {
  for (const name of ["DateFormatInput", "TimeFormatInput"]) {
    const html = renderToStaticMarkup(createElement(controls[name], {
      value: "invalid", onChange() {}, "aria-invalid": false, "aria-describedby": "external-error",
    }));
    assert.ok(html.includes('aria-invalid="true"'));
    const descriptions = /aria-describedby="([^"]+)"/.exec(html)[1].split(" ");
    assert.equal(descriptions[0], "external-error");
    assert.equal(descriptions.length, 2);
    assert.ok(html.includes(`id="${descriptions[1]}"`));
  }
});