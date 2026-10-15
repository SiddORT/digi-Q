import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let Panel;
before(async () => {
  const result = await build({
    entryPoints: [new URL("./EmailProviderPanel.tsx", import.meta.url).pathname],
    bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic", loader: { ".css": "empty" },
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "@tanstack/react-query"],
    plugins: [{ name: "fictional-email-only", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: "api", namespace: "fixture" }));
      b.onResolve({ filter: /\/ConfirmDialog$|^\.\/ConfirmDialog$/ }, () => ({ path: "confirm", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "confirm"
        ? `export const useConfirm=()=>({dialog:null,ask:async()=>false});`
        : `
          const noWrite=()=>{throw new Error("Unexpected provider call on render")};
          const smtp={ready:true,source:"database",revision:"fictional-rev",
            smtpHost:"smtp.example.invalid",smtpPort:587,fromEmail:"sender@example.invalid",
            fromName:"Fictional Clinic",useTls:true,useSsl:false,notificationsEnabled:false,
            keys:["SMTP_USER","SMTP_PASSWORD"].map(key=>({key,status:"configured"}))};
          export const getGetIntegrationSettingsQueryKey=()=>["fictional-settings"];
          export const useGetIntegrationSettings=()=>({data:{smtp,editable:true},refetch:noWrite,isFetching:false});
          export const useSendSmtpTestEmail=()=>({mutateAsync:noWrite,reset(){}});
          export const useUpdateIntegrationSettings=()=>({mutate:noWrite,reset(){}});
          export const useCheckIntegrationConnection=()=>({mutate:noWrite});
        ` }));
    } }],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, mod, mod.exports);
  Panel = mod.exports.EmailProviderPanel;
});

test("real email panel renders one editor/test flow and manual saved-setting diagnostics without provider calls", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Panel)));
  for (const id of ["panel-email-provider", "input-smtp-host", "button-send-smtp-test", "button-save-smtp-settings", "section-email-diagnostics", "button-check-smtp"]) {
    assert.equal(html.split(`data-testid="${id}"`).length - 1, 1, id);
  }
  assert.match(html, /smtp\.example\.invalid/);
  assert.match(html, /encrypted website settings/);
  assert.match(html, /SMTP_PASSWORD<\/code>: configured/);
  assert.match(html, /Password is configured/);
  assert.match(html, /Username is configured/);
  assert.match(html, /not unsaved edits/);
  assert.match(html, /does not confirm sender permission or inbox delivery/);
  assert.doesNotMatch(html, /input-smtp-password|input-smtp-user|list-check-smtp/);
  // The saved optional gate remains off; rendering must not turn it on.
  assert.doesNotMatch(html.match(/<input[^>]*data-testid="checkbox-email-enabled"[^>]*>/)?.[0] || "", /checked/);
  client.clear();
});
