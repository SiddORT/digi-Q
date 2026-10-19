import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let Component;
before(async () => {
  const result = await build({
    entryPoints: [new URL("./SmtpTestReceipt.tsx", import.meta.url).pathname],
    bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic",
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "@tanstack/react-query"],
    plugins: [{ name: "receipt-read-fixture", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: "api", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        export const getGetSmtpTestReceiptQueryKey=()=>["receipt"];
        export const useGetSmtpTestReceipt=()=>globalThis.smtpReceiptView;
        export const useConfirmSmtpTestReceipt=()=>({mutate(){throw Error("Rendering must not confirm or send");}});
      ` }));
    } }],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, mod, mod.exports);
  Component = mod.exports.SmtpTestReceipt;
});
const tracked = { requestId: "fictional", sentAt: "2026-10-19T12:00:00.000Z", status: "provider_accepted", currentConfiguration: true, receivedAt: null };
function render(view) {
  globalThis.smtpReceiptView = view;
  const client = new QueryClient();
  try { return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Component))); }
  finally { client.clear(); delete globalThis.smtpReceiptView; }
}
test("accepted test offers explicit manual receipt without sending", () => {
  const html = render({ data: { test: tracked } });
  assert.match(html, /I received the test email/);
  assert.match(html, /does not automatically verify inbox delivery/);
});
test("saved receipt displays server timestamp without automatic-delivery claims", () => {
  const html = render({ data: { test: { ...tracked, receivedAt: "2026-10-19T12:05:00.000Z" } } });
  assert.match(html, /User-confirmed received/);
  assert.match(html, /2026-10-19T12:05:00.000Z/);
  assert.doesNotMatch(html, /button-confirm-smtp-received/);
});
test("old settings and failed or unfinished tests cannot offer confirmation", () => {
  for (const extra of [{ currentConfiguration: false }, { status: "provider_rejected" }, { status: "sending" }]) {
    const html = render({ data: { test: { ...tracked, ...extra } } });
    assert.doesNotMatch(html, /button-confirm-smtp-received/);
  }
});
test("empty, loading and read-error states are explicit", () => {
  assert.match(render({ data: { test: null } }), /No tracked test email yet/);
  assert.match(render({ isLoading: true }), /Loading receipt status/);
  assert.match(render({ isError: true }), /Receipt status is unavailable/);
});
