import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let render, configure, queryOptions;
before(async () => {
  const result = await build({
    stdin: { resolveDir: import.meta.dirname, contents: `
      import { renderToStaticMarkup } from "react-dom/server";
      import { createElement } from "react";
      import { BookingMailOutcomes } from "./BookingMailOutcomes";
      import { configure, options } from "@workspace/api-client-react";
      export { configure, options };
      export const render = () => renderToStaticMarkup(createElement(BookingMailOutcomes, { clinicId: "clinic-a", actorId: "owner-a" }));` },
    bundle: true, platform: "node", format: "cjs", write: false, jsx: "automatic",
    external: ["react", "react-dom/server", "react/jsx-runtime"],
    plugins: [{ name: "safe-query-fixture", setup(b) {
      b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: "query", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
        let state = {};
        let latest;
        export const configure = value => { state = value; };
        export const options = () => latest;
        export const getListBookingMailOutcomesQueryKey = params => ["/api/management/booking-mail-outcomes", params];
        export const useListBookingMailOutcomes = (params, options) => { latest = { params, options }; return { refetch() {}, ...state }; };
      ` }));
    } }],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const exports = module.exports;
  render = exports.render; configure = exports.configure; queryOptions = exports.options;
});

test("every recorded status is visible and unconfirmed dispatch never promises delivery or resend", () => {
  const states = ["pending", "sending", "delivery_unknown", "provider_accepted", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient", "unknown"];
  configure({ data: { items: states.map(status => ({ reference: `REF-${status}`, status, createdAt: 1700000000000 })), hasMore: true } });
  const html = render();
  for (const reference of states) assert.ok(html.includes(`REF-${reference}`));
  for (const phrase of ["outcome unconfirmed", "not automatically resent", "inbox delivery is not confirmed", "Email unavailable", "Preparation failed", "No valid recipient", "Status unavailable"])
    assert.ok(html.includes(phrase), phrase);
  assert.ok(html.includes("Refresh status"));
  assert.ok(html.includes("Previous") && html.includes("Next"));
  assert.equal((html.match(/<li>/g) || []).length, states.length);
  const { params, options } = queryOptions();
  assert.deepEqual(params, { clinicId: "clinic-a", page: 1, pageSize: 20 });
  assert.equal(options.query.queryKey.at(-1), "owner-a");
  assert.equal(options.query.refetchOnMount, "always");
  assert.equal(options.query.refetchInterval, 30000);
});

test("loading, empty and denied/error states do not misrepresent delivery or retain stale outcomes", () => {
  configure({ isLoading: true });
  assert.match(render(), /Loading booking email outcomes/);
  configure({ data: { items: [], hasMore: false } });
  assert.match(render(), /empty list is not proof of delivery/);
  configure({ isError: true, data: { items: [{ reference: "STALE-OTHER-CLINIC", status: "pending", createdAt: null }], hasMore: false } });
  const denied = render();
  assert.match(denied, /role="alert"/);
  assert.doesNotMatch(denied, /STALE-OTHER-CLINIC/);
});

test("references are escaped, null values are explicit, and owner/clinic switches remount the panel", () => {
  configure({ data: { items: [
    { reference: "<script>alert(1)</script>", status: "sending", createdAt: null },
    { reference: null, status: "unknown", createdAt: null },
  ], hasMore: false } });
  const html = render();
  assert.ok(html.includes("&lt;script&gt;"));
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Ref Unavailable/);
  assert.match(html, /Recorded time unavailable/);
  const ownerUI = readFileSync(new URL("./EmailTemplates.tsx", import.meta.url), "utf8");
  assert.match(ownerUI, /identity\.user\?\.role === "clinicAdmin" && clinicId && <BookingMailOutcomes/);
  assert.ok(ownerUI.includes('key={`${identity.user.id}:${clinicId}`}'));
});
