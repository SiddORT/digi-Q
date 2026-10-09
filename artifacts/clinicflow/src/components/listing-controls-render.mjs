// Render the real shared header, including its children, without matching JSX
// spelling. Interactive geometry/drawer behavior belongs to the browser check.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { unlink } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const output = new URL(`../../.listing-controls-test-${process.pid}.mjs`, import.meta.url);
let controls;
try {
  await build({
    entryPoints: [fileURLToPath(new URL("./ListingControls.tsx", import.meta.url))],
    outfile: fileURLToPath(output),
    bundle: true, platform: "node", format: "esm", packages: "external",
    jsx: "automatic", loader: { ".css": "empty" },
    alias: { "@": fileURLToPath(new URL("../", import.meta.url)) },
  });
  controls = await import(output.href);
} finally {
  await unlink(output).catch(error => { if (error.code !== "ENOENT") throw error; });
}

export function renderFilterBar(props = {}, pageTitle = false) {
  const header = createElement(controls.FilterBar, props);
  return renderToStaticMarkup(pageTitle
    ? createElement(controls.ListPageTitleContext.Provider, {
      value: { title: "Appointments", owner: { current: null } },
    }, header)
    : header);
}
