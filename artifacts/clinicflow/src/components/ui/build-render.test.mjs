import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let ui;

before(async () => {
  const result = await build({
    stdin: {
      contents: `export * from "./command"; export * from "./label"; export * from "./tooltip";`,
      resolveDir: new URL(".", import.meta.url).pathname,
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    tsconfig: new URL("../../../tsconfig.json", import.meta.url).pathname,
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime"],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    require, module, module.exports,
  );
  ui = module.exports;
});

test("command keeps its input, list semantics and utility styling", () => {
  const html = renderToStaticMarkup(
    h(ui.Command, null,
      h(ui.CommandInput, { placeholder: "Find a clinic", "aria-label": "Clinic search" }),
      h(ui.CommandList, null, h(ui.CommandEmpty, null, "No clinics found")),
    ),
  );
  assert.match(html, /role="combobox"/);
  assert.match(html, /role="listbox"/);
  assert.match(html, /Find a clinic/);
  assert.match(html, /No clinics found/);
  assert.match(html, /flex h-full w-full flex-col/);
});

test("label keeps its field association, visible text and disabled styling", () => {
  const html = renderToStaticMarkup(h(ui.Label, { htmlFor: "clinic-name" }, "Clinic name"));
  assert.match(html, /<label/);
  assert.match(html, /for="clinic-name"/);
  assert.match(html, /Clinic name/);
  assert.match(html, /peer-disabled:opacity-70/);
});

test("tooltip keeps its accessible trigger without adding closed content", () => {
  const html = renderToStaticMarkup(
    h(ui.TooltipProvider, null,
      h(ui.Tooltip, null,
        h(ui.TooltipTrigger, { "aria-label": "More information" }, "Help"),
        h(ui.TooltipContent, null, "Clinic help"),
      ),
    ),
  );
  assert.match(html, /<button/);
  assert.match(html, /aria-label="More information"/);
  assert.match(html, /data-state="closed"/);
  assert.doesNotMatch(html, /Clinic help/);
});
