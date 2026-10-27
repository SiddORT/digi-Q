import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
let render;
before(async () => {
  const bundle = await build({
    stdin: { resolveDir: import.meta.dirname, contents: `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { AppointmentHistoryPanel } from "./AppointmentHistoryPanel";
      export const render = history => renderToStaticMarkup(createElement(AppointmentHistoryPanel, {
        appointment: { id: "fictional", timezone: "UTC" }, history, loading: false, error: null, retry() {}
      }));
    ` },
    bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic",
    loader: { ".css": "empty" },
    external: ["react", "react-dom/server", "react/jsx-runtime"],
    plugins: [{
      name: "isolate-history-resources",
      setup(builder) {
        builder.onResolve({ filter: /\/resources$/ }, () => ({ path: "resources", namespace: "history-test" }));
        builder.onLoad({ filter: /.*/, namespace: "history-test" }, () => ({
          contents: `export const title = s => s; export const ErrorNotice = () => null;`, loader: "js",
        }));
      },
    }],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", bundle.outputFiles[0].text)(module, module.exports, require);
  render = module.exports.render;
});
const event = (from, to) => [{ status: "waiting", action: "reschedule", occurredAt: "2030-01-07T11:00:00Z", from, to }];

test("private History renders recorded names on both sides and identifies missing legacy names without current-visit fallback", () => {
  const html = render(event(
    { doctorName: "Original doctor", branchName: "Original location", date: "2030-01-06", startTime: "09:00", timezone: "UTC" },
    { doctorName: "Destination doctor", branchName: "Destination location", date: "2030-01-07", startTime: "13:00", timezone: "UTC" },
  ));
  for (const name of ["Original doctor", "Original location", "Destination doctor", "Destination location"])
    assert.ok(html.includes(`${name} (name recorded at move)`));
  const legacy = render(event({ date: "2030-01-06", startTime: "09:00" }, { date: "2030-01-07" }));
  assert.match(legacy, /Doctor name not recorded/);
  assert.match(legacy, /Location name not recorded/);
  assert.match(legacy, /original timezone not recorded/);
  assert.doesNotMatch(legacy, /name recorded at move/);
});

test("removed doctors override stale names, partial snapshots remain honest and React escapes labels", () => {
  const html = render(event(
    { deletedDoctor: true, doctorName: "Must not be revived", branchName: "Preserved location", date: "2030-01-06" },
    { doctorName: "<script>untrusted</script>", branchName: "A & B" },
  ));
  assert.match(html, /Removed doctor/);
  assert.doesNotMatch(html, /Must not be revived|<script>/);
  assert.match(html, /&lt;script&gt;untrusted/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /Date not recorded/);
  assert.match(render(event(undefined, { date: "2030-01-07" })), /Previous visit not recorded/);
});
